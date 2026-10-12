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

// ── Rate-limit probe daftar kasir (S1 hardening) ────────────────────────────
//
// GET /api/auth/kasir?slug=... memang PUBLIK menurut desain (tablet login flow,
// lampiran skema §2 aturan #7), tapi ia bisa dipakai untuk enumerasi warung +
// daftar kasir lintas-slug. Untuk menahan penyalahgunaan itu, endpoint dibatasi
// per-IP dengan fixed-window sederhana yang tetap dipersist di tabel yang SAMA
// (`login_attempts`) memakai prefix key khusus agar TIDAK bentrok dengan hitungan
// login. Karena state di DB, batas berlaku lintas-instance (shared) seperti
// rate-limit login.
//
// Pemetaan kolom: `failures` = jumlah request pada window berjalan,
// `blockedUntil` = waktu reset window (bukan blok). Bila window lewat, hitungan
// dimulai ulang dari nol.
const KASIR_PROBE_PREFIX = "kasir-probe:";
const KASIR_PROBE_MAX = 30;
const KASIR_PROBE_WINDOW_MS = 5 * 60 * 1000;

export type SlugProbeStatus = {
  blocked: boolean;
  retryAfterSeconds: number;
  remaining: number;
};

export function kasirProbeKey(ip: string): string {
  return `${KASIR_PROBE_PREFIX}${ip}`;
}

// FAIL-OPEN: bila penyimpanan rate-limit sendiri bermasalah (mis. tabel belum
// ter-migrasi / DB hiccup), JANGAN jadikan endpoint ikut mati — catat & anggap
// tidak diblok. Rate-limit adalah pelindung tambahan, bukan jalur kritis; ia tak
// boleh menjadi sumber outage baru.
const PROBE_OPEN: SlugProbeStatus = { blocked: false, retryAfterSeconds: 0, remaining: KASIR_PROBE_MAX };

export async function checkSlugRate(ip: string): Promise<SlugProbeStatus> {
  const key = kasirProbeKey(ip);
  const nowMs = Date.now();

  let row: { failures: number; blockedUntil: Date | null } | null;
  try {
    row = await prisma.loginAttempt.findUnique({
      where: { key },
      select: { failures: true, blockedUntil: true },
    });
  } catch (e) {
    console.error("[rate-limit] checkSlugRate gagal (fail-open):", e);
    return PROBE_OPEN;
  }

  if (!row || !row.blockedUntil || row.blockedUntil.getTime() <= nowMs) {
    return { blocked: false, retryAfterSeconds: 0, remaining: KASIR_PROBE_MAX };
  }

  const remaining = Math.max(0, KASIR_PROBE_MAX - row.failures);
  return {
    blocked: remaining <= 0,
    retryAfterSeconds: remaining <= 0 ? Math.ceil((row.blockedUntil.getTime() - nowMs) / 1000) : 0,
    remaining,
  };
}

export async function recordSlugProbe(ip: string): Promise<SlugProbeStatus> {
  const key = kasirProbeKey(ip);
  const nowMs = Date.now();

  try {
    const row = await prisma.loginAttempt.findUnique({
      where: { key },
      select: { blockedUntil: true },
    });

    if (!row || !row.blockedUntil || row.blockedUntil.getTime() <= nowMs) {
      await prisma.loginAttempt.upsert({
        where: { key },
        create: { key, failures: 1, blockedUntil: new Date(nowMs + KASIR_PROBE_WINDOW_MS) },
        update: { failures: 1, blockedUntil: new Date(nowMs + KASIR_PROBE_WINDOW_MS) },
      });
    } else {
      await prisma.loginAttempt.update({ where: { key }, data: { failures: { increment: 1 } } });
    }
  } catch (e) {
    // FAIL-OPEN — lihat catatan di checkSlugRate.
    console.error("[rate-limit] recordSlugProbe gagal (fail-open):", e);
    return PROBE_OPEN;
  }

  return checkSlugRate(ip);
}

// Hanya untuk test: reset SELURUH state rate-limit.
// Tabel `login_attempts` hanya menyimpan state rate-limit (tanpa data warung),
// jadi menghapus semua baris aman di test maupun prod. JANGAN panggil dari kode
// produksi — ini murni hook test (mis. dari tests/pin-ratelimit.test.ts).
export async function __resetRateLimit(): Promise<void> {
  await prisma.loginAttempt.deleteMany({});
}

// ── Rate-limit login per-IP (anti password-spray + anti account-lockout) ─────
//
// Rate-limit per-akun (di atas) membatasi tebak-password pada SATU akun, tapi
// penyerang bisa menyebar percobaan ke BANYAK email (password spraying) dan
// setiap email punya hitungan sendiri → lolos. Selain itu, karena limit
// per-akun, orang yang tahu email owner bisa sengaja salah 5× → mengunci owner
// (denial-of-service pada akun).
//
// Lapis per-IP menutup keduanya: total KEGAGALAN login dari satu IP dibatasi,
// apa pun akun yang dicoba. Ini melindungi owner dari penguncian oleh IP asing
// (IP owner sendiri tetap punya jatah penuh) dan menahan spray lintas-akun.
//
// Fixed-window, state di tabel yang SAMA (`login_attempts`) dengan prefix
// khusus agar tak bentrok. FAIL-OPEN seperti rate-limit lain (pelindung
// tambahan, bukan jalur kritis) — DB hiccup tidak boleh mematikan login.
const LOGIN_IP_PREFIX = "login-ip:";
const LOGIN_IP_MAX = 20; // maksimum kegagalan per window per IP
const LOGIN_IP_WINDOW_MS = 10 * 60 * 1000; // 10 menit

export type LoginIpStatus = {
  blocked: boolean;
  retryAfterSeconds: number;
};

export function loginIpKey(ip: string): string {
  return `${LOGIN_IP_PREFIX}${ip}`;
}

const LOGIN_IP_OPEN: LoginIpStatus = { blocked: false, retryAfterSeconds: 0 };

export async function checkLoginIpRate(ip: string): Promise<LoginIpStatus> {
  const key = loginIpKey(ip);
  const nowMs = Date.now();
  try {
    const row = await prisma.loginAttempt.findUnique({
      where: { key },
      select: { failures: true, blockedUntil: true },
    });
    if (!row || !row.blockedUntil || row.blockedUntil.getTime() <= nowMs) {
      return LOGIN_IP_OPEN;
    }
    const remaining = Math.max(0, LOGIN_IP_MAX - row.failures);
    return {
      blocked: remaining <= 0,
      retryAfterSeconds: remaining <= 0 ? Math.ceil((row.blockedUntil.getTime() - nowMs) / 1000) : 0,
    };
  } catch (e) {
    console.error("[rate-limit] checkLoginIpRate gagal (fail-open):", e);
    return LOGIN_IP_OPEN;
  }
}

export async function recordLoginIpFailure(ip: string): Promise<LoginIpStatus> {
  const key = loginIpKey(ip);
  const nowMs = Date.now();
  try {
    const row = await prisma.loginAttempt.findUnique({
      where: { key },
      select: { blockedUntil: true },
    });
    if (!row || !row.blockedUntil || row.blockedUntil.getTime() <= nowMs) {
      await prisma.loginAttempt.upsert({
        where: { key },
        create: { key, failures: 1, blockedUntil: new Date(nowMs + LOGIN_IP_WINDOW_MS) },
        update: { failures: 1, blockedUntil: new Date(nowMs + LOGIN_IP_WINDOW_MS) },
      });
    } else {
      await prisma.loginAttempt.update({ where: { key }, data: { failures: { increment: 1 } } });
    }
  } catch (e) {
    console.error("[rate-limit] recordLoginIpFailure gagal (fail-open):", e);
    return LOGIN_IP_OPEN;
  }
  return checkLoginIpRate(ip);
}

// Hapus hitungan IP saat login sukses (agar IP warung yang sah tak menumpuk
// kegagalan lama). Dipanggil bersama recordLoginSuccess per-akun.
export async function recordLoginIpSuccess(ip: string): Promise<void> {
  await prisma.loginAttempt.deleteMany({ where: { key: loginIpKey(ip) } }).catch(() => {});
}

export const RATE_LIMIT = { MAX_FAILURES, BLOCK_MS, LOGIN_IP_MAX, LOGIN_IP_WINDOW_MS };
