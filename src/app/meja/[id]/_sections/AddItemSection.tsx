"use client";

import { rupiah } from "@/shared/rupiah";
import { categoryIcon, productIcon } from "@/shared/category-icon";

// Section "Tambah Item" bill meja: pencarian + filter kategori + grid produk +
// stepper qty & tombol tambah. Diekstrak dari BillPanel (murni struktural —
// state & handler tetap di BillPanel, dioper lewat props).

type Product = { id: string; name: string; price: number; stock: number; category: string; icon: string };

type Props = {
  categories: string[];
  kategori: string;
  setKategori: (v: string) => void;
  cari: string;
  setCari: (v: string) => void;
  produkTampil: Product[];
  productId: string;
  setProductId: (id: string) => void;
  produkTerpilih: Product | null;
  sisaStok: (p: Product) => number;
  qtyDiBill: Map<string, number>;
  qty: string;
  setQty: (v: string) => void;
  loading: boolean;
  tambahItem: () => void;
};

export default function AddItemSection({
  categories,
  kategori,
  setKategori,
  cari,
  setCari,
  produkTampil,
  productId,
  setProductId,
  produkTerpilih,
  sisaStok,
  qtyDiBill,
  qty,
  setQty,
  loading,
  tambahItem,
}: Props) {
  return (
    <section className="rounded-2xl border border-ink-200 bg-surface p-4">
      <h3 className="mb-2 text-headline-sm text-ink-950">Tambah Item</h3>

      {/* Pencarian + filter kategori — kasir jam sibuk tak perlu scroll dropdown panjang. */}
      <input
        value={cari}
        onChange={(e) => setCari(e.target.value)}
        placeholder="🔍 Cari menu…"
        className="mb-2 h-12 w-full rounded-xl border border-ink-200 bg-surface px-3 text-body-md text-ink-950 outline-none transition-colors placeholder:text-ink-500 focus:border-ink-950"
      />
      <div className="-mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => setKategori("")}
          className={`h-12 shrink-0 rounded-xl border px-3 text-label-md transition-all active:scale-[0.98] ${
            kategori === ""
              ? "border-ink-950 bg-ink-950 text-surface"
              : "border-ink-200 bg-surface text-ink-500 hover:border-ink-300 hover:text-ink-950"
          }`}
        >
          Semua
        </button>
        {categories.map((c) => (
          <button
            type="button"
            key={c}
            onClick={() => setKategori(c)}
            className={`h-12 shrink-0 rounded-xl border px-3 text-label-md transition-all active:scale-[0.98] ${
              kategori === c
                ? "border-ink-950 bg-ink-950 text-surface"
                : "border-ink-200 bg-surface text-ink-500 hover:border-ink-300 hover:text-ink-950"
            }`}
          >
            {categoryIcon(c)} {c}
          </button>
        ))}
      </div>

      {/* Grid tombol produk — satu ketuk pilih, langsung tambah oleh tombol besar. */}
      <div className="max-h-64 overflow-y-auto rounded-xl border border-ink-200 bg-canvas p-2">
        {produkTampil.length === 0 ? (
          <p className="py-6 text-center text-body-sm text-ink-500">Menu tidak ditemukan.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {produkTampil.map((p) => {
              const sisa = Math.max(0, sisaStok(p));
              const dipilih = productId === p.id;
              const habis = sisa <= 0;
              // qty yang SUDAH ada di bill ini (delta): beri badge agar kasir
              // tahu penambahan akan menggabung (+N), bukan baris baru (fix A11).
              const qtyAda = qtyDiBill.get(p.id) ?? 0;
              return (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setProductId(p.id)}
                  className={`flex flex-col rounded-xl border p-2.5 text-left text-caption transition ${
                    dipilih
                      ? "border-ink-950 bg-ink-100 ring-1 ring-ink-950"
                      : "border-ink-200 bg-surface hover:border-ink-300"
                  }`}
                >
                  <span className="relative text-xl">
                    {productIcon(p)}
                    {qtyAda > 0 && (
                      <span className="absolute -right-1 -top-1 rounded-full bg-ink-950 px-1.5 text-[10px] font-bold leading-4 text-surface">
                        ×{qtyAda}
                      </span>
                    )}
                  </span>
                  <span className="mt-1 line-clamp-2 min-h-8 font-semibold leading-tight text-ink-950">
                    {p.name}
                  </span>
                  <span className="mt-1 flex items-center justify-between">
                    <span className="text-numeral-md text-ink-950 tabular-nums">{rupiah(p.price)}</span>
                    <span className={habis ? "font-semibold text-danger" : "text-ink-500"}>
                      sisa {sisa}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Qty + tombol tambah — aktif hanya bila produk sudah dipilih. */}
      <div className="mt-3 flex items-center gap-2">
        <div className="min-w-0 flex-1 text-body-sm">
          {produkTerpilih ? (
            <span className="block truncate font-semibold text-ink-950">
              {productIcon(produkTerpilih)} {produkTerpilih.name}
            </span>
          ) : (
            <span className="text-ink-500">Pilih menu di atas</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setQty(String(Math.max(1, (Number(qty) || 1) - 1)))}
            className="h-12 w-12 rounded-xl border border-ink-200 bg-surface text-lg font-bold text-ink-700 transition-colors hover:bg-ink-100"
            aria-label="Kurangi qty"
          >
            −
          </button>
          <input
            value={qty}
            onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            className="h-12 w-14 rounded-xl border border-ink-200 bg-surface text-center text-body-md font-bold text-ink-950 outline-none focus:border-ink-950"
            placeholder="1"
          />
          <button
            type="button"
            onClick={() => setQty(String((Number(qty) || 0) + 1))}
            className="h-12 w-12 rounded-xl border border-ink-200 bg-surface text-lg font-bold text-ink-700 transition-colors hover:bg-ink-100"
            aria-label="Tambah qty"
          >
            +
          </button>
        </div>
        <button
          type="button"
          onClick={tambahItem}
          disabled={loading || !productId}
          className="h-12 rounded-xl bg-ink-950 px-5 text-label-lg text-surface transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
        >
          Tambah {Number(qty) || 1}
        </button>
      </div>
      <p className="mt-2 text-caption text-ink-500">
        Stok baru berkurang saat bill dibayar, bukan saat item ditambahkan.
      </p>
    </section>
  );
}
