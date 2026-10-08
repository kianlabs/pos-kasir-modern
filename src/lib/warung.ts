import * as React from "react";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, verifySession, type SessionPayload } from "@/lib/session";

// Tenant SELALU dari session login (lampiran skema §2 aturan #8):
// warungId tidak pernah diterima dari body/query/header.

function memoize<Args extends unknown[], Return>(
  fn: (...args: Args) => Promise<Return>
): (...args: Args) => Promise<Return> {
  if (typeof React.cache === "function") {
    return React.cache(fn);
  }
  return fn;
}

// Sesi mentah dari cookie. null = belum login / token tidak valid.
export const getSession = memoize(async (): Promise<SessionPayload | null> => {
  let token: string | undefined;
  try {
    token = cookies().get(SESSION_COOKIE)?.value;
  } catch {
    // Di luar request context (build / script)
    return null;
  }
  return verifySession(token);
});

// Dipakai di route API: bawa objek { status, message } agar bisa langsung
// dijadikan respons 401 tanpa lempar exception.
export async function requireSession(): Promise<
  { ok: true; session: SessionPayload } | { ok: false; message: string }
> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Belum login." };
  return { ok: true, session };
}

// warungId turunan session — satu-satunya pintu masuk tenant.
export const currentWarungId = memoize(async (): Promise<string> => {
  const session = await getSession();
  if (!session) throw new Error("Tidak ada session. Login dulu.");
  return session.wid;
});

// Kasir/user yang sedang login (untuk audit: siapa).
export const currentKasirId = memoize(async (warungId?: string): Promise<string> => {
  const session = await getSession();
  if (!session) throw new Error("Tidak ada session. Login dulu.");
  const wId = warungId ?? session.wid;

  // Validasi user masih ada, aktif, dan berada di warung yang sama.
  const user = await prisma.user.findFirst({
    where: { id: session.uid, warungId: wId, aktif: true },
    select: { id: true },
  });
  if (!user) throw new Error("User tidak aktif atau tidak ditemukan.");
  return user.id;
});

export const currentWarung = memoize(async () => {
  const wId = await currentWarungId();
  const warung = await prisma.warung.findUnique({ where: { id: wId } });
  if (!warung) throw new Error("Warung tidak ditemukan.");
  return warung;
});

// Cek role: return false bila bukan salah satu role yang diizinkan.
export function hasRole(session: SessionPayload | null, ...roles: string[]): boolean {
  return !!session && roles.includes(session.role);
}
