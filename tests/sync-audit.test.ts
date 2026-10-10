import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/server/db";
import { seedWarung } from "../prisma/seed";
import { bersihkanWarungUji } from "./helpers";

// Uji observability jalur sync (M2, M4) — memanggil ROUTE NYATA POST /api/sync
// (bukan meniru handler), dengan session di-mock agar route memakai warung uji.
// Yang diuji: audit SYNC_MONEY_RECOMPUTED & SYNC_ORPHAN_SHIFT benar-benar tercatat.
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

import { POST } from "@/app/api/sync/route";

describe("audit sync M2/M4 (SYNC_MONEY_RECOMPUTED & SYNC_ORPHAN_SHIFT)", () => {
  let warung: { id: string; nama: string };
  let kasir: { id: string };
  let produk: { id: string; name: string; price: number };

  async function kirimSync(transactions: unknown[]) {
    const req = new Request("http://localhost/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactions }),
    });
    const res = await POST(req);
    return { status: res.status, body: await res.json() };
  }

  beforeAll(async () => {
    warung = await seedWarung("Warung Sync Audit");
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
    await bersihkanWarungUji(["Warung Sync Audit"]);
    await prisma.$disconnect();
  });

  it("(1) M4: total client memaksa diskon/pajak direkalkulasi → audit SYNC_MONEY_RECOMPUTED", async () => {
    const id = randomUUID();
    // Hitung ekspektasi dari harga produk nyata (seed bisa berubah).
    const subtotal = produk.price * 2;
    const taxNormal = Math.round(subtotal * 0.1); // pajak default setting = 10%
    const totalNormal = subtotal + taxNormal;
    // Kirim total client yang JELAS beda dari formula normal (setengah subtotal).
    const totalClient = Math.floor(subtotal / 2);

    const { status, body } = await kirimSync([
      {
        id,
        items: [{ productId: produk.id, qty: 2 }],
        cash: totalClient,
        payment: "CASH",
        discount: 0,
        total: totalClient,
      },
    ]);

    expect(status).toBe(200);
    expect(body.results[0].status).toBe("ok");

    const trx = await prisma.transaction.findUniqueOrThrow({ where: { id } });
    expect(trx.subtotal).toBe(subtotal);
    // Tersimpan menyimpang dari formula normal → audit ada.
    expect(trx.discount !== 0 || trx.tax !== taxNormal).toBe(true);

    const audit = await prisma.auditLog.findFirst({
      where: { warungId: warung.id, action: "SYNC_MONEY_RECOMPUTED" },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).not.toBeNull();

    const meta = JSON.parse(audit!.meta ?? "{}") as Record<string, unknown>;
    expect(meta.transactionId).toBe(id);
    expect(meta.subtotal).toBe(subtotal);
    expect(meta.totalClient).toBe(totalClient);
    expect(meta.totalComputedNormal).toBe(totalNormal);
    expect(typeof meta.discountStored).toBe("number");
    expect(typeof meta.taxStored).toBe("number");
  });

  it("(2) M4 (kontrol): total client SAMA dengan formula normal → TIDAK ada SYNC_MONEY_RECOMPUTED", async () => {
    const id = randomUUID();
    // normal: subtotal = harga; tax 10%; total normal disamakan dengan total client.
    const subtotal = produk.price;
    const totalNormal = subtotal + Math.round(subtotal * 0.1);

    const { body } = await kirimSync([
      {
        id,
        items: [{ productId: produk.id, qty: 1 }],
        cash: totalNormal,
        payment: "CASH",
        discount: 0,
        total: totalNormal,
      },
    ]);
    expect(body.results[0].status).toBe("ok");

    // Tidak ada audit SYNC_MONEY_RECOMPUTED untuk transaksi kontrol id ini.
    const semua = await prisma.auditLog.findMany({
      where: { warungId: warung.id, action: "SYNC_MONEY_RECOMPUTED" },
    });
    for (const a of semua) {
      expect(JSON.parse(a.meta ?? "{}").transactionId).not.toBe(id);
    }
  });

  it("(3) M2: sync TanPA shift BUKA → audit SYNC_ORPHAN_SHIFT dengan shiftId null", async () => {
    // Pastikan tak ada shift BUKA di warung uji ini.
    const shiftBuka = await prisma.shift.count({
      where: { warungId: warung.id, status: "BUKA" },
    });
    expect(shiftBuka).toBe(0);

    const id = randomUUID();
    const { status, body } = await kirimSync([
      {
        id,
        items: [{ productId: produk.id, qty: 1 }],
        cash: 6000,
        payment: "CASH",
        discount: 0,
        createdAt: Date.now(),
      },
    ]);
    expect(status).toBe(200);
    expect(body.results[0].status).toBe("ok");

    const trx = await prisma.transaction.findUniqueOrThrow({ where: { id } });
    expect(trx.shiftId).toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: { warungId: warung.id, action: "SYNC_ORPHAN_SHIFT" },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).not.toBeNull();

    const meta = JSON.parse(audit!.meta ?? "{}") as Record<string, unknown>;
    expect(meta.transactionId).toBe(id);
    expect(meta.shiftId).toBeNull();
  });

  it("(4) M2: createdAt di LUAR jendela shift BUKA → audit SYNC_ORPHAN_SHIFT (shiftId terisi)", async () => {
    // Buat shift BUKA dengan openedAt = sekarang.
    const shift = await prisma.shift.create({
      data: {
        warungId: warung.id,
        cashierId: kasir.id,
        modalAwal: 0,
        status: "BUKA",
      },
    });

    try {
      const id = randomUUID();
      // createdAt jauh SEBELUM shift dibuka → di luar jendela [openedAt, now].
      const createdAt = shift.openedAt.getTime() - 60 * 60 * 1000;

      const { body } = await kirimSync([
        {
          id,
          items: [{ productId: produk.id, qty: 1 }],
          cash: 6000,
          payment: "CASH",
          discount: 0,
          createdAt,
        },
      ]);
      expect(body.results[0].status).toBe("ok");

      const trx = await prisma.transaction.findUniqueOrThrow({ where: { id } });
      expect(trx.shiftId).toBe(shift.id);

      const audit = await prisma.auditLog.findFirst({
        where: {
          warungId: warung.id,
          action: "SYNC_ORPHAN_SHIFT",
        },
        orderBy: { createdAt: "desc" },
      });
      expect(audit).not.toBeNull();
      const meta = JSON.parse(audit!.meta ?? "{}") as Record<string, unknown>;
      expect(meta.transactionId).toBe(id);
      expect(meta.shiftId).toBe(shift.id);
    } finally {
      await prisma.shift.delete({ where: { id: shift.id } });
    }
  });
});
