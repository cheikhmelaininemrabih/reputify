"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "./api";

const DOCS = [
  { id: "nin", label: "National ID (NIN)" },
  { id: "bvn", label: "Bank Verification Number (BVN)" },
  { id: "passport", label: "International passport" },
  { id: "drivers_license", label: "Driver's licence" },
];
const STAGES = [
  "Reading document image…",
  "Extracting ID data (OCR / MRZ)…",
  "Matching selfie to document photo…",
  "Screening sanctions & PEP watchlists…",
  "Checking the national identity registry…",
  "Anchoring Verifiable Credential on Hedera…",
];

export function KycFlow({ defaultName, onDone }: { defaultName: string; onDone: () => void }) {
  const [phase, setPhase] = useState<"form" | "verifying" | "checks">("form");
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [fullName, setFullName] = useState(defaultName);
  const [documentType, setDocumentType] = useState("nin");
  const [nationalId, setNationalId] = useState("");
  const [dob, setDob] = useState("1996-05-14");
  const [photo, setPhoto] = useState<string>("");
  const [liveness, setLiveness] = useState<"idle" | "scanning" | "done">("idle");
  const [err, setErr] = useState("");
  const [stage, setStage] = useState(0);
  const [checks, setChecks] = useState<any[]>([]);
  const [reveal, setReveal] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  // Staged verification animation, then reveal the real check results.
  useEffect(() => {
    if (phase !== "verifying") return;
    if (stage < STAGES.length) { const t = setTimeout(() => setStage((s) => s + 1), 620); return () => clearTimeout(t); }
    if (checks.length) setPhase("checks");
  }, [phase, stage, checks]);

  useEffect(() => {
    if (phase !== "checks") return;
    if (reveal < checks.length) { const t = setTimeout(() => setReveal((r) => r + 1), 260); return () => clearTimeout(t); }
    const t = setTimeout(onDone, 1300); return () => clearTimeout(t);
  }, [phase, reveal, checks, onDone]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader(); r.onload = () => setPhoto(String(r.result)); r.readAsDataURL(f);
  }
  function startScan() { setLiveness("scanning"); setTimeout(() => setLiveness("done"), 1900); }

  async function submit() {
    setErr(""); setStage(0); setChecks([]); setReveal(0); setPhase("verifying");
    try {
      const d = await api("/api/remi/kyc", { fullName, nationalId, dob, documentType, livenessPassed: liveness === "done", documentCaptured: !!photo });
      setChecks(d.checks);
    } catch (e: any) { setErr(e.message); setPhase("form"); setStep(4); }
  }

  if (phase === "verifying" || phase === "checks") {
    return (
      <div>
        <div className="label" style={{ marginBottom: 12 }}>Verifying your identity</div>
        {phase === "verifying" ? (
          <ul className="reasons">
            {STAGES.map((s, i) => (
              <li key={i} style={{ opacity: i <= stage ? 1 : 0.4 }}>
                <span className="sign" style={{ background: i < stage ? "#d7e9df" : "var(--surface-2)", color: "var(--green)" }}>{i < stage ? "✓" : i === stage ? "" : ""}</span>
                {i === stage ? <span className="spinner dark" style={{ width: 14, height: 14 }} /> : null}
                <span style={{ fontSize: 14 }}>{s}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div>
            <ul className="reasons">
              {checks.slice(0, reveal).map((c, i) => (
                <li key={i} className="fade"><span className={`sign ${c.passed ? "pos" : "neg"}`}>{c.passed ? "✓" : "✕"}</span><span style={{ flex: 1 }}>{c.name}</span><span className="small muted">{c.detail}</span></li>
              ))}
            </ul>
            {reveal >= checks.length && <div className="clean" style={{ marginTop: 12 }}><span>✓</span><div>Verifiable Credential issued and anchored on Hedera.</div></div>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {[1, 2, 3, 4].map((s) => <span key={s} style={{ height: 4, flex: 1, borderRadius: 3, background: step >= s ? "var(--gold)" : "var(--surface-2)" }} />)}
      </div>

      {step === 1 && (
        <div>
          <div className="label" style={{ marginBottom: 10 }}>Step 1 · Identity document</div>
          <div className="grid2">
            <label><div className="label" style={{ marginBottom: 6 }}>Document type</div><select className="inp" value={documentType} onChange={(e) => setDocumentType(e.target.value)}>{DOCS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</select></label>
            <label><div className="label" style={{ marginBottom: 6 }}>ID number (11 digits)</div><input className="inp" value={nationalId} onChange={(e) => setNationalId(e.target.value)} placeholder="22212345678" /></label>
            <label><div className="label" style={{ marginBottom: 6 }}>Full legal name</div><input className="inp" value={fullName} onChange={(e) => setFullName(e.target.value)} /></label>
            <label><div className="label" style={{ marginBottom: 6 }}>Date of birth</div><input className="inp" type="date" value={dob} onChange={(e) => setDob(e.target.value)} /></label>
          </div>
          <button className="btn gold" style={{ marginTop: 14 }} onClick={() => setStep(2)} disabled={!nationalId || fullName.split(/\s+/).length < 2}>Continue →</button>
        </div>
      )}

      {step === 2 && (
        <div>
          <div className="label" style={{ marginBottom: 10 }}>Step 2 · Upload your document photo</div>
          <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ width: 200, height: 126, borderRadius: 12, border: `2px dashed ${photo ? "var(--green)" : "var(--line-strong)"}`, background: "var(--surface-2)", display: "grid", placeItems: "center", overflow: "hidden" }}>
              {photo ? <img src={photo} alt="document" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 34 }}>🪪</span>}
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <p className="small muted" style={{ marginTop: 0 }}>Snap or upload the photo page of your {DOCS.find((d) => d.id === documentType)?.label}. We read it with OCR and match the face.</p>
              <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn ghost" onClick={() => fileRef.current?.click()}>{photo ? "Replace photo" : "Upload photo"}</button>
                {!photo && <button className="btn ghost" onClick={() => setPhoto(SAMPLE_DOC)}>Use sample document</button>}
              </div>
              {photo && <div className="clean" style={{ marginTop: 10 }}><span>✓</span><div>Document captured.</div></div>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button className="btn ghost" onClick={() => setStep(1)}>← Back</button>
            <button className="btn gold" onClick={() => setStep(3)} disabled={!photo}>Continue →</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <div className="label" style={{ marginBottom: 10 }}>Step 3 · Liveness &amp; face match</div>
          <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ width: 120, height: 120, borderRadius: "50%", border: `3px solid ${liveness === "done" ? "var(--green)" : "var(--gold)"}`, display: "grid", placeItems: "center", fontSize: 44, background: "var(--surface-2)", position: "relative", overflow: "hidden" }}>
              {liveness === "done" ? "🙂" : "👤"}
              {liveness === "scanning" && <span style={{ position: "absolute", left: 0, right: 0, height: 3, background: "var(--gold)", animation: "scan 1.9s linear", top: 0 }} />}
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <p className="small muted" style={{ marginTop: 0 }}>We match a live selfie against your document photo. (Simulated — no camera used.)</p>
              {liveness === "idle" && <button className="btn ghost" onClick={startScan}>Start face scan</button>}
              {liveness === "scanning" && <div className="small" style={{ color: "var(--gold)" }}><span className="spinner dark" /> Scanning… hold still</div>}
              {liveness === "done" && <div className="clean"><span>✓</span><div>Liveness confirmed — face matched the document.</div></div>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button className="btn ghost" onClick={() => setStep(2)}>← Back</button>
            <button className="btn gold" onClick={() => setStep(4)} disabled={liveness !== "done"}>Continue →</button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div>
          <div className="label" style={{ marginBottom: 10 }}>Step 4 · Review &amp; verify</div>
          <div className="anchorbox" style={{ marginBottom: 12 }}>
            <div className="kv"><span className="k">Name</span><span className="v">{fullName}</span></div>
            <div className="kv"><span className="k">Document</span><span className="v">{DOCS.find((d) => d.id === documentType)?.label}</span></div>
            <div className="kv"><span className="k">ID number</span><span className="v">{nationalId}</span></div>
            <div className="kv"><span className="k">Document photo</span><span className="v">uploaded ✓</span></div>
            <div className="kv"><span className="k">Liveness</span><span className="v">confirmed ✓</span></div>
          </div>
          {err && <div className="fraud" style={{ marginBottom: 10 }}><span>⚠</span><div>{err}</div></div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn ghost" onClick={() => setStep(3)}>← Back</button>
            <button className="btn gold" onClick={submit}>Verify identity &amp; anchor credential</button>
          </div>
        </div>
      )}
    </div>
  );
}

// A tiny inline SVG "ID card" so "Use sample document" shows a real preview offline.
const SAMPLE_DOC =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='320' height='202'><rect width='320' height='202' fill='#123'/><rect x='0' y='0' width='320' height='40' fill='#1a936f'/><text x='14' y='26' fill='#fff' font-family='monospace' font-size='15'>FED. REPUBLIC · NIN CARD</text><circle cx='52' cy='110' r='34' fill='#5b6' /><text x='104' y='84' fill='#cde' font-family='monospace' font-size='13'>OKAFOR, AMARA</text><text x='104' y='108' fill='#9ab' font-family='monospace' font-size='11'>NIN 2221•••5678</text><text x='104' y='128' fill='#9ab' font-family='monospace' font-size='11'>DOB 1996-05-14</text><text x='104' y='158' fill='#7a9' font-family='monospace' font-size='10'>&lt;&lt;SPECIMEN&lt;&lt;NOT&lt;REAL&lt;&lt;</text></svg>`
  );
