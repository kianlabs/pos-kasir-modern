import { beforeEach, describe, expect, it } from "vitest";
import {
  SESSION_TTL_SECONDS,
  issueSession,
  verifySession,
} from "@/server/session";

// Test sesi HMAC (src/server/session.ts) — GAP yang ditemukan audit: token
// ditandatangani & diverifikasi dengan node:crypto, dan `timingSafeEqual` dipakai
// untuk cegah timing attack, tetapi tidak ada test. Regresi (mis. timingSafeEqual
// → ===, atau lupa cek `exp`) harus tertangkap di sini.
//
// Tidak menyentuh DB. SESSION_SECRET diset di beforeEach agar deterministik.

const SECRET = "test-secret-min-16-chars-ok"; // >=16 char agar lolos guard
const USER = {
  id: "user-1",
  warungId: "warung-1",
  role: "OWNER",
  name: "Budi",
};

beforeEach(() => {
  process.env.SESSION_SECRET = SECRET;
});

describe("session HMAC (issue + verify)", () => {
  it("token yang baru diterbitkan dapat diverifikasi & memuat klaim benar", () => {
    const { token, maxAge } = issueSession(USER);
    expect(maxAge).toBe(SESSION_TTL_SECONDS);
    expect(token).toContain(".");

    const payload = verifySession(token);
    expect(payload).not.toBeNull();
    expect(payload?.uid).toBe(USER.id);
    expect(payload?.wid).toBe(USER.warungId);
    expect(payload?.role).toBe("OWNER");
    expect(payload?.name).toBe(USER.name);
    expect(payload?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("role selain OWNER dinormalkan menjadi KASIR", () => {
    const { token } = issueSession({ ...USER, role: "SUPERADMIN" });
    expect(verifySession(token)?.role).toBe("KASIR");
  });

  it("token kosong / null / undefined ditolak (null)", () => {
    expect(verifySession(undefined)).toBeNull();
    expect(verifySession(null)).toBeNull();
    expect(verifySession("")).toBeNull();
    expect(verifySession("tanpa-titik")).toBeNull();
  });

  it("SIGNATURE DIPALSUKAN → ditolak", () => {
    const { token } = issueSession(USER);
    const [payload, sig] = token.split(".");
    // Ubah 1 karakter signature → HMAC tidak cocok.
    const sigPalsu = sig.slice(0, -1) + (sig.at(-1) === "A" ? "B" : "A");
    expect(verifySession(`${payload}.${sigPalsu}`)).toBeNull();
  });

  it("PAYLOAD DIUBAH (mis. role jadi OWNER) → signature tidak cocok → ditolak", () => {
    const { token } = issueSession({ ...USER, role: "KASIR" });
    const sig = token.slice(token.lastIndexOf(".") + 1);
    // Payload baru: KASIR naik jadi OWNER, ditandatangani ulang TANPA secret.
    const payloadPalsu = Buffer.from(
      JSON.stringify({
        uid: "user-1",
        warungId: "warung-1",
        role: "OWNER",
        name: "Budi",
        iat: 0,
        exp: Math.floor(Date.now() / 1000) + 9999,
      }),
    ).toString("base64url");
    // Signature lama tidak berlaku untuk payload baru.
    expect(verifySession(`${payloadPalsu}.${sig}`)).toBeNull();
  });

  it("token bertanda tangan dari secret LAIN → ditolak", () => {
    const { token } = issueSession(USER);
    process.env.SESSION_SECRET = "secret-lain-yang-berbeda-123";
    expect(verifySession(token)).toBeNull();
  });

  it("token KEDALUWARSA (exp di masa lalu) → ditolak", () => {
    // Buat payload exp masa lalu, tandatangani dengan secret yang sama via
    // issueSession → kita tak bisa memaksa exp, jadi pakai HMAC manual.
    const payload = {
      uid: "user-1",
      warungId: "warung-1",
      role: "OWNER",
      name: "Budi",
      iat: 1,
      exp: 1000, // jauh di masa lalu
    };
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createHmac } = require("node:crypto");
    const sig = createHmac("sha256", SECRET).update(payloadB64).digest("base64url");
    expect(verifySession(`${payloadB64}.${sig}`)).toBeNull();
  });

  it("payload valid-tanda-tangan tapi cacat bentuk → ditolak", () => {
    const { createHmac } = require("node:crypto");
    const buat = (obj: unknown) => {
      const b64 = Buffer.from(JSON.stringify(obj)).toString("base64url");
      const sig = createHmac("sha256", SECRET).update(b64).digest("base64url");
      return `${b64}.${sig}`;
    };
    const expValid = Math.floor(Date.now() / 1000) + 3600;
    // uid bukan string
    expect(verifySession(buat({ uid: 1, wid: "w", role: "OWNER", exp: expValid }))).toBeNull();
    // role tidak valid
    expect(verifySession(buat({ uid: "u", wid: "w", role: "ADMIN", exp: expValid }))).toBeNull();
    // exp bukan number
    expect(verifySession(buat({ uid: "u", wid: "w", role: "OWNER", exp: "x" }))).toBeNull();
  });
});
