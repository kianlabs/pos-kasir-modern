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
    <section className="rounded-xl border bg-white p-4 shadow-xs">
      <h3 className="mb-2 font-bold">Tambah Item</h3>

      {/* Pencarian + filter kategori — kasir jam sibuk tak perlu scroll dropdown panjang. */}
      <input
        value={cari}
        onChange={(e) => setCari(e.target.value)}
        placeholder="🔍 Cari menu…"
        className="mb-2 w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
      />
      <div className="-mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => setKategori("")}
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
            kategori === "" ? "bg-primary text-white" : "bg-zinc-100 text-zinc-600"
          }`}
        >
          Semua
        </button>
        {categories.map((c) => (
          <button
            type="button"
            key={c}
            onClick={() => setKategori(c)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
              kategori === c ? "bg-primary text-white" : "bg-zinc-100 text-zinc-600"
            }`}
          >
            {categoryIcon(c)} {c}
          </button>
        ))}
      </div>

      {/* Grid tombol produk — satu ketuk pilih, langsung tambah oleh tombol besar. */}
      <div className="max-h-64 overflow-y-auto rounded-lg border bg-zinc-50 p-2">
        {produkTampil.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-400">Menu tidak ditemukan.</p>
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
                  className={`flex flex-col rounded-lg border p-2.5 text-left text-xs transition ${
                    dipilih
                      ? "border-primary bg-accent-bg ring-1 ring-primary"
                      : "border-zinc-200 bg-white hover:border-primary/40"
                  }`}
                >
                  <span className="relative text-xl">
                    {productIcon(p)}
                    {qtyAda > 0 && (
                      <span className="absolute -right-1 -top-1 rounded-full bg-primary px-1.5 text-[10px] font-bold leading-4 text-white">
                        ×{qtyAda}
                      </span>
                    )}
                  </span>
                  <span className="mt-1 line-clamp-2 min-h-8 font-semibold leading-tight">
                    {p.name}
                  </span>
                  <span className="mt-1 flex items-center justify-between">
                    <span className="font-bold text-primary">{rupiah(p.price)}</span>
                    <span className={habis ? "font-semibold text-amber-600" : "text-zinc-400"}>
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
        <div className="min-w-0 flex-1 text-sm">
          {produkTerpilih ? (
            <span className="truncate font-semibold">
              {productIcon(produkTerpilih)} {produkTerpilih.name}
            </span>
          ) : (
            <span className="text-zinc-400">Pilih menu di atas</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setQty(String(Math.max(1, (Number(qty) || 1) - 1)))}
            className="h-9 w-9 rounded-lg border bg-white text-lg font-bold text-zinc-600 hover:bg-zinc-50"
            aria-label="Kurangi qty"
          >
            −
          </button>
          <input
            value={qty}
            onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            className="h-9 w-14 rounded-lg border bg-white text-center text-sm font-bold outline-none focus:border-primary"
            placeholder="1"
          />
          <button
            type="button"
            onClick={() => setQty(String((Number(qty) || 0) + 1))}
            className="h-9 w-9 rounded-lg border bg-white text-lg font-bold text-zinc-600 hover:bg-zinc-50"
            aria-label="Tambah qty"
          >
            +
          </button>
        </div>
        <button
          type="button"
          onClick={tambahItem}
          disabled={loading || !productId}
          className="h-9 rounded-lg bg-primary px-5 text-sm font-bold text-white hover:bg-primary-hover disabled:opacity-40"
        >
          Tambah {Number(qty) || 1}
        </button>
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        Stok baru berkurang saat bill dibayar, bukan saat item ditambahkan.
      </p>
    </section>
  );
}
