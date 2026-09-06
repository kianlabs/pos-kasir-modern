import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/stock-moves?productId= → 100 pergerakan terakhir
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get("productId");

  const moves = await prisma.stockMove.findMany({
    where: productId ? { productId } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { product: { select: { name: true, category: true } } },
  });
  return NextResponse.json(moves);
}
