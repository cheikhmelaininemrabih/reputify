"use client";
import { useEffect, useState } from "react";

interface Status {
  network: string; // testnet | mainnet
  mode: "live" | "simulated";
  operatorId: string | null;
  topicId: string | null;
}

export function ChainStatus() {
  const [s, setS] = useState<Status | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/status")
      .then((r) => r.json())
      .then((d) => alive && setS(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!s) return <span className="chainpill sim"><span className="live" />Hedera …</span>;
  const live = s.mode === "live";
  return (
    <span
      className={`chainpill${live ? "" : " sim"}`}
      title={
        live
          ? `Anchoring to Hedera ${s.network}${s.topicId ? ` · topic ${s.topicId}` : ""}`
          : `Simulated anchors — set HEDERA_OPERATOR_ID + HEDERA_OPERATOR_KEY to submit to Hedera ${s.network} for real`
      }
    >
      <span className="live" />
      Hedera {s.network} · {live ? "live" : "sim"}
    </span>
  );
}
