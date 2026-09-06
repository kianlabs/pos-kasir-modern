import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/request";

export const dynamic = "force-dynamic";

// POST /api/shifts/[id]/close { kasFisik } → tutup shift + hitung selisih
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await readJson(req);
  if (!body) return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });
  const kasFisik = Number(body.kasFisik);

  if (!Number.isInteger(kasFisik) || kasFisik < 0) {
    return NextResponse.json({ error: "Kas fisik tidak valid." }, { status: 400 });
  }
  const shift = await prisma.shift.findUnique({
    where: { id: params.id },
    include: { transactions: { select: { total: true, payment: true } } },
  });
  if (!shift || shift.status !== "BUKA") {
    return NextResponse.json({ error: "Shift tidak ditemukan / sudah tutup." }, { status: 404 });
  }

  const tunai = shift.transactions
    .filter((t) => t.payment === "CASH")
    .reduce((n, t) => n + t.total, 0);
  const expected = shift.modalAwal + tunai;

  const closed = await prisma.shift.update({
    where: { id: params.id },
    data: { status: "TUTUP", closedAt: new Date(), kasFisik },
  });
  return NextResponse.json({ ...closed, expected, selisih: kasFisik - expected });
}
