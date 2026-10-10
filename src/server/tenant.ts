import * as React from "react";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { SESSION_COOKIE, type SessionPayload } from "@/shared/session-types";
import { verifySession } from "@/server/session";

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
    token = (await cookies()).get(SESSION_COOKIE)?.value;
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

// Gate role untuk route API: kembalikan respons siap-pakai bila tidak berhak,
// atau null bila boleh lanjut. Dipakai sebelum menyentuh Prisma.
export async function requireOwnerResponse(): Promise<ReturnType<typeof NextResponse.json> | null> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Belum login." }, { status: 401 });
  }
  if (session.role !== "OWNER") {
    return NextResponse.json({ error: "Akses khusus owner." }, { status: 403 });
  }
  return null;
}
