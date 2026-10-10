import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { currentWarungId, requireOwnerResponse } from "@/server/tenant";
import { handleApiError } from "@/server/api-error";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// POST /api/ai/insights/[id]/read → tandai readAt (owner-only, ter-scope tenant).
//
// updateMany + cek count: tak melempar P2025 saat 0 baris, dan warungId difilter
// ganda agar id milik warung lain tidak bisa ditandai (aturan isolasi tenant #1).
// Idempoten: tanda baca kedua tak mengubah apa pun (readAt hanya diisi sekali).
export async function POST(_req: Request, props: Params) {
  try {
    const denied = await requireOwnerResponse();
    if (denied) return denied;

    const { id } = await props.params;
    const warungId = await currentWarungId();

    const existing = await prisma.insight.findFirst({
      where: { id, warungId },
      select: { id: true, readAt: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Insight tidak ditemukan." }, { status: 404 });
    }

    if (!existing.readAt) {
      await prisma.insight.updateMany({
        where: { id, warungId },
        data: { readAt: new Date() },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
