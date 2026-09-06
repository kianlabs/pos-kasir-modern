import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTaxSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

// GET /api/settings → { taxEnabled, taxPct }
export async function GET() {
  const tax = await getTaxSetting();
  return NextResponse.json({ taxEnabled: tax.enabled, taxPct: tax.pct });
}

// PATCH /api/settings { taxEnabled?, taxPct? }
export async function PATCH(req: Request) {
  const body = await req.json();
  if (body.taxEnabled !== undefined) {
    await prisma.setting.upsert({
      where: { key: "taxEnabled" },
      update: { value: body.taxEnabled ? "1" : "0" },
      create: { key: "taxEnabled", value: body.taxEnabled ? "1" : "0" },
    });
  }
  if (body.taxPct !== undefined) {
    const pct = Math.min(100, Math.max(0, Number(body.taxPct) || 0));
    await prisma.setting.upsert({
      where: { key: "taxPct" },
      update: { value: String(pct) },
      create: { key: "taxPct", value: String(pct) },
    });
  }
  const tax = await getTaxSetting();
  return NextResponse.json({ taxEnabled: tax.enabled, taxPct: tax.pct });
}
