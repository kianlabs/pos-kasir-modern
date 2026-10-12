import { PrismaClient } from "@prisma/client";

// ── Koneksi DB: runtime WAJIB lewat TRANSACTION POOLER (6543) ────────────
//
// Riwayat (insiden produksi 2026-10-12 — semua halaman 500 "max clients reached"):
// Runtime dulu diarahkan ke DIRECT_URL (port 5432 = Supabase *session* pooler).
// Session pooler membatasi HARD 15 client (pool_size: 15). Di Vercel serverless
// tiap instance/cold-start membuka pool sendiri, jadi 3-4 instance saja sudah
// menghabiskan 15 slot → semua request berikutnya gagal:
//   FATAL: (EMAXCONNSESSION) max clients reached in session mode — limited to 15
//
// Terukur (uji 20 koneksi simultan):
//   • 5432 session pooler  → 15 OK / 5 GAGAL  (batas keras 15)
//   • 6543 transaction pooler → 20 OK / 0 GAGAL
// Terukur (30 tx interaktif paralel via 6543): limit=1 → 10/30; limit=5 → 30/30.
//
// Interactive transaction (`transaksi()`) tetap AMAN di transaction pooler:
// Supavisor mem-pin satu koneksi selama transaksi berjalan (bukan per-statement),
// jadi tx multi-query tidak tercampur. Terbukti: flow /api/auth/daftar
// (14 write dalam 1 tx) × 20 paralel = 20/20 sukses.
//
// DIRECT_URL (5432) tetap dipakai Prisma HANYA untuk migrasi/introspection
// (lihat `directUrl` di prisma/schema.prisma) — bukan runtime.
//
// ── Tuning pool ─────────────────────────────────────────────────────────
// connection_limit=5: satu instance Vercel boleh pegang 5 koneksi; pooler 6543
// batasnya tinggi (~200) sehingga aman untuk banyak instance. connect_timeout
// diperpanjang (region Sydney, cold-connect sering >5s) dan pool_timeout agar
// query MENUNGGU koneksi bebas alih-alih langsung error.
const POOL_PARAMS: Record<string, string> = {
  connection_limit: process.env.DB_CONNECTION_LIMIT ?? "5",
  connect_timeout: process.env.DB_CONNECT_TIMEOUT ?? "15",
  pool_timeout: process.env.DB_POOL_TIMEOUT ?? "20",
};

// Normalisasi parameter pool pada URL koneksi.
//
// PENTING: pakai SET (override), bukan "hanya bila belum ada". Template Supabase
// menyisipkan `connection_limit=1` di DATABASE_URL; nilai itu MENGHANCURKAN
// serverless (uji: 30 tx interaktif paralel via 6543 → limit=1 = 10/30 sukses,
// limit=5 = 30/30). Sumber kebenaran = POOL_PARAMS (dapat ditimpa via env DB_*).
function withPoolParams(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  try {
    const u = new URL(raw);
    for (const [k, v] of Object.entries(POOL_PARAMS)) {
      u.searchParams.set(k, v);
    }
    return u.toString();
  } catch {
    // URL tak terparse — kembalikan apa adanya (biar Prisma yang mengeluh).
    return raw;
  }
}

// Runtime pakai DATABASE_URL (transaction pooler 6543). DIRECT_URL (5432)
// hanya untuk migrasi Prisma — memakainya di serverless = kehabisan 15 slot.
const datasourceUrl = withPoolParams(process.env.DATABASE_URL ?? process.env.DIRECT_URL);

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
