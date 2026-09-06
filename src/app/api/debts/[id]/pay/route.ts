import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// POST /api/debts/[id]/pay { amount } → cicilan / pelunasan
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  const amount = Number(body.amount);

  if (!Number.isInteger(amount) || amount <= 0) {
    return NextResponse.json({ error: "Nominal tidak valid." }, { status: 400 });
  }
  const debt = await prisma.debt.findUnique({ where: { id: params.id } });
  if (!debt || debt.status === "LUNAS") {
    return NextResponse.json({ error: "Hutang tidak ditemukan / sudah lunas." }, { status: 404 });
  }
  const sisa = debt.total - debt.paid;
  if (amount > sisa) {
    return NextResponse.json({ error: `Melebihi sisa ${sisa}.` }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.debtPayment.create({ data: { debtId: debt.id, amount } });
    return tx.debt.update({
      where: { id: debt.id },
      data: {
        paid: { increment: amount },
        status: debt.paid + amount >= debt.total ? "LUNAS" : "BELUM",
      },
    });
  });
  return NextResponse.json(updated);
}
