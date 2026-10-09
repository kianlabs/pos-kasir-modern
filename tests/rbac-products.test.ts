import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { cookies } from "next/headers";
import { prisma } from "@/server/db";
import { issueSession } from "@/server/session";
import { SESSION_COOKIE } from "@/shared/session-types";
import { seedWarung } from "../prisma/seed";
import { bersihkanWarungUji } from "./helpers";

// Test RBAC (gate role) yang MEMANGGIL ROUTE ASLI — menutup GAP audit: sebelumnya
// gate `requireOwnerResponse` hanya diuji lewat helper tiruan, bukan handler.
//
// Cara: mock `next/headers` cookies() agar mengembalikan token sesi nyata (HMAC
// asli), lalu panggil POST /api/products. Handler memakai React.cache untuk
// memoize getSession — cache di-reset antar-test lewat vi.resetModules + import
// ulang modul handler.
//
// Butuh DB test (TEST_DATABASE_URL). Tidak menyentuh route HTTP penuh — cukup
// memanggil fungsi handler dengan Request sintetis.

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => currentCookie?.name === name ? currentCookie : undefined,
  }),
}));

// Cookie yang sedang "aktif" untuk request berikutnya.
let currentCookie: { name: string; value: string } | undefined;

function setSessionCookie(token: string | undefined) {
  currentCookie = token ? { name: SESSION_COOKIE, value: token } : undefined;
}

describe("RBAC route /api/products (gate owner-only)", () => {
  let warungId: string;
  let ownerToken: string;
  let kasirToken: string;

  beforeAll(async () => {
    const w = await seedWarung("Warung RBAC Test");
    warungId = w.id;

    const owner = await prisma.user.findFirstOrThrow({
      where: { warungId, role: "OWNER" },
    });
    const kasir = await prisma.user.findFirstOrThrow({
      where: { warungId, role: "KASIR" },
    });
    ownerToken = issueSession({ id: owner.id, warungId, role: "OWNER", name: owner.name }).token;
    kasirToken = issueSession({ id: kasir.id, warungId, role: "KASIR", name: kasir.name }).token;
  });

  afterAll(async () => {
    await bersihkanWarungUji(["Warung RBAC Test"]);
    await prisma.$disconnect();
  });

  // Handler diimpor ulang tiap test agar React.cache (memoize getSession) bersih.
  async function postProducts(body: unknown) {
    vi.resetModules();
    const { POST } = await import("@/app/api/products/route");
    const req = new Request("http://localhost/api/products", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return POST(req);
  }

  it("tanpa sesi → 401 (belum login)", async () => {
    setSessionCookie(undefined);
    const res = await postProducts({ name: "X", price: 1000 });
    expect(res.status).toBe(401);
  });

  it("sesi KASIR → 403 (khusus owner)", async () => {
    setSessionCookie(kasirToken);
    const res = await postProducts({ name: "Produk Kasir", price: 1000 });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/owner/i);
  });

  it("sesi OWNER + body valid → 201 (produk dibuat di warung sendiri)", async () => {
    setSessionCookie(ownerToken);
    const res = await postProducts({ name: "Produk RBAC OK", price: 2500, stock: 3 });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.warungId).toBe(warungId);
    // Bersihkan produk uji.
    await prisma.product.delete({ where: { id: json.id } });
    await prisma.stockMove.deleteMany({ where: { productId: json.id } });
  });

  it("sesi OWNER + body tidak valid (harga <= 0) → 400", async () => {
    setSessionCookie(ownerToken);
    const res = await postProducts({ name: "X", price: 0 });
    expect(res.status).toBe(400);
  });

  it("token sesi DIPALSUKAN → dianggap belum login (401)", async () => {
    setSessionCookie("payload-palsu.signature-palsu");
    const res = await postProducts({ name: "X", price: 1000 });
    expect(res.status).toBe(401);
  });
});
