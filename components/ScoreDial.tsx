"use client";
import { useEffect, useState } from "react";

const COLORS: Record<string, string> = { "Low risk": "#2c7a57", "Medium risk": "#9c6a12", "High risk": "#a5382a" };

export function ScoreDial({ score, band }: { score: number; band: string }) {
  const [shown, setShown] = useState(300);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setShown(score);
      return;
    }
    const start = performance.now();
    const from = 300;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 900);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(from + (score - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  const pct = (Math.min(850, Math.max(300, score)) - 300) / 550;
  const color = COLORS[band] || "#a9761e";
  const R = 52;
  const C = 2 * Math.PI * R;
  const bandClass = band === "Low risk" ? "low" : band === "Medium risk" ? "med" : "high";

  return (
    <div className="dial-wrap">
      <svg width="140" height="140" viewBox="0 0 140 140" aria-label={`Score ${score}`}>
        <circle cx="70" cy="70" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="12" />
        <circle
          cx="70" cy="70" r={R} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - pct)} transform="rotate(-90 70 70)"
          style={{ transition: "stroke-dashoffset .9s cubic-bezier(.2,.7,.2,1)" }}
        />
        <text x="70" y="66" textAnchor="middle" fontFamily="var(--serif)" fontSize="30" fontWeight="600" fill="var(--ink)">{shown}</text>
        <text x="70" y="86" textAnchor="middle" fontFamily="var(--mono)" fontSize="9" letterSpacing="1.5" fill="var(--muted)">300–850</text>
      </svg>
      <div>
        <div className="label">Credit Passport score</div>
        <div className={`band ${bandClass}`} style={{ marginTop: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block" }} />
          {band}
        </div>
      </div>
    </div>
  );
}
