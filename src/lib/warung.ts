import * as React from "react";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

// Bridge Tahap 1: cookie "kring_warung" + fallback warung pertama.
// Tahap 2 mengganti dengan session login (aturan #8: warungId TIDAK PERNAH dari body/query/header).
function memoize<Args extends unknown[], Return>(
  fn: (...args: Args) => Promise<Return>
): (...args: Args) => Promise<Return> {
  if (typeof React.cache === "function") {
    return React.cache(fn);
  }
  return fn;
}

export const currentWarungId = memoize(async (): Promise<string> => {
  let cookieWarungId: string | undefined;
  try {
    const cookieStore = cookies();
    cookieWarungId = cookieStore.get("kring_warung")?.value;
  } catch {
    // Di luar request context (e.g. build / script)
  }

  if (cookieWarungId) {
    const exists = await prisma.warung.findUnique({
      where: { id: cookieWarungId },
      select: { id: true },
    });
    if (exists) return exists.id;
  }

  const fallback = await prisma.warung.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (!fallback) {
    throw new Error("Jalankan seed dulu: tidak ada warung di database.");
  }

  return fallback.id;
});

export const currentKasirId = memoize(async (warungId?: string): Promise<string> => {
  const wId = warungId ?? (await currentWarungId());
  const kasir = await prisma.user.findFirst({
    where: {
      warungId: wId,
      role: "KASIR",
      aktif: true,
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (!kasir) {
    // Fallback jika tidak ada kasir: ambil user apa pun (owner)
    const anyUser = await prisma.user.findFirst({
      where: { warungId: wId, aktif: true },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (anyUser) return anyUser.id;
    throw new Error(`Tidak ada kasir aktif di warung ${wId}.`);
  }

  return kasir.id;
});

export const currentWarung = memoize(async () => {
  const wId = await currentWarungId();
  const warung = await prisma.warung.findUnique({
    where: { id: wId },
  });
  if (!warung) {
    throw new Error("Jalankan seed dulu: warung tidak ditemukan.");
  }
  return warung;
});
