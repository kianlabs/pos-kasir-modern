"use client";

import { rupiah } from "@/shared/rupiah";

// Section "Diskon" bill meja. Diekstrak dari BillPanel (murni struktural —
// nilai & handler tetap di BillPanel, dioper lewat props).

type Props = {
  discountInput: string;
  setDiscountInput: (v: string) => void;
  loading: boolean;
  terapkanDiskon: () => void;
  discNum: number;
  discEffective: number;
  discLebih: boolean;
  discount: number;
};

export default function DiskonSection({
  discountInput,
  setDiscountInput,
  loading,
  terapkanDiskon,
  discNum,
  discEffective,
  discLebih,
  discount,
}: Props) {
  return (
    <section className="rounded-xl border bg-white p-4 shadow-xs">
      <h3 className="mb-2 font-bold">Diskon</h3>
      <div className="flex gap-2">
        <input
          value={discountInput}
          onChange={(e) => setDiscountInput(e.target.value.replace(/\D/g, ""))}
          inputMode="numeric"
          placeholder="Diskon Rp (opsional)"
          className="min-w-0 flex-1 rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={terapkanDiskon}
          disabled={loading}
          className="rounded-lg border border-primary/30 bg-accent-bg px-4 py-2 text-sm font-bold text-primary hover:bg-primary/10 disabled:opacity-40"
        >
          Terapkan
        </button>
      </div>
      {discNum > 0 && (
        <p className="mt-1.5 text-xs text-zinc-500">
          Diskon aktif: {rupiah(discEffective)}
          {discLebih && <> (diniatkan {rupiah(discount)})</>}
        </p>
      )}
    </section>
  );
}
