import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

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
