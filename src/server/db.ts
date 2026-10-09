import { PrismaClient } from "@prisma/client";

// ── Koneksi DB: kenapa session/direct (5432), bukan pooled 6543 ──────────
//
// Aplikasi ini memakai INTERACTIVE TRANSACTION (lihat `transaksi()` di bawah →
// `prisma.$transaction(async (tx) => ...)`). Interactive transaction butuh SATU
// koneksi yang di-pin selama transaksi berlangsung.
//
// Supabase DATABASE_URL menunjuk PgBouncer mode *transaction* (port 6543,
// `?pgbouncer=true`). Di mode itu backend dipindah-pindah tiap statement →
// transaksi interaktif tidak andal (rawan P2028 "Transaction already closed",
// prepared statement & `SET` bisa bocor antar-query). Karena itu runtime
// diarahkan eksplisit ke koneksi session/direct (port 5432) via `datasourceUrl`.
//
// DIRECT_URL = direct/session (5432); DATABASE_URL hanya dipakai sebagai
// fallback bila DIRECT_URL tak tersedia (mis. env yang cuma punya satu URL).
//
// Catatan skala: koneksi direct punya kuota lebih kecil dari pooler. Untuk
// deploy serverless trafik tinggi, pertimbangkan Supabase *session pooler*
// (juga 5432, mode session) sebagai DIRECT_URL agar transaksi tetap valid tanpa
// menghabiskan kuota koneksi langsung.
const datasourceUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient(datasourceUrl ? { datasourceUrl } : undefined);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Ambang timeout interactive transaction.
//
// Default Prisma = 5 detik, cukup untuk DB lokal (SQLite ~ms). Tapi di Postgres
// remote (mis. Supabase region jauh) satu transaksi multi-query bisa >5s karena
// latensi per round-trip, sehingga gagal dengan P2028 "Transaction already
// closed". Karena itu kita naikkan timeout terpusat di sini, bukan tersebar.
const TX_MAX_WAIT_MS = 15_000; // tunggu antre koneksi dari pool
const TX_TIMEOUT_MS = 60_000; // durasi maksimum transaksi itu sendiri

/**
 * Jalankan interactive transaction dengan timeout yang tahan latensi cloud.
 * Pakai ini sebagai ganti `prisma.$transaction(async (tx) => ...)` langsung.
 */
export function transaksi<T>(
  fn: (tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(fn, {
    maxWait: TX_MAX_WAIT_MS,
    timeout: TX_TIMEOUT_MS,
  });
}
