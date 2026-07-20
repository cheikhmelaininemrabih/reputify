"use client";

export function WrongRole({ session, wantRole }: { session: { role: string; name: string }; wantRole: string }) {
  async function signOut() {
    await fetch("/api/rep/session", { method: "DELETE" });
    window.location.reload();
  }
  return (
    <div className="card pad" style={{ maxWidth: 480, margin: "60px auto" }}>
      <h3 style={{ marginTop: 0 }}>You're signed in as a {session.role}</h3>
      <p style={{ color: "var(--muted)" }}>
        <b>{session.name}</b> is currently signed in as a {session.role}. Reputify keeps borrower,
        lender, and attester identities separate — one role per browser session at a time — so
        sign out to continue here as a {wantRole}.
      </p>
      <button className="btn gold" onClick={signOut}>Sign out &amp; continue as {wantRole}</button>
    </div>
  );
}
