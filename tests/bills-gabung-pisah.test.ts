import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma, transaksi } from "@/server/db";
import { issueSession } from "@/server/session";
import { SESSION_COOKIE } from "@/shared/session-types";
import { seedWarung } from "../prisma/seed";
import { bersihkanWarungUji } from "./helpers";
import { hitungUlangBill } from "@/server/meja";

// Test gabung/pisah bill yang MEMANGGIL ROUTE ASLI:
//   POST /api/bills/[id]/gabung  (pindahkan SEMUA item bill sumber → bill tujuan, hapus sumber)
//   POST /api/bills/[id]/pisah   (pindahkan SEBAGIAN item bill sumber → bill DRAFT baru di meja lain)
//
// Pola sama dengan tests/rbac-products.test.ts: mock `next/headers` cookies()
// agar mengembalikan token sesi nyata (HMAC asli), lalu import handler dinamis
// + vi.resetModules tiap panggil supaya React.cache (memoize getSession) bersih.
//
// Butuh DB test (TEST_DATABASE_URL). Bill DRAFT + item dibuat lewat Prisma
// langsung di setup test (bukan lewat route buka-bill), karena yang diuji di
// sini adalah mutasi gabung/pisah-nya.
//
// Kontrak yang diverifikasi (plan §4.3, §7 keputusan 3):
// - Item DIPINDAH (update transactionId), BUKAN disalin → tidak ada duplikasi,
//   snapshot name/price utuh, dan stok TIDAK disentuh.
// - gabung: bill sumber terhapus, mejanya jadi KOSONG.
// - pisah: qty sebagian → baris asal dikurangi + baris baru dibuat; qty penuh →
//   baris dipindah.
// - guard: source===target ditolak, meja tujuan harus KOSONG, qty pisah > qty item ditolak.
// - RBAC: endpoint ini level kasir (tanpa gate owner) → sesi KASIR boleh.

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => (currentCookie?.name === name ? currentCookie : undefined),
  }),
}));

// Cookie yang sedang "aktif" untuk request berikutnya.
let currentCookie: { name: string; value: string } | undefined;

function setSessionCookie(token: string | undefined) {
  currentCookie = token ? { name: SESSION_COOKIE, value: token } : undefined;
}

describe("route /api/bills/[id]/gabung & /pisah (handler asli)", () => {
  const NAMA = "Warung Sementara Gabung Pisah";
  let warungId: string;
  let kasirId: string;
  let kasirToken: string;
  let meja: { id: string; nomor: string }[];
  let produk: { id: string; name: string; price: number }[];

  beforeAll(async () => {
    const w = await seedWarung(NAMA);
    warungId = w.id;

    const kasir = await prisma.user.findFirstOrThrow({
      where: { warungId, role: "KASIR", aktif: true },
    });
    kasirId = kasir.id;
    kasirToken = issueSession({
      id: kasir.id,
      warungId,
      role: "KASIR",
      name: kasir.name,
    }).token;

    meja = await prisma.meja.findMany({
      where: { warungId },
      select: { id: true, nomor: true },
      orderBy: { nomor: "asc" },
    });
    produk = await prisma.product.findMany({
      where: { warungId },
      select: { id: true, name: true, price: true },
      orderBy: { name: "asc" },
      take: 3,
    });

    expect(meja.length).toBeGreaterThanOrEqual(4);
    expect(produk.length).toBeGreaterThanOrEqual(2);
  });

  afterAll(async () => {
    await bersihkanWarungUji([NAMA]);
    await prisma.$disconnect();
  });

  // ── helper setup ────────────────────────────────────────────────────────

  // Hapus semua bill DRAFT warung ini (batal) agar tiap test mulai dari peta
  // meja bersih — meja KOSONG = tidak ada Transaction DRAFT di meja itu.
  async function bersihkanDraft() {
    const drafts = await prisma.transaction.findMany({
      where: { warungId, status: "DRAFT" },
      select: { id: true },
    });
    const ids = drafts.map((d) => d.id);
    if (ids.length === 0) return;
    await prisma.transactionItem.deleteMany({ where: { transactionId: { in: ids } } });
    await prisma.transaction.deleteMany({ where: { id: { in: ids } } });
  }

  // Buat bill DRAFT + item lewat Prisma langsung, total dihitung ulang via
  // hitungUlangBill (server-side) — sama seperti kontrak route bill.
  async function buatBillDraft(
    mejaId: string,
    items: { productId: string; name: string; price: number; qty: number }[]
  ) {
    return transaksi(async (tx) => {
      const bill = await tx.transaction.create({
        data: { warungId, mejaId, cashierId: kasirId, status: "DRAFT", total: 0 },
      });
      const created = [];
      for (const it of items) {
        created.push(
          await tx.transactionItem.create({
            data: {
              warungId,
              transactionId: bill.id,
              productId: it.productId,
              name: it.name,
              price: it.price,
              qty: it.qty,
            },
          })
        );
      }
      const totals = await hitungUlangBill(bill.id, warungId, tx);
      await tx.transaction.update({
        where: { id: bill.id },
        data: {
          subtotal: totals.subtotal,
          discount: totals.rawDiscount,
          tax: totals.tax,
          total: totals.total,
        },
      });
      return { bill, items: created };
    });
  }

  // Handler diimpor ulang tiap panggil agar React.cache (memoize getSession) bersih.
  async function panggilGabung(id: string, body: unknown) {
    vi.resetModules();
    const { POST } = await import("@/app/api/bills/[id]/gabung/route");
    const req = new Request(`http://localhost/api/bills/${id}/gabung`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return POST(req, { params: { id } });
  }

  async function panggilPisah(id: string, body: unknown) {
    vi.resetModules();
    const { POST } = await import("@/app/api/bills/[id]/pisah/route");
    const req = new Request(`http://localhost/api/bills/${id}/pisah`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return POST(req, { params: { id } });
  }

  // ── 1. gabung: pindah item, bukan salin ─────────────────────────────────

  it("gabung memindahkan item (bukan menyalin) & menghapus bill sumber", async () => {
    await bersihkanDraft();
    setSessionCookie(kasirToken);

    const [pA, pB] = produk;
    const target = await buatBillDraft(meja[0].id, [
      { productId: pA.id, name: pA.name, price: pA.price, qty: 2 },
    ]);
    const source = await buatBillDraft(meja[1].id, [
      { productId: pB.id, name: pB.name, price: pB.price, qty: 3 },
    ]);
    const stokSebelum = await prisma.product.findUniqueOrThrow({ where: { id: pB.id } });

    const res = await panggilGabung(target.bill.id, { sourceBillId: source.bill.id });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.moved).toBe(1); // satu baris item dipindah
    // subtotal = 2*pA.price + 3*pB.price; tax 10%.
    const subtotal = 2 * pA.price + 3 * pB.price;
    expect(json.subtotal).toBe(subtotal);
    expect(json.total).toBe(subtotal + Math.round(subtotal * 0.1));

    // Bill sumber HILANG (dihapus), bukan dibiarkan kosong.
    const sourceAfter = await prisma.transaction.findUnique({ where: { id: source.bill.id } });
    expect(sourceAfter).toBeNull();

    // Meja sumber jadi KOSONG (tidak ada DRAFT tersisa di meja itu).
    const draftDiMejaSumber = await prisma.transaction.findFirst({
      where: { warungId, mejaId: meja[1].id, status: "DRAFT" },
    });
    expect(draftDiMejaSumber).toBeNull();

    // Item pindah: kini dimiliki bill tujuan, snapshot utuh, TIDAK diduplikasi.
    const itemsTarget = await prisma.transactionItem.findMany({
      where: { transactionId: target.bill.id, warungId },
      orderBy: { name: "asc" },
    });
    expect(itemsTarget).toHaveLength(2);
    const movedRow = itemsTarget.find((i) => i.productId === pB.id);
    expect(movedRow).toBeTruthy();
    expect(movedRow!.qty).toBe(3); // qty utuh, bukan disalin sebagian
    expect(movedRow!.price).toBe(pB.price); // snapshot harga tetap
    // Hanya SATU baris untuk pB di seluruh warung → membuktikan "pindah" bukan "salin".
    const barisPB = await prisma.transactionItem.count({ where: { warungId, productId: pB.id } });
    expect(barisPB).toBe(1);

    // Total tersimpan di DB ikut terhitung ulang.
    const targetAfter = await prisma.transaction.findUniqueOrThrow({
      where: { id: target.bill.id },
    });
    expect(targetAfter.subtotal).toBe(subtotal);
    expect(targetAfter.total).toBe(json.total);

    // Stok produk TIDAK disentuh (gabung tidak menyentuh stok).
    const pBrow = await prisma.product.findUniqueOrThrow({ where: { id: pB.id } });
    expect(pBrow.stock).toBe(stokSebelum.stock);
  });

  // ── 2. pisah sebagian ───────────────────────────────────────────────────

  it("pisah sebagian: item terbagi benar (baris asal dikurangi + baris baru)", async () => {
    await bersihkanDraft();
    setSessionCookie(kasirToken);

    const [pA] = produk;
    const source = await buatBillDraft(meja[0].id, [
      { productId: pA.id, name: pA.name, price: pA.price, qty: 5 },
    ]);
    const itemAsal = source.items[0];

    const res = await panggilPisah(source.bill.id, {
      targetMejaId: meja[2].id,
      items: [{ transactionItemId: itemAsal.id, qty: 2 }],
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.targetMejaId).toBe(meja[2].id);
    const newBillId = json.billId as string;

    // Baris asal dikurangi jadi 3; baris baru di bill tujuan qty 2 (snapshot sama).
    const itemAsalAfter = await prisma.transactionItem.findUniqueOrThrow({
      where: { id: itemAsal.id },
    });
    expect(itemAsalAfter.transactionId).toBe(source.bill.id);
    expect(itemAsalAfter.qty).toBe(3);

    const itemsTarget = await prisma.transactionItem.findMany({
      where: { transactionId: newBillId, warungId },
    });
    expect(itemsTarget).toHaveLength(1);
    expect(itemsTarget[0].productId).toBe(pA.id);
    expect(itemsTarget[0].qty).toBe(2);
    expect(itemsTarget[0].price).toBe(pA.price); // snapshot harga tersalin

    // Total kedua bill dihitung ulang dari item.
    const srcTotals = await hitungUlangBill(source.bill.id, warungId);
    expect(srcTotals.subtotal).toBe(3 * pA.price);
    expect(srcTotals.total).toBe(3 * pA.price + Math.round(3 * pA.price * 0.1));

    const tgtBill = await prisma.transaction.findUniqueOrThrow({ where: { id: newBillId } });
    expect(tgtBill.status).toBe("DRAFT");
    expect(tgtBill.mejaId).toBe(meja[2].id);
    expect(tgtBill.subtotal).toBe(2 * pA.price);
    expect(tgtBill.total).toBe(2 * pA.price + Math.round(2 * pA.price * 0.1));
    expect(json.source.total).toBe(srcTotals.total);
    expect(json.target.total).toBe(tgtBill.total);
  });

  it("pisah penuh (qty = qty item): baris dipindah utuh, bukan disalin", async () => {
    await bersihkanDraft();
    setSessionCookie(kasirToken);

    const [pA] = produk;
    const source = await buatBillDraft(meja[0].id, [
      { productId: pA.id, name: pA.name, price: pA.price, qty: 4 },
    ]);
    const itemAsal = source.items[0];

    const res = await panggilPisah(source.bill.id, {
      targetMejaId: meja[3].id,
      items: [{ transactionItemId: itemAsal.id, qty: 4 }],
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    const newBillId = json.billId as string;

    // Baris asal yang SAMA berpindah pemilik (update transactionId), tidak ada
    // baris baru → membuktikan "pindah" bukan "salin".
    const itemAfter = await prisma.transactionItem.findUniqueOrThrow({ where: { id: itemAsal.id } });
    expect(itemAfter.transactionId).toBe(newBillId);
    expect(itemAfter.qty).toBe(4);
    const jumlahBaris = await prisma.transactionItem.count({
      where: { warungId, productId: pA.id },
    });
    expect(jumlahBaris).toBe(1);
    expect(await prisma.transactionItem.count({ where: { transactionId: source.bill.id } })).toBe(0);
  });

  // ── 3. guard ────────────────────────────────────────────────────────────

  it("guard: bill sumber === tujuan ditolak (400)", async () => {
    await bersihkanDraft();
    setSessionCookie(kasirToken);

    const [pA] = produk;
    const bill = await buatBillDraft(meja[0].id, [
      { productId: pA.id, name: pA.name, price: pA.price, qty: 1 },
    ]);

    const res = await panggilGabung(bill.bill.id, { sourceBillId: bill.bill.id });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/tidak boleh sama/i);

    // Bill sumber tetap ada (tidak ada mutasi).
    expect(await prisma.transaction.findUnique({ where: { id: bill.bill.id } })).not.toBeNull();
  });

  it("guard: meja tujuan pisah harus KOSONG (409 bila sudah ada DRAFT)", async () => {
    await bersihkanDraft();
    setSessionCookie(kasirToken);

    const [pA] = produk;
    const source = await buatBillDraft(meja[0].id, [
      { productId: pA.id, name: pA.name, price: pA.price, qty: 3 },
    ]);
    // Meja tujuan sudah terisi bill DRAFT.
    await buatBillDraft(meja[1].id, [
      { productId: pA.id, name: pA.name, price: pA.price, qty: 1 },
    ]);

    const res = await panggilPisah(source.bill.id, {
      targetMejaId: meja[1].id,
      items: [{ transactionItemId: source.items[0].id, qty: 1 }],
    });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toMatch(/sudah punya bill/i);
  });

  it("guard: qty pisah > qty item ditolak (400)", async () => {
    await bersihkanDraft();
    setSessionCookie(kasirToken);

    const [pA] = produk;
    const source = await buatBillDraft(meja[0].id, [
      { productId: pA.id, name: pA.name, price: pA.price, qty: 2 },
    ]);

    const res = await panggilPisah(source.bill.id, {
      targetMejaId: meja[2].id,
      items: [{ transactionItemId: source.items[0].id, qty: 5 }],
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/melebihi qty item/i);

    // Rollback atomik: qty item asal TIDAK berubah, tidak ada bill tujuan baru.
    const itemAfter = await prisma.transactionItem.findUniqueOrThrow({
      where: { id: source.items[0].id },
    });
    expect(itemAfter.qty).toBe(2);
    expect(
      await prisma.transaction.findFirst({
        where: { warungId, mejaId: meja[2].id, status: "DRAFT" },
      })
    ).toBeNull();
  });

  // ── 4. RBAC: endpoint level kasir ───────────────────────────────────────

  it("RBAC: sesi KASIR (bukan owner) boleh gabung & pisah", async () => {
    await bersihkanDraft();
    setSessionCookie(kasirToken);

    const [pA, pB] = produk;
    const target = await buatBillDraft(meja[0].id, [
      { productId: pA.id, name: pA.name, price: pA.price, qty: 1 },
    ]);
    const source = await buatBillDraft(meja[1].id, [
      { productId: pB.id, name: pB.name, price: pB.price, qty: 1 },
    ]);

    // Route gabung/pisah tidak memanggil requireOwnerResponse → kasir lolos.
    const gabungRes = await panggilGabung(target.bill.id, { sourceBillId: source.bill.id });
    expect(gabungRes.status).toBe(200);

    const pisahSource = await buatBillDraft(meja[2].id, [
      { productId: pA.id, name: pA.name, price: pA.price, qty: 2 },
    ]);
    const pisahRes = await panggilPisah(pisahSource.bill.id, {
      targetMejaId: meja[3].id,
      items: [{ transactionItemId: pisahSource.items[0].id, qty: 1 }],
    });
    expect(pisahRes.status).toBe(200);
  });

  it("tanpa sesi: currentWarungId melempar (endpoint bergantung sesi)", async () => {
    await bersihkanDraft();
    setSessionCookie(undefined);

    // Route tidak membungkus currentWarungId() di try/catch → promise reject.
    await expect(panggilGabung("id-palsu", { sourceBillId: "x" })).rejects.toThrow(/session/i);
  });
});
