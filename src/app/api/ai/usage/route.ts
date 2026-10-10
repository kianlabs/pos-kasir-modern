import { NextResponse } from "next/server";
import { currentWarungId, requireOwnerResponse } from "@/server/tenant";
import { handleApiError } from "@/server/api-error";
import { ringkasUsage } from "@/server/ai/usage";

export const dynamic = "force-dynamic";

// GET /api/ai/usage → ringkasan pemakaian token AI bulan ini (lampiran §8, §11).
//
// Owner-only (fitur AI tidak untuk kasir, §1.3). warungId turunan session
// (aturan §1.4) — tak ada id dari query. Query opsional `?bulan=YYYY-MM` untuk
// melihat bulan lain; default = bulan berjalan (WIB).
export async function GET(req: Request) {
  try {
    const denied = await requireOwnerResponse();
    if (denied) return denied;

    const warungId = await currentWarungId();

    const bulan = new URL(req.url).searchParams.get("bulan") ?? undefined;
    const ringkasan = await ringkasUsage(warungId, { bulan });

    return NextResponse.json(ringkasan);
  } catch (e) {
    return handleApiError(e);
  }
}
