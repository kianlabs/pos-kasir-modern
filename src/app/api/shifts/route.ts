import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export type ShiftSummary = {
  id: string;
  openedAt: string;
  closedAt: string | null;
  modalAwal: number;
  kasFisik: number | null;
  status: string;
  tunai: number;
  qris: number;
  hutang: number;
  trxCount: number;
  expected: number; // modal + tunai
  selisih: number | null; // kasFisik - expected (bila tutup)
};

// GET /api/shifts → riwayat + ringkasan per shift
export async function GET() {
  const shifts = await prisma.shift.findMany({
    orderBy: { openedAt: "desc" },
    take: 20,
    include: { transactions: { select: { total: true, payment: true } } },
  });

  const out: ShiftSummary[] = shifts.map((s) => {
    const tunai = s.transactions.filter((t) => t.payment === "CASH").reduce((n, t) => n + t.total, 0);
    const qris = s.transactions.filter((t) => t.payment === "QRIS").reduce((n, t) => n + t.total, 0);
    const hutang = s.transactions.filter((t) => t.payment === "HUTANG").reduce((n, t) => n + t.total, 0);
    const expected = s.modalAwal + tunai;
    return {
      id: s.id,
      openedAt: s.openedAt.toISOString(),
      closedAt: s.closedAt?.toISOString() ?? null,
      modalAwal: s.modalAwal,
      kasFisik: s.kasFisik,
      status: s.status,
      tunai,
      qris,
      hutang,
      trxCount: s.transactions.length,
      expected,
      selisih: s.kasFisik != null ? s.kasFisik - expected : null,
    };
  });
  return NextResponse.json(out);
}

// POST /api/shifts { modalAwal } → buka shift baru
export async function POST(req: Request) {
  const body = await req.json();
  const modalAwal = Math.max(0, Math.floor(Number(body.modalAwal) || 0));

  const active = await prisma.shift.findFirst({ where: { status: "BUKA" } });
  if (active) {
    return NextResponse.json({ error: "Masih ada shift buka. Tutup dulu." }, { status: 400 });
  }
  const shift = await prisma.shift.create({ data: { modalAwal } });
  return NextResponse.json(shift, { status: 201 });
}
