import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { seedWarung } from "../prisma/seed";
import { bersihkanWarungUji } from "./helpers";

// Lampiran PRD skema DB §2 aturan #2: user warung A request data warung B
// harus 403/kosong. Ini gerbang CI — bukan test manual.
//
// Strategi: seed dua warung lewat helper yang sama dengan produksi
// (seedWarung), tambah 1 transaksi untuk warung B, lalu buktikan setiap query
// yang WAJIB di-scope warungId (§2 aturan #1) tidak pernah menyentuh tenant
// lain. DB test terpisah (Postgres, TEST_DATABASE_URL) di-migrate di tests/global-setup.ts.
describe("isolasi tenant (§2 aturan #2)", () => {
  let warungA: { id: string; nama: string };
  let warungB: { id: string; nama: string };
  let kasirB: { id: string };

  beforeAll(async () => {
    warungA = await seedWarung("Warung Alpha Test");
    warungB = await seedWarung("Warung Beta Test");

    const kasir = await prisma.user.findFirst({
      where: { warungId: warungB.id, role: "KASIR" },
    });
    if (!kasir) throw new Error("Kasir warung B tidak ditemukan");
    kasirB = kasir;

    await prisma.transaction.create({
      data: {
        id: "trx-warung-b-1",
        warungId: warungB.id,
        cashierId: kasirB.id,
        status: "LUNAS",
        subtotal: 15000,
        total: 15000,
        cash: 15000,
      },
    });

    expect(warungA.id).not.toBe(warungB.id);
  });

  afterAll(async () => {
    await bersihkanWarungUji([
      "Warung Alpha Test",
      "Warung Beta Test",
      "Warung Sementara Test",
    ]);
    await prisma.$disconnect();
  });

  it("dua warung ter-seed dengan id berbeda", () => {
    expect(warungA.id).toBeTruthy();
    expect(warungB.id).toBeTruthy();
    expect(warungA.id).not.toBe(warungB.id);
  });

  it("seed menaruh produk di kedua warung (prasyarat yang bermakna)", async () => {
    const produkA = await prisma.product.count({ where: { warungId: warungA.id } });
    const produkB = await prisma.product.count({ where: { warungId: warungB.id } });
    expect(produkA).toBeGreaterThan(0);
    expect(produkB).toBeGreaterThan(0);
  });

  it("product.findMany warungId A tidak memuat produk warung B", async () => {
    const produkA = await prisma.product.findMany({ where: { warungId: warungA.id } });

    expect(produkA.length).toBeGreaterThan(0);
    expect(produkA.every((p) => p.warungId === warungA.id)).toBe(true);

    const idProdukB = new Set(
      (await prisma.product.findMany({
        where: { warungId: warungB.id },
        select: { id: true },
      })).map((p) => p.id)
    );
    expect(idProdukB.size).toBeGreaterThan(0);
    expect(produkA.some((p) => idProdukB.has(p.id))).toBe(false);
  });

  it("transaction.findMany warungId A kosong untuk trx warung B", async () => {
    const trxMilikB = await prisma.transaction.findUnique({
      where: { id: "trx-warung-b-1" },
    });
    expect(trxMilikB?.warungId).toBe(warungB.id);

    const trxA = await prisma.transaction.findMany({ where: { warungId: warungA.id } });
    expect(trxA).toHaveLength(0);

    const trxB = await prisma.transaction.findMany({ where: { warungId: warungB.id } });
    expect(trxB).toHaveLength(1);
    expect(trxB.every((t) => t.warungId === warungB.id)).toBe(true);
  });

  it("query lintas-tenant tanpa scope bocor (demonstrasi kegagalan aturan #1)", async () => {
    // Tanpa filter warungId, Prisma (by design) mengembalikan SEMUA tenant —
    // test ini membuktikan kenapa aturan #1 wajib, bukan opsional.
    const tanpaScope = await prisma.product.findMany();
    const punyaA = tanpaScope.some((p) => p.warungId === warungA.id);
    const punyaB = tanpaScope.some((p) => p.warungId === warungB.id);
    expect(punyaA && punyaB).toBe(true);
  });

  it("delete warung A tidak menghapus data warung B (cascade ter-scope)", async () => {
    const warungSementara = await seedWarung("Warung Sementara Test");
    await prisma.warung.delete({ where: { id: warungSementara.id } });

    const sisaProdukB = await prisma.product.count({ where: { warungId: warungB.id } });
    expect(sisaProdukB).toBeGreaterThan(0);
  });
});
