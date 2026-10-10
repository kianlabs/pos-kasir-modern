import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { readJson } from "@/server/http";
import { catat } from "@/server/audit";
import { currentWarungId, currentKasirId, requireOwnerResponse } from "@/server/tenant";
import { clampTaxPct } from "@/shared/hitung-uang";
import { handleApiError } from "@/server/api-error";
import { isHHMM, optionalStr } from "@/server/validate";

export const dynamic = "force-dynamic";

// GET /api/settings → { taxEnabled, taxPct, receiptName, jamBuka, jamTutup }
export async function GET() {
  try {
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
  } catch (e) {
    return handleApiError(e);
  }
}

// PATCH /api/settings { taxEnabled?, taxPct?, receiptName?, jamBuka?, jamTutup? }
// Owner-only: kasir tidak boleh mengubah pajak / identitas struk.
export async function PATCH(req: Request) {
  try {
    const denied = await requireOwnerResponse();
    if (denied) return denied;

    const warungId = await currentWarungId();
    const kasirId = await currentKasirId(warungId);
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
      updateData.taxPct = clampTaxPct(Number(body.taxPct) || 0);
    }
    if (body.receiptName !== undefined) {
      updateData.receiptName = optionalStr(body.receiptName, 120);
    }
    if (body.jamBuka !== undefined) {
      const jam = optionalStr(body.jamBuka);
      if (jam !== null && !isHHMM(jam)) {
        return NextResponse.json({ error: "Format jam harus HH:MM." }, { status: 400 });
      }
      updateData.jamBuka = jam;
    }
    if (body.jamTutup !== undefined) {
      const jam = optionalStr(body.jamTutup);
      if (jam !== null && !isHHMM(jam)) {
        return NextResponse.json({ error: "Format jam harus HH:MM." }, { status: 400 });
      }
      updateData.jamTutup = jam;
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

    const fields = Object.keys(updateData);
    if (fields.length > 0) {
      await catat({
        warungId,
        userId: kasirId,
        action: "SETTING_CHANGE",
        meta: { fields },
      });
    }

    return NextResponse.json({
      taxEnabled: setting.taxEnabled,
      taxPct: setting.taxPct,
      receiptName: setting.receiptName,
      jamBuka: setting.jamBuka,
      jamTutup: setting.jamTutup,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
