import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentWarungId } from "@/lib/warung";

export const dynamic = "force-dynamic";

// GET /api/stock-moves?productId= → 100 pergerakan terakhir
export async function GET(req: Request) {
  const warungId = await currentWarungId();
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get("productId");

  const moves = await prisma.stockMove.findMany({
    where: {
      warungId,
      ...(productId ? { productId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { product: { select: { name: true, category: true, icon: true } } },
  });

  // Provide both type and reason (for backward compat)
  const mapped = moves.map((m) => ({
    ...m,
    reason: m.type,
  }));

  return NextResponse.json(mapped);
}
