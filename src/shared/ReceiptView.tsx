import type { ReactNode } from "react";
import { rupiah } from "@/shared/rupiah";
import { PAYMENT_LABEL, shortId } from "@/shared/category-icon";

// Komponen presentasional murni — dipakai bersama oleh:
// struk/[id] (server), struk/offline/[id] (client), dan modal kasir (client).
// TIDAK ada "use client", hook, fetch, atau import server → aman dua sisi.

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
  // Kelas kontainer struk; default = kontrak visual struk 80mm.
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
  className = "print-area mx-auto max-w-sm rounded-xl border bg-white p-6 font-mono text-sm shadow-xs",
}: ReceiptViewProps) {
  return (
    <div>
      <div className={className}>
        <h1 className="text-center text-lg font-bold">🧾 {nama}</h1>
        <p className="text-center text-xs text-zinc-500">
          {alamat && (
            <>
              {alamat}
              <br />
            </>
          )}
          {createdAtLabel} • #{shortId(id)}
        </p>
        {badge && <div className="mt-2 flex justify-center">{badge}</div>}
        <div className="my-3 border-t-2 border-dashed" />
        {lines.map((l) => (
          <div key={l.key} className="mb-1.5">
            <div className="font-bold">{l.name}</div>
            <div className="flex justify-between text-zinc-700">
              <span>
                {l.qty} × {rupiah(l.price)}
              </span>
              <span>{rupiah(l.price * l.qty)}</span>
            </div>
          </div>
        ))}
        <div className="my-3 border-t-2 border-dashed" />
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{rupiah(subtotal)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between">
            <span>Diskon</span>
            <span>−{rupiah(discount)}</span>
          </div>
        )}
        {tax > 0 && (
          <div className="flex justify-between">
            <span>Pajak</span>
            <span>+{rupiah(tax)}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-bold">
          <span>TOTAL</span>
          <span>{rupiah(total)}</span>
        </div>
        <div className="mt-1 flex justify-between">
          <span>{PAYMENT_LABEL[payment] ?? payment}</span>
          <span>{rupiah(cash)}</span>
        </div>
        {payment === "CASH" && (
          <div className="flex justify-between">
            <span>Kembali</span>
            <span>{rupiah(change)}</span>
          </div>
        )}
        <div className="my-3 border-t-2 border-dashed" />
        <p className="text-center text-xs text-zinc-500">
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
