"use client";

import { rupiah } from "@/shared/rupiah";

// Blok kontrol pembayaran yang IDENTIK dipakai di dua tempat:
//  - /          (kasir, aside keranjang)
//  - /meja/[id] (BillPanel, section Bayar)
// Diekstrak murni struktural — signature prop tak berubah, hanya visual
// yang diselaraskan dengan sistem Warm Monochrome (tokens ink-*/surface, 48px
// touch target, rounded-xl, tabular-nums pada semua nominal).

type Payment = "CASH" | "QRIS";

const QUICK_CASH = [10000, 20000, 50000, 100000];

// Segmented control metode bayar: Tunai / QRIS.
// Tab aktif = ink-950 solid (mockup "modal_pembayaran_tunai_qris"); tab pasif =
// surface + border ink-200 dengan hover ink-100.
export function PaymentMethods({
  payment,
  onChange,
}: {
  payment: Payment;
  onChange: (p: Payment) => void;
}) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2" role="tablist" aria-label="Metode pembayaran">
      <button
        type="button"
        role="tab"
        aria-selected={payment === "CASH"}
        onClick={() => onChange("CASH")}
        className={`h-12 rounded-xl flex items-center justify-center gap-2 text-label-lg font-label-lg active:scale-[0.98] transition-all ${
          payment === "CASH"
            ? "bg-ink-950 text-surface shadow-sm"
            : "border border-ink-200 bg-surface text-ink-950 hover:bg-ink-100"
        }`}
      >
        <span className="material-symbols-outlined text-[20px]" aria-hidden>
          payments
        </span>
        <span>Tunai</span>
        {payment === "CASH" && <span className="h-2 w-2 rounded-full bg-success" />}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={payment === "QRIS"}
        onClick={() => onChange("QRIS")}
        className={`h-12 rounded-xl flex items-center justify-center gap-2 text-label-lg font-label-lg active:scale-[0.98] transition-all ${
          payment === "QRIS"
            ? "bg-ink-950 text-surface shadow-sm"
            : "border border-ink-200 bg-surface text-ink-950 hover:bg-ink-100"
        }`}
      >
        <span className="material-symbols-outlined text-[20px]" aria-hidden>
          qr_code_2
        </span>
        <span>QRIS</span>
        {payment === "QRIS" ? (
          <span className="h-2 w-2 rounded-full bg-success" />
        ) : (
          <span className="rounded bg-ink-100 px-1.5 py-0.5 text-caption font-caption text-ink-500 border border-ink-200">
            Instan
          </span>
        )}
      </button>
    </div>
  );
}

// Tombol cepat nominal tunai ("Uang Pas" + pecahan 10/20/50/100rb).
// Chip 48px dua baris: label kecil + nominal tabular (mockup "REKOMENDASI UANG
// TUNAI CEPAT").
export function QuickCash({
  total,
  onPick,
}: {
  total: number;
  onPick: (v: string) => void;
}) {
  return (
    <div className="mt-3">
      <span className="text-caption font-caption font-medium text-ink-500">
        REKOMENDASI UANG TUNAI CEPAT
      </span>
      <div className="mt-1.5 grid grid-cols-5 gap-1.5">
        <button
          type="button"
          onClick={() => onPick(String(total))}
          className="h-12 rounded-xl bg-surface border border-ink-200 hover:border-ink-950 hover:bg-ink-100 active:scale-[0.98] transition-all flex flex-col items-center justify-center text-center"
        >
          <span className="text-caption font-caption text-ink-500 leading-none">Uang Pas</span>
          <span className="text-label-md font-label-md text-ink-950 tabular-nums leading-snug">
            {rupiah(total)}
          </span>
        </button>
        {QUICK_CASH.map((v) => (
          <button
            type="button"
            key={v}
            onClick={() => onPick(String(v))}
            className="h-12 rounded-xl bg-surface border border-ink-200 hover:border-ink-950 hover:bg-ink-100 active:scale-[0.98] transition-all flex flex-col items-center justify-center text-center"
          >
            <span className="text-caption font-caption text-ink-500 leading-none">Cepat</span>
            <span className="text-label-md font-label-md text-ink-950 tabular-nums leading-snug">
              {v / 1000}rb
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Kotak keterangan kembalian (mockup "KOTAK KALKULASI OTOMATIS KEMBALIAN").
// Tampilkan "—" bila nominal tunai belum diisi. Kembalian negatif (uang kurang)
// diberi warna danger agar kasir waspada.
export function Kembalian({
  cash,
  kembalian,
}: {
  cash: string;
  kembalian: number;
}) {
  const kurang = kembalian < 0;
  return (
    <div
      className={`mt-3 p-3 rounded-xl bg-surface border-2 flex items-center justify-between ${
        kurang ? "border-danger" : "border-ink-950"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${
            kurang ? "bg-danger text-surface" : "bg-ink-950 text-surface"
          }`}
        >
          <span className="material-symbols-outlined text-[22px]" aria-hidden>
            currency_exchange
          </span>
        </span>
        <div className="flex flex-col">
          <span className="text-label-lg font-label-lg uppercase tracking-wider text-ink-950 block leading-tight">
            {kurang ? "KURANG" : "KEMBALIAN"}
          </span>
          <span className="text-caption font-caption text-ink-500">
            {kurang ? "Uang belum mencukupi" : "Wajib diserahkan ke pelanggan"}
          </span>
        </div>
      </div>
      <span
        className={`text-numeral-lg font-numeral-lg tabular-nums tracking-tight ${
          kurang ? "text-danger" : "text-ink-950"
        }`}
      >
        {cash ? rupiah(Math.abs(kembalian)) : "—"}
      </span>
    </div>
  );
}
