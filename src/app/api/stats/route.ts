import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const weekAgo = new Date(start);
  weekAgo.setDate(weekAgo.getDate() - 6);

  // Rentang kustom untuk filter laporan (inklusif)
  const range =
    fromParam && toParam
      ? { gte: new Date(fromParam + "T00:00:00"), lte: new Date(toParam + "T23:59:59") }
      : undefined;

  const [today, count, lowStock, weekTrx, topItems] = await Promise.all([
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
    prisma.transaction.findMany({
      where: { createdAt: { gte: weekAgo } },
      select: { total: true, createdAt: true },
    }),
    prisma.transactionItem.groupBy({
      by: ["productId"],
      _sum: { qty: true },
      orderBy: { _sum: { qty: "desc" } },
      take: 5,
    }),
  ]);

  // Omzet per hari 7 hari terakhir
  const days: { label: string; total: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(start);
    d.setDate(d.getDate() - i);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    const total = weekTrx
      .filter((t) => t.createdAt >= d && t.createdAt < next)
      .reduce((n, t) => n + t.total, 0);
    days.push({
      label: d.toLocaleDateString("id-ID", { weekday: "short" }),
      total,
    });
  }

  // Nama produk terlaris
  const topIds = topItems.map((t) => t.productId);
  const topProducts = await prisma.product.findMany({
    where: { id: { in: topIds } },
    select: { id: true, name: true, price: true },
  });
  const topById = new Map(topProducts.map((p) => [p.id, p]));
  const top = topItems.map((t) => ({
    name: topById.get(t.productId)?.name ?? "?",
    qty: t._sum.qty ?? 0,
    omzet: (topById.get(t.productId)?.price ?? 0) * (t._sum.qty ?? 0),
  }));

  const recent = await prisma.transaction.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { items: true },
  });

  const trxCount = today._count;
  const omzet = today._sum.total ?? 0;

  // Ringkasan periode (untuk filter tanggal + export)
  let rangeSummary = null;
  if (range) {
    const r = await prisma.transaction.aggregate({
      _sum: { total: true },
      _count: true,
      where: { createdAt: range },
    });
    const rCount = r._count;
    const rOmzet = r._sum.total ?? 0;
    rangeSummary = {
      from: fromParam,
      to: toParam,
      omzet: rOmzet,
      trx: rCount,
      rata2: rCount > 0 ? Math.round(rOmzet / rCount) : 0,
    };
  }

  return NextResponse.json({
    omzetHariIni: omzet,
    trxHariIni: trxCount,
    rataRata: trxCount > 0 ? Math.round(omzet / trxCount) : 0,
    totalProduk: count,
    lowStock,
    weekly: days,
    top,
    range: rangeSummary,
    recent: recent.map((t) => ({
      id: t.id,
      total: t.total,
      payment: t.payment,
      itemCount: t.items.reduce((n, i) => n + i.qty, 0),
      createdAt: t.createdAt,
    })),
  });
}
