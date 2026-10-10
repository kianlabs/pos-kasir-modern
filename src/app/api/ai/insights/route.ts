import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { currentWarungId, requireOwnerResponse } from "@/server/tenant";
import { handleApiError } from "@/server/api-error";

export const dynamic = "force-dynamic";

// GET /api/ai/insights → daftar Insight terbaru untuk warung sesi (lampiran §6).
//
// Owner-only (fitur AI tidak untuk kasir, §1.3). Limit tetap 30 (lampiran §6)
// agar payload kecil; urut terbaru dulu. warungId turunan session (aturan #4).
export async function GET() {
  try {
    const denied = await requireOwnerResponse();
    if (denied) return denied;

    const warungId = await currentWarungId();

    const rows = await prisma.insight.findMany({
      where: { warungId },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        findings: true,
        source: true,
        readAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json(rows);
  } catch (e) {
    return handleApiError(e);
  }
}
