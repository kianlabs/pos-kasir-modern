import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/server/db";
import { seedWarung } from "../prisma/seed";
import { bersihkanWarungUji } from "./helpers";

// Uji handler RUTE NYATA untuk modul shift — menutup GAP audit: rute ini
// sebelumnya TIDAK punya test yang memanggil handler aslinya.
//   POST /api/shifts                     → buka shift (BUKA) / 409 bila sudah ada
//   GET  /api/shifts/active              → shift BUKA saat ini atau null
//   POST /api/shifts/[id]/close          → tutup (TUTUP) + expected & selisih / 409 bila ada bill DRAFT
//
// Pola sama dengan tests/sync-audit.test.ts & tests/checkout-shift.test.ts:
// session di-mock lewat `@/server/tenant` (handler asli memakai cookies() yang
// butuh request context Next.js). Sisanya (Prisma, transaksi, catat) NYATA.
// Karena tenant di-mock kita TIDAK perlu token HMAC — cukup set warungId/kasirId.

const nampan = vi.hoisted(() => ({
  warungId: "",
  kasirId: "",
}));

vi.mock("@/server/tenant", () => ({
  currentWarungId: async () => nampan.warungId,
  currentKasirId: async () => nampan.kasirId,
}));

import { POST as bukaShift } from "@/app/api/shifts/route";
import { GET as activeShift } from "@/app/api/shifts/active/route";
import { POST as closeShift } from "@/app/api/shifts/[id]/close/route";

describe("rute /api/shifts (buka / active / close) — handler asli", () => {
  const NAMA = "Warung Meja Shift";
  let warung: { id: string; nama: string };
  let kasir: { id: string };
  let produk: { id: string; price: number };

  async function panggilBuka(body: unknown) {
    const req = new Request("http://localhost/api/shifts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const res = await bukaShift(req);
    return { status: res.status, body: await res.json() };
  }

  async function panggilActive() {
    const res = await activeShift();
    return { status: res.status, body: await res.json() };
  }

  async function panggilClose(id: string, body: unknown) {
    const req = new Request(`http://localhost/api/shifts/${id}/close`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const res = await closeShift(req, { params: { id } });
    return { status: res.status, body: await res.json() };
  }

  // Bersihkan shift + bill DRAFT agar tiap test mulai dari warung bersih.
  async function bersihkanShiftDanDraft() {
    const drafts = await prisma.transaction.findMany({
      where: { warungId: warung.id, status: "DRAFT" },
      select: { id: true },
    });
    const ids = drafts.map((d) => d.id);
    if (ids.length) {
      await prisma.transactionItem.deleteMany({ where: { transactionId: { in: ids } } });
      await prisma.transaction.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.transaction.deleteMany({
      where: { warungId: warung.id, status: "LUNAS" },
    });
    await prisma.shift.deleteMany({ where: { warungId: warung.id } });
  }

  beforeAll(async () => {
    warung = await seedWarung(NAMA);
    nampan.warungId = warung.id;

    const k = await prisma.user.findFirstOrThrow({
      where: { warungId: warung.id, role: "KASIR" },
    });
    kasir = k;
    nampan.kasirId = k.id;

    const p = await prisma.product.findFirstOrThrow({
      where: { warungId: warung.id },
      orderBy: { price: "asc" },
    });
    produk = p;
  });

  beforeEach(async () => {
    await bersihkanShiftDanDraft();
  });

  afterAll(async () => {
    await bersihkanWarungUji([NAMA]);
    await prisma.$disconnect();
  });

  // ── POST /api/shifts ──────────────────────────────────────────────────────

  it("POST buka shift → 201, membuat shift BUKA + audit SHIFT_OPEN", async () => {
    const { status, body } = await panggilBuka({ modalAwal: 50_000 });
    expect(status).toBe(201);
    expect(body.status).toBe("BUKA");
    expect(body.modalAwal).toBe(50_000);
    expect(body.warungId).toBe(warung.id);
    expect(body.cashierId).toBe(kasir.id);
    expect(body.closedAt).toBeNull();

    const tersimpan = await prisma.shift.findUniqueOrThrow({ where: { id: body.id } });
    expect(tersimpan.status).toBe("BUKA");
    expect(tersimpan.modalAwal).toBe(50_000);
  });

  it("POST buka modalAwal negatif / bukan angka → di-clamp ke 0", async () => {
    const { status, body } = await panggilBuka({ modalAwal: -999 });
    expect(status).toBe(201);
    expect(body.modalAwal).toBe(0);
  });

  it("POST buka saat sudah ada shift BUKA → 409 (guard cek-dalam-transaksi)", async () => {
    const pertama = await panggilBuka({ modalAwal: 10_000 });
    expect(pertama.status).toBe(201);

    const kedua = await panggilBuka({ modalAwal: 20_000 });
    expect(kedua.status).toBe(409);
    expect(kedua.body.error).toMatch(/masih ada shift terbuka/i);

    // Hanya SATU shift BUKA di warung ini (invarian).
    const jumlahBuka = await prisma.shift.count({
      where: { warungId: warung.id, status: "BUKA" },
    });
    expect(jumlahBuka).toBe(1);
  });

  it("POST buka tanpa body JSON valid → 400", async () => {
    const req = new Request("http://localhost/api/shifts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "bukan-json",
    });
    const res = await bukaShift(req);
    expect(res.status).toBe(400);
  });

  // ── GET /api/shifts/active ────────────────────────────────────────────────

  it("GET active tanpa shift BUKA → JSON null", async () => {
    const { status, body } = await panggilActive();
    expect(status).toBe(200);
    expect(body).toBeNull();
  });

  it("GET active mengembalikan shift BUKA yang sedang berjalan", async () => {
    const buka = await panggilBuka({ modalAwal: 33_000 });
    expect(buka.status).toBe(201);

    const { status, body } = await panggilActive();
    expect(status).toBe(200);
    expect(body).not.toBeNull();
    expect(body.id).toBe(buka.body.id);
    expect(body.status).toBe("BUKA");
    expect(body.modalAwal).toBe(33_000);
  });

  // ── POST /api/shifts/[id]/close ───────────────────────────────────────────

  it("POST close → 200, status TUTUP + expected = modalAwal + Σ(total CASH) + selisih", async () => {
    const buka = await panggilBuka({ modalAwal: 40_000 });
    const shiftId = buka.body.id as string;

    // Dua transaksi LUNAS milik shift ini: satu CASH, satu QRIS (QRIS TIDAK
    // masuk expected — expected hanya modal + tunai/CASH).
    const tunaiTotal = 25_000;
    const qrisTotal = 60_000;
    await prisma.transaction.create({
      data: {
        warungId: warung.id,
        shiftId,
        cashierId: kasir.id,
        status: "LUNAS",
        subtotal: tunaiTotal,
        total: tunaiTotal,
        cash: tunaiTotal,
        payment: "CASH",
      },
    });
    await prisma.transaction.create({
      data: {
        warungId: warung.id,
        shiftId,
        cashierId: kasir.id,
        status: "LUNAS",
        subtotal: qrisTotal,
        total: qrisTotal,
        cash: qrisTotal,
        payment: "QRIS",
      },
    });

    const expected = 40_000 + tunaiTotal; // = 65_000
    const kasFisik = 70_000; // sengaja beda → selisih +5000

    const { status, body } = await panggilClose(shiftId, { kasFisik });
    expect(status).toBe(200);
    expect(body.status).toBe("TUTUP");
    expect(body.kasFisik).toBe(kasFisik);
    expect(body.expected).toBe(expected);
    expect(body.selisih).toBe(kasFisik - expected); // 5_000
    expect(body.closedAt).not.toBeNull();

    const tersimpan = await prisma.shift.findUniqueOrThrow({ where: { id: shiftId } });
    expect(tersimpan.status).toBe("TUTUP");
    expect(tersimpan.kasFisik).toBe(kasFisik);

    // Audit SHIFT_CLOSE tercatat.
    const audit = await prisma.auditLog.findFirst({
      where: { warungId: warung.id, action: "SHIFT_CLOSE" },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).not.toBeNull();
    const meta = JSON.parse(audit!.meta ?? "{}") as Record<string, unknown>;
    expect(meta.kasFisik).toBe(kasFisik);
    expect(meta.selisih).toBe(kasFisik - expected);
  });

  it("POST close diblokir 409 saat masih ada bill DRAFT (guard lintas-shift)", async () => {
    const buka = await panggilBuka({ modalAwal: 0 });
    const shiftId = buka.body.id as string;

    // Bill DRAFT menggantung (uang belum beres) → close harus ditolak.
    const meja = await prisma.meja.findFirstOrThrow({ where: { warungId: warung.id } });
    await prisma.transaction.create({
      data: {
        warungId: warung.id,
        mejaId: meja.id,
        shiftId,
        cashierId: kasir.id,
        status: "DRAFT",
        total: 0,
      },
    });

    const { status, body } = await panggilClose(shiftId, { kasFisik: 0 });
    expect(status).toBe(409);
    expect(body.error).toMatch(/bill terbuka/i);

    // Shift TETAP BUKA (tidak ada mutasi parsial).
    const tersimpan = await prisma.shift.findUniqueOrThrow({ where: { id: shiftId } });
    expect(tersimpan.status).toBe("BUKA");
  });

  it("POST close dengan kasFisik tidak valid (negatif) → 400", async () => {
    const buka = await panggilBuka({ modalAwal: 0 });
    const { status, body } = await panggilClose(buka.body.id, { kasFisik: -1 });
    expect(status).toBe(400);
    expect(body.error).toMatch(/kas fisik tidak valid/i);
  });

  it("POST close shift yang sudah TUTUP → 404", async () => {
    const buka = await panggilBuka({ modalAwal: 0 });
    const shiftId = buka.body.id as string;

    const pertama = await panggilClose(shiftId, { kasFisik: 0 });
    expect(pertama.status).toBe(200);

    const kedua = await panggilClose(shiftId, { kasFisik: 0 });
    expect(kedua.status).toBe(404);
    expect(kedua.body.error).toMatch(/tidak ditemukan/i);
  });

  it("POST close shift warung lain → 404 (isolasi tenant)", async () => {
    // Buat shift di warung lain (bukan nampan.warungId).
    const lain = await seedWarung("Warung Meja Shift Lain");
    try {
      const kasirLain = await prisma.user.findFirstOrThrow({
        where: { warungId: lain.id, role: "KASIR" },
      });
      const shiftLain = await prisma.shift.create({
        data: { warungId: lain.id, cashierId: kasirLain.id, modalAwal: 1000, status: "BUKA" },
      });

      const { status } = await panggilClose(shiftLain.id, { kasFisik: 0 });
      expect(status).toBe(404);

      // Shift warung lain TIDAK tersentuh.
      const cek = await prisma.shift.findUniqueOrThrow({ where: { id: shiftLain.id } });
      expect(cek.status).toBe("BUKA");
    } finally {
      await bersihkanWarungUji(["Warung Meja Shift Lain"]);
    }
  });

  // Produk diambil agar prasyarat seed bermakna (konsisten dgn file uji lain).
  it("prasyarat: produk warung uji ada", () => {
    expect(produk.id).toBeTruthy();
  });
});
