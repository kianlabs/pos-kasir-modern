import { prisma } from "@/lib/prisma";
import type { AuditAction } from "@/types";

// catat() dipakai untuk semua aksi mutasi penting (lampiran skema §2 aturan #10).
// Gagal menulis audit TIDAK boleh menggagalkan aksi utama — cukup dilog.
type AuditInput = {
  warungId: string;
  userId?: string | null;
  action: AuditAction;
  meta?: Record<string, unknown> | null;
};

export async function catat({ warungId, userId, action, meta }: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        warungId,
        userId: userId ?? null,
        action,
        // Ringkas: hanya angka/id, bukan data mentah (lampiran AI §5).
        meta: meta ? JSON.stringify(meta).slice(0, 500) : null,
      },
    });
  } catch (e) {
    console.error("[audit] gagal mencatat", action, e);
  }
}
