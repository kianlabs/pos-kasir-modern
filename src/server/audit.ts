import { prisma } from "@/server/db";
import type { AuditAction } from "@/types";

// catat() dipakai untuk semua aksi mutasi penting (lampiran skema §2 aturan #10).
// Gagal menulis audit TIDAK boleh menggagalkan aksi utama — cukup dilog.
type AuditInput = {
  warungId: string;
  userId?: string | null;
  action: AuditAction;
  meta?: Record<string, unknown> | null;
};

// Batas panjang meta agar baris audit tetap ringkas. Nilai ini di luar
// kebutuhan saat ini (meta hanya berisi angka/id kecil), tetapi melindungi
// dari pertumbuhan liar tanpa memotong JSON di tengah string.
const MAX_META_LENGTH = 4000;

export async function catat({ warungId, userId, action, meta }: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        warungId,
        userId: userId ?? null,
        action,
        // Ringkas: hanya angka/id, bukan data mentah (lampiran AI §5).
        // JANGAN potong string JSON — pemotongan bisa menghasilkan JSON tidak
        // valid (bug: `.slice()` lama memotong di tengah string). Bila terlalu
        // panjang, simpan penanda valid alih-alih JSON rusak.
        meta: serializeMeta(meta),
      },
    });
  } catch (e) {
    console.error("[audit] gagal mencatat", action, e);
  }
}

function serializeMeta(meta: Record<string, unknown> | null | undefined): string | null {
  if (!meta) return null;
  const json = JSON.stringify(meta);
  if (json.length <= MAX_META_LENGTH) return json;
  return JSON.stringify({ _truncated: true, _originalLength: json.length });
}
