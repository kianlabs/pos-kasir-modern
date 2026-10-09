import { beforeEach, describe, expect, it } from "vitest";
import {
  RATE_LIMIT,
  __resetRateLimit,
  checkLoginRate,
  recordLoginFailure,
  recordLoginSuccess,
} from "@/server/rate-limit";

// Lampiran PRD skema DB §2 aturan #9: 5 kegagalan berturut per User → tolak
// 5 menit (blok sementara). Daftar nama boleh publik; PIN harus terasa seperti
// password. State in-memory per proses → di-reset tiap test via
// __resetRateLimit().
describe("rate-limit login PIN (§2 aturan #9)", () => {
  const USER = "user-kasir-1";

  beforeEach(() => {
    __resetRateLimit();
  });

  it("user tanpa riwayat gagal: tidak diblok, sisa percobaan penuh", () => {
    const status = checkLoginRate(USER);
    expect(status.blocked).toBe(false);
    expect(status.retryAfterSeconds).toBe(0);
    expect(status.remaining).toBe(RATE_LIMIT.MAX_FAILURES);
  });

  it("5 kegagalan berturut → blocked true dengan retryAfterSeconds > 0", () => {
    for (let i = 1; i <= RATE_LIMIT.MAX_FAILURES; i++) {
      recordLoginFailure(USER);
    }

    const status = checkLoginRate(USER);
    expect(status.blocked).toBe(true);
    expect(status.retryAfterSeconds).toBeGreaterThan(0);
    expect(status.retryAfterSeconds).toBeLessThanOrEqual(RATE_LIMIT.BLOCK_MS / 1000 + 1);
    expect(status.remaining).toBe(0);
  });

  it("4 kegagalan belum memblok, sisa percobaan 1", () => {
    for (let i = 1; i < RATE_LIMIT.MAX_FAILURES; i++) {
      recordLoginFailure(USER);
    }

    const status = checkLoginRate(USER);
    expect(status.blocked).toBe(false);
    expect(status.retryAfterSeconds).toBe(0);
    expect(status.remaining).toBe(1);
  });

  it("keberhasilan mereset hitungan kegagalan", () => {
    for (let i = 1; i < RATE_LIMIT.MAX_FAILURES; i++) {
      recordLoginFailure(USER);
    }
    expect(checkLoginRate(USER).remaining).toBe(1);

    recordLoginSuccess(USER);

    const status = checkLoginRate(USER);
    expect(status.blocked).toBe(false);
    expect(status.retryAfterSeconds).toBe(0);
    expect(status.remaining).toBe(RATE_LIMIT.MAX_FAILURES);
  });

  it("keberhasilan setelah terkunci ikut mereset blok", () => {
    for (let i = 1; i <= RATE_LIMIT.MAX_FAILURES; i++) {
      recordLoginFailure(USER);
    }
    expect(checkLoginRate(USER).blocked).toBe(true);

    recordLoginSuccess(USER);

    const status = checkLoginRate(USER);
    expect(status.blocked).toBe(false);
    expect(status.retryAfterSeconds).toBe(0);
    expect(status.remaining).toBe(RATE_LIMIT.MAX_FAILURES);
  });

  it("blok terpisah per user — kegagalan user lain tidak mengunci user ini", () => {
    for (let i = 1; i <= RATE_LIMIT.MAX_FAILURES; i++) {
      recordLoginFailure("user-lain");
    }

    expect(checkLoginRate("user-lain").blocked).toBe(true);
    expect(checkLoginRate(USER).blocked).toBe(false);
    expect(checkLoginRate(USER).remaining).toBe(RATE_LIMIT.MAX_FAILURES);
  });

  it("setelah 5 kegagalan, percobaan gagal berikutnya tetap blocked", () => {
    for (let i = 1; i <= RATE_LIMIT.MAX_FAILURES; i++) {
      recordLoginFailure(USER);
    }
    recordLoginFailure(USER);

    const status = checkLoginRate(USER);
    expect(status.blocked).toBe(true);
    expect(status.retryAfterSeconds).toBeGreaterThan(0);
  });
});
