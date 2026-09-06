import { prisma } from "@/lib/prisma";

type SettingDb = { setting: Pick<typeof prisma.setting, "findMany"> };

// Pajak otomatis dari pengaturan global.
// Kembalikan { enabled, pct } — checkout menghitung tax bila enabled.
export async function getTaxSetting(tx: SettingDb = prisma) {
  const rows = await tx.setting.findMany({
    where: { key: { in: ["taxEnabled", "taxPct"] } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const enabled = map.get("taxEnabled") !== "0";
  const pct = Math.min(100, Math.max(0, Number(map.get("taxPct") ?? 10) || 0));
  return { enabled, pct };
}
