import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const [today, count, lowStock] = await Promise.all([
    prisma.transaction.aggregate({
      _sum: { total: true },
      _count: true,
      where: { createdAt: { gte: start } },
    }),
    prisma.product.count(),
    prisma.product.findMany({
      where: { stock: { lte: 5 } },
      orderBy: { stock: "asc" },
      take: 10,
    }),
  ]);

  const recent = await prisma.transaction.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { items: true },
  });

  return NextResponse.json({
    omzetHariIni: today._sum.total ?? 0,
    trxHariIni: today._count,
    totalProduk: count,
    lowStock,
    recent: recent.map((t) => ({
      id: t.id,
      total: t.total,
      payment: t.payment,
      itemCount: t.items.reduce((n, i) => n + i.qty, 0),
      createdAt: t.createdAt,
    })),
  });
}
