import { prisma } from "@/server/db";
import { currentWarungId } from "@/server/tenant";
import { clampTaxPct } from "@/shared/hitung-uang";

type SettingDb = {
  setting: {
    findUnique: typeof prisma.setting.findUnique;
  };
};

// Pajak otomatis dari pengaturan per-warung.
// Kembalikan { enabled, pct } — checkout menghitung tax bila enabled.
export async function getTaxSetting(tx: SettingDb = prisma, warungId?: string) {
  const wId = warungId ?? (await currentWarungId());
  const row = await tx.setting.findUnique({
    where: { warungId: wId },
  });

  if (!row) {
    return { enabled: true, pct: 10 };
  }

  const enabled = !!row.taxEnabled;
  const pct = clampTaxPct(Number(row.taxPct) || 0);
  return { enabled, pct };
}
