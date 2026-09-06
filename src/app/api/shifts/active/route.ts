import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/shifts/active → shift buka saat ini atau null
export async function GET() {
  const shift = await prisma.shift.findFirst({
    where: { status: "BUKA" },
    orderBy: { openedAt: "desc" },
  });
  return NextResponse.json(shift);
}
