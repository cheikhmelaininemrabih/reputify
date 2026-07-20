// Acceptance / demo scenarios (roadmap §12). Drives the /api/rep API end-to-end
// against a running dev server. Each scenario doubles as an acceptance test.
// Run: `npm run dev` in one terminal, then `npm run scenarios`.
// Prints "ALL SCENARIOS PASS" and exits 0 on success (mirrors the existing e2e).
const BASE = process.env.REP_BASE_URL || "http://localhost:3000";

let passed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`   ✓ ${msg}`); }
  else { console.error(`   ✗ ${msg}`); throw new Error(`assertion failed: ${msg}`); }
}
async function j(path, body) {
  const res = await fetch(BASE + path, body === undefined
    ? { method: "GET" }
    : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}
const bondOf = async (address) =>
  (await j("/api/rep/state")).data.attesters.find((a) => a.address === address)?.bond ?? 0;

// A trivial 1x1 PNG — the KYC route trusts the client-computed face-descriptor
// distance (it can't re-run a browser face model server-side), so headless
// scenarios don't need a real camera/photo, just a distance under the threshold.
const TINY_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

async function seedBorrower(name, personhoodId, provider = "OPay", fabricate = false) {
  const b = (await j("/api/rep/borrowers", { name, phone: `+234${Math.floor(Math.random() * 1e9)}`, personhoodId })).data.borrower;
  await j(`/api/rep/borrowers/${b.id}/kyc`, { idImageBase64: TINY_PNG, selfieImageBase64: TINY_PNG, distance: 0.1 });
  const conn = (await j(`/api/rep/borrowers/${b.id}/connections`, { provider })).data.connection;
  // Approving is a separate app now — only a wallet can authorize a connection.
  const wallet = (await j("/api/rep/wallets", { provider, phone: `+234${Math.floor(Math.random() * 1e9)}`, name: `${name} ${provider} wallet` })).data.wallet;
  await j(`/api/rep/wallets/${wallet.id}/authorize`, { connectionId: conn.id });
  const mint = (await j(`/api/rep/borrowers/${b.id}/mint`, { months: 6, fabricate })).data;
  return { borrower: b, seqs: mint.seqs };
}
async function disclose(borrowerId, lenderId) {
  await j("/api/rep/lenders/subscribe", { lenderId });
  const req = (await j("/api/rep/disclosures", { borrowerId, lenderId })).data.disclosure;
  await j(`/api/rep/disclosures/${req.id}`, { allow: true });
}

async function main() {
  console.log(`\nReputify acceptance scenarios → ${BASE}\n`);
  await j("/api/rep/state", { reset: true });

  // ── 1. Clean repayer ──────────────────────────────────────────────────────
  console.log("1. Clean repayer");
  {
    const { borrower, seqs } = await seedBorrower("Amara (clean)", "NIN-1001");
    assert(seqs.length === 6, "6 attestations minted from connected provider");
    await disclose(borrower.id, "LenderHub");
    const view = (await j(`/api/rep/lenders/borrowers/${borrower.id}?lenderId=LenderHub`)).data;
    assert(view.granularAllowed && view.verified, "lender sees Verified ✓ granular packages");
    const loan = (await j("/api/rep/loans", { lender: "LenderHub", borrower: borrower.id, principal: 150000, dueAt: new Date(Date.now() + 30 * 864e5).toISOString(), reliedOn: seqs })).data.loan;
    assert(loan.reliedOn.length === 6, "loan records the relied-on attestation seq numbers");
    const repaid = (await j(`/api/rep/loans/${loan.loanId}`, { action: "repaid", by: "LenderHub" })).data.loan;
    assert(repaid.state === "Repaid", "loan marked repaid");
    const rep = (await j(`/api/rep/borrowers/${borrower.id}/reputation`)).data.reputation;
    assert(rep.loansRepaid === 1, "reputation improves — 1 loan repaid on record");
  }

  // ── 2. Honest default ─────────────────────────────────────────────────────
  console.log("2. Honest default (truthful attestation, loan defaults)");
  {
    const { borrower, seqs } = await seedBorrower("Ngozi (honest)", "NIN-1002");
    await disclose(borrower.id, "LenderHub");
    const loan = (await j("/api/rep/loans", { lender: "LenderHub", borrower: borrower.id, principal: 120000, dueAt: new Date(Date.now() + 30 * 864e5).toISOString(), reliedOn: seqs })).data.loan;
    await j(`/api/rep/loans/${loan.loanId}`, { action: "defaulted", by: "LenderHub" });
    const state = (await j("/api/rep/state")).data;
    const attester = state.attesters[0];
    const bondBefore = attester.bond;
    const ch = (await j("/api/rep/disputes", { loanId: loan.loanId, attestationSeq: seqs[0], evidenceURI: "ipfs://evidence-honest" })).data.challenge;
    const ruled = (await j(`/api/rep/disputes/${ch.challengeId}`, { upheld: false })).data.challenge;
    assert(ruled.ruled && ruled.upheld === false, "challenge NOT upheld (honest default)");
    assert((await bondOf(attester.address)) === bondBefore, "attester NOT slashed — bond unchanged");
  }

  // ── 3. Fraudulent attestation ─────────────────────────────────────────────
  console.log("3. Fraudulent attestation (fabricated cash flow)");
  {
    const { borrower, seqs } = await seedBorrower("Tunde (fraud)", "NIN-1003", "PalmPay", true);
    await disclose(borrower.id, "LenderHub");
    const loan = (await j("/api/rep/loans", { lender: "LenderHub", borrower: borrower.id, principal: 400000, dueAt: new Date(Date.now() + 30 * 864e5).toISOString(), reliedOn: seqs })).data.loan;
    await j(`/api/rep/loans/${loan.loanId}`, { action: "defaulted", by: "LenderHub" });
    const attester = (await j("/api/rep/state")).data.attesters[0];
    const bondBefore = await bondOf(attester.address);
    const ch = (await j("/api/rep/disputes", { loanId: loan.loanId, attestationSeq: seqs[0], evidenceURI: "ipfs://evidence-fraud" })).data.challenge;
    const ruled = (await j(`/api/rep/disputes/${ch.challengeId}`, { upheld: true })).data.challenge;
    assert(ruled.upheld === true && ruled.slashed > 0, `challenge upheld — attester slashed ${ruled.slashed}`);
    assert((await bondOf(attester.address)) < bondBefore, "attester bond reduced (lender partially compensated)");
  }

  // ── 4. Sybil attempt ──────────────────────────────────────────────────────
  console.log("4. Sybil attempt (re-onboard as a fresh identity)");
  {
    const dup = await j("/api/rep/borrowers", { name: "Amara again", phone: "+2340000", personhoodId: "NIN-1001" });
    assert(!dup.ok && dup.status === 400, "re-onboarding an enrolled person is blocked");
    assert(/enrolled/i.test(dup.data.error || ""), "block reason = personhood binding");
  }

  console.log(`\nALL SCENARIOS PASS (${passed} assertions)\n`);
}

main().catch((e) => { console.error("\nSCENARIO FAILURE:", e.message, "\n"); process.exit(1); });
