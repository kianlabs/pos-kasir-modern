// Pengiriman notifikasi outbox + penyusunan struk pembeli (Fase 2 §7a).
//
// Modul ini menjembatani OUTBOX (`notifikasi`, lihat src/server/notif.ts) dengan
// adapter provider (`src/server/wa/client.ts`):
//  - `kirimNotifikasi`  : kirim SATU baris notifikasi berdasarkan id.
//  - `kirimSemuaPending`: kirim semua baris PENDING warung (dibatasi per panggilan).
//  - `enqueueStrukWa`   : susun teks struk & simpan sebagai baris notifikasi PENDING.
//
// Aturan tenant #1: SEMUA query difilter `warungId` — tidak pernah dari client.
// Prinsip degradasi §9: kegagalan provider TIDAK melempar; baris ditandai GAGAL
// (tidak dihapus) agar bisa dicoba ulang, dan kasir tak pernah terpengaruh.

import { prisma } from "@/server/db";
import { rupiah } from "@/shared/rupiah";
import { kirimPesanWa } from "@/server/wa/client";

// Batas jumlah baris yang diproses per panggilan `kirimSemuaPending` — membatasi
// durasi kerja (tiap baris = 1 request jaringan) dan waktu tunggu route.
const MAKS_PER_KIRIM_PENDING = 20;

export type HasilKirimNotifikasi = {
  ok: boolean;
  /** Status akhir baris notifikasi: TERKIRIM | GAGAL (atau status awal bila dilewati). */
  status: string;
  /** Alasan bila gagal (mis. nomor kosong, provider down). */
  error?: string;
};

export type HasilKirimSemuaPending = {
  terkirim: number;
  gagal: number;
};

// Simpan id pesan provider ke kolom `meta` (JSON) tanpa menimpa angka audit yang
// sudah ada dari pembuat baris (mis. ringkasan shift di notif.ts). Bila meta
// bukan JSON valid, ganti dengan objek baru agar tidak crash.
function metaDenganProviderId(
  metaLama: string | null,
  providerId: string | undefined,
): string | undefined {
  if (!providerId) return undefined;
  let obj: Record<string, unknown> = {};
  if (metaLama) {
    try {
      const parsed = JSON.parse(metaLama);
      if (parsed && typeof parsed === "object") obj = parsed as Record<string, unknown>;
    } catch {
      obj = {};
    }
  }
  obj.waProviderId = providerId;
  return JSON.stringify(obj);
}

/**
 * Kirim SATU baris notifikasi (ter-scope tenant) lewat provider WA.
 *
 * Tahapan:
 *  1. Load baris by id + warungId (tenant-safe). Tidak ada → lempar ApiError 404.
 *  2. Bila `tujuan` kosong → tandai GAGAL "Nomor tujuan kosong." (bukan 500).
 *  3. Panggil kirimPesanWa (tak pernah melempar).
 *  4. Sukses → status TERKIRIM + sentAt; gagal → status GAGAL (baris dipertahankan).
 */
export async function kirimNotifikasi(
  warungId: string,
  notifikasiId: string,
): Promise<HasilKirimNotifikasi> {
  const baris = await prisma.notifikasi.findFirst({
    where: { id: notifikasiId, warungId },
    select: { id: true, tujuan: true, body: true, meta: true },
  });
  if (!baris) {
    // Import ApiError dinamis-aman: konstanta kecil, tak menambah siklus.
    const { ApiError } = await import("@/server/api-error");
    throw new ApiError("Notifikasi tidak ditemukan.", 404);
  }

  const tujuan = (baris.tujuan ?? "").trim();
  if (tujuan.length === 0) {
    await prisma.notifikasi.updateMany({
      where: { id: notifikasiId, warungId },
      data: { status: "GAGAL" },
    });
    return { ok: false, status: "GAGAL", error: "Nomor tujuan kosong." };
  }

  const hasil = await kirimPesanWa({ tujuan, pesan: baris.body });

  if (hasil.ok) {
    const meta = metaDenganProviderId(baris.meta, hasil.providerId);
    await prisma.notifikasi.updateMany({
      where: { id: notifikasiId, warungId },
      data: {
        status: "TERKIRIM",
        sentAt: new Date(),
        ...(meta ? { meta } : {}),
      },
    });
    return { ok: true, status: "TERKIRIM" };
  }

  // GAGAL: pertahankan baris agar bisa dicoba ulang; catat alasan bila ada.
  await prisma.notifikasi.updateMany({
    where: { id: notifikasiId, warungId },
    data: { status: "GAGAL" },
  });
  return { ok: false, status: "GAGAL", error: hasil.error };
}

/**
 * Kirim SEMUA baris notifikasi PENDING milik warung (dibatasi
 * `MAKS_PER_KIRIM_PENDING` per panggilan). Tiap baris diproses berurutan agar
 * beban provider terkendali; hasil dihitung per baris.
 *
 * Baris yang gagal (nomor kosong / provider down) ditandai GAGAL, sehingga tidak
 * ikut terambil pada panggilan berikutnya — idempoten-ish & mudah dilacak.
 */
export async function kirimSemuaPending(warungId: string): Promise<HasilKirimSemuaPending> {
  const rows = await prisma.notifikasi.findMany({
    where: { warungId, status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: MAKS_PER_KIRIM_PENDING,
    select: { id: true },
  });

  let terkirim = 0;
  let gagal = 0;

  for (const row of rows) {
    const hasil = await kirimNotifikasi(warungId, row.id);
    if (hasil.ok) terkirim++;
    else gagal++;
  }

  return { terkirim, gagal };
}

// Susun teks struk plain-text untuk pembeli (deterministik, tanpa HTML).
function renderStrukWa(input: {
  warungNama: string;
  createdAt: Date;
  items: { name: string; price: number; qty: number }[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  payment: string;
}): { subject: string; body: string } {
  const subject = `Struk — ${input.warungNama}`;

  const lines: string[] = [
    `🧾 Struk — ${input.warungNama}`,
    input.createdAt.toLocaleString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    ``,
  ];

  for (const it of input.items) {
    lines.push(`${it.name} ×${it.qty} = ${rupiah(it.price * it.qty)}`);
  }

  lines.push(``);
  lines.push(`Subtotal: ${rupiah(input.subtotal)}`);
  if (input.discount > 0) lines.push(`Diskon: -${rupiah(input.discount)}`);
  if (input.tax > 0) lines.push(`Pajak: ${rupiah(input.tax)}`);
  lines.push(`Total: ${rupiah(input.total)}`);
  lines.push(`Bayar: ${input.payment}`);
  lines.push(``);
  lines.push(`Terima kasih 🙏`);

  return { subject, body: lines.join("\n") };
}

/**
 * Susun teks struk pembeli dari transaksi (ter-scope tenant) dan simpan sebagai
 * baris notifikasi PENDING (jenis "STRUK", channel "WA"). Kembalikan id baris,
 * atau null bila transaksi tidak ada / bukan milik warung ini.
 *
 * Item memakai SNAPSHOT name/price/qty dari TransactionItem — struk menampilkan
 * harga saat transaksi, bukan harga produk sekarang.
 */
export async function enqueueStrukWa(
  warungId: string,
  transactionId: string,
  tujuan: string,
): Promise<{ id: string } | null> {
  const trx = await prisma.transaction.findFirst({
    where: { id: transactionId, warungId },
    include: {
      warung: { select: { nama: true } },
      items: { select: { name: true, price: true, qty: true } },
    },
  });
  if (!trx) return null;

  const { subject, body } = renderStrukWa({
    warungNama: trx.warung.nama,
    createdAt: trx.createdAt,
    items: trx.items,
    subtotal: trx.subtotal,
    discount: trx.discount,
    tax: trx.tax,
    total: trx.total,
    payment: trx.payment,
  });

  const dibuat = await prisma.notifikasi.create({
    data: {
      warungId,
      jenis: "STRUK",
      channel: "WA",
      tujuan: tujuan.trim() || null,
      subject,
      body,
      status: "PENDING",
      refId: transactionId,
      meta: JSON.stringify({ total: trx.total, payment: trx.payment, items: trx.items.length }),
    },
    select: { id: true },
  });

  return { id: dibuat.id };
}
