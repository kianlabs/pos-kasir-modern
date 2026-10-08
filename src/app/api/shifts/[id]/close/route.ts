import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/request";
import { catat } from "@/lib/audit";
import { currentWarungId, currentKasirId } from "@/lib/warung";

export const dynamic = "force-dynamic";

// POST /api/shifts/[id]/close { kasFisik } → tutup shift + hitung selisih
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const warungId = await currentWarungId();
  const kasirId = await currentKasirId(warungId);

  const body = await readJson(req);
  if (!body) return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });
  const kasFisik = Number(body.kasFisik);

  if (!Number.isInteger(kasFisik) || kasFisik < 0) {
    return NextResponse.json({ error: "Kas fisik tidak valid." }, { status: 400 });
  }
  const shift = await prisma.shift.findFirst({
    where: { id: params.id, warungId },
    include: {
      transactions: {
        where: { status: "LUNAS" },
        select: { total: true, payment: true },
      },
    },
  });
  if (!shift || shift.status !== "BUKA") {
    return NextResponse.json({ error: "Shift tidak ditemukan / sudah tutup." }, { status: 404 });
  }

  // Guard (plan §7 keputusan 1): bill DRAFT TIDAK boleh menggantung lintas shift.
  // Bila masih ada bill terbuka di warung → 409, arahkan selesaikan/batalkan dulu.
  const openBills = await prisma.transaction.count({
    where: { warungId, status: "DRAFT" },
  });
  if (openBills > 0) {
    return NextResponse.json(
      { error: `Masih ada ${openBills} bill terbuka. Selesaikan atau batalkan dulu.` },
      { status: 409 }
    );
  }

  const tunai = shift.transactions
    .filter((t) => t.payment === "CASH")
    .reduce((n, t) => n + t.total, 0);
  const expected = shift.modalAwal + tunai;

  const closed = await prisma.shift.update({
    where: { id: params.id },
    data: { status: "TUTUP", closedAt: new Date(), kasFisik },
  });
  await catat({
    warungId,
    userId: kasirId,
    action: "SHIFT_CLOSE",
    meta: { kasFisik, selisih: kasFisik - expected },
  });
  return NextResponse.json({ ...closed, expected, selisih: kasFisik - expected });
}
