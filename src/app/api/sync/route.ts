import { NextResponse } from "next/server";
import { prisma, transaksi } from "@/server/db";
import { getTaxSetting } from "@/server/settings";
import { readJson } from "@/server/http";
import { catat } from "@/server/audit";
import { currentWarungId, currentKasirId } from "@/server/tenant";
import {
  prosesCheckout,
  isUniqueConstraintError,
  SYNC_BATCH_LIMIT,
  BATAS_UANG,
  type CheckoutLine,
} from "@/client/offline-sync";
import type { SyncItemResult } from "@/client/offline-types";

export const dynamic = "force-dynamic";

type TransaksiSync = {
  id?: unknown;
  items?: unknown;
  cash?: unknown;
  payment?: unknown;
  discount?: unknown;
  mejaId?: unknown;
  total?: unknown;
  createdAt?: unknown;
};

// POST /api/sync { transactions: [{ id, items, cash, payment, discount, mejaId?, createdAt? }] }
//
// Sinkronisasi batch transaksi yang dibuat OFFLINE di tablet. Untuk tiap
// transaksi diproses IDEMPOTENT (upsert by id): kirim 2× id sama → tetap 1 baris.
//
// PRD §12 — stok boleh minus sementara saat offline: bila saat sync stok KURANG,
// transaksi TETAP DITERIMA (tidak ditolak) dan ditandai konflik lewat audit
// SYNC_CONFLICT untuk review owner ("transparan > sempurna").
//
// warungId & kasirId SELALU dari session (aturan #8) — tidak pernah dari client.
export async function POST(req: Request) {
  const warungId = await currentWarungId();
  const kasirId = await currentKasirId(warungId);

  const body = await readJson(req);
  if (!body) return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });

  const raw = body.transactions;
  if (!Array.isArray(raw)) {
    return NextResponse.json({ error: "Field 'transactions' harus berupa array." }, { status: 400 });
  }
  if (raw.length === 0) {
    return NextResponse.json({ error: "Tidak ada transaksi untuk disinkronkan." }, { status: 400 });
  }
  if (raw.length > SYNC_BATCH_LIMIT) {
    return NextResponse.json(
      { error: `Batch maksimum ${SYNC_BATCH_LIMIT} transaksi.` },
      { status: 400 }
    );
  }

  // Pajak per-warung — sama untuk seluruh batch.
  const taxCfg = await getTaxSetting(prisma, warungId);

  const results: SyncItemResult[] = [];
  let synced = 0;
  let conflicts = 0;
  let errors = 0;

  for (const item of raw as TransaksiSync[]) {
    const id = typeof item?.id === "string" && item.id ? item.id : null;
    if (!id) {
      results.push({ id: "", status: "error", message: "Transaksi tanpa id." });
      errors++;
      continue;
    }

    const hasil = await prosesSatu(id, item, warungId, kasirId, taxCfg);
    results.push(hasil);
    if (hasil.status === "ok") synced++;
    else if (hasil.status === "conflict") conflicts++;
    else errors++;
  }

  // Ringkasan batch (audit gagal tidak boleh menggagalkan sync — catat() aman).
  await catat({
    warungId,
    userId: kasirId,
    action: "SYNC_BATCH",
    meta: { total: raw.length, synced, conflicts, errors },
  });

  return NextResponse.json({ results, synced, conflicts, errors });
}

async function prosesSatu(
  id: string,
  item: TransaksiSync,
  warungId: string,
  kasirId: string,
  taxCfg: { enabled: boolean; pct: number }
): Promise<SyncItemResult> {
  const rawItems = item.items;
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { id, status: "error", message: "Keranjang kosong." };
  }

  const cash = Number(item.cash);
  const payment = item.payment === "QRIS" ? "QRIS" : "CASH";
  // Diskon: clamp eksplisit ke [0, BATAS_UANG] (bukan hanya >= 0) agar nilai
  // absurd dari client tak menghasilkan diskon/total aneh atau overflow int32.
  const discount = Math.min(Math.max(0, Math.floor(Number(item.discount) || 0)), BATAS_UANG);
  const mejaId = typeof item.mejaId === "string" && item.mejaId ? item.mejaId : null;
  // Total dihitung client saat offline (opsional) → otoritatif saat sync (PRD §12).
  // Validasi rentang: bila bukan integer atau di luar [0, BATAS_UANG], JANGAN
  // diteruskan mentah — kembalikan error (data korup) agar server hitung sendiri
  // lewat jalur normal, bukan menyimpan total di luar batas wajar.
  const totalMentah = Number(item.total);
  const totalDariClient =
    item.total === undefined || item.total === null
      ? null
      : Number.isInteger(totalMentah) && totalMentah >= 0 && totalMentah <= BATAS_UANG
        ? totalMentah
        : null;
  if (item.total !== undefined && item.total !== null && totalDariClient === null) {
    return { id, status: "error", message: "Total transaksi di luar batas wajar." };
  }
  const createdAt =
    typeof item.createdAt === "number" && Number.isFinite(item.createdAt)
      ? new Date(item.createdAt)
      : null;

  if (payment === "CASH" && (!Number.isInteger(cash) || cash < 0)) {
    return { id, status: "error", message: "Nominal tunai tidak valid." };
  }

  // Fast-path idempotent: sudah tersync sebelumnya → ok tanpa menyentuh stok.
  const existing = await prisma.transaction.findUnique({
    where: { id },
    select: { id: true, warungId: true },
  });
  if (existing) {
    if (existing.warungId !== warungId) {
      // Isolasi tenant: id milik warung lain → jangan pernah dianggap milik kita.
      return { id, status: "error", message: "Transaksi bukan milik warung ini." };
    }
    return { id, status: "ok", serverId: existing.id };
  }

  try {
    const result = await transaksi(async (tx) => {
      return prosesCheckout(tx, {
        id,
        warungId,
        cashierId: kasirId,
        items: rawItems as CheckoutLine[],
        cash,
        payment,
        discount,
        mejaId,
        dibuatOffline: true,
        createdAt,
        taxCfg,
        allowStokMinus: true, // PRD §12: terima walau stok kurang
        totalDariClient,
      });
    });

    if (result.sudahAda) {
      // Balapan: request lain menciptakannya lebih dulu → tetap ok.
      return { id, status: "ok", serverId: result.id };
    }

    // M4 — total client diterima → diskon/pajak tersimpan menyimpang dari formula
    // normal. Audit agar owner melihat "diskon hantu" (bukan transparan tanpa jejak).
    if (result.moneyRecomputed) {
      await catat({
        warungId,
        userId: kasirId,
        action: "SYNC_MONEY_RECOMPUTED",
        meta: { transactionId: result.id, ...result.moneyDetail },
      });
    }

    // M2 — transaksi offline diatribusikan ke shift yang meragukan (tak ada shift
    // BUKA, atau createdAt di luar jendela shift terpilih). Audit untuk review owner.
    if (result.shiftOrphan) {
      await catat({
        warungId,
        userId: kasirId,
        action: "SYNC_ORPHAN_SHIFT",
        meta: { transactionId: result.id, ...result.shiftDetail },
      });
    }

    if (result.konflikStok) {
      // Transaksi diterima tapi stok kurang → tandai konflik untuk review owner.
      await catat({
        warungId,
        userId: kasirId,
        action: "SYNC_CONFLICT",
        meta: { transactionId: result.id, konflik: result.konfliks },
      });
      return {
        id,
        status: "conflict",
        serverId: result.id,
        message: "Stok kurang saat sync — transaksi tetap diterima, tandai untuk review.",
      };
    }

    return { id, status: "ok", serverId: result.id };
  } catch (e) {
    // Balapan id: transaksi sudah tercipta di request lain → ok (idempotent).
    if (isUniqueConstraintError(e)) {
      return { id, status: "ok", serverId: id };
    }
    const message = e instanceof Error ? e.message : "Gagal menyimpan transaksi.";
    return { id, status: "error", message };
  }
}
