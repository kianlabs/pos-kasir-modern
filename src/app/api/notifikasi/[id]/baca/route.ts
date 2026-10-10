import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { currentWarungId, requireOwnerResponse } from "@/server/tenant";
import { handleApiError } from "@/server/api-error";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// POST /api/notifikasi/[id]/baca → tandai readAt (owner-only, ter-scope tenant).
//
// updateMany + cek count: tak melempar P2025 saat 0 baris, dan warungId difilter
// ganda agar id yang bocor dari warung lain tidak bisa ditandai (aturan #1).
export async function POST(_req: Request, props: Params) {
  try {
    const denied = await requireOwnerResponse();
    if (denied) return denied;

    const { id } = await props.params;
    const warungId = await currentWarungId();

    // Set readAt hanya bila belum ada (idempoten — tanda baca kedua tak mengubah).
    const existing = await prisma.notifikasi.findFirst({
      where: { id, warungId },
      select: { id: true, readAt: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Notifikasi tidak ditemukan." }, { status: 404 });
    }

    if (!existing.readAt) {
      await prisma.notifikasi.updateMany({
        where: { id, warungId },
        data: { readAt: new Date(), status: "DIBACA" },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
