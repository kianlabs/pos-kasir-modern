import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/server/db";
import { issueSession } from "@/server/session";
import { SESSION_COOKIE } from "@/shared/session-types";
import { seedWarung } from "../prisma/seed";
import { bersihkanWarungUji } from "./helpers";

// Uji INVARIAN aturan #12 (DRAFT tidak bocor ke laporan) untuk DUA route ASLI:
//   GET /api/stats   (src/app/api/stats/route.ts)
//   GET /api/export  (src/app/api/export/route.ts)
// plus RBAC export (owner-only) dan format CSV (header + escaping).
//
// Cara memanggil route asli sama dengan tests/rbac-products.test.ts: mock
// `next/headers` cookies() agar mengembalikan token sesi nyata (HMAC asli),
// lalu import handler dinamis dengan vi.resetModules agar memoize React.cache
// di `@/server/tenant` bersih antar-test.
//
// Butuh DB test (TEST_DATABASE_URL). JANGAN pernah arahkan ke DB dev/produksi.

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

// Slug awalan "warung-meja-" → ikut dibersihkan global-setup sebagai jaring
// pengaman bila run sebelumnya crash sebelum afterAll.
const NAMA_WARUNG = "Warung Meja Stats Export";

const LUNAS_TOTAL = 20_000;
const DRAFT_TOTAL = 77_777;
// Nama item sengaja mengandung koma & tanda kutip untuk menguji escaping CSV.
const LUNAS_ITEM_NAME = 'Nasi, Goreng "Spesial"';

describe("stats & export — invarian LUNAS + RBAC export (aturan #12)", () => {
  let warungId: string;
  let ownerToken: string;
  let kasirToken: string;
  let lunasId: string;
  let draftId: string;
  let lunasProductName: string;
  let draftProductName: string;

  // Panggil handler GET asli dengan modul yang baru (cache React.cache bersih).
  async function callStats(query = "") {
    vi.resetModules();
    const { GET } = await import("@/app/api/stats/route");
    return GET(new Request(`http://localhost/api/stats${query}`));
  }

  async function callExport(query = "") {
    vi.resetModules();
    const { GET } = await import("@/app/api/export/route");
    return GET(new Request(`http://localhost/api/export${query}`));
  }

  beforeAll(async () => {
    const w = await seedWarung(NAMA_WARUNG);
    warungId = w.id;

    const owner = await prisma.user.findFirstOrThrow({ where: { warungId, role: "OWNER" } });
    const kasir = await prisma.user.findFirstOrThrow({ where: { warungId, role: "KASIR" } });
    ownerToken = issueSession({ id: owner.id, warungId, role: "OWNER", name: owner.name }).token;
    kasirToken = issueSession({ id: kasir.id, warungId, role: "KASIR", name: kasir.name }).token;

    // Produk khusus agar kebocoran DRAFT ke "produk terlaris" mudah terdeteksi.
    const stamp = Date.now();
    lunasProductName = `LunasUji-${stamp}`;
    draftProductName = `DraftBocor-${stamp}`;
    const produkLunas = await prisma.product.create({
      data: { warungId, name: lunasProductName, price: 10_000, stock: 50 },
    });
    const produkDraft = await prisma.product.create({
      data: { warungId, name: draftProductName, price: 9_999, stock: 50 },
    });

    // 1 transaksi LUNAS (dihitung) …
    const lunas = await prisma.transaction.create({
      data: {
        warungId,
        cashierId: kasir.id,
        status: "LUNAS",
        subtotal: LUNAS_TOTAL,
        discount: 0,
        tax: 0,
        total: LUNAS_TOTAL,
        cash: 25_000,
        change: 5_000,
        payment: "CASH",
        items: {
          create: [
            {
              warungId,
              productId: produkLunas.id,
              name: LUNAS_ITEM_NAME,
              price: 10_000,
              qty: 2,
            },
          ],
        },
      },
    });
    lunasId = lunas.id;

    // … dan 1 DRAFT bertotal besar yang TIDAK boleh dihitung siapa pun.
    const draft = await prisma.transaction.create({
      data: {
        warungId,
        cashierId: kasir.id,
        status: "DRAFT",
        total: DRAFT_TOTAL,
        items: {
          create: [
            {
              warungId,
              productId: produkDraft.id,
              name: `${draftProductName} x7`,
              price: 9_999,
              qty: 7,
            },
          ],
        },
      },
    });
    draftId = draft.id;
  });

  afterAll(async () => {
    await bersihkanWarungUji([NAMA_WARUNG]);
    await prisma.$disconnect();
  });

  // ── /api/stats ────────────────────────────────────────────────────────────

  it("stats: omzet & jumlah transaksi hari ini HANYA dari LUNAS", async () => {
    setSessionCookie(ownerToken);
    const res = await callStats();
    expect(res.status).toBe(200);
    const json = await res.json();

    // DRAFT (77_777) TIDAK ikut — kalau bocor, nilainya jadi 97_777.
    expect(json.omzetHariIni).toBe(LUNAS_TOTAL);
    expect(json.trxHariIni).toBe(1);

    // Omzet harian: hari terakhir (hari ini) juga hanya LUNAS.
    const hariIni = json.weekly[json.weekly.length - 1];
    expect(hariIni.total).toBe(LUNAS_TOTAL);
  });

  it("stats: daftar transaksi terbaru tidak memuat DRAFT", async () => {
    setSessionCookie(ownerToken);
    const json = await (await callStats()).json();

    const ids = json.recent.map((t: { id: string }) => t.id);
    expect(ids).toContain(lunasId);
    expect(ids).not.toContain(draftId);
    expect(ids).toHaveLength(1);
  });

  it("stats: produk terlaris (top) hanya dari item LUNAS", async () => {
    setSessionCookie(ownerToken);
    const json = await (await callStats()).json();

    const names = json.top.map((t: { name: string }) => t.name);
    expect(names).toContain(lunasProductName);
    expect(names).not.toContain(draftProductName);
  });

  it("stats: filter rentang (from/to) juga hanya menghitung LUNAS", async () => {
    setSessionCookie(ownerToken);
    const now = new Date();
    const ymd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate(),
    ).padStart(2, "0")}`;

    const json = await (await callStats(`?from=${ymd}&to=${ymd}`)).json();
    expect(json.range).not.toBeNull();
    expect(json.range.omzet).toBe(LUNAS_TOTAL);
    expect(json.range.trx).toBe(1);
  });

  it("stats: boleh diakses KASIR (bukan owner-only) & tetap ter-scope warungnya", async () => {
    setSessionCookie(kasirToken);
    const res = await callStats();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.omzetHariIni).toBe(LUNAS_TOTAL);
    expect(json.trxHariIni).toBe(1);
  });

  it("stats: tanpa sesi → ditolak (belum login)", async () => {
    setSessionCookie(undefined);
    await expect(callStats()).rejects.toThrow(/session|login/i);
  });

  // ── /api/export ───────────────────────────────────────────────────────────

  it("export: owner → 200 CSV; header tepat & hanya baris LUNAS", async () => {
    setSessionCookie(ownerToken);
    const res = await callExport();
    expect(res.status).toBe(200);

    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toMatch(
      /attachment; filename="laporan-\d{4}-\d{2}-\d{2}\.csv"/,
    );

    // BOM utf-8 (EF BB BF) untuk Excel. Dicek di level byte: Response.text()
    // men-strip BOM sesuai spec WHATWG, jadi tak bisa dilihat dari string.
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);

    const text = new TextDecoder().decode(bytes);
    const lines = text.split("\n");
    expect(lines[0]).toBe("id,waktu,item,subtotal,diskon,pajak,total,cara,bayar,kembali");

    // Hanya header + 1 baris (transaksi LUNAS). DRAFT tidak menghasilkan baris.
    expect(lines).toHaveLength(2);
    expect(text).toContain(lunasId);
    expect(text).not.toContain(draftId);
    expect(text).not.toContain(String(DRAFT_TOTAL));
  });

  it("export: escaping CSV — nama item berkoma & ber-kutip dikutip ganda", async () => {
    setSessionCookie(ownerToken);
    const text = await (await callExport()).text();

    // esc() membungkus field dengan " dan menggandakan kutip di dalamnya.
    const escaped = '"Nasi, Goreng ""Spesial"" x2"';
    expect(text).toContain(escaped);
  });

  it("export: KASIR → 403 (khusus owner)", async () => {
    setSessionCookie(kasirToken);
    const res = await callExport();
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/owner/i);
  });

  it("export: tanpa sesi → 401 (belum login)", async () => {
    setSessionCookie(undefined);
    const res = await callExport();
    expect(res.status).toBe(401);
  });
});
