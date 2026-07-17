import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";
const OUT = process.env.REMI_SHOTS_DIR || "./.data/shots";
mkdirSync(OUT, { recursive: true });
const CHROME = process.env.CHROME_PATH || "/usr/bin/chromium";
const B = process.env.REMI_BASE_URL || "http://localhost:3000";
const rid = Math.random().toString(36).slice(2, 7);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function clickText(page, text, exact = false) {
  await page.evaluate((t, ex) => {
    const el = [...document.querySelectorAll("button,a")].find((e) => ex ? e.textContent.trim() === t : e.textContent.trim().includes(t));
    if (!el) throw new Error("no element: " + t);
    el.click();
  }, text, exact);
}
async function waitText(page, text, ms = 15000) {
  await page.waitForFunction((t) => document.body.innerText.toLowerCase().includes(t.toLowerCase()), { timeout: ms }, text);
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox", "--disable-gpu"] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 1700, deviceScaleFactor: 1 });
await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);

try {
  // Reputify signup
  await page.goto(`${B}/signup`, { waitUntil: "networkidle0" });
  let inp = await page.$$(".inp");
  await inp[0].type("Amara Okafor");
  await inp[1].type("8012" + rid);
  await inp[2].type("secret123");
  await clickText(page, "Create account");
  await page.waitForFunction(() => location.pathname === "/dashboard", { timeout: 15000 });
  await waitText(page, "Identity document");
  console.log("signed up");

  // KYC — current 4-step flow: document → photo → liveness → review
  // Step 1 · identity document (name/DOB are prefilled; just enter the ID number)
  await page.type('input[placeholder="22212345678"]', "2221" + Math.floor(Math.random() * 9000000 + 1000000));
  await clickText(page, "Continue");
  await waitText(page, "Upload your document photo");
  // Step 2 · document photo
  await clickText(page, "Use sample document");
  await waitText(page, "Document captured");
  await clickText(page, "Continue");
  await waitText(page, "Liveness");
  // Step 3 · liveness & face match
  await clickText(page, "Start face scan");
  await waitText(page, "Liveness confirmed");
  await clickText(page, "Continue");
  await waitText(page, "Review");
  // Step 4 · review, then verify + anchor the credential
  await clickText(page, "Verify identity");
  await waitText(page, "Verifiable Credential", 25000);
  await waitText(page, "Identity verified", 25000).catch(() => {});
  console.log("kyc verified (4-step)");

  // Connect OPay
  await waitText(page, "Connect OPay", 15000);
  await clickText(page, "Connect OPay");
  await page.waitForFunction(() => location.pathname.includes("/wallet/opay"), { timeout: 15000 });
  await page.waitForSelector(".inp", { timeout: 15000 });
  inp = await page.$$(".inp");
  await inp[0].type("Amara Okafor");
  await inp[1].type("8090" + rid);
  await inp[2].type("opaypass");
  await clickText(page, "Open OPay account");
  await waitText(page, "Move money");
  console.log("wallet opened");

  // Build a transaction history: income in, then betting spend to trip the risk engine
  async function addMoney(amount) {
    await clickText(page, "Add money");
    await page.waitForSelector('input[type="number"]', { timeout: 8000 });
    await page.type('input[type="number"]', String(amount));
    await clickText(page, "Confirm");
    await sleep(800);
  }
  async function payBetting(billerValue, amount) {
    await clickText(page, "Pay bill");
    await page.waitForSelector("select", { timeout: 8000 });
    await page.select("select", billerValue);
    await page.waitForSelector('input[type="number"]', { timeout: 8000 });
    await page.type('input[type="number"]', String(amount));
    await clickText(page, "Confirm");
    await sleep(800);
  }
  await addMoney(200000);
  await payBetting("betking", 60000);
  await payBetting("sporty", 50000);
  await sleep(500);
  await page.screenshot({ path: `${OUT}/remi-wallet.png` });
  console.log("wallet transactions + fraud panel screenshot");

  // Authorize Reputify
  await clickText(page, "Authorize Reputify");
  await page.waitForFunction(() => location.pathname === "/dashboard", { timeout: 15000 });
  await waitText(page, "Linked");
  // Passport
  await clickText(page, "Build Passport");
  await waitText(page, "Why this score");
  await sleep(500);
  await page.screenshot({ path: `${OUT}/remi-dash2.png` });
  // Consent
  await clickText(page, "Grant consent");
  await waitText(page, "Hand this consent");
  const consentId = await page.evaluate(() => [...document.querySelectorAll("code")].map((e) => e.textContent).find((t) => t && t.startsWith("cn_")));
  console.log("passport + consent:", consentId);

  // Bank
  const bank = await browser.newPage();
  await bank.setViewport({ width: 1280, height: 1300 });
  await bank.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await bank.goto(`${B}/bank`, { waitUntil: "networkidle0" });
  await bank.waitForSelector(".inp", { timeout: 15000 });
  await clickText(bank, "Register bank");
  await bank.waitForFunction(() => document.querySelectorAll(".inp").length >= 3, { timeout: 15000 });
  let binp = await bank.$$(".inp");
  await binp[0].type("First Bank of Nigeria");
  await binp[1].type("officer_" + rid);
  await binp[2].type("bankpass1");
  await bank.evaluate(() => [...document.querySelectorAll("button")].find((e) => e.textContent.trim() === "Register").click());
  await waitText(bank, "Loan decisioning");
  // The borrower who just granted consent appears in the lender's applicant pool.
  await waitText(bank, "Amara", 15000);
  await sleep(500);
  await bank.screenshot({ path: `${OUT}/remi-bank2.png` });
  // The lender makes the call — approve the first pending applicant.
  await clickText(bank, "Approve").catch(() => {});
  await sleep(900);
  console.log("bank: applicant pool loaded + decision made");
  console.log("ALL GOOD");
} catch (e) {
  console.error("FAILED:", e.message);
  await page.screenshot({ path: `${OUT}/remi-err2.png` }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
