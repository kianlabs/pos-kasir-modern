// Rate-limit login PIN (lampiran skema §2 aturan #9):
// 5 kegagalan berturut per User → tolak 5 menit.
//
// Deter: state disimpan PERSISTEN di DB (tabel `login_attempts`, model
// LoginAttempt) — BUKAN in-memory. Alasan: di deploy multi-instance/serverless
// (Vercel), tiap instance punya memori sendiri; Map in-memory per proses tidak
// terbagi antar-instance sehingga penyerang bisa menyebar percobaan PIN ke
// beberapa instance dan brute-force tetap lolos. Dengan state di DB, hitungan
// dan blok berlaku lintas-instance (shared), jadi "5× gagal → blok 5 menit"
// sungguh ditegakkan di produksi.
//
// Karena akses DB asinkron, seluruh fungsi di sini `Promise`-based.

import { prisma } from "@/server/db";

const MAX_FAILURES = 5;
const BLOCK_MS = 5 * 60 * 1000; // 5 menit

export type RateLimitStatus = {
  blocked: boolean;
  retryAfterSeconds: number;
  remaining: number; // sisa percobaan sebelum blok
};

function unblocked(remaining = MAX_FAILURES): RateLimitStatus {
  return { blocked: false, retryAfterSeconds: 0, remaining };
}

export async function checkLoginRate(key: string): Promise<RateLimitStatus> {
  const row = await prisma.loginAttempt.findUnique({ where: { key } });
  if (!row) return unblocked();

  const nowMs = Date.now();

  // Masih terkunci.
  if (row.blockedUntil && row.blockedUntil.getTime() > nowMs) {
    return {
      blocked: true,
      retryAfterSeconds: Math.ceil((row.blockedUntil.getTime() - nowMs) / 1000),
      remaining: 0,
    };
  }

  // Blok sudah lewat → bersihkan baris (mulai hitungan dari nol).
  if (row.blockedUntil) {
    await prisma.loginAttempt.delete({ where: { key } }).catch(() => {});
    return unblocked();
  }

  return unblocked(Math.max(0, MAX_FAILURES - row.failures));
}

export async function recordLoginFailure(key: string): Promise<RateLimitStatus> {
  const row = await prisma.loginAttempt.findUnique({ where: { key } });
  const current = row?.failures ?? 0;
  const failures = current + 1;

  if (failures >= MAX_FAILURES) {
    // Capai ambang → pasang blok, reset hitungan (blok yang menahan).
    await prisma.loginAttempt.upsert({
      where: { key },
      create: { key, failures: 0, blockedUntil: new Date(Date.now() + BLOCK_MS) },
      update: { failures: 0, blockedUntil: new Date(Date.now() + BLOCK_MS) },
    });
  } else {
    await prisma.loginAttempt.upsert({
      where: { key },
      create: { key, failures },
      update: { failures },
    });
  }

  return checkLoginRate(key);
}

export async function recordLoginSuccess(key: string): Promise<void> {
  await prisma.loginAttempt.deleteMany({ where: { key } });
}

// Hanya untuk test: reset SELURUH state rate-limit.
// Tabel `login_attempts` hanya menyimpan state rate-limit (tanpa data warung),
// jadi menghapus semua baris aman di test maupun prod. JANGAN panggil dari kode
// produksi — ini murni hook test (mis. dari tests/pin-ratelimit.test.ts).
export async function __resetRateLimit(): Promise<void> {
  await prisma.loginAttempt.deleteMany({});
}

export const RATE_LIMIT = { MAX_FAILURES, BLOCK_MS };
