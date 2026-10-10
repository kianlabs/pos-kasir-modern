import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/server/db";
import { verifySession } from "@/server/session";
import { __resetRateLimit } from "@/server/rate-limit";
import { SESSION_COOKIE } from "@/shared/session-types";
import { seedWarung } from "../prisma/seed";
import { bersihkanWarungUji } from "./helpers";

// Test login lewat ROUTE ASLI src/app/api/auth/login/route.ts (POST).
//
// Menutup GAP: alur login (owner password + kasir PIN), penolakan kredensial
// salah, rate-limit PIN 5×, dan status 404/400 — sebelumnya tak ada test yang
// memanggil handler-nya langsung.
//
// Cara: mock `next/headers` cookies() → route men-set cookie sesi lewat
// `cookies().set(...)` (bukan NextResponse.cookies), jadi kita tangkap argumen
// set() untuk verifikasi cookie. Handler diimpor SEKALI (tanpa vi.resetModules)
// supaya __resetRateLimit (kini hapus baris tabel DB) menyasar state yang sama.
//
// Rate-limit PERSISTEN di DB (tabel login_attempts) — bukan in-memory — agar
// berlaku lintas-instance saat deploy serverless. Konsekuensi untuk test: state
// tak lagi terisolasi per proses, jadi file ini WAJIB membersihkannya: await
// __resetRateLimit() di beforeEach (isolasi antar-test) DAN afterEach/afterAll
// (jangan tinggalkan blok yang mengunci login test file lain yang berbagi DB).
//
// Butuh DB test (TEST_DATABASE_URL). Seed warung uji via seedWarung: owner
// password "password123", kasir PIN "123456".

// Tangkap cookie yang di-set oleh route pada request terakhir.
let setCookie: { name: string; value: string; options: Record<string, unknown> } | undefined;

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: () => undefined,
    set: (name: string, value: string, options: Record<string, unknown>) => {
      setCookie = { name, value, options };
    },
  }),
}));

const NAMA_WARUNG = "Warung Login Test";

async function postLogin(body: unknown): Promise<Response> {
  const { POST } = await import("@/app/api/auth/login/route");
  const req = new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return POST(req);
}

describe("POST /api/auth/login (route asli)", () => {
  let slug: string;
  let ownerEmail: string;
  let kasirId: string;

  beforeAll(async () => {
    const w = await seedWarung(NAMA_WARUNG);
    slug = w.slug;

    const owner = await prisma.user.findFirstOrThrow({
      where: { warungId: w.id, role: "OWNER" },
    });
    ownerEmail = owner.email!;

    const kasir = await prisma.user.findFirstOrThrow({
      where: { warungId: w.id, role: "KASIR" },
    });
    kasirId = kasir.id;
  });

  afterAll(async () => {
    await bersihkanWarungUji([NAMA_WARUNG]);
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await __resetRateLimit();
    setCookie = undefined;
  });

  afterEach(async () => {
    await __resetRateLimit();
  });

  it("owner login benar → 200 + cookie sesi ter-set (role OWNER)", async () => {
    const res = await postLogin({
      slug,
      mode: "owner",
      email: ownerEmail,
      password: "password123",
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.user.role).toBe("OWNER");

    expect(setCookie?.name).toBe(SESSION_COOKIE);
    expect(setCookie?.options.httpOnly).toBe(true);
    expect(setCookie?.options.path).toBe("/");
    // Token harus valid & memuat klaim owner.
    const payload = verifySession(setCookie?.value);
    expect(payload?.role).toBe("OWNER");
    expect(payload?.uid).toBe(json.user.id);
  });

  it("owner password salah → 401", async () => {
    const res = await postLogin({
      slug,
      mode: "owner",
      email: ownerEmail,
      password: "password-salah",
    });
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toMatch(/salah/i);
    expect(setCookie).toBeUndefined();
  });

  it("kasir login PIN benar → 200 + cookie sesi ter-set (role KASIR)", async () => {
    const res = await postLogin({
      slug,
      mode: "kasir",
      userId: kasirId,
      pin: "123456",
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.user.role).toBe("KASIR");

    expect(setCookie?.name).toBe(SESSION_COOKIE);
    const payload = verifySession(setCookie?.value);
    expect(payload?.role).toBe("KASIR");
    expect(payload?.uid).toBe(kasirId);
  });

  it("kasir PIN salah → 401", async () => {
    const res = await postLogin({
      slug,
      mode: "kasir",
      userId: kasirId,
      pin: "000000",
    });
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toMatch(/PIN/i);
    expect(setCookie).toBeUndefined();
  });

  it("rate-limit: 5 PIN salah berturut → 429 (blok sementara)", async () => {
    const salah = () => postLogin({ slug, mode: "kasir", userId: kasirId, pin: "000000" });

    // 4 percobaan pertama masih 401 (belum blok).
    for (let i = 1; i <= 4; i++) {
      expect((await salah()).status).toBe(401);
    }
    // Percobaan ke-5 memicu blok → 429.
    const kelima = await salah();
    expect(kelima.status).toBe(429);
    const json = await kelima.json();
    expect(json.error).toMatch(/diblokir|diblok|PIN/i);

    // Percobaan ke-6 pun tetap 429 (masih dalam jendela blok).
    expect((await salah()).status).toBe(429);
  });

  it("warung tidak ada → 404", async () => {
    const res = await postLogin({
      slug: "warung-tidak-ada-xyz",
      mode: "owner",
      email: "owner@nowhere.demo",
      password: "password123",
    });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/tidak ditemukan/i);
  });

  it("slug kosong → 400", async () => {
    const res = await postLogin({
      slug: "",
      mode: "owner",
      email: ownerEmail,
      password: "password123",
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/warung|peran/i);
  });
});
