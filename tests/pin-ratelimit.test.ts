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
// password. State kini persisten di DB (tabel `login_attempts`) agar shared
// lintas-instance/serverless → di-reset tiap test via __resetRateLimit().
describe("rate-limit login PIN (§2 aturan #9)", () => {
  const USER = "user-kasir-1";

  beforeEach(async () => {
    await __resetRateLimit();
  });

  it("user tanpa riwayat gagal: tidak diblok, sisa percobaan penuh", async () => {
    const status = await checkLoginRate(USER);
    expect(status.blocked).toBe(false);
    expect(status.retryAfterSeconds).toBe(0);
    expect(status.remaining).toBe(RATE_LIMIT.MAX_FAILURES);
  });

  it("5 kegagalan berturut → blocked true dengan retryAfterSeconds > 0", async () => {
    for (let i = 1; i <= RATE_LIMIT.MAX_FAILURES; i++) {
      await recordLoginFailure(USER);
    }

    const status = await checkLoginRate(USER);
    expect(status.blocked).toBe(true);
    expect(status.retryAfterSeconds).toBeGreaterThan(0);
    expect(status.retryAfterSeconds).toBeLessThanOrEqual(RATE_LIMIT.BLOCK_MS / 1000 + 1);
    expect(status.remaining).toBe(0);
  });

  it("4 kegagalan belum memblok, sisa percobaan 1", async () => {
    for (let i = 1; i < RATE_LIMIT.MAX_FAILURES; i++) {
      await recordLoginFailure(USER);
    }

    const status = await checkLoginRate(USER);
    expect(status.blocked).toBe(false);
    expect(status.retryAfterSeconds).toBe(0);
    expect(status.remaining).toBe(1);
  });

  it("keberhasilan mereset hitungan kegagalan", async () => {
    for (let i = 1; i < RATE_LIMIT.MAX_FAILURES; i++) {
      await recordLoginFailure(USER);
    }
    expect((await checkLoginRate(USER)).remaining).toBe(1);

    await recordLoginSuccess(USER);

    const status = await checkLoginRate(USER);
    expect(status.blocked).toBe(false);
    expect(status.retryAfterSeconds).toBe(0);
    expect(status.remaining).toBe(RATE_LIMIT.MAX_FAILURES);
  });

  it("keberhasilan setelah terkunci ikut mereset blok", async () => {
    for (let i = 1; i <= RATE_LIMIT.MAX_FAILURES; i++) {
      await recordLoginFailure(USER);
    }
    expect((await checkLoginRate(USER)).blocked).toBe(true);

    await recordLoginSuccess(USER);

    const status = await checkLoginRate(USER);
    expect(status.blocked).toBe(false);
    expect(status.retryAfterSeconds).toBe(0);
    expect(status.remaining).toBe(RATE_LIMIT.MAX_FAILURES);
  });

  it("blok terpisah per user — kegagalan user lain tidak mengunci user ini", async () => {
    for (let i = 1; i <= RATE_LIMIT.MAX_FAILURES; i++) {
      await recordLoginFailure("user-lain");
    }

    expect((await checkLoginRate("user-lain")).blocked).toBe(true);
    expect((await checkLoginRate(USER)).blocked).toBe(false);
    expect((await checkLoginRate(USER)).remaining).toBe(RATE_LIMIT.MAX_FAILURES);
  });

  it("setelah 5 kegagalan, percobaan gagal berikutnya tetap blocked", async () => {
    for (let i = 1; i <= RATE_LIMIT.MAX_FAILURES; i++) {
      await recordLoginFailure(USER);
    }
    await recordLoginFailure(USER);

    const status = await checkLoginRate(USER);
    expect(status.blocked).toBe(true);
    expect(status.retryAfterSeconds).toBeGreaterThan(0);
  });
});
