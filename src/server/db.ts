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
// Default Prisma = 5 detik, cukup untuk DB lokal (Postgres lokal ~ms). Tapi di
// Postgres remote (mis. Supabase region jauh) satu transaksi multi-query bisa
// >5s karena latensi per round-trip, sehingga gagal dengan P2028 "Transaction
// already closed". Karena itu kita naikkan timeout terpusat di sini, bukan tersebar.
const TX_MAX_WAIT_MS = 15_000; // tunggu antre koneksi dari pool
const TX_TIMEOUT_MS = 60_000; // durasi maksimum transaksi itu sendiri

// Retry untuk write-conflict/deadlock. Postgres membatalkan SATU transaksi saat
// deadlock (40P01) atau serialization failure (40001); Prisma melaporkannya
// sebagai P2034. Karena transaksi di-abort penuh (bukan commit parsial), aman
// diulang. Tanpa retry, kasir bisa melihat error "deadlock detected" sporadis.
const TX_MAX_RETRY = 3;
const TX_RETRY_BASE_MS = 50;

function isRetryableTxError(e: unknown): boolean {
  const code = (e as { code?: unknown } | null)?.code;
  // P2034 = write conflict / deadlock (Prisma). Aman di-retry karena transaksi
  // sudah di-abort penuh, bukan commit parsial.
  return code === "P2034";
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Jalankan interactive transaction dengan timeout yang tahan latensi cloud,
 * plus retry terbatas untuk write-conflict/deadlock (P2034).
 * Pakai ini sebagai ganti `prisma.$transaction(async (tx) => ...)` langsung.
 */
export async function transaksi<T>(
  fn: (tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]) => Promise<T>,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= TX_MAX_RETRY; attempt++) {
    try {
      return await prisma.$transaction(fn, {
        maxWait: TX_MAX_WAIT_MS,
        timeout: TX_TIMEOUT_MS,
      });
    } catch (e) {
      if (!isRetryableTxError(e) || attempt === TX_MAX_RETRY) throw e;
      lastErr = e;
      // Backoff eksponensial ringan + jitter.
      await sleep(TX_RETRY_BASE_MS * 2 ** attempt + Math.floor(Math.random() * 25));
    }
  }
  // Tidak tercapai — loop selalu return atau throw.
  throw lastErr;
}
