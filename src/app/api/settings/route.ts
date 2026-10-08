import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/request";
import { currentWarungId, requireOwnerResponse } from "@/lib/warung";

export const dynamic = "force-dynamic";

// GET /api/settings → { taxEnabled, taxPct, receiptName, jamBuka, jamTutup }
export async function GET() {
  const warungId = await currentWarungId();
  const setting = await prisma.setting.findUnique({
    where: { warungId },
  });

  return NextResponse.json({
    taxEnabled: setting?.taxEnabled ?? true,
    taxPct: setting?.taxPct ?? 10,
    receiptName: setting?.receiptName ?? null,
    jamBuka: setting?.jamBuka ?? "07:00",
    jamTutup: setting?.jamTutup ?? "21:00",
  });
}

// PATCH /api/settings { taxEnabled?, taxPct?, receiptName?, jamBuka?, jamTutup? }
// Owner-only: kasir tidak boleh mengubah pajak / identitas struk.
export async function PATCH(req: Request) {
  const denied = await requireOwnerResponse();
  if (denied) return denied;

  const warungId = await currentWarungId();
  const body = await readJson(req);
  if (!body) return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });

  const updateData: {
    taxEnabled?: boolean;
    taxPct?: number;
    receiptName?: string | null;
    jamBuka?: string | null;
    jamTutup?: string | null;
  } = {};

  if (body.taxEnabled !== undefined) {
    updateData.taxEnabled = Boolean(body.taxEnabled);
  }
  if (body.taxPct !== undefined) {
    updateData.taxPct = Math.min(100, Math.max(0, Number(body.taxPct) || 0));
  }
  if (body.receiptName !== undefined) {
    updateData.receiptName = body.receiptName ? String(body.receiptName).trim() : null;
  }
  if (body.jamBuka !== undefined) {
    updateData.jamBuka = body.jamBuka ? String(body.jamBuka).trim() : null;
  }
  if (body.jamTutup !== undefined) {
    updateData.jamTutup = body.jamTutup ? String(body.jamTutup).trim() : null;
  }

  const setting = await prisma.setting.upsert({
    where: { warungId },
    update: updateData,
    create: {
      warungId,
      taxEnabled: updateData.taxEnabled ?? true,
      taxPct: updateData.taxPct ?? 10,
      receiptName: updateData.receiptName ?? null,
      jamBuka: updateData.jamBuka ?? "07:00",
      jamTutup: updateData.jamTutup ?? "21:00",
    },
  });

  return NextResponse.json({
    taxEnabled: setting.taxEnabled,
    taxPct: setting.taxPct,
    receiptName: setting.receiptName,
    jamBuka: setting.jamBuka,
    jamTutup: setting.jamTutup,
  });
}
