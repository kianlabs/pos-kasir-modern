import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const trx = await prisma.transaction.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { items: { include: { product: true } } },
  });
  return NextResponse.json(
    trx.map((t) => ({
      id: t.id,
      total: t.total,
      cash: t.cash,
      change: t.change,
      payment: t.payment,
      createdAt: t.createdAt,
      items: t.items.map((i) => ({
        name: i.product.name,
        qty: i.qty,
        price: i.price,
      })),
    }))
  );
}
