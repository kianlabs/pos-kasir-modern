import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/server/db";
import { issueSession } from "@/server/session";
import { SESSION_COOKIE } from "@/shared/session-types";
import { hitungUang } from "@/shared/hitung-uang";
import { seedWarung } from "../prisma/seed";
import { bersihkanWarungUji } from "./helpers";

// Uji handler RUTE NYATA untuk: PATCH /api/settings (owner-only), GET
// /api/stock-moves (kartu stok ter-scope tenant), dan PATCH/DELETE
// /api/bills/[id] (ubah item/diskon + batal bill). Menutup GAP audit: rute-rute
// ini sebelumnya TIDAK punya test yang memanggil handler aslinya.
//
// Pola sama dengan tests/rbac-products.test.ts & tests/bills-gabung-pisah.test.ts:
// mock `next/headers` cookies() agar mengembalikan token sesi NYATA (HMAC asli),
// lalu import handler dinamis + vi.resetModules tiap panggil supaya React.cache
// (memoize getSession) bersih. Ini penting untuk settings: gate owner memakai
// requireOwnerResponse() yang membaca getSession() LANGSUNG — bukan fungsi
// tenant yang biasa di-mock.

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

describe("rute settings / stock-moves / bills — handler asli", () => {
  const NAMA = "Warung Sementara Settings";
  const NAMA_LAIN = "Warung Sementara Settings Lain";

  let warungId: string;
  let warungLainId: string;
  let kasirId: string;
  let kasirToken: string;
  let ownerToken: string;
  let meja: { id: string; nomor: string }[];
  let produk: { id: string; name: string; price: number }[];
  // Produk milik warung LAIN (untuk uji isolasi stock-moves).
  let produkLain: { id: string };

  beforeAll(async () => {
    const w = await seedWarung(NAMA);
    warungId = w.id;
    const wLain = await seedWarung(NAMA_LAIN);
    warungLainId = wLain.id;

    const kasir = await prisma.user.findFirstOrThrow({
      where: { warungId, role: "KASIR", aktif: true },
    });
    kasirId = kasir.id;
    kasirToken = issueSession({ id: kasir.id, warungId, role: "KASIR", name: kasir.name }).token;

    const owner = await prisma.user.findFirstOrThrow({
      where: { warungId, role: "OWNER" },
    });
    ownerToken = issueSession({ id: owner.id, warungId, role: "OWNER", name: owner.name }).token;

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
    expect(meja.length).toBeGreaterThanOrEqual(1);
    expect(produk.length).toBeGreaterThanOrEqual(2);

    // Produk warung lain untuk uji isolasi stock-moves + guard bill.
    const pLain = await prisma.product.findFirstOrThrow({ where: { warungId: warungLainId } });
    produkLain = { id: pLain.id };
  });

  beforeEach(async () => {
    // Reset setting ke default seed + bersihkan DRAFT/bill agar tiap test bersih.
    await prisma.setting.update({
      where: { warungId },
      data: { taxEnabled: true, taxPct: 10, receiptName: null, jamBuka: "07:00", jamTutup: "21:00" },
    });
    const drafts = await prisma.transaction.findMany({
      where: { warungId, status: { in: ["DRAFT", "LUNAS"] } },
      select: { id: true },
    });
    const ids = drafts.map((d) => d.id);
    if (ids.length) {
      await prisma.transactionItem.deleteMany({ where: { transactionId: { in: ids } } });
      await prisma.transaction.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.stockMove.deleteMany({ where: { warungId } });
  });

  afterAll(async () => {
    await bersihkanWarungUji([NAMA, NAMA_LAIN]);
    await prisma.$disconnect();
  });

  // ── helper: impor handler segar + bangun Request ──────────────────────────

  async function panggilSettingsPatch(body: unknown) {
    vi.resetModules();
    const { PATCH } = await import("@/app/api/settings/route");
    const req = new Request("http://localhost/api/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return PATCH(req);
  }

  async function panggilStockMoves(query = "") {
    vi.resetModules();
    const { GET } = await import("@/app/api/stock-moves/route");
    const req = new Request(`http://localhost/api/stock-moves${query}`);
    return GET(req);
  }

  async function panggilBillPatch(id: string, body: unknown) {
    vi.resetModules();
    const { PATCH } = await import("@/app/api/bills/[id]/route");
    const req = new Request(`http://localhost/api/bills/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return PATCH(req, { params: { id } });
  }

  async function panggilBillDelete(id: string) {
    vi.resetModules();
    const { DELETE } = await import("@/app/api/bills/[id]/route");
    const req = new Request(`http://localhost/api/bills/${id}`, { method: "DELETE" });
    return DELETE(req, { params: { id } });
  }

  // Buat bill DRAFT + item via Prisma (setup), bukan lewat route — yang diuji
  // adalah mutasi PATCH/DELETE. Total dihitung konsisten dgn rumus kanonik.
  async function buatBillDraft(
    mejaId: string,
    items: { productId: string; name: string; price: number; qty: number }[],
    discount = 0
  ) {
    const bill = await prisma.transaction.create({
      data: { warungId, mejaId, cashierId: kasirId, status: "DRAFT", total: 0, discount },
    });
    for (const it of items) {
      await prisma.transactionItem.create({
        data: {
          warungId,
          transactionId: bill.id,
          productId: it.productId,
          name: it.name,
          price: it.price,
          qty: it.qty,
        },
      });
    }
    return bill;
  }

  // ── PATCH /api/settings (owner-only) ──────────────────────────────────────

  it("PATCH settings dengan sesi KASIR → 403 (khusus owner)", async () => {
    setSessionCookie(kasirToken);
    const res = await panggilSettingsPatch({ taxPct: 5 });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/owner/i);

    // Tidak ada perubahan tersimpan (setting tetap default seed).
    const setting = await prisma.setting.findUniqueOrThrow({ where: { warungId } });
    expect(setting.taxPct).toBe(10);
  });

  it("PATCH settings tanpa sesi → 401", async () => {
    setSessionCookie(undefined);
    const res = await panggilSettingsPatch({ taxPct: 5 });
    expect(res.status).toBe(401);
  });

  it("PATCH settings dengan sesi OWNER → 200 dan taxPct/taxEnabled tersimpan", async () => {
    setSessionCookie(ownerToken);
    const res = await panggilSettingsPatch({ taxEnabled: false, taxPct: 8 });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.taxEnabled).toBe(false);
    expect(json.taxPct).toBe(8);

    const setting = await prisma.setting.findUniqueOrThrow({ where: { warungId } });
    expect(setting.taxEnabled).toBe(false);
    expect(setting.taxPct).toBe(8);

    // Audit SETTING_CHANGE tercatat.
    const audit = await prisma.auditLog.findFirst({
      where: { warungId, action: "SETTING_CHANGE" },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).not.toBeNull();
    const meta = JSON.parse(audit!.meta ?? "{}") as { fields?: string[] };
    expect(meta.fields).toEqual(expect.arrayContaining(["taxEnabled", "taxPct"]));
  });

  it("PATCH settings taxPct di-clamp ke [0,100] (OWNER)", async () => {
    setSessionCookie(ownerToken);

    const tinggi = await panggilSettingsPatch({ taxPct: 250 });
    expect(tinggi.status).toBe(200);
    expect((await tinggi.json()).taxPct).toBe(100);

    const rendah = await panggilSettingsPatch({ taxPct: -20 });
    expect(rendah.status).toBe(200);
    expect((await rendah.json()).taxPct).toBe(0);

    const setting = await prisma.setting.findUniqueOrThrow({ where: { warungId } });
    expect(setting.taxPct).toBe(0);
  });

  // ── GET /api/stock-moves ──────────────────────────────────────────────────

  it("GET stock-moves mengembalikan move warung ter-scope & terfilter productId", async () => {
    setSessionCookie(kasirToken);
    const [pA, pB] = produk;

    await prisma.stockMove.create({
      data: { warungId, productId: pA.id, type: "KOREKSI", qty: 3, note: "uji-a" },
    });
    await prisma.stockMove.create({
      data: { warungId, productId: pB.id, type: "KULAKAN", qty: 5, note: "uji-b" },
    });

    // Semua move warung ini.
    const semua = await panggilStockMoves();
    expect(semua.status).toBe(200);
    const semuaJson = (await semua.json()) as Array<Record<string, unknown>>;
    expect(semuaJson.length).toBe(2);
    expect(semuaJson.every((m) => m.warungId === warungId)).toBe(true);
    // `reason` disediakan sebagai alias `type` (backward compat).
    expect(semuaJson.every((m) => m.reason === m.type)).toBe(true);
    // product di-include (nama terisi).
    expect(semuaJson.every((m) => (m.product as { name?: string })?.name)).toBe(true);

    // Filter productId=pA → hanya move pA.
    const filterA = await panggilStockMoves(`?productId=${pA.id}`);
    const filterAJson = (await filterA.json()) as Array<Record<string, unknown>>;
    expect(filterAJson.length).toBe(1);
    expect(filterAJson[0].productId).toBe(pA.id);
    expect(filterAJson[0].note).toBe("uji-a");
  });

  it("GET stock-moves dengan productId warung LAIN → kosong (isolasi tenant)", async () => {
    setSessionCookie(kasirToken);
    // Buat move di warung lain untuk produk warung lain.
    const kasirLain = await prisma.user.findFirstOrThrow({
      where: { warungId: warungLainId, role: "KASIR" },
    });
    await prisma.stockMove.create({
      data: { warungId: warungLainId, productId: produkLain.id, type: "KOREKSI", qty: 7 },
    });

    const res = await panggilStockMoves(`?productId=${produkLain.id}`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as unknown[];
    // Tidak membocorkan baris warung lain meski productId-nya valid.
    expect(json).toHaveLength(0);
    expect(kasirLain.id).toBeTruthy();
  });

  // ── PATCH /api/bills/[id] ─────────────────────────────────────────────────

  it("PATCH bill menambah item → subtotal/tax/total sesuai rumus kanonik", async () => {
    setSessionCookie(kasirToken);
    const [pA] = produk;
    const bill = await buatBillDraft(meja[0].id, []);

    const res = await panggilBillPatch(bill.id, { items: [{ productId: pA.id, qty: 2 }] });
    expect(res.status).toBe(200);
    const json = await res.json();

    const subtotal = 2 * pA.price;
    const diskon = 0;
    const { tax, total } = hitungUang({ subtotal, discount: diskon, taxEnabled: true, taxPct: 10 });
    expect(json.subtotal).toBe(subtotal);
    expect(json.discount).toBe(diskon);
    expect(json.tax).toBe(tax);
    expect(json.total).toBe(total);
    expect(json.items).toHaveLength(1);
    expect(json.items[0].qty).toBe(2);

    // Tersimpan di DB juga sama.
    const tersimpan = await prisma.transaction.findUniqueOrThrow({ where: { id: bill.id } });
    expect(tersimpan.total).toBe(total);
  });

  it("PATCH bill mengubah qty (delta merge) + set diskon → total dihitung ulang", async () => {
    setSessionCookie(kasirToken);
    const [pA] = produk;
    const bill = await buatBillDraft(meja[0].id, [
      { productId: pA.id, name: pA.name, price: pA.price, qty: 3 },
    ]);

    // qty diperlakukan sebagai DELTA: -1 → qty jadi 2; diskon 1000.
    const res = await panggilBillPatch(bill.id, {
      items: [{ productId: pA.id, qty: -1 }],
      discount: 1000,
    });
    expect(res.status).toBe(200);
    const json = await res.json();

    const subtotal = 2 * pA.price;
    const { tax, total } = hitungUang({
      subtotal,
      discount: 1000,
      taxEnabled: true,
      taxPct: 10,
    });
    expect(json.subtotal).toBe(subtotal);
    expect(json.discount).toBe(1000);
    expect(json.tax).toBe(tax);
    expect(json.total).toBe(total);
    expect(json.items[0].qty).toBe(2);
  });

  it("PATCH bill qty delta ≤ 0 → item dihapus", async () => {
    setSessionCookie(kasirToken);
    const [pA] = produk;
    const bill = await buatBillDraft(meja[0].id, [
      { productId: pA.id, name: pA.name, price: pA.price, qty: 2 },
    ]);

    const res = await panggilBillPatch(bill.id, { items: [{ productId: pA.id, qty: -2 }] });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.items).toHaveLength(0);
    expect(json.subtotal).toBe(0);
    expect(json.total).toBe(0);
    expect(await prisma.transactionItem.count({ where: { transactionId: bill.id } })).toBe(0);
  });

  it("PATCH bill tanpa perubahan (tanpa items & discount) → 400", async () => {
    setSessionCookie(kasirToken);
    const [pA] = produk;
    const bill = await buatBillDraft(meja[0].id, [
      { productId: pA.id, name: pA.name, price: pA.price, qty: 1 },
    ]);
    const res = await panggilBillPatch(bill.id, {});
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/tidak ada perubahan/i);
  });

  it("PATCH bill milik warung LAIN → 404 (isolasi tenant)", async () => {
    setSessionCookie(kasirToken);
    const kasirLain = await prisma.user.findFirstOrThrow({
      where: { warungId: warungLainId, role: "KASIR" },
    });
    const mejaLain = await prisma.meja.findFirstOrThrow({ where: { warungId: warungLainId } });
    const billLain = await prisma.transaction.create({
      data: {
        warungId: warungLainId,
        mejaId: mejaLain.id,
        cashierId: kasirLain.id,
        status: "DRAFT",
        total: 0,
      },
    });

    const res = await panggilBillPatch(billLain.id, {
      items: [{ productId: produkLain.id, qty: 1 }],
    });
    expect(res.status).toBe(404);

    // Bill warung lain TIDAK tersentuh.
    expect(await prisma.transactionItem.count({ where: { transactionId: billLain.id } })).toBe(0);
  });

  // ── DELETE /api/bills/[id] ────────────────────────────────────────────────

  it("DELETE bill membatalkan DRAFT (bill + item hilang) + audit MEJA_BATAL", async () => {
    setSessionCookie(kasirToken);
    const [pA] = produk;
    const bill = await buatBillDraft(meja[0].id, [
      { productId: pA.id, name: pA.name, price: pA.price, qty: 2 },
    ]);

    const res = await panggilBillDelete(bill.id);
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);

    expect(await prisma.transaction.findUnique({ where: { id: bill.id } })).toBeNull();
    expect(await prisma.transactionItem.count({ where: { transactionId: bill.id } })).toBe(0);

    const audit = await prisma.auditLog.findFirst({
      where: { warungId, action: "MEJA_BATAL" },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).not.toBeNull();
    const meta = JSON.parse(audit!.meta ?? "{}") as { billId?: string };
    expect(meta.billId).toBe(bill.id);

    // Batal kedua kali → 404 (sudah tidak ada).
    const lagi = await panggilBillDelete(bill.id);
    expect(lagi.status).toBe(404);
  });

  it("DELETE bill milik warung LAIN → 404 (isolasi tenant)", async () => {
    setSessionCookie(kasirToken);
    const kasirLain = await prisma.user.findFirstOrThrow({
      where: { warungId: warungLainId, role: "KASIR" },
    });
    // Pakai meja ke-2 (meja ke-1 mungkin masih memuat DRAFT dari test PATCH di
    // atas — partial unique index `tx_one_draft_per_meja` melarang 2 DRAFT/meja).
    const mejaLain = await prisma.meja.findFirstOrThrow({
      where: { warungId: warungLainId, nomor: "2" },
    });
    const billLain = await prisma.transaction.create({
      data: {
        warungId: warungLainId,
        mejaId: mejaLain.id,
        cashierId: kasirLain.id,
        status: "DRAFT",
        total: 0,
      },
    });

    const res = await panggilBillDelete(billLain.id);
    expect(res.status).toBe(404);
    // Bill warung lain tetap ada.
    expect(await prisma.transaction.findUnique({ where: { id: billLain.id } })).not.toBeNull();
  });
});
