import { prisma } from "@/lib/prisma";
import { currentWarungId } from "@/lib/warung";

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
  const pct = Math.min(100, Math.max(0, Number(row.taxPct) || 0));
  return { enabled, pct };
}
