"use client";
// Tiny client-side fetch helper. Throws on non-2xx with the server's error text.
export async function api<T = any>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, body === undefined ? { method: "GET" } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error || `Request failed (${res.status})`);
  return data as T;
}

export const ngn = (n: number) => "₦" + Math.abs(Math.round(n)).toLocaleString("en-NG");
