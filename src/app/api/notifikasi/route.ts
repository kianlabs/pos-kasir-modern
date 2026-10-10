import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { currentWarungId, requireOwnerResponse } from "@/server/tenant";
import { handleApiError } from "@/server/api-error";

export const dynamic = "force-dynamic";

// GET /api/notifikasi?limit=20 → daftar notifikasi outbox terbaru untuk warung
// sesi. Owner-only (laporan shift berisi angka kas — kasir tak perlu).
//
// Fase 2 §7a: hanya MEMBACA outbox. Tidak ada pengiriman/HTTP ke provider.
export async function GET(req: Request) {
  try {
    const denied = await requireOwnerResponse();
    if (denied) return denied;

    const warungId = await currentWarungId();
    const { searchParams } = new URL(req.url);

    const limitParam = Number(searchParams.get("limit"));
    const limit = Number.isInteger(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 20;

    const rows = await prisma.notifikasi.findMany({
      where: { warungId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        jenis: true,
        subject: true,
        body: true,
        status: true,
        refId: true,
        createdAt: true,
        readAt: true,
      },
    });

    return NextResponse.json(rows);
  } catch (e) {
    return handleApiError(e);
  }
}
