import { createHmac, timingSafeEqual } from "node:crypto";
import type { Role } from "@/types";

// Session stateless: payload base64url + tanda tangan HMAC-SHA256.
// Tanpa dependency baru, cukup untuk Next 14 App Router.
// Rahasia diambil dari SESSION_SECRET; di dev ada fallback + peringatan.

export const SESSION_COOKIE = "kring_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 jam — satu shift kerja

export type SessionPayload = {
  uid: string; // User.id
  wid: string; // Warung.id — SATU-SATUNYA sumber warungId (lampiran §2 #8)
  role: Role;
  name: string; // nama tampil (audit + header)
  iat: number; // epoch detik
  exp: number; // epoch detik
};

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  // Dev-only fallback agar `next dev` langsung jalan. Produksi WAJIB set env.
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET wajib diisi di produksi (min. 16 karakter).");
  }
  return "kring-dev-secret-change-me";
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(payloadB64: string): string {
  return createHmac("sha256", secret()).update(payloadB64).digest("base64url");
}

export function issueSession(user: {
  id: string;
  warungId: string;
  role: string;
  name: string;
}): { token: string; maxAge: number } {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    uid: user.id,
    wid: user.warungId,
    role: user.role === "OWNER" ? "OWNER" : "KASIR",
    name: user.name,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };
  const payloadB64 = b64url(JSON.stringify(payload));
  const token = `${payloadB64}.${sign(payloadB64)}`;
  return { token, maxAge: SESSION_TTL_SECONDS };
}

export function verifySession(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payloadB64 = token.slice(0, dot);
  const providedSig = token.slice(dot + 1);
  const expectedSig = sign(payloadB64);

  // Bandingkan konstan-waktu (panjang beda → pasti tidak cocok).
  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let payload: SessionPayload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (
    typeof payload?.uid !== "string" ||
    typeof payload?.wid !== "string" ||
    (payload?.role !== "OWNER" && payload?.role !== "KASIR") ||
    typeof payload?.exp !== "number"
  ) {
    return null;
  }
  if (payload.exp <= Math.floor(Date.now() / 1000)) return null;

  return payload;
}
