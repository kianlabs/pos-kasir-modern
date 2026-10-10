import type { ReactNode } from "react";
import { rupiah } from "@/shared/rupiah";
import { PAYMENT_LABEL, shortId } from "@/shared/category-icon";

// Komponen presentasional murni — dipakai bersama oleh:
// struk/[id] (server), struk/offline/[id] (client), dan modal kasir (client).
// TIDAK ada "use client", hook, fetch, atau import server → aman dua sisi.
//
// Visual Warm Monochrome: permukaan putih, pembatas putus-putus ink-200,
// semua nilai uang tabular-nums. Kontrak cetak (kelas "print-area" + 80mm)
// dipertahankan lewat className default; pemanggil boleh menimpanya.

export type ReceiptLine = { key: string; name: string; qty: number; price: number };

export type ReceiptViewProps = {
  nama: string; // header name (receiptName / "Struk" / "Struk (offline)")
  alamat?: string | null; // baris subtitle kedua opsional
  id: string; // untuk shortId
  createdAtLabel: string; // timestamp yang sudah diformat pemanggil
  lines: ReceiptLine[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  payment: string;
  cash: number;
  change: number;
  footerNote?: string; // baris footer kedua
  badge?: ReactNode; // elemen opsional di bawah subtitle (mis. "Belum tersinkron")
  actions?: ReactNode; // baris tombol aksi opsional
  // Kelas kontainer struk; default = kontrak visual struk 80mm (mono).
  className?: string;
};

export default function ReceiptView({
  nama,
  alamat,
  id,
  createdAtLabel,
  lines,
  subtotal,
  discount,
  tax,
  total,
  payment,
  cash,
  change,
  footerNote,
  badge,
  actions,
  className = "print-area mx-auto max-w-sm rounded-xl border border-ink-200 bg-surface p-6 font-receipt text-body-sm text-ink-950",
}: ReceiptViewProps) {
  return (
    <div>
      <div className={className}>
        <h1 className="text-center text-label-lg font-label-lg font-bold uppercase tracking-wide text-ink-950">
          {nama}
        </h1>
        <p className="mt-1 text-center text-caption font-caption text-ink-500">
          {alamat && (
            <>
              {alamat}
              <br />
            </>
          )}
          {createdAtLabel} • #{shortId(id)}
        </p>
        {badge && <div className="mt-2 flex justify-center">{badge}</div>}
        <div className="my-3 border-t border-dashed border-ink-200" />

        {lines.map((l) => (
          <div key={l.key} className="mb-2">
            <div className="font-semibold text-ink-950">{l.name}</div>
            <div className="flex justify-between text-ink-700">
              <span className="tabular-nums">
                {l.qty} × {rupiah(l.price)}
              </span>
              <span className="tabular-nums font-semibold text-ink-950">
                {rupiah(l.price * l.qty)}
              </span>
            </div>
          </div>
        ))}

        <div className="my-3 border-t border-dashed border-ink-200" />

        <div className="flex justify-between text-ink-700">
          <span>Subtotal</span>
          <span className="tabular-nums text-ink-950">{rupiah(subtotal)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-ink-700">
            <span>Diskon</span>
            <span className="tabular-nums text-ink-950">−{rupiah(discount)}</span>
          </div>
        )}
        {tax > 0 && (
          <div className="flex justify-between text-ink-700">
            <span>Pajak</span>
            <span className="tabular-nums text-ink-950">+{rupiah(tax)}</span>
          </div>
        )}
        <div className="mt-1 flex justify-between border-t border-ink-200 pt-1 text-body-md font-bold text-ink-950">
          <span>TOTAL</span>
          <span className="tabular-nums">{rupiah(total)}</span>
        </div>

        <div className="mt-1 flex justify-between text-ink-700">
          <span>{PAYMENT_LABEL[payment] ?? payment}</span>
          <span className="tabular-nums text-ink-950">{rupiah(cash)}</span>
        </div>
        {payment === "CASH" && (
          <div className="flex justify-between text-ink-700">
            <span>Kembali</span>
            <span className="tabular-nums text-ink-950">{rupiah(change)}</span>
          </div>
        )}

        <div className="my-3 border-t border-dashed border-ink-200" />

        <p className="text-center text-caption font-caption text-ink-500">
          Terima kasih & sampai jumpa 🙏
          {footerNote && (
            <>
              <br />
              {footerNote}
            </>
          )}
        </p>
      </div>

      {actions}
    </div>
  );
}
