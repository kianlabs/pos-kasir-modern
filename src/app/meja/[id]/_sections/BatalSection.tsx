"use client";

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
    <div className="flex justify-end border-t pt-3">
      <button
        type="button"
        onClick={batal}
        disabled={loading}
        className="rounded-lg border border-danger/40 bg-white px-4 py-2 text-sm font-bold text-danger hover:bg-red-50 disabled:opacity-40"
      >
        🗑️ Batalkan Bill
      </button>
    </div>
  );
}
