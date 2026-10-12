"use client";

import { Trash2 } from "lucide-react";

// Aksi destruktif "Batalkan Bill". Diekstrak dari BillPanel (murni struktural —
// handler tetap di BillPanel, dioper lewat props).

type Props = {
  loading: boolean;
  batal: () => void;
};

export default function BatalSection({ loading, batal }: Props) {
  return (
    // Batal — aksi destruktif, sengaja dibuat kompak & terpisah agar tidak
    // sengaja tertekan saat scroll cepat.
    <div className="flex justify-end border-t border-ink-200 pt-3">
      <button
        type="button"
        onClick={batal}
        disabled={loading}
        className="inline-flex h-12 items-center gap-2 rounded-xl border border-danger bg-surface px-4 text-label-lg text-danger transition-colors hover:bg-danger hover:text-surface active:scale-[0.98] disabled:opacity-40"
      >
        <Trash2 className="h-4 w-4" /> Batalkan Bill
      </button>
    </div>
  );
}
