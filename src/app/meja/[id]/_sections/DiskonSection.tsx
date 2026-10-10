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
    <section className="rounded-2xl border border-ink-200 bg-surface p-4">
      <h3 className="mb-2 text-headline-sm text-ink-950">Diskon</h3>
      <div className="flex gap-2">
        <input
          value={discountInput}
          onChange={(e) => setDiscountInput(e.target.value.replace(/\D/g, ""))}
          inputMode="numeric"
          placeholder="Diskon Rp (opsional)"
          className="h-12 min-w-0 flex-1 rounded-xl border border-ink-200 bg-surface px-3 text-body-md text-ink-950 tabular-nums outline-none transition-colors placeholder:text-ink-500 focus:border-ink-950"
        />
        <button
          type="button"
          onClick={terapkanDiskon}
          disabled={loading}
          className="h-12 rounded-xl border border-ink-200 bg-surface px-4 text-label-lg text-ink-950 transition-all hover:bg-ink-100 active:scale-[0.98] disabled:opacity-40"
        >
          Terapkan
        </button>
      </div>
      {discNum > 0 && (
        <p className="mt-1.5 text-caption text-ink-500">
          Diskon aktif: <span className="tabular-nums">{rupiah(discEffective)}</span>
          {discLebih && <> (diniatkan {rupiah(discount)})</>}
        </p>
      )}
    </section>
  );
}
