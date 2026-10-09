// Sync engine offline-first (Tahap 4) — DUA bagian dalam satu modul:
//
// 1) SERVER — `prosesCheckout(tx, input)`: INTI checkout IDEMPOTENT yang dipakai
//    bersama oleh POST /api/checkout dan POST /api/sync. Menerima `tx` (Prisma
//    TransactionClient) supaya tetap atomik dalam satu `$transaction`.
//    PENTING: file ini juga diimpor bundle CLIENT (page.tsx) → hanya boleh
//    `import type` dari Prisma, TIDAK boleh meng-import `@/lib/prisma`,
//    `@/lib/settings`, atau `@/lib/audit` (semuanya menyeret Prisma runtime).
//    Query setting/pajak & audit dilakukan oleh route (server) yang memanggil.
//
// 2) CLIENT — `syncOutbox()` / `enqueueCheckout()`: menggerakkan antrean
//    IndexedDB (reuse `@/lib/offline/db`) ↔ endpoint /api/sync.
//
// Idempotency (PRD §10, lampiran §2 aturan #5): id = UUID client-side. Bila
// transaksi dengan id itu SUDAH ada untuk warung ini → kembalikan yang ada,
// JANGAN decrement stok lagi. Ini yang mencegah uang/transaksi dobel saat retry.

import type { Prisma } from "@prisma/client";
import { deleteOutbox, listOutbox, putOutbox } from "@/lib/offline/db";
import type {
  OutboxEntry,
  OutboxPayload,
  SyncBatchResponse,
  SyncItemResult,
} from "@/lib/offline/types";

// ════════════════════════════════════════════════════════════════════
// BAGIAN SERVER — inti checkout idempotent
// ════════════════════════════════════════════════════════════════════

export type CheckoutLine = { productId: string; qty: number };

export type ProsesCheckoutInput = {
  /** UUID dari client (opsional). Ada = jalur offline/retry → idempotent. */
  id: string | null;
  /** SELALU dari session (aturan #8) — tidak pernah dari client. */
  warungId: string;
  cashierId: string;
  items: CheckoutLine[];
  cash: number;
  payment: "CASH" | "QRIS";
  /** Sudah dinormalisasi (>= 0) oleh pemanggil. */
  discount: number;
  mejaId: string | null;
  dibuatOffline: boolean;
  /** Waktu dibuat di tablet (opsional) agar urutan histori benar saat sync. */
  createdAt: Date | null;
  /** Pajak dari pengaturan warung (diambil pemanggil via getTaxSetting). */
  taxCfg: { enabled: boolean; pct: number };
  /**
   * false = jalur online: stok kurang DITOLAK.
   * true  = jalur sync (PRD §12): stok kurang DITERIMA (boleh minus) + ditandai
   *         konflik untuk review owner ("transparan > sempurna").
   */
  allowStokMinus: boolean;
};

export type KonflikStok = { productId: string; name: string; butuh: number; sisa: number };

export type ProsesCheckoutResult = {
  id: string;
  /** true = transaksi id ini sudah ada → tidak menyentuh stok (idempotent hit). */
  sudahAda: boolean;
  /** true = diterima walau stok kurang (hanya mungkin saat allowStokMinus). */
  konflikStok: boolean;
  /** Detail produk yang stoknya kurang (untuk audit SYNC_CONFLICT). */
  konfliks: KonflikStok[];
};

/**
 * Membuat transaksi LUNAS secara atomik & IDEMPOTENT.
 *
 * Kontrak (dipakai /api/checkout & /api/sync):
 * - Bila `input.id` sudah ada untuk `warungId` → kembalikan yang ada, tidak
 *   membuat baris/item baru & tidak decrement stok (IDEMPOTENT).
 * - Bila `input.id` ada tetapi milik warung LAIN → lempar (isolasi tenant,
 *   aturan #8) — jangan pernah kembalikan/bocorkan transaksi tenant lain.
 * - Bila belum ada → buat Transaction + TransactionItem (snapshot) + StockMove
 *   + decrement stok, semua dalam `tx` yang sama.
 *
 * Catatan race: cek-lalu-create di dalam `$transaction` mengandalkan serialisasi
 * transaksi interaktif Prisma/SQLite (pola sama dengan buka-shift & buka-bill).
 * Bila dua request id sama benar-benar balapan, satu kalah unique (P2002);
 * pemanggil menangkapnya via `isUniqueConstraintError` dan mengembalikan yang
 * ada (tetap idempotent). Saat migrasi ke Postgres: `id` sudah PK → aman.
 */
export async function prosesCheckout(
  tx: Prisma.TransactionClient,
  input: ProsesCheckoutInput
): Promise<ProsesCheckoutResult> {
  const { warungId, cashierId } = input;

  // (1) IDEMPOTENCY — INTI. Bila id dari client sudah ada → kembalikan yang ada.
  if (input.id) {
    const existing = await tx.transaction.findUnique({
      where: { id: input.id },
      select: { id: true, warungId: true },
    });
    if (existing) {
      // Isolasi tenant: id milik warung lain bukan milik kita → jangan bocorkan.
      if (existing.warungId !== warungId) {
        throw new Error("Transaksi tidak ditemukan.");
      }
      return { id: existing.id, sudahAda: true, konflikStok: false, konfliks: [] };
    }
  }

  // (2) Gabung item duplikat per productId + validasi bentuk.
  const merged = new Map<string, number>();
  for (const item of input.items ?? []) {
    if (!item || typeof item.productId !== "string" || !item.productId) {
      throw new Error("Item keranjang tidak valid.");
    }
    if (!Number.isInteger(item.qty) || item.qty <= 0) {
      throw new Error("Item keranjang tidak valid.");
    }
    merged.set(item.productId, (merged.get(item.productId) ?? 0) + item.qty);
  }
  if (merged.size === 0) throw new Error("Keranjang kosong.");

  // (3) Produk — WAJIB filter warungId (aturan #1).
  const items = Array.from(merged.entries());
  const products = await tx.product.findMany({
    where: { id: { in: items.map(([pid]) => pid) }, warungId },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  let subtotal = 0;
  const konfliks: KonflikStok[] = [];
  for (const [pid, qty] of items) {
    const p = byId.get(pid);
    if (!p) throw new Error("Produk tidak ditemukan.");
    if (p.stock < qty) {
      if (!input.allowStokMinus) {
        throw new Error(`Stok ${p.name} kurang (sisa ${p.stock}).`);
      }
      // Jalur sync: terima, tandai konflik (PRD §12).
      konfliks.push({ productId: p.id, name: p.name, butuh: qty, sisa: p.stock });
    }
    subtotal += p.price * qty;
  }

  // (4) Uang integer rupiah. Diskon di-clamp ke subtotal; pajak dari setting.
  const disc = Math.min(input.discount, subtotal);
  const tax = input.taxCfg.enabled
    ? Math.round(((subtotal - disc) * input.taxCfg.pct) / 100)
    : 0;
  const total = subtotal - disc + tax;

  const paid = input.payment === "CASH" ? input.cash : total;
  if (paid < total) throw new Error(`Uang kurang ${total - paid}.`);

  // (5) Meja OPSIONAL — validasi kepemilikan (aturan #1 & #8).
  if (input.mejaId) {
    const meja = await tx.meja.findFirst({ where: { id: input.mejaId, warungId } });
    if (!meja) throw new Error("Meja tidak ditemukan.");
  }

  const shift = await tx.shift.findFirst({
    where: { warungId, status: "BUKA" },
    orderBy: { openedAt: "desc" },
  });

  // (6) Simpan transaksi. `id` client dipakai bila ada (idempotent saat retry).
  const created = await tx.transaction.create({
    data: {
      ...(input.id ? { id: input.id } : {}),
      warungId,
      cashierId,
      mejaId: input.mejaId,
      status: "LUNAS",
      subtotal,
      discount: disc,
      tax,
      total,
      cash: paid,
      change: paid - total,
      payment: input.payment,
      shiftId: shift?.id ?? null,
      dibuatOffline: input.dibuatOffline,
      ...(input.createdAt ? { createdAt: input.createdAt } : {}),
    },
  });

  // (7) Snapshot item + decrement stok + kartu stok (dalam tx yang sama).
  for (const [pid, qty] of items) {
    const p = byId.get(pid)!;
    await tx.transactionItem.create({
      data: {
        warungId,
        transactionId: created.id,
        productId: p.id,
        name: p.name,
        qty,
        price: p.price,
      },
    });
    await tx.product.update({
      where: { id: p.id },
      data: { stock: { decrement: qty } },
    });
    await tx.stockMove.create({
      data: {
        warungId,
        productId: p.id,
        qty: -qty,
        type: "PENJUALAN",
        refId: created.id,
        createdBy: cashierId,
      },
    });
  }

  return { id: created.id, sudahAda: false, konflikStok: konfliks.length > 0, konfliks };
}

/** True bila error Prisma adalah pelanggaran unique (P2002) — mis. race id. */
export function isUniqueConstraintError(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2002";
}

// ════════════════════════════════════════════════════════════════════
// BAGIAN CLIENT — penggerak antrean IndexedDB ↔ /api/sync
// ════════════════════════════════════════════════════════════════════

/** Batas item per request sync — selaras dengan guard endpoint /api/sync. */
export const SYNC_BATCH_LIMIT = 100;

export type SyncRingkasan = {
  total: number;
  synced: number;
  conflicts: number;
  errors: number;
  /** true bila berhenti karena server tak terjangkau (bukan error data). */
  offline: boolean;
};

/** Bentuk satu transaksi saat dikirim ke /api/sync. */
function keWire(entry: OutboxEntry) {
  return {
    id: entry.id,
    items: entry.payload.items,
    cash: entry.payload.cash,
    payment: entry.payload.payment,
    discount: entry.payload.discount,
    mejaId: entry.payload.mejaId ?? null,
    createdAt: entry.createdAt,
  };
}

/**
 * Kirim seluruh antrean outbox ke /api/sync dalam batch (maks 100).
 * - "ok"       → hapus dari antrean (deleteOutbox).
 * - "conflict" → simpan ulang dengan status "conflict" + lastError.
 * - "error"    → attempts++ + status "error" (tetap di antrean, dicoba lagi).
 * Bila server tak terjangkau, entri TIDAK dibuang — ditandai "error" agar
 * dicoba lagi pada sync berikutnya.
 */
export async function syncOutbox(): Promise<SyncRingkasan> {
  const entries = await listOutbox();
  const ringkasan: SyncRingkasan = {
    total: entries.length,
    synced: 0,
    conflicts: 0,
    errors: 0,
    offline: false,
  };
  if (entries.length === 0) return ringkasan;

  for (let i = 0; i < entries.length; i += SYNC_BATCH_LIMIT) {
    const batch = entries.slice(i, i + SYNC_BATCH_LIMIT);

    let data: SyncBatchResponse | null = null;
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions: batch.map(keWire) }),
      });
      if (res.ok) data = (await res.json()) as SyncBatchResponse;
    } catch {
      data = null;
    }

    if (!data) {
      // Server tak terjangkau → jangan buang antrean; tandai agar dicoba lagi.
      for (const entry of batch) {
        await putOutbox({
          ...entry,
          status: "error",
          attempts: entry.attempts + 1,
          lastError: "Gagal menghubungi server.",
        });
        ringkasan.errors++;
      }
      ringkasan.offline = true;
      break;
    }

    const byId = new Map<string, SyncItemResult>(data.results.map((r) => [r.id, r]));
    for (const entry of batch) {
      const hasil = byId.get(entry.id);
      if (!hasil) {
        await putOutbox({
          ...entry,
          status: "error",
          attempts: entry.attempts + 1,
          lastError: "Server tidak mengembalikan hasil untuk transaksi ini.",
        });
        ringkasan.errors++;
        continue;
      }
      await terapkanHasil(entry, hasil, ringkasan);
    }
  }

  return ringkasan;
}

async function terapkanHasil(
  entry: OutboxEntry,
  hasil: SyncItemResult,
  ringkasan: SyncRingkasan
): Promise<void> {
  if (hasil.status === "ok") {
    await deleteOutbox(entry.id);
    ringkasan.synced++;
  } else if (hasil.status === "conflict") {
    await putOutbox({ ...entry, status: "conflict", lastError: hasil.message });
    ringkasan.conflicts++;
  } else {
    await putOutbox({
      ...entry,
      status: "error",
      attempts: entry.attempts + 1,
      lastError: hasil.message,
    });
    ringkasan.errors++;
  }
}

/**
 * Masukkan satu checkout ke antrean offline. `id` = UUID client-side (calon
 * Transaction.id di server) → retry aman/idempotent.
 *
 * `opts.id` dapat diberikan pemanggil bila id perlu diketahui SEBELUM enqueue
 * (mis. untuk mengarahkan langsung ke `/struk/offline/<id>`); bila tidak diisi,
 * id dibuat di sini.
 */
export async function enqueueCheckout(
  payload: OutboxPayload,
  opts?: { id?: string; createdAt?: number }
): Promise<OutboxEntry> {
  const entry: OutboxEntry = {
    id: opts?.id ?? crypto.randomUUID(),
    payload,
    createdAt: opts?.createdAt ?? Date.now(),
    status: "pending",
    attempts: 0,
  };
  await putOutbox(entry);
  return entry;
}
