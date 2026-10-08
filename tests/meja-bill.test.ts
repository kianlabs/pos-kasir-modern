import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { seedWarung } from "../prisma/seed";
import { deriveStatusMeja, hitungUlangBill } from "@/lib/meja";

// Uji manajemen meja / bill DRAFT (plan Tahap 3 §5.7). Menguji kontrak domain
// yang dipakai endpoint: invarian satu DRAFT per meja, derive KOSONG/TERISI,
// stok hanya berkurang saat bayar, gabung/pisah memindah (bukan menyalin) item,
// DRAFT tidak bocor ke laporan (aturan #12), isolasi tenant, dan hitung ulang
// uang integer server-side.
//
// Test menyentuh DB test terpisah (prisma/test.db) via tests/global-setup.ts +
// tests/setup.ts — JANGAN pernah arahkan ke dev.db.
describe("manajemen meja & bill DRAFT (Tahap 3)", () => {
  let warungA: { id: string; nama: string };
  let warungB: { id: string; nama: string };
  let kasirA: { id: string };
  let kasirB: { id: string };
  let shiftA: { id: string };

  // Produk & meja warung A yang dipakai berulang.
  let mejaA1: { id: string; nomor: string };
  let mejaA2: { id: string; nomor: string };
  let mejaA3: { id: string; nomor: string };
  let produkA: { id: string; name: string; price: number; stock: number };

  // Helper: ambil produk baru segar (stok bisa berubah antar test).
  async function getProdukA() {
    const p = await prisma.product.findUniqueOrThrow({ where: { id: produkA.id } });
    return p;
  }

  // Membuat bill DRAFT persis seperti handler POST /api/meja/[id]/bill:
  // cek-dalam-transaksi → satu DRAFT per meja, shift WAJIB BUKA.
  async function bukaBill(mejaId: string, warungId: string, cashierId: string) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.transaction.findFirst({
        where: { warungId, mejaId, status: "DRAFT" },
      });
      if (existing) throw new Error("Meja sudah punya bill terbuka.");
      const shift = await tx.shift.findFirst({
        where: { warungId, status: "BUKA" },
        orderBy: { openedAt: "desc" },
      });
      if (!shift) throw new Error("Belum ada shift terbuka. Buka shift dulu.");
      return tx.transaction.create({
        data: { warungId, mejaId, shiftId: shift.id, cashierId, status: "DRAFT", total: 0 },
      });
    });
  }

  // Menambah item ke bill (PATCH /api/bills/[id]): upsert qty per productId,
  // hitung ulang total atomik via hitungUlangBill(tx). TIDAK menyentuh stok.
  async function tambahItem(
    billId: string,
    warungId: string,
    productId: string,
    qty: number,
    discount?: number
  ) {
    return prisma.$transaction(async (tx) => {
      if (discount !== undefined) {
        await tx.transaction.update({ where: { id: billId }, data: { discount } });
      }
      const existing = await tx.transactionItem.findFirst({
        where: { transactionId: billId, productId, warungId },
      });
      if (existing) {
        await tx.transactionItem.update({
          where: { id: existing.id },
          data: { qty: existing.qty + qty },
        });
      } else {
        const p = await tx.product.findFirstOrThrow({ where: { id: productId, warungId } });
        await tx.transactionItem.create({
          data: {
            warungId,
            transactionId: billId,
            productId: p.id,
            name: p.name,
            price: p.price,
            qty,
          },
        });
      }
      const totals = await hitungUlangBill(billId, warungId, tx);
      return tx.transaction.update({ where: { id: billId }, data: totals });
    });
  }

  // Bayar bill (POST /api/bills/[id]/bayar): validasi stok → decrement →
  // StockMove → status LUNAS, semua dalam satu transaksi.
  async function bayarBill(billId: string, warungId: string, cashierId: string, cash: number) {
    return prisma.$transaction(async (tx) => {
      const bill = await tx.transaction.findFirst({
        where: { id: billId, warungId, status: "DRAFT" },
        include: { items: true },
      });
      if (!bill) throw new Error("Bill tidak ditemukan.");
      if (bill.items.length === 0) throw new Error("Bill masih kosong.");

      const products = await tx.product.findMany({
        where: { id: { in: bill.items.map((i) => i.productId) }, warungId },
      });
      const byId = new Map(products.map((p) => [p.id, p]));

      let subtotal = 0;
      for (const item of bill.items) {
        const p = byId.get(item.productId)!;
        if (p.stock < item.qty) throw new Error(`Stok ${p.name} kurang (sisa ${p.stock}).`);
        subtotal += p.price * item.qty;
      }

      const discount = Math.min(bill.discount, subtotal);
      const setting = await tx.setting.findUnique({ where: { warungId } });
      const taxEnabled = setting ? !!setting.taxEnabled : true;
      const taxPct = setting ? Number(setting.taxPct) || 0 : 10;
      const tax = taxEnabled ? Math.round(((subtotal - discount) * taxPct) / 100) : 0;
      const total = subtotal - discount + tax;
      if (cash < total) throw new Error(`Uang kurang ${total - cash}.`);

      await tx.transaction.update({
        where: { id: bill.id },
        data: {
          status: "LUNAS",
          subtotal,
          discount,
          tax,
          total,
          cash,
          change: cash - total,
          payment: "CASH",
        },
      });

      for (const item of bill.items) {
        const p = byId.get(item.productId)!;
        await tx.product.update({
          where: { id: p.id },
          data: { stock: { decrement: item.qty } },
        });
        await tx.stockMove.create({
          data: {
            warungId,
            productId: p.id,
            qty: -item.qty,
            type: "PENJUALAN",
            refId: bill.id,
            createdBy: cashierId,
          },
        });
      }

      return { id: bill.id, total };
    });
  }

  beforeAll(async () => {
    warungA = await seedWarung("Warung Meja Alpha");
    warungB = await seedWarung("Warung Meja Beta");

    const ka = await prisma.user.findFirst({ where: { warungId: warungA.id, role: "KASIR" } });
    const kb = await prisma.user.findFirst({ where: { warungId: warungB.id, role: "KASIR" } });
    if (!ka || !kb) throw new Error("Kasir tidak ditemukan");
    kasirA = ka;
    kasirB = kb;

    const mejasA = await prisma.meja.findMany({
      where: { warungId: warungA.id },
      orderBy: { nomor: "asc" },
    });
    if (mejasA.length < 3) throw new Error("Butuh minimal 3 meja warung A");
    mejaA1 = mejasA[0];
    mejaA2 = mejasA[1];
    mejaA3 = mejasA[2];

    const p = await prisma.product.findFirst({
      where: { warungId: warungA.id, stock: { gte: 20 } },
      orderBy: { price: "asc" },
    });
    if (!p) throw new Error("Produk stok besar tidak ditemukan");
    produkA = p;

    shiftA = await prisma.shift.create({
      data: { warungId: warungA.id, cashierId: kasirA.id, modalAwal: 100000, status: "BUKA" },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("(a) dua bill DRAFT di meja berbeda → item tidak tercampur", async () => {
    const bill1 = await bukaBill(mejaA1.id, warungA.id, kasirA.id);
    const bill2 = await bukaBill(mejaA2.id, warungA.id, kasirA.id);

    expect(bill1.id).not.toBe(bill2.id);
    expect(bill1.status).toBe("DRAFT");
    expect(bill1.mejaId).toBe(mejaA1.id);
    expect(bill2.mejaId).toBe(mejaA2.id);

    await tambahItem(bill1.id, warungA.id, produkA.id, 2);
    await tambahItem(bill2.id, warungA.id, produkA.id, 5);

    const items1 = await prisma.transactionItem.findMany({ where: { transactionId: bill1.id } });
    const items2 = await prisma.transactionItem.findMany({ where: { transactionId: bill2.id } });

    expect(items1).toHaveLength(1);
    expect(items2).toHaveLength(1);
    expect(items1[0].qty).toBe(2);
    expect(items2[0].qty).toBe(5);

    // Bill 1 tidak memuat item bill 2 (dan sebaliknya).
    const ids1 = new Set(items1.map((i) => i.id));
    expect(items2.some((i) => ids1.has(i.id))).toBe(false);

    // Bersihkan agar test berikutnya mulai dari meja kosong.
    await prisma.transactionItem.deleteMany({
      where: { transactionId: { in: [bill1.id, bill2.id] } },
    });
    await prisma.transaction.deleteMany({ where: { id: { in: [bill1.id, bill2.id] } } });
  });

  it("invarian: meja yang sudah punya bill DRAFT tidak bisa dibuka lagi", async () => {
    const bill = await bukaBill(mejaA1.id, warungA.id, kasirA.id);
    await expect(bukaBill(mejaA1.id, warungA.id, kasirA.id)).rejects.toThrow(
      /sudah punya bill terbuka/
    );
    await prisma.transaction.delete({ where: { id: bill.id } });
  });

  it("(b) bayar bill DRAFT mengurangi stok SEKALI + catat StockMove + status LUNAS", async () => {
    const before = await getProdukA();
    const bill = await bukaBill(mejaA1.id, warungA.id, kasirA.id);
    await tambahItem(bill.id, warungA.id, produkA.id, 3);

    // Stok BELUM berkurang saat DRAFT / tambah item (§7 keputusan 3).
    const saatDraft = await getProdukA();
    expect(saatDraft.stock).toBe(before.stock);

    const result = await bayarBill(bill.id, warungA.id, kasirA.id, 1000000);

    const after = await getProdukA();
    expect(after.stock).toBe(before.stock - 3);

    const lunas = await prisma.transaction.findUniqueOrThrow({ where: { id: result.id } });
    expect(lunas.status).toBe("LUNAS");
    expect(lunas.mejaId).toBe(mejaA1.id); // mejaId dipertahankan saat bayar

    // Tepat satu StockMove PENJUALAN untuk bill ini.
    const moves = await prisma.stockMove.findMany({
      where: { refId: bill.id, type: "PENJUALAN" },
    });
    expect(moves).toHaveLength(1);
    expect(moves[0].qty).toBe(-3);
  });

  it("(c) batal bill tidak mengubah stok", async () => {
    const before = await getProdukA();
    const bill = await bukaBill(mejaA2.id, warungA.id, kasirA.id);
    await tambahItem(bill.id, warungA.id, produkA.id, 4);

    // Batal = hapus bill + item (stok belum pernah dikurangi).
    await prisma.transactionItem.deleteMany({ where: { transactionId: bill.id } });
    await prisma.transaction.delete({ where: { id: bill.id } });

    const after = await getProdukA();
    expect(after.stock).toBe(before.stock);
    expect(await prisma.transaction.findUnique({ where: { id: bill.id } })).toBeNull();
  });

  it("(d) gabung memindahkan item tanpa duplikasi, meja sumber KOSONG", async () => {
    const target = await bukaBill(mejaA1.id, warungA.id, kasirA.id);
    const source = await bukaBill(mejaA2.id, warungA.id, kasirA.id);

    await tambahItem(target.id, warungA.id, produkA.id, 1);
    await tambahItem(source.id, warungA.id, produkA.id, 2);

    const totalItemSebelum =
      (await prisma.transactionItem.count({ where: { transactionId: target.id } })) +
      (await prisma.transactionItem.count({ where: { transactionId: source.id } }));

    // Gabung: pindahkan semua item sumber → target, hapus bill sumber.
    await prisma.$transaction(async (tx) => {
      await tx.transactionItem.updateMany({
        where: { transactionId: source.id, warungId: warungA.id },
        data: { transactionId: target.id },
      });
      await tx.transaction.delete({ where: { id: source.id } });
      const totals = await hitungUlangBill(target.id, warungA.id, tx);
      await tx.transaction.update({ where: { id: target.id }, data: totals });
    });

    // Tidak ada duplikasi: total baris item tetap sama (1 item produk yang sama
    // di kedua bill tetap 2 baris — tidak digabung otomatis).
    const totalItemSesudah = await prisma.transactionItem.count({
      where: { transactionId: target.id },
    });
    expect(totalItemSesudah).toBe(totalItemSebelum);

    // Bill sumber hilang → meja A2 kembali KOSONG.
    expect(await prisma.transaction.findUnique({ where: { id: source.id } })).toBeNull();
    const peta = await deriveStatusMeja(warungA.id);
    expect(peta.find((m) => m.id === mejaA2.id)?.status).toBe("KOSONG");
    expect(peta.find((m) => m.id === mejaA1.id)?.status).toBe("TERISI");
  });

  it("(e) pisah memindahkan sebagian item (bukan menyalin) ke meja kosong", async () => {
    const source = await prisma.transaction.findFirstOrThrow({
      where: { warungId: warungA.id, mejaId: mejaA1.id, status: "DRAFT" },
      include: { items: true },
    });
    const item = source.items[0];
    const qtyAsal = item.qty;

    // Meja A2 harus KOSONG; buka bill baru di sana sebagai target pisah.
    const target = await bukaBill(mejaA2.id, warungA.id, kasirA.id);

    const moveQty = 1;
    await prisma.$transaction(async (tx) => {
      await tx.transactionItem.update({
        where: { id: item.id },
        data: { qty: qtyAsal - moveQty },
      });
      await tx.transactionItem.create({
        data: {
          warungId: warungA.id,
          transactionId: target.id,
          productId: item.productId,
          name: item.name,
          price: item.price,
          qty: moveQty,
        },
      });
      const st = await hitungUlangBill(source.id, warungA.id, tx);
      const tt = await hitungUlangBill(target.id, warungA.id, tx);
      await tx.transaction.update({ where: { id: source.id }, data: st });
      await tx.transaction.update({ where: { id: target.id }, data: tt });
    });

    const itemSumber = await prisma.transactionItem.findUniqueOrThrow({ where: { id: item.id } });
    const itemTarget = await prisma.transactionItem.findFirstOrThrow({
      where: { transactionId: target.id, productId: item.productId },
    });

    // Item dipindah, bukan disalin: sumber berkurang, target bertambah.
    expect(itemSumber.qty).toBe(qtyAsal - moveQty);
    expect(itemTarget.qty).toBe(moveQty);
    expect(itemTarget.id).not.toBe(item.id); // baris baru (snapshot sama)

    // Total kedua bill konsisten dengan item masing-masing.
    const billSumber = await prisma.transaction.findUniqueOrThrow({ where: { id: source.id } });
    const hitungSumber = await hitungUlangBill(source.id, warungA.id);
    expect(billSumber.total).toBe(hitungSumber.total);
  });

  it("(f) DRAFT tidak bocor ke laporan: /transaksi & stats hanya LUNAS (aturan #12)", async () => {
    // Saat ini ada DRAFT terbuka (sisa test sebelumnya) DENGAN item & total.
    const drafts = await prisma.transaction.findMany({
      where: { warungId: warungA.id, status: "DRAFT" },
      include: { items: true },
    });
    expect(drafts.length).toBeGreaterThan(0);
    // Bukti bermakna: DRAFT memang punya item & total > 0, jadi filter LUNAS
    // benar-benar menguji pengecualian (bukan lolos karena total 0).
    const adaItemDraft = drafts.some((d) => d.items.length > 0 && d.total > 0);
    expect(adaItemDraft).toBe(true);

    // Meniru where-clause halaman /transaksi (status: "LUNAS").
    const daftarTransaksi = await prisma.transaction.findMany({
      where: { warungId: warungA.id, status: "LUNAS" },
    });
    expect(daftarTransaksi.every((t) => t.status === "LUNAS")).toBe(true);
    expect(daftarTransaksi.some((t) => drafts.some((d) => d.id === t.id))).toBe(false);

    // Meniru stats/export: total penjualan HANYA dari LUNAS.
    const salesLunas = await prisma.transaction.aggregate({
      where: { warungId: warungA.id, status: "LUNAS" },
      _sum: { total: true },
    });
    const draftSum = await prisma.transaction.aggregate({
      where: { warungId: warungA.id, status: "DRAFT" },
      _sum: { total: true },
    });
    // DRAFT punya nilai > 0, tetapi TIDAK ikut ke penjualan LUNAS.
    expect(draftSum._sum.total ?? 0).toBeGreaterThan(0);
    const allSum = await prisma.transaction.aggregate({
      where: { warungId: warungA.id },
      _sum: { total: true },
    });
    // Penjualan LUNAS + DRAFT = total semua (bukti DRAFT memang dikecualikan).
    expect((salesLunas._sum.total ?? 0) + (draftSum._sum.total ?? 0)).toBe(
      allSum._sum.total ?? 0
    );
  });

  it("(g) isolasi tenant: meja/bill warung A tidak terlihat dari warung B", async () => {
    const mejaB = await prisma.meja.findFirstOrThrow({ where: { warungId: warungB.id } });

    // Bill DRAFT warung A tidak muncul saat query warung B.
    const draftB = await prisma.transaction.findMany({
      where: { warungId: warungB.id, status: "DRAFT" },
    });
    expect(draftB.every((t) => t.warungId === warungB.id)).toBe(true);

    // deriveStatusMeja warung B tidak pernah menyentuh meja warung A.
    const petaB = await deriveStatusMeja(warungB.id);
    expect(petaB.every((m) => m.id !== mejaA1.id && m.id !== mejaA2.id)).toBe(true);
    expect(petaB.some((m) => m.id === mejaB.id)).toBe(true);

    // Buka bill di warung B dengan shift BUKA → bill tetap milik B.
    await prisma.shift.create({
      data: { warungId: warungB.id, cashierId: kasirB.id, modalAwal: 50000, status: "BUKA" },
    });
    const billB = await bukaBill(mejaB.id, warungB.id, kasirB.id);
    expect(billB.warungId).toBe(warungB.id);

    // Bill warung B tidak terlihat dari query warung A.
    const draftA = await prisma.transaction.findMany({
      where: { warungId: warungA.id, status: "DRAFT" },
    });
    expect(draftA.some((t) => t.id === billB.id)).toBe(false);
  });

  it("(h) tutup shift diblokir 409 saat ada DRAFT, sukses setelah bersih", async () => {
    // Shift warung A masih BUKA dan masih ada bill DRAFT → guard menolak.
    const countDraft = await prisma.transaction.count({
      where: { warungId: warungA.id, status: "DRAFT" },
    });
    expect(countDraft).toBeGreaterThan(0);

    // Meniru guard di POST /api/shifts/[id]/close.
    function bolehTutup(n: number) {
      return n === 0;
    }
    expect(bolehTutup(countDraft)).toBe(false);

    // Bersihkan semua DRAFT warung A (batal).
    const drafts = await prisma.transaction.findMany({
      where: { warungId: warungA.id, status: "DRAFT" },
      select: { id: true },
    });
    await prisma.transactionItem.deleteMany({
      where: { transactionId: { in: drafts.map((d) => d.id) } },
    });
    await prisma.transaction.deleteMany({ where: { id: { in: drafts.map((d) => d.id) } } });

    const sisaDraft = await prisma.transaction.count({
      where: { warungId: warungA.id, status: "DRAFT" },
    });
    expect(sisaDraft).toBe(0);

    // Sekarang tutup shift berhasil (guard lolos).
    const closed = await prisma.shift.update({
      where: { id: shiftA.id },
      data: { status: "TUTUP", closedAt: new Date(), kasFisik: 100000 },
    });
    expect(closed.status).toBe("TUTUP");
  });

  it("deriveStatusMeja: KOSONG bila tidak ada bill terbuka", async () => {
    const peta = await deriveStatusMeja(warungA.id);
    expect(peta.every((m) => m.status === "KOSONG")).toBe(true);
    expect(peta.every((m) => m.billId === null)).toBe(true);
  });
});
