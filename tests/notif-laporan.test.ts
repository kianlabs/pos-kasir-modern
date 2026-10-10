import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/server/db";
import { issueSession } from "@/server/session";
import { SESSION_COOKIE } from "@/shared/session-types";
import { seedWarung } from "../prisma/seed";
import { bersihkanWarungUji } from "./helpers";

// Uji Fase 2 §7a: outbox notifikasi + laporan shift (fondasi provider-agnostic).
//
// Strategi mock (hibrida, sengaja):
// - `@/server/tenant` di-mock SEBAGIAN: fungsi tenant biasa (currentWarungId,
//   currentKasirId) dikembalikan dari `nampan` agar handler tutup-shift asli
//   bisa dipanggil tanpa konteks cookies Next.js (pola tests/shifts-routes.test.ts).
// - `requireOwnerResponse`/`getSession` DIBIARKAN ASLI (via importActual) supaya
//   gate owner-only benar-benar diuji lewat token sesi HMAC nyata (pola
//   tests/settings-stock-bills-routes.test.ts). Karena itu cookies() di-mock juga.
//
// Sisanya NYATA: Prisma, transaksi, catat, buatLaporanShift, renderLaporanShift.

const nampan = vi.hoisted(() => ({ warungId: "", kasirId: "" }));

vi.mock("@/server/tenant", async (importActual) => {
  const asli = await importActual<typeof import("@/server/tenant")>();
  return {
    ...asli,
    currentWarungId: async () => nampan.warungId,
    currentKasirId: async () => nampan.kasirId,
  };
});

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => (currentCookie?.name === name ? currentCookie : undefined),
  }),
}));

let currentCookie: { name: string; value: string } | undefined;
function setSessionCookie(token: string | undefined) {
  currentCookie = token ? { name: SESSION_COOKIE, value: token } : undefined;
}

import { POST as bukaShift } from "@/app/api/shifts/route";
import { POST as closeShift } from "@/app/api/shifts/[id]/close/route";
import { renderLaporanShift, buatLaporanShift, type RingkasanShift } from "@/server/notif";

const NAMA = "Warung Notif Outbox";

describe("renderLaporanShift — fungsi murni", () => {
  function ringkasan(over: Partial<RingkasanShift> = {}): RingkasanShift {
    return {
      shiftId: "shift-1",
      warungNama: "Warung Berkah Jaya",
      kasirNama: "Budi",
      openedAt: new Date("2026-10-10T07:00:00"),
      closedAt: new Date("2026-10-10T14:30:00"),
      modalAwal: 50_000,
      tunai: 125_000,
      qris: 60_000,
      totalOmzet: 185_000,
      trxCount: 12,
      expected: 175_000,
      kasFisik: 178_000,
      selisih: 3_000,
      topProducts: [
        { name: "Bakso Urat", qty: 18 },
        { name: "Es Teh", qty: 12 },
      ],
      stokMenipis: [
        { name: "Telur", stock: 4 },
        { name: "Gula", stock: 2 },
      ],
      ...over,
    };
  }

  it("memuat nama warung, rupiah terformat, trx, selisih, terlaris, stok menipis", () => {
    const { subject, body } = renderLaporanShift(ringkasan());

    expect(subject).toContain("Warung Berkah Jaya");
    expect(body).toContain("Warung Berkah Jaya");
    expect(body).toContain("Budi");

    // Rupiah terformat (id-ID, titik ribuan) di baris omzet.
    expect(body).toContain("Rp185.000");
    expect(body).toContain("Rp125.000"); // tunai
    expect(body).toContain("Rp60.000"); // qris
    expect(body).toContain("Rp50.000"); // modal awal
    expect(body).toContain("Rp178.000"); // kas fisik
    expect(body).toContain("Rp175.000"); // expected

    // Jumlah transaksi.
    expect(body).toContain("12 transaksi");

    // Selisih positif → tanda "+" + label "lebih".
    expect(body).toContain("Selisih: +Rp3.000");
    expect(body).toContain("lebih Rp3.000");

    // Terlaris & stok menipis.
    expect(body).toContain("Bakso Urat ×18");
    expect(body).toContain("Es Teh ×12");
    expect(body).toContain("Telur (4)");
    expect(body).toContain("Gula (2)");
  });

  it("selisih 0 → label 'pas' (tanpa 'lebih'/'kurang')", () => {
    const { body } = renderLaporanShift(ringkasan({ kasFisik: 175_000, selisih: 0 }));
    expect(body).toContain("pas");
    expect(body).not.toContain("lebih");
    expect(body).not.toContain("kurang");
  });

  it("selisih negatif → tanda '−' + label 'kurang'", () => {
    const { body } = renderLaporanShift(ringkasan({ kasFisik: 170_000, selisih: -5_000 }));
    expect(body).toContain("−Rp5.000");
    expect(body).toContain("kurang Rp5.000");
  });

  it("daftar kosong → tampil '—' untuk terlaris & stok menipis", () => {
    const { body } = renderLaporanShift(ringkasan({ topProducts: [], stokMenipis: [] }));
    const barisTerlaris = body.split("\n").find((l) => l.startsWith("Terlaris:"))!;
    const barisStok = body.split("\n").find((l) => l.startsWith("Stok menipis:"))!;
    expect(barisTerlaris).toBe("Terlaris: —");
    expect(barisStok).toBe("Stok menipis: —");
  });

  it("deterministik: masukan sama → keluaran sama", () => {
    const a = renderLaporanShift(ringkasan());
    const b = renderLaporanShift(ringkasan());
    expect(a).toEqual(b);
  });
});

describe("outbox notifikasi via rute tutup-shift + gate owner (handler asli)", () => {
  let warung: { id: string; nama: string };
  let kasir: { id: string };
  let ownerToken: string;
  let kasirToken: string;

  async function panggilBuka(body: unknown) {
    const req = new Request("http://localhost/api/shifts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const res = await bukaShift(req);
    return { status: res.status, body: await res.json() };
  }

  async function panggilClose(id: string, body: unknown) {
    const req = new Request(`http://localhost/api/shifts/${id}/close`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const res = await closeShift(req, { params: Promise.resolve({ id }) });
    return { status: res.status, body: await res.json() };
  }

  async function bersihkan() {
    await prisma.notifikasi.deleteMany({ where: { warungId: warung.id } });
    const drafts = await prisma.transaction.findMany({
      where: { warungId: warung.id },
      select: { id: true },
    });
    const ids = drafts.map((d) => d.id);
    if (ids.length) {
      await prisma.transactionItem.deleteMany({ where: { transactionId: { in: ids } } });
      await prisma.transaction.deleteMany({ where: { id: { in: ids } } });
    }
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

    const owner = await prisma.user.findFirstOrThrow({
      where: { warungId: warung.id, role: "OWNER" },
    });
    ownerToken = issueSession({
      id: owner.id,
      warungId: warung.id,
      role: "OWNER",
      name: owner.name,
    }).token;
    kasirToken = issueSession({
      id: kasir.id,
      warungId: warung.id,
      role: "KASIR",
      name: k.name,
    }).token;
  });

  beforeEach(async () => {
    await bersihkan();
    setSessionCookie(undefined);
  });

  afterAll(async () => {
    await bersihkanWarungUji([NAMA]);
    await prisma.$disconnect();
  });

  it("tutup shift → baris notifikasi LAPORAN_SHIFT (refId=shift, PENDING, body memuat omzet)", async () => {
    const buka = await panggilBuka({ modalAwal: 40_000 });
    const shiftId = buka.body.id as string;

    const tunaiTotal = 25_000;
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

    const { status } = await panggilClose(shiftId, { kasFisik: 70_000 });
    expect(status).toBe(200);

    const notif = await prisma.notifikasi.findFirst({
      where: { warungId: warung.id, jenis: "LAPORAN_SHIFT" },
    });
    expect(notif).not.toBeNull();
    expect(notif!.refId).toBe(shiftId);
    expect(notif!.status).toBe("PENDING");
    expect(notif!.channel).toBe("WA");
    expect(notif!.tujuan).toBeNull();

    // Omzet = modal-tunai saja (25.000) di body, terformat rupiah.
    const omzet = 25_000;
    expect(notif!.body).toContain("Rp25.000");
    // Meta berisi angka pendukung (audit/verifikasi).
    const meta = JSON.parse(notif!.meta ?? "{}") as Record<string, unknown>;
    expect(meta.totalOmzet).toBe(omzet);
    expect(meta.trxCount).toBe(1);
    expect(meta.selisih).toBe(70_000 - (40_000 + omzet));
  });

  it("idempoten: buatLaporanShift dua kali untuk shiftId sama → tetap 1 baris", async () => {
    const buka = await panggilBuka({ modalAwal: 10_000 });
    const shiftId = buka.body.id as string;
    await panggilClose(shiftId, { kasFisik: 10_000 });

    // Panggil ulang langsung (mensimulasikan close ganda / retry).
    const a = await buatLaporanShift(prisma, { warungId: warung.id, shiftId });
    const b = await buatLaporanShift(prisma, { warungId: warung.id, shiftId });
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a!.id).toBe(b!.id);

    const jumlah = await prisma.notifikasi.count({
      where: { warungId: warung.id, jenis: "LAPORAN_SHIFT", refId: shiftId },
    });
    expect(jumlah).toBe(1);
  });

  it("buatLaporanShift untuk shift warung lain → null (isolasi tenant)", async () => {
    const lain = await seedWarung("Warung Notif Outbox Lain");
    try {
      const kasirLain = await prisma.user.findFirstOrThrow({
        where: { warungId: lain.id, role: "KASIR" },
      });
      const shiftLain = await prisma.shift.create({
        data: { warungId: lain.id, cashierId: kasirLain.id, modalAwal: 0, status: "TUTUP", kasFisik: 0 },
      });
      // warungId sesi (=warung.id) ≠ pemilik shift → null, tak ada baris dibuat.
      const hasil = await buatLaporanShift(prisma, { warungId: warung.id, shiftId: shiftLain.id });
      expect(hasil).toBeNull();
      expect(
        await prisma.notifikasi.count({ where: { warungId: warung.id, refId: shiftLain.id } })
      ).toBe(0);
    } finally {
      await bersihkanWarungUji(["Warung Notif Outbox Lain"]);
    }
  });

  it("GET /api/notifikasi dengan sesi KASIR → 403 (owner-only)", async () => {
    setSessionCookie(kasirToken);
    vi.resetModules();
    const { GET } = await import("@/app/api/notifikasi/route");
    const res = await GET(new Request("http://localhost/api/notifikasi"));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/owner/i);
  });

  it("GET /api/notifikasi tanpa sesi → 401", async () => {
    setSessionCookie(undefined);
    vi.resetModules();
    const { GET } = await import("@/app/api/notifikasi/route");
    const res = await GET(new Request("http://localhost/api/notifikasi"));
    expect(res.status).toBe(401);
  });

  it("GET /api/notifikasi dengan sesi OWNER → 200 + baris ter-scope tenant", async () => {
    const buka = await panggilBuka({ modalAwal: 0 });
    await panggilClose(buka.body.id, { kasFisik: 0 });

    setSessionCookie(ownerToken);
    vi.resetModules();
    const { GET } = await import("@/app/api/notifikasi/route");
    const res = await GET(new Request("http://localhost/api/notifikasi?limit=5"));
    expect(res.status).toBe(200);
    const rows = (await res.json()) as Array<Record<string, unknown>>;
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.every((r) => r.jenis === "LAPORAN_SHIFT")).toBe(true);
    expect(rows[0]).toHaveProperty("body");
    expect(rows[0]).toHaveProperty("refId");
  });

  it("POST /api/notifikasi/[id]/baca menandai readAt; warung lain → 404", async () => {
    const buka = await panggilBuka({ modalAwal: 0 });
    await panggilClose(buka.body.id, { kasFisik: 0 });
    const notif = await prisma.notifikasi.findFirstOrThrow({
      where: { warungId: warung.id, jenis: "LAPORAN_SHIFT" },
    });
    expect(notif.readAt).toBeNull();

    setSessionCookie(ownerToken);
    vi.resetModules();
    const { POST } = await import("@/app/api/notifikasi/[id]/baca/route");
    const res = await POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ id: notif.id }),
    });
    expect(res.status).toBe(200);

    const sesudah = await prisma.notifikasi.findUniqueOrThrow({ where: { id: notif.id } });
    expect(sesudah.readAt).not.toBeNull();

    // Id notifikasi warung lain → 404 (isolasi tenant).
    const lain = await seedWarung("Warung Notif Outbox Baca");
    try {
      const notifLain = await prisma.notifikasi.create({
        data: {
          warungId: lain.id,
          jenis: "LAPORAN_SHIFT",
          subject: "x",
          body: "y",
        },
      });
      const res404 = await POST(new Request("http://localhost", { method: "POST" }), {
        params: Promise.resolve({ id: notifLain.id }),
      });
      expect(res404.status).toBe(404);
    } finally {
      await bersihkanWarungUji(["Warung Notif Outbox Baca"]);
    }
  });
});
