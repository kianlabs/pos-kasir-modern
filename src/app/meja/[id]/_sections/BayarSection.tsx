"use client";

import { rupiah } from "@/shared/rupiah";
import { PaymentMethods, QuickCash, Kembalian } from "@/app/_components/PaymentControls";

// Section "Bayar" bill meja: ringkasan uang, toggle metode, nominal tunai,
// kembalian, tombol bayar, dan peringatan stok kurang. Diekstrak dari BillPanel
// (murni struktural — state & handler tetap di BillPanel, dioper lewat props).

type Payment = "CASH" | "QRIS";

type Props = {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  discEffective: number;
  discLebih: boolean;
  payment: Payment;
  setPayment: (p: Payment) => void;
  cash: string;
  setCash: (v: string) => void;
  cashNum: number;
  kembalian: number;
  canPay: boolean;
  loading: boolean;
  bayar: () => void;
  kurangStok: { name: string; butuh: number; ada: number }[];
};

export default function BayarSection({
  subtotal,
  discount,
  tax,
  total,
  discEffective,
  discLebih,
  payment,
  setPayment,
  cash,
  setCash,
  cashNum,
  kembalian,
  canPay,
  loading,
  bayar,
  kurangStok,
}: Props) {
  return (
    <section className="rounded-xl border bg-white p-4 shadow-xs">
      <h3 className="mb-2 font-bold">Bayar</h3>
      <div className="mb-3 flex justify-between text-sm text-zinc-600">
        <span>Subtotal</span>
        <span>{rupiah(subtotal)}</span>
      </div>
      {discEffective > 0 && (
        <div className="flex justify-between text-sm text-zinc-600">
          <span>Diskon</span>
          <span>−{rupiah(discEffective)}</span>
        </div>
      )}
      {discLebih && (
        <p className="mt-1 text-xs text-amber-700">
          Diskon melebihi subtotal — sisa {rupiah(discount - subtotal)} tidak terpakai.
        </p>
      )}
      {tax > 0 && (
        <div className="flex justify-between text-sm text-zinc-600">
          <span>Pajak</span>
          <span>+{rupiah(tax)}</span>
        </div>
      )}
      <div className="mt-1 flex justify-between text-lg font-extrabold">
        <span>Total</span>
        <span>{rupiah(total)}</span>
      </div>

      <PaymentMethods payment={payment} onChange={setPayment} />

      {payment === "CASH" && (
        <>
          <QuickCash total={total} onPick={setCash} />
          {/* Nilai mentah (digit) agar caret tidak melompat saat edit
              di tengah angka; format rupiah hanya di keterangan. */}
          <input
            value={cash}
            onChange={(e) => setCash(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            placeholder="Nominal diterima…"
            aria-label="Nominal tunai diterima"
            className="mt-2 w-full rounded-lg border bg-white px-3 py-2 text-right text-lg font-bold outline-none focus:border-primary"
          />
          {cashNum > 0 && (
            <p className="mt-1 text-right text-xs text-zinc-400">{rupiah(cashNum)}</p>
          )}
          <Kembalian cash={cash} kembalian={kembalian} />
        </>
      )}

      <button
        type="button"
        onClick={bayar}
        disabled={!canPay}
        className="mt-3 w-full rounded-lg bg-primary py-3 font-bold text-white shadow-sm hover:bg-primary-hover disabled:opacity-40"
      >
        {loading ? "Memproses…" : `Bayar ${rupiah(total)}`}
      </button>

      {kurangStok.length > 0 && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          ⚠️ Stok kurang untuk:{" "}
          {kurangStok.map((k) => `${k.name} (butuh ${k.butuh}, ada ${k.ada})`).join(", ")}. Kurangi
          qty atau kulakan dulu sebelum bayar.
        </p>
      )}
    </section>
  );
}
