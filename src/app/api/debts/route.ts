import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/debts?status=BELUM → daftar hutang + sisa
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const debts = await prisma.debt.findMany({
    where: status === "BELUM" || status === "LUNAS" ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      customer: true,
      payments: { orderBy: { createdAt: "desc" } },
      transaction: { include: { items: { include: { product: true } } } },
    },
  });

  return NextResponse.json(
    debts.map((d) => ({
      id: d.id,
      customer: d.customer.name,
      total: d.total,
      paid: d.paid,
      sisa: d.total - d.paid,
      status: d.status,
      createdAt: d.createdAt,
      items: d.transaction?.items.map((i) => `${i.product.name} ×${i.qty}`) ?? [],
      payments: d.payments,
    }))
  );
}
