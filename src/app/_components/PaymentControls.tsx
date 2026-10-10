"use client";

import { rupiah } from "@/shared/rupiah";

// Blok kontrol pembayaran yang IDENTIK dipakai di dua tempat:
//  - /          (kasir, aside keranjang)
//  - /meja/[id] (BillPanel, section Bayar)
// Diekstrak murni struktural — className/teks tak berubah, agar layout kedua
// konteks (lebar aside vs panel) tetap sama persis.

type Payment = "CASH" | "QRIS";

const QUICK_CASH = [10000, 20000, 50000, 100000];

// Toggle metode bayar: Tunai / QRIS.
export function PaymentMethods({
  payment,
  onChange,
}: {
  payment: Payment;
  onChange: (p: Payment) => void;
}) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-bold">
      <button
        type="button"
        onClick={() => onChange("CASH")}
        className={`rounded-lg border py-2 ${payment === "CASH" ? "border-primary bg-primary text-white" : "bg-white"}`}
      >
        💵 Tunai
      </button>
      <button
        type="button"
        onClick={() => onChange("QRIS")}
        className={`rounded-lg border py-2 ${payment === "QRIS" ? "border-primary bg-primary text-white" : "bg-white"}`}
      >
        📱 QRIS
      </button>
    </div>
  );
}

// Tombol cepat nominal tunai: "Uang pas" + pecahan 10/20/50/100rb.
export function QuickCash({
  total,
  onPick,
}: {
  total: number;
  onPick: (v: string) => void;
}) {
  return (
    <div className="mt-3 grid grid-cols-4 gap-1.5">
      <button
        type="button"
        onClick={() => onPick(String(total))}
        className="rounded-md bg-accent-bg py-1.5 text-xs font-bold text-primary hover:bg-primary/10"
      >
        Uang pas
      </button>
      {QUICK_CASH.map((v) => (
        <button
          type="button"
          key={v}
          onClick={() => onPick(String(v))}
          className="rounded-md bg-zinc-100 py-1.5 text-xs font-bold hover:bg-zinc-200"
        >
          {v / 1000}rb
        </button>
      ))}
    </div>
  );
}

// Baris keterangan kembalian. Tampilkan "—" bila nominal tunai belum diisi.
export function Kembalian({
  cash,
  kembalian,
}: {
  cash: string;
  kembalian: number;
}) {
  return (
    <div className="mt-1.5 flex justify-between text-sm font-semibold">
      <span className="text-zinc-500">Kembalian</span>
      <span className={kembalian < 0 ? "text-danger" : "text-secondary"}>
        {cash ? rupiah(Math.max(0, kembalian)) : "—"}
      </span>
    </div>
  );
}
