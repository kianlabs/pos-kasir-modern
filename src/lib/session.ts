import { createHmac, timingSafeEqual } from "node:crypto";
import { SESSION_COOKIE, type SessionPayload } from "@/lib/auth-session";

// Penandatanganan & verifikasi token session (Node runtime).
// Tipe + nama cookie ada di lib/auth-session.ts agar middleware edge bisa
// mengimpornya tanpa menyeret node:crypto.

export { SESSION_COOKIE };
export type { SessionPayload };

export const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 jam — satu shift kerja

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET wajib diisi di produksi (min. 16 karakter).");
  }
  return "kring-dev-secret-change-me";
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
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return { token: `${payloadB64}.${sign(payloadB64)}`, maxAge: SESSION_TTL_SECONDS };
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
