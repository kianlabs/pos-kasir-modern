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
    <section className="rounded-2xl border border-ink-200 bg-surface p-4">
      <h3 className="mb-2 text-headline-sm text-ink-950">Bayar</h3>
      <div className="mb-3 flex justify-between text-body-sm text-ink-700">
        <span>Subtotal</span>
        <span className="tabular-nums">{rupiah(subtotal)}</span>
      </div>
      {discEffective > 0 && (
        <div className="flex justify-between text-body-sm text-ink-700">
          <span>Diskon</span>
          <span className="tabular-nums">−{rupiah(discEffective)}</span>
        </div>
      )}
      {discLebih && (
        <p className="mt-1 text-caption text-danger">
          Diskon melebihi subtotal — sisa {rupiah(discount - subtotal)} tidak terpakai.
        </p>
      )}
      {tax > 0 && (
        <div className="flex justify-between text-body-sm text-ink-700">
          <span>Pajak</span>
          <span className="tabular-nums">+{rupiah(tax)}</span>
        </div>
      )}
      <div className="mt-1 flex justify-between text-numeral-lg text-ink-950">
        <span>Total</span>
        <span className="tabular-nums">{rupiah(total)}</span>
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
            className="mt-2 h-12 w-full rounded-xl border border-ink-200 bg-surface px-3 text-right text-numeral-lg text-ink-950 tabular-nums outline-none transition-colors focus:border-ink-950"
          />
          {cashNum > 0 && (
            <p className="mt-1 text-right text-caption text-ink-500 tabular-nums">{rupiah(cashNum)}</p>
          )}
          <Kembalian cash={cash} kembalian={kembalian} />
        </>
      )}

      <button
        type="button"
        onClick={bayar}
        disabled={!canPay}
        className="mt-3 min-h-16 w-full rounded-xl bg-ink-950 py-3 text-label-lg text-surface transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
      >
        {loading ? "Memproses…" : `Bayar ${rupiah(total)}`}
      </button>

      {kurangStok.length > 0 && (
        <p className="mt-2 rounded-xl border border-danger/30 bg-danger-bg px-3 py-2 text-caption font-medium text-danger">
          ⚠️ Stok kurang untuk:{" "}
          {kurangStok.map((k) => `${k.name} (butuh ${k.butuh}, ada ${k.ada})`).join(", ")}. Kurangi
          qty atau kulakan dulu sebelum bayar.
        </p>
      )}
    </section>
  );
}
