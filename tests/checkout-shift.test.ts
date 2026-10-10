import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/server/db";
import { seedWarung } from "../prisma/seed";
import { bersihkanWarungUji } from "./helpers";

// Uji observability checkout ONLINE tanpa shift (M3) — memanggil ROUTE NYATA
// POST /api/checkout (bukan meniru handler), dengan session di-mock agar route
// memakai warung uji. Yang diuji: transaksi tanpa shift tetap DIBUAT (offline-safe,
// tidak ditolak) TAPI di-audit CHECKOUT_TANPA_SHIFT; saat ada shift BUKA, tidak.
//
// Session di-mock lewat `@/server/tenant` karena handler asli memakai cookies()
// (butuh request context Next.js). Sisanya (prosesCheckout, catat, Prisma) nyata.

const nampan = vi.hoisted(() => ({
  warungId: "",
  kasirId: "",
}));

vi.mock("@/server/tenant", () => ({
  currentWarungId: async () => nampan.warungId,
  currentKasirId: async () => nampan.kasirId,
}));

import { POST } from "@/app/api/checkout/route";

describe("audit checkout M3 (CHECKOUT_TANPA_SHIFT)", () => {
  let warung: { id: string; nama: string };
  let kasir: { id: string };
  let produk: { id: string; name: string; price: number };

  async function kirimCheckout(body: unknown) {
    const req = new Request("http://localhost/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const res = await POST(req);
    return { status: res.status, body: await res.json() };
  }

  beforeAll(async () => {
    warung = await seedWarung("Warung Checkout Shift");
    nampan.warungId = warung.id;

    const k = await prisma.user.findFirst({ where: { warungId: warung.id, role: "KASIR" } });
    if (!k) throw new Error("Kasir tidak ditemukan");
    kasir = k;
    nampan.kasirId = k.id;

    const p = await prisma.product.findFirst({
      where: { warungId: warung.id, stock: { gte: 50 } },
      orderBy: { price: "asc" },
    });
    if (!p) throw new Error("Produk stok besar tidak ditemukan");
    produk = p;
  });

  afterAll(async () => {
    await bersihkanWarungUji(["Warung Checkout Shift"]);
    await prisma.$disconnect();
  });

  it("(1) M3: checkout ONLINE tanpa shift BUKA → transaksi DIBUAT + audit CHECKOUT_TANPA_SHIFT", async () => {
    const shiftBuka = await prisma.shift.count({
      where: { warungId: warung.id, status: "BUKA" },
    });
    expect(shiftBuka).toBe(0);

    const { status, body } = await kirimCheckout({
      items: [{ productId: produk.id, qty: 1 }],
      cash: produk.price * 2, // cukup untuk subtotal + pajak 10%
      payment: "CASH",
      discount: 0,
    });

    // Tidak ditolak (offline-safe): transaksi tetap tercipta.
    expect(status).toBe(201);
    const trx = await prisma.transaction.findUniqueOrThrow({ where: { id: body.id } });
    expect(trx.shiftId).toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: { warungId: warung.id, action: "CHECKOUT_TANPA_SHIFT" },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).not.toBeNull();

    const meta = JSON.parse(audit!.meta ?? "{}") as Record<string, unknown>;
    expect(meta.transactionId).toBe(body.id);
    expect(meta.shiftId).toBeNull();
  });

  it("(2) M3 (kontrol): checkout ONLINE dengan shift BUKA → TIDAK ada CHECKOUT_TANPA_SHIFT", async () => {
    const shift = await prisma.shift.create({
      data: { warungId: warung.id, cashierId: kasir.id, modalAwal: 0, status: "BUKA" },
    });
    try {
      const { status, body } = await kirimCheckout({
        items: [{ productId: produk.id, qty: 1 }],
        cash: produk.price * 2,
        payment: "CASH",
        discount: 0,
      });
      expect(status).toBe(201);

      const trx = await prisma.transaction.findUniqueOrThrow({ where: { id: body.id } });
      expect(trx.shiftId).toBe(shift.id);

      // Tak ada audit CHECKOUT_TANPA_SHIFT untuk transaksi kontrol id ini.
      const semua = await prisma.auditLog.findMany({
        where: { warungId: warung.id, action: "CHECKOUT_TANPA_SHIFT" },
      });
      for (const a of semua) {
        expect(JSON.parse(a.meta ?? "{}").transactionId).not.toBe(body.id);
      }
    } finally {
      await prisma.shift.delete({ where: { id: shift.id } });
    }
  });
});
