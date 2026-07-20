"use client";
// Per-tab identity, not per-browser. sessionStorage (unlike a cookie or
// localStorage) is scoped to one tab/window, so a borrower tab and a lender
// tab can be open side by side in the same browser and both operate at once
// — each tab is its own "app" without one stomping the other's identity.
// Still one role per tab at a time (you can't be both within the same view).
// No server round-trip to "sign in" — there's no password, an identity here
// is just a pointer to an id you already picked from a real list.
export type Role = "borrower" | "lender" | "attester" | "wallet";
export interface Identity { role: Role; id: string; name: string }

const KEY = "rep_identity";

export function getIdentity(): Identity | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Identity) : null;
  } catch {
    return null;
  }
}

export function setIdentity(i: Identity) {
  sessionStorage.setItem(KEY, JSON.stringify(i));
}

export function clearIdentity() {
  sessionStorage.removeItem(KEY);
}
