import type { Role } from "@/types";

// Tipe bersama untuk token session. Dipisah dari lib/session.ts (yang memakai
// node:crypto) supaya middleware edge bisa mengimpornya tanpa ikut menyeret
// modul Node. Verifikasi & penandatanganan tetap di lib/session.ts.

export const SESSION_COOKIE = "kring_session";

export type SessionPayload = {
  uid: string; // User.id
  wid: string; // Warung.id — SATU-SATUNYA sumber warungId (lampiran §2 #8)
  role: Role;
  name: string; // nama tampil (audit + header)
  iat: number; // epoch detik
  exp: number; // epoch detik
};
