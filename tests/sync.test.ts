import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getTaxSetting } from "@/lib/settings";
import { seedWarung } from "../prisma/seed";
import { prosesCheckout } from "@/lib/offline/sync";

// Uji sync engine + endpoint idempotent (plan Tahap 4 §5 W1).
//
// Inti: IDEMPOTENCY. Transaksi offline membawa UUID client-side; bila dikirim
// 2× (retry / sync ganda) server WAJIB mengembalikan yang ada TANPA decrement
// stok lagi. Test ini memanggil INTI PRODUKSI `prosesCheckout()` — fungsi yang
// sama dipakai POST /api/checkout & POST /api/sync — jadi bug pada logika
// upsert benar-benar tertangkap (bukan meniru handler di test).
//
// Batasan (jujur, sama seperti meja-bill.test.ts): kita menguji KONTRAK DOMAIN
// terhadap DB nyata, bukan memanggil route handler HTTP (butuh cookies() +
// React.cache yang belum ada harness-mock). Query/validasi di sini identik
// dengan yang dijalankan handler di dalam `$transaction`.
//
// DB test terpisah (prisma/test.db) via tests/global-setup.ts + tests/setup.ts —
// JANGAN pernah arahkan ke dev.db.
describe("sync engine idempotent & isolasi tenant (Tahap 4)", () => {
  let warungA: { id: string; nama: string };
  let warungB: { id: string; nama: string };
  let kasirA: { id: string };
  let kasirB: { id: string };
  let produkA: { id: string; name: string; price: number };
  let produkB: { id: string; name: string; price: number };

  // Helper: menjalankan SATU checkout lewat inti produksi prosesCheckout(),
  // persis seperti route (fetch tax setting lalu proses dalam $transaction).
  async function checkout(args: {
    id?: string | null;
    warungId: string;
    cashierId: string;
    productId: string;
    qty: number;
    cash?: number;
    payment?: "CASH" | "QRIS";
    allowStokMinus?: boolean;
  }) {
    return prisma.$transaction(async (tx) => {
      const taxCfg = await getTaxSetting(tx, args.warungId);
      return prosesCheckout(tx, {
        id: args.id ?? null,
        warungId: args.warungId,
        cashierId: args.cashierId,
        items: [{ productId: args.productId, qty: args.qty }],
        cash: args.cash ?? 1_000_000,
        payment: args.payment ?? "CASH",
        discount: 0,
        mejaId: null,
        dibuatOffline: args.id != null,
        createdAt: null,
        taxCfg,
        allowStokMinus: args.allowStokMinus ?? false,
      });
    });
  }

  beforeAll(async () => {
    warungA = await seedWarung("Warung Sync Alpha");
    warungB = await seedWarung("Warung Sync Beta");

    const ka = await prisma.user.findFirst({ where: { warungId: warungA.id, role: "KASIR" } });
    const kb = await prisma.user.findFirst({ where: { warungId: warungB.id, role: "KASIR" } });
    if (!ka || !kb) throw new Error("Kasir tidak ditemukan");
    kasirA = ka;
    kasirB = kb;

    const pa = await prisma.product.findFirst({
      where: { warungId: warungA.id, stock: { gte: 50 } },
      orderBy: { price: "asc" },
    });
    const pb = await prisma.product.findFirst({
      where: { warungId: warungB.id, stock: { gte: 50 } },
      orderBy: { price: "asc" },
    });
    if (!pa || !pb) throw new Error("Produk stok besar tidak ditemukan");
    produkA = pa;
    produkB = pb;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("(1) IDEMPOTENCY: id sama dikirim 2× → 1 baris Transaction, stok turun SEKALI", async () => {
    const id = randomUUID();
    const before = await prisma.product.findUniqueOrThrow({ where: { id: produkA.id } });

    const first = await checkout({
      id,
      warungId: warungA.id,
      cashierId: kasirA.id,
      productId: produkA.id,
      qty: 3,
    });
    const second = await checkout({
      id,
      warungId: warungA.id,
      cashierId: kasirA.id,
      productId: produkA.id,
      qty: 3,
    });

    // Kedua panggilan menghasilkan id yang sama; yang kedua = hit (tidak buat baru).
    expect(first.id).toBe(id);
    expect(first.sudahAda).toBe(false);
    expect(second.id).toBe(id);
    expect(second.sudahAda).toBe(true);

    // TEPAT satu baris Transaction, satu set item, satu StockMove.
    expect(await prisma.transaction.count({ where: { id } })).toBe(1);
    expect(await prisma.transactionItem.count({ where: { transactionId: id } })).toBe(1);
    expect(
      await prisma.stockMove.count({ where: { refId: id, type: "PENJUALAN" } })
    ).toBe(1);

    // Stok berkurang SEKALI (bukan dua kali) — bukti inti anti-duplikat.
    const after = await prisma.product.findUniqueOrThrow({ where: { id: produkA.id } });
    expect(after.stock).toBe(before.stock - 3);

    // Total transaksi warung A bertambah tepat 1 selama test ini.
    const trxById = await prisma.transaction.findUniqueOrThrow({ where: { id } });
    expect(trxById.status).toBe("LUNAS");
    expect(trxById.warungId).toBe(warungA.id);
    expect(trxById.dibuatOffline).toBe(true);
  });

  it("(2) BATCH: dua transaksi id berbeda → keduanya tersimpan, stok turun sesuai jumlah", async () => {
    const id1 = randomUUID();
    const id2 = randomUUID();
    const before = await prisma.product.findUniqueOrThrow({ where: { id: produkA.id } });

    const r1 = await checkout({
      id: id1,
      warungId: warungA.id,
      cashierId: kasirA.id,
      productId: produkA.id,
      qty: 2,
    });
    const r2 = await checkout({
      id: id2,
      warungId: warungA.id,
      cashierId: kasirA.id,
      productId: produkA.id,
      qty: 5,
    });

    expect(r1.sudahAda).toBe(false);
    expect(r2.sudahAda).toBe(false);
    expect(r1.id).not.toBe(r2.id);

    expect(await prisma.transaction.count({ where: { id: { in: [id1, id2] } } })).toBe(2);
    const after = await prisma.product.findUniqueOrThrow({ where: { id: produkA.id } });
    expect(after.stock).toBe(before.stock - 7); // 2 + 5
  });

  it("(3) KONFLIK: stok kurang saat sync → transaksi TETAP diterima (boleh minus), bukan ditolak", async () => {
    // Produk stok kecil khusus untuk skenario konflik (PRD §12).
    const p = await prisma.product.create({
      data: { warungId: warungA.id, name: `SyncKonflik-${Date.now()}`, price: 1000, stock: 2 },
    });
    const id = randomUUID();

    // Minta 5 > stok 2, allowStokMinus=true (jalur sync) → diterima + ditandai.
    const hasil = await checkout({
      id,
      warungId: warungA.id,
      cashierId: kasirA.id,
      productId: p.id,
      qty: 5,
      allowStokMinus: true,
    });

    expect(hasil.sudahAda).toBe(false);
    expect(hasil.konflikStok).toBe(true);
    expect(hasil.konfliks[0].butuh).toBe(5);
    expect(hasil.konfliks[0].sisa).toBe(2);

    // Transaksi tersimpan & stok menjadi minus (2 - 5 = -3) — tidak ditolak.
    expect(await prisma.transaction.count({ where: { id } })).toBe(1);
    const after = await prisma.product.findUniqueOrThrow({ where: { id: p.id } });
    expect(after.stock).toBe(-3);

    // Jalur ONLINE tetap menolak stok kurang (kontrol: allowStokMinus=false).
    await expect(
      checkout({
        id: randomUUID(),
        warungId: warungA.id,
        cashierId: kasirA.id,
        productId: p.id,
        qty: 1,
        allowStokMinus: false,
      })
    ).rejects.toThrow(/Stok .* kurang/);
  });

  it("(4) ISOLASI TENANT: id milik warung A tidak bisa dipakai/disentuh dari context warung B", async () => {
    const id = randomUUID();
    // Transaksi milik warung A.
    await checkout({
      id,
      warungId: warungA.id,
      cashierId: kasirA.id,
      productId: produkA.id,
      qty: 1,
    });

    const stokBSehat = await prisma.product.findUniqueOrThrow({ where: { id: produkB.id } });

    // Warung B mengirim id yang sudah dipakai warung A → HARUS ditolak,
    // tidak boleh mengembalikan/membocorkan transaksi A.
    await expect(
      checkout({
        id,
        warungId: warungB.id,
        cashierId: kasirB.id,
        productId: produkB.id,
        qty: 1,
      })
    ).rejects.toThrow(/tidak ditemukan/i);

    // Stok warung B TIDAK tersentuh oleh percobaan lintas-tenant.
    const stokBSetelah = await prisma.product.findUniqueOrThrow({ where: { id: produkB.id } });
    expect(stokBSetelah.stock).toBe(stokBSehat.stock);

    // Transaksi id itu tetap milik warung A & tidak terlihat dari query warung B.
    const trx = await prisma.transaction.findUniqueOrThrow({ where: { id } });
    expect(trx.warungId).toBe(warungA.id);
    const dariB = await prisma.transaction.findMany({
      where: { warungId: warungB.id, id },
    });
    expect(dariB).toHaveLength(0);

    // Checkout baru di warung B dengan id segar → milik B, tak terlihat dari A.
    const idB = randomUUID();
    await checkout({
      id: idB,
      warungId: warungB.id,
      cashierId: kasirB.id,
      productId: produkB.id,
      qty: 1,
    });
    const trxB = await prisma.transaction.findUniqueOrThrow({ where: { id: idB } });
    expect(trxB.warungId).toBe(warungB.id);
    const dariA = await prisma.transaction.findMany({ where: { warungId: warungA.id, id: idB } });
    expect(dariA).toHaveLength(0);
  });
});
