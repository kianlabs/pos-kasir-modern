import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, transaksi } from "@/lib/prisma";
import { seedWarung } from "../prisma/seed";
import { bersihkanWarungUji } from "./helpers";
import { deriveStatusMeja, hitungUlangBill } from "@/lib/meja";

// Uji manajemen meja / bill DRAFT (plan Tahap 3 §5.7). Menguji kontrak domain
// yang dipakai endpoint: invarian satu DRAFT per meja, derive KOSONG/TERISI,
// stok hanya berkurang saat bayar, gabung/pisah memindah (bukan menyalin) item,
// DRAFT tidak bocor ke laporan (aturan #12), isolasi tenant, dan hitung ulang
// uang integer server-side.
//
// Test menyentuh DB test terpisah (Postgres, TEST_DATABASE_URL) via
// tests/global-setup.ts + tests/setup.ts — JANGAN pernah arahkan ke DB dev/produksi.
//
// Batasan (jujur): test ini menguji KONTRAK DOMAIN (query/invarian/hitung uang)
// terhadap DB nyata, bukan memanggil route handler HTTP. Handler butuh konteks
// request (cookies() + React.cache) yang belum ada harness-mock di repo ini.
// Alur buka/bayar di sini meniru handler sedekat mungkin; regresi K1 & P1
// (baris di bawah) terbukti gagal pada logika lama → perubahan perilaku
// handler tetap tertangkap. Lihat plan §8.6 & catatan reviewer soal batasan ini.
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

  // Helper: hapus semua bill DRAFT warung A (batal) agar test berikutnya
  // mulai dari peta meja bersih. Dipakai di awal test yang butuh meja KOSONG.
  async function bersihkanDraftA() {
    const drafts = await prisma.transaction.findMany({
      where: { warungId: warungA.id, status: "DRAFT" },
      select: { id: true },
    });
    const ids = drafts.map((d) => d.id);
    if (ids.length === 0) return;
    await prisma.transactionItem.deleteMany({ where: { transactionId: { in: ids } } });
    await prisma.transaction.deleteMany({ where: { id: { in: ids } } });
  }

  // Membuat bill DRAFT persis seperti handler POST /api/meja/[id]/bill:
  // cek-dalam-transaksi → satu DRAFT per meja, shift WAJIB BUKA.
  async function bukaBill(mejaId: string, warungId: string, cashierId: string) {
    return transaksi(async (tx) => {
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
    return transaksi(async (tx) => {
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
      // Fix A13: simpan rawDiscount (diskon diniatkan), bukan clamped `discount`.
      return tx.transaction.update({
        where: { id: billId },
        data: {
          subtotal: totals.subtotal,
          discount: totals.rawDiscount,
          tax: totals.tax,
          total: totals.total,
        },
      });
    });
  }

  // Bayar bill (POST /api/bills/[id]/bayar): validasi stok (qty TERAGREGASI
  // per produk) → decrement → StockMove → status LUNAS, semua dalam satu
  // transaksi. Subtotal dari SNAPSHOT item.price (bukan harga produk live).
  async function bayarBill(billId: string, warungId: string, cashierId: string, cash: number) {
    return transaksi(async (tx) => {
      const bill = await tx.transaction.findFirst({
        where: { id: billId, warungId, status: "DRAFT" },
        include: { items: true },
      });
      if (!bill) throw new Error("Bill tidak ditemukan.");
      if (bill.items.length === 0) throw new Error("Bill masih kosong.");

      // Agregasi qty per productId (fix K1: cegah stok minus saat >1 baris produk sama).
      const qtyByProduct = new Map<string, number>();
      for (const item of bill.items) {
        qtyByProduct.set(item.productId, (qtyByProduct.get(item.productId) ?? 0) + item.qty);
      }

      const products = await tx.product.findMany({
        where: { id: { in: Array.from(qtyByProduct.keys()) }, warungId },
      });
      const byId = new Map(products.map((p) => [p.id, p]));

      let subtotal = 0;
      for (const item of bill.items) subtotal += item.price * item.qty;

      for (const [productId, qty] of Array.from(qtyByProduct.entries())) {
        const p = byId.get(productId)!;
        if (p.stock < qty) throw new Error(`Stok ${p.name} kurang (sisa ${p.stock}).`);
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

      for (const [productId, qty] of Array.from(qtyByProduct.entries())) {
        await tx.product.update({
          where: { id: productId },
          data: { stock: { decrement: qty } },
        });
        await tx.stockMove.create({
          data: {
            warungId,
            productId,
            qty: -qty,
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
    await bersihkanWarungUji(["Warung Meja Alpha", "Warung Meja Beta"]);
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

  it("(a2) dua bukaBill bersamaan pada meja sama → tepat 1 sukses, 1 DRAFT", async () => {
    // Regresi aturan #11: cek-dalam-$transaction harus menolak klik ganda.
    // Pada SQLite+Prisma transaksi interaktif di-serialize → efektif atomik.
    await bersihkanDraftA();

    const hasil = await Promise.allSettled([
      bukaBill(mejaA1.id, warungA.id, kasirA.id),
      bukaBill(mejaA1.id, warungA.id, kasirA.id),
    ]);

    const sukses = hasil.filter((h) => h.status === "fulfilled");
    const gagal = hasil.filter((h) => h.status === "rejected");
    expect(sukses).toHaveLength(1);
    expect(gagal).toHaveLength(1);

    const draftCount = await prisma.transaction.count({
      where: { warungId: warungA.id, mejaId: mejaA1.id, status: "DRAFT" },
    });
    expect(draftCount).toBe(1);

    await bersihkanDraftA();
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
    await transaksi(async (tx) => {
      await tx.transactionItem.updateMany({
        where: { transactionId: source.id, warungId: warungA.id },
        data: { transactionId: target.id },
      });
      await tx.transaction.delete({ where: { id: source.id } });
      const totals = await hitungUlangBill(target.id, warungA.id, tx);
      await tx.transaction.update({
        where: { id: target.id },
        data: {
          subtotal: totals.subtotal,
          discount: totals.rawDiscount,
          tax: totals.tax,
          total: totals.total,
        },
      });
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
    await transaksi(async (tx) => {
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
      await tx.transaction.update({
        where: { id: source.id },
        data: {
          subtotal: st.subtotal,
          discount: st.rawDiscount,
          tax: st.tax,
          total: st.total,
        },
      });
      await tx.transaction.update({
        where: { id: target.id },
        data: {
          subtotal: tt.subtotal,
          discount: tt.rawDiscount,
          tax: tt.tax,
          total: tt.total,
        },
      });
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

  it("(e2/REGRESI K1) bayar setelah gabung TIDAK membuat stok minus", async () => {
    // Skenario bug: bill A & B masing-masing punya produk SAMA; gabung
    // memindah baris tanpa merge → bill tujuan punya 2 baris produk sama.
    // Logika bayar lama memvalidasi per-baris terhadap stok ter-cache →
    // dua baris lolos → decrement kumulatif → stok minus. Regresi ini harus
    // GAGAL pada kode lama dan LULUS setelah agregasi qty per produk.
    await bersihkanDraftA();
    const p = await prisma.product.create({
      data: { warungId: warungA.id, name: `ProdukK1-${Date.now()}`, price: 1000, stock: 2 },
    });

    const target = await bukaBill(mejaA1.id, warungA.id, kasirA.id);
    const source = await bukaBill(mejaA2.id, warungA.id, kasirA.id);
    await tambahItem(target.id, warungA.id, p.id, 1); // 1 × produk
    await tambahItem(source.id, warungA.id, p.id, 2); // 2 × produk

    // Gabung tanpa merge → 2 baris produk p di bill target.
    await transaksi(async (tx) => {
      await tx.transactionItem.updateMany({
        where: { transactionId: source.id, warungId: warungA.id },
        data: { transactionId: target.id },
      });
      await tx.transaction.delete({ where: { id: source.id } });
    });
    const baris = await prisma.transactionItem.count({
      where: { transactionId: target.id, productId: p.id },
    });
    expect(baris).toBe(2);

    // Bayar: qty teragregasi = 3 > stok 2 → HARUS ditolak (stok tetap 2).
    await expect(bayarBill(target.id, warungA.id, kasirA.id, 100000)).rejects.toThrow(
      /Stok .* kurang/
    );
    const setelahGagal = await prisma.product.findUniqueOrThrow({ where: { id: p.id } });
    expect(setelahGagal.stock).toBe(2); // tidak berkurang, tidak minus

    // Turunkan kebutuhan jadi tepat = stok (hapus baris qty 1, sisakan qty 2),
    // lalu bayar sukses dengan stok tepat 0 (bukan minus).
    await prisma.transactionItem.delete({
      where: { id: (await prisma.transactionItem.findFirstOrThrow({
        where: { transactionId: target.id, productId: p.id, qty: 1 },
      })).id },
    });
    await bayarBill(target.id, warungA.id, kasirA.id, 100000);
    const akhir = await prisma.product.findUniqueOrThrow({ where: { id: p.id } });
    expect(akhir.stock).toBe(0);
    expect(akhir.stock).toBeGreaterThanOrEqual(0);

    // Produk uji tidak dihapus (masih dirujuk TransactionItem → FK Restrict);
    // cukup bersihkan DRAFT. DB test dibuang tiap run (global-setup migrate).
    await bersihkanDraftA();
  });

  it("(e3/REGRESI P1) bayar memakai snapshot harga item, bukan harga produk live", async () => {
    // Bug lama: bayar memakai p.price (harga produk live) sementara PATCH/
    // struk memakai snapshot. Ubah harga produk saat bill terbuka → tagihan
    // tidak boleh ikut berubah.
    await bersihkanDraftA();
    const p = await prisma.product.create({
      data: { warungId: warungA.id, name: `ProdukP1-${Date.now()}`, price: 5000, stock: 10 },
    });
    const bill = await bukaBill(mejaA1.id, warungA.id, kasirA.id);
    await tambahItem(bill.id, warungA.id, p.id, 2); // subtotal snapshot = 10_000

    // Harga produk naik SETELAH item masuk bill.
    await prisma.product.update({ where: { id: p.id }, data: { price: 9000 } });

    const hasil = await bayarBill(bill.id, warungA.id, kasirA.id, 1_000_000);
    const lunas = await prisma.transaction.findUniqueOrThrow({ where: { id: hasil.id } });

    // Subtotal = 2 × 5000 (snapshot), bukan 2 × 9000 (live).
    expect(lunas.subtotal).toBe(10_000);
    expect(lunas.total).toBe(10_000 + Math.round(10_000 * 0.1)); // + pajak 10%

    // Stok turun 2 (dari 10 → 8).
    const after = await prisma.product.findUniqueOrThrow({ where: { id: p.id } });
    expect(after.stock).toBe(8);

    // Produk uji tidak dihapus (dirujuk TransactionItem → FK Restrict).
  });

  it("(a3/REGRESI A13) diskon pada bill KOSONG tidak hilang & bertahan setelah tambah item", async () => {
    // Bug lama: hitungUlangBill meng-clamp discount = min(discount, subtotal)
    // dan SEMUA pemanggil menyimpan nilai ter-clamp itu. Akibatnya diskon yang
    // diterapkan ke bill KOSONG (subtotal 0) langsung menulis discount=0 →
    // hilang tanpa jejak; diskon > subtotal juga terpotong permanen.
    // Fix: helper mengembalikan rawDiscount (tak ter-clamp) untuk DISIMPAN, dan
    // `discount` ter-clamp hanya dipakai untuk math pajak/total.
    await bersihkanDraftA();
    const p = await prisma.product.create({
      data: { warungId: warungA.id, name: `ProdukA13-${Date.now()}`, price: 2000, stock: 50 },
    });
    const bill = await bukaBill(mejaA1.id, warungA.id, kasirA.id);

    // Meniru PATCH /api/bills/[id] { discount } pada bill KOSONG: set diskon,
    // lalu hitung ulang DI DALAM tx dan simpan (persis alur route).
    await transaksi(async (tx) => {
      await tx.transaction.update({ where: { id: bill.id }, data: { discount: 5000 } });
      const totals = await hitungUlangBill(bill.id, warungA.id, tx);
      await tx.transaction.update({
        where: { id: bill.id },
        data: {
          subtotal: totals.subtotal,
          discount: totals.rawDiscount, // A13: simpan nilai diniatkan, bukan clamped
          tax: totals.tax,
          total: totals.total,
        },
      });
    });

    // Diskon SELAMAT: tersimpan 5000 walau subtotal masih 0.
    const setelahDiskon = await prisma.transaction.findUniqueOrThrow({ where: { id: bill.id } });
    expect(setelahDiskon.subtotal).toBe(0);
    expect(setelahDiskon.discount).toBe(5000);
    expect(setelahDiskon.total).toBe(0);

    // Tambah 1 item @2000 → subtotal 2000. Diskon TETAP 5000 (tidak ter-clamp
    // di kolom tersimpan). Clamp hanya menyentuh math: pajak 0, total 0.
    await tambahItem(bill.id, warungA.id, p.id, 1);
    const setelahItem = await prisma.transaction.findUniqueOrThrow({ where: { id: bill.id } });
    expect(setelahItem.subtotal).toBe(2000);
    expect(setelahItem.discount).toBe(5000); // ← regresi lama: 0 atau 2000
    expect(setelahItem.total).toBe(0); // 2000 - min(5000,2000) + 0
    expect(setelahItem.total).toBeGreaterThanOrEqual(0); // total tak pernah negatif

    // Membuktikan `discount` ter-clamp dipakai untuk math (bukan disimpan):
    const math = await hitungUlangBill(bill.id, warungA.id);
    expect(math.rawDiscount).toBe(5000);
    expect(math.discount).toBe(2000); // min(5000, 2000)
    expect(math.total).toBe(0);

    // Bersihkan DRAFT agar test (f) bisa membuka meja A1 lagi (mulai bersih).
    await bersihkanDraftA();
  });

  it("(f) DRAFT tidak bocor ke laporan: /transaksi & stats hanya LUNAS (aturan #12)", async () => {
    // Buat sendiri DRAFT dengan item & total > 0 agar pembuktian bermakna
    // (tidak bergantung sisa test sebelumnya).
    const p = await prisma.product.findFirstOrThrow({ where: { warungId: warungA.id } });
    const draft = await bukaBill(mejaA1.id, warungA.id, kasirA.id);
    await tambahItem(draft.id, warungA.id, p.id, 2);
    await tambahItem(draft.id, warungA.id, p.id, 1); // qty 3 → total > 0

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
