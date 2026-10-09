import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { currentWarungId } from "@/server/tenant";

export const dynamic = "force-dynamic";

// GET /api/shifts/active → shift buka saat ini atau null
export async function GET() {
  const warungId = await currentWarungId();
  const shift = await prisma.shift.findFirst({
    where: { warungId, status: "BUKA" },
    orderBy: { openedAt: "desc" },
  });
  return NextResponse.json(shift);
}
