import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";
const OUT = process.env.REMI_SHOTS_DIR || "./.data/shots";
mkdirSync(OUT, { recursive: true });
const CHROME = process.env.CHROME_PATH || "/usr/bin/chromium";
const B = process.env.REMI_BASE_URL || "http://localhost:3000";
const rid = Math.random().toString(36).slice(2, 7);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function clickText(p, t, exact = false) { await p.evaluate((t, ex) => { const e = [...document.querySelectorAll("button,a")].find((x) => ex ? x.textContent.trim() === t : x.textContent.trim().includes(t)); if (!e) throw new Error("no: " + t); e.click(); }, t, exact); }
async function waitText(p, t, ms = 20000) { await p.waitForFunction((t) => document.body.innerText.toLowerCase().includes(t.toLowerCase()), { timeout: ms }, t); }

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox", "--disable-gpu"] });
try {
  // ---- BANK decisioning console ----
  const bank = await browser.newPage();
  await bank.setViewport({ width: 1300, height: 1700 });
  await bank.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await bank.goto(`${B}/bank`, { waitUntil: "networkidle0" });
  await bank.waitForSelector(".inp");
  await clickText(bank, "Register bank");
  await bank.waitForFunction(() => document.querySelectorAll(".inp").length >= 3);
  let bi = await bank.$$(".inp");
  await bi[0].type("First Bank of Nigeria");
  await bi[1].type("officer_" + rid);
  await bi[2].type("bankpass1");
  await bank.evaluate(() => [...document.querySelectorAll("button")].find((e) => e.textContent.trim() === "Register").click());
  await waitText(bank, "Loan decisioning");
  await clickText(bank, "Seed demo applicants");
  await waitText(bank, "suggested", 25000);
  await sleep(800);
  await bank.screenshot({ path: `${OUT}/remi-bank-console.png` });
  console.log("bank console screenshot");

  // ---- WALLET with fraud loop + betting + dropdowns ----
  const w = await browser.newPage();
  await w.setViewport({ width: 1100, height: 1700 });
  await w.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await w.goto(`${B}/wallet/opay`, { waitUntil: "networkidle0" });
  await w.waitForSelector(".inp");
  let wi = await w.$$(".inp");
  await wi[0].type("Demo User");
  await wi[1].type("8090" + rid);
  await wi[2].type("opaypass");
  await w.select("select.inp", "gig");
  await w.$$eval('input[type="checkbox"]', (els) => els[0] && els[0].click()); // seed fraud loop
  await clickText(w, "Open OPay account");
  await waitText(w, "Move money");
  // Pay a betting biller to trigger the AI fraud alert
  await clickText(w, "Pay bill");
  await w.waitForSelector("select.inp");
  await w.select("select.inp", "betking");
  await w.waitForSelector('input[type="number"]');
  await w.type('input[type="number"]', "60000");
  await clickText(w, "Confirm");
  await waitText(w, "fraud & risk alert", 12000).catch(() => {});
  await sleep(600);
  await w.screenshot({ path: `${OUT}/remi-wallet-fraud.png` });
  console.log("wallet fraud screenshot");
  console.log("ALL GOOD");
} catch (e) {
  console.error("FAILED:", e.message);
} finally { await browser.close(); }
