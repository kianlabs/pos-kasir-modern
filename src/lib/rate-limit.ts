// Rate-limit login PIN (lampiran skema §2 aturan #9):
// 5 kegagalan berturut per User → tolak 5 menit.
//
// Deter: in-memory per proses. Cukup untuk dev & 1 instance. Bila deploy
// multi-instance (Vercel serverless), pindahkan ke DB/Redis — dicatat sebagai
// utang teknis di docs/PRD-lampiran-skema-db.md §2.

const MAX_FAILURES = 5;
const BLOCK_MS = 5 * 60 * 1000; // 5 menit

type Entry = { failures: number; blockedUntil: number };

const buckets = new Map<string, Entry>();

export type RateLimitStatus = {
  blocked: boolean;
  retryAfterSeconds: number;
  remaining: number; // sisa percobaan sebelum blok
};

function now(): number {
  return Date.now();
}

export function checkLoginRate(userId: string): RateLimitStatus {
  const e = buckets.get(userId);
  if (!e) return { blocked: false, retryAfterSeconds: 0, remaining: MAX_FAILURES };

  if (e.blockedUntil > now()) {
    return {
      blocked: true,
      retryAfterSeconds: Math.ceil((e.blockedUntil - now()) / 1000),
      remaining: 0,
    };
  }

  // Blok sudah lewat → bersihkan.
  if (e.blockedUntil !== 0 && e.blockedUntil <= now()) {
    buckets.delete(userId);
    return { blocked: false, retryAfterSeconds: 0, remaining: MAX_FAILURES };
  }

  return { blocked: false, retryAfterSeconds: 0, remaining: Math.max(0, MAX_FAILURES - e.failures) };
}

export function recordLoginFailure(userId: string): RateLimitStatus {
  const e = buckets.get(userId) ?? { failures: 0, blockedUntil: 0 };
  e.failures += 1;
  if (e.failures >= MAX_FAILURES) {
    e.blockedUntil = now() + BLOCK_MS;
    e.failures = 0; // reset hitungan; blok yang menahan
  }
  buckets.set(userId, e);
  return checkLoginRate(userId);
}

export function recordLoginSuccess(userId: string): void {
  buckets.delete(userId);
}

// Hanya untuk test: reset seluruh state.
export function __resetRateLimit(): void {
  buckets.clear();
}

export const RATE_LIMIT = { MAX_FAILURES, BLOCK_MS };
