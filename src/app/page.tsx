"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { rupiah } from "@/lib/rupiah";
import { categoryIcon } from "@/lib/meta";

type Product = { id: string; name: string; price: number; stock: number; category: string };
type Cart = Record<string, number>;

const QUICK_CASH = [10000, 20000, 50000, 100000];

function stockStyle(stock: number): string {
  if (stock === 0) return "bg-red-100 text-red-700";
  if (stock <= 5) return "bg-amber-100 text-amber-700";
  return "bg-emerald-100 text-emerald-700";
}

export default function KasirPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Cart>({});
  const [cash, setCash] = useState("");
  const [payment, setPayment] = useState<"CASH" | "QRIS">("CASH");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Semua");

  async function load() {
    const res = await fetch("/api/products");
    setProducts(await res.json());
  }
  useEffect(() => {
    load();
  }, []);

  const categories = useMemo(
    () => ["Semua", ...Array.from(new Set(products.map((p) => p.category)))],
    [products]
  );

  const filtered = products.filter(
    (p) =>
      (category === "Semua" || p.category === category) &&
      p.name.toLowerCase().includes(search.toLowerCase())
  );

  const lines = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, qty]) => ({ product: products.find((p) => p.id === id)!, qty }))
        .filter((l) => l.product && l.qty > 0),
    [cart, products]
  );
  const total = lines.reduce((n, l) => n + l.product.price * l.qty, 0);
  const itemCount = lines.reduce((n, l) => n + l.qty, 0);
  const cashNum = Number(cash) || 0;
  const kembalian = cashNum - total;
  const canPay =
    lines.length > 0 && !loading && (payment === "QRIS" || cashNum >= total);

  function add(id: string) {
    const p = products.find((x) => x.id === id);
    if (!p || p.stock === 0) return;
    setCart((c) => ({ ...c, [id]: Math.min((c[id] ?? 0) + 1, p.stock) }));
    setError("");
  }
  function dec(id: string) {
    setCart((c) => {
      const qty = (c[id] ?? 0) - 1;
      const next = { ...c };
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });
  }

  async function bayar() {
    setError("");
    if (lines.length === 0) return setError("Keranjang masih kosong.");
    if (payment === "CASH" && cashNum < total)
      return setError(`Uang kurang ${rupiah(total - cashNum)}.`);
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map((l) => ({ productId: l.product.id, qty: l.qty })),
          cash: payment === "QRIS" ? total : cashNum,
          payment,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal checkout.");
        load(); // stok mungkin berubah
        return;
      }
      router.push(`/struk/${data.id}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[1fr_360px]">
      {/* Kiri: katalog */}
      <section>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <h1 className="text-xl font-bold">Kasir</h1>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Cari produk…"
            className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-orange-500 sm:ml-auto sm:max-w-xs"
          />
        </div>

        <div className="nice-scroll mb-4 flex gap-2 overflow-x-auto pb-1">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                category === c
                  ? "bg-zinc-900 text-white"
                  : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:ring-zinc-400"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="rounded-lg bg-white p-8 text-center text-sm text-zinc-500">
            Produk tidak ditemukan.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-4">
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => add(p.id)}
                disabled={p.stock === 0}
                className="group rounded-xl border bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
              >
                <div className="flex items-start justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-zinc-100 text-2xl">
                    {categoryIcon(p.category)}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${stockStyle(p.stock)}`}>
                    {p.stock === 0 ? "Habis" : `Stok ${p.stock}`}
                  </span>
                </div>
                <div className="mt-2 truncate text-sm font-semibold">{p.name}</div>
                <div className="text-[11px] text-zinc-500">{p.category}</div>
                <div className="mt-1 font-bold text-orange-700">{rupiah(p.price)}</div>
                {cart[p.id] ? (
                  <div className="mt-1 text-[11px] font-bold text-zinc-900">
                    di keranjang: {cart[p.id]} ✓
                  </div>
                ) : null}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Kanan: keranjang */}
      <aside className="rounded-xl border bg-white shadow-sm xl:sticky xl:top-6">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-bold">
            Pesanan <span className="text-sm font-normal text-zinc-500">({itemCount} item)</span>
          </h2>
          {lines.length > 0 && (
            <button
              onClick={() => setCart({})}
              className="text-xs font-semibold text-red-600 hover:underline"
            >
              Hapus semua
            </button>
          )}
        </div>

        <div className="nice-scroll max-h-64 overflow-y-auto px-4 py-2">
          {lines.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-400">
              🛒
              <br />
              Klik produk untuk menambah
              <br />
              ke pesanan
            </p>
          ) : (
            lines.map((l) => (
              <div key={l.product.id} className="flex items-center gap-2 border-b py-2.5 text-sm last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{l.product.name}</div>
                  <div className="text-xs text-zinc-500">{rupiah(l.product.price)} /pcs</div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => dec(l.product.id)}
                    className="h-7 w-7 rounded-md bg-zinc-100 font-bold hover:bg-zinc-200">−</button>
                  <span className="w-6 text-center font-bold">{l.qty}</span>
                  <button onClick={() => add(l.product.id)}
                    className="h-7 w-7 rounded-md bg-zinc-100 font-bold hover:bg-zinc-200">+</button>
                </div>
                <div className="w-20 text-right font-bold">
                  {rupiah(l.product.price * l.qty)}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t bg-zinc-50 px-4 py-3">
          <div className="flex justify-between text-2xl font-extrabold">
            <span>Total</span>
            <span>{rupiah(total)}</span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-bold">
            <button onClick={() => setPayment("CASH")}
              className={`rounded-lg border py-2 ${payment === "CASH" ? "border-orange-600 bg-orange-600 text-white" : "bg-white"}`}>
              💵 Tunai
            </button>
            <button onClick={() => setPayment("QRIS")}
              className={`rounded-lg border py-2 ${payment === "QRIS" ? "border-orange-600 bg-orange-600 text-white" : "bg-white"}`}>
              📱 QRIS
            </button>
          </div>

          {payment === "CASH" ? (
            <>
              <div className="mt-3 grid grid-cols-4 gap-1.5">
                <button onClick={() => setCash(String(total))}
                  className="rounded-md bg-orange-100 py-1.5 text-xs font-bold text-orange-800 hover:bg-orange-200">
                  Uang pas
                </button>
                {QUICK_CASH.map((v) => (
                  <button key={v} onClick={() => setCash(String(v))}
                    className="rounded-md bg-zinc-100 py-1.5 text-xs font-bold hover:bg-zinc-200">
                    {v / 1000}rb
                  </button>
                ))}
              </div>
              <input
                value={cash ? Number(cash).toLocaleString("id-ID") : ""}
                onChange={(e) => setCash(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                placeholder="Nominal diterima…"
                className="mt-2 w-full rounded-lg border bg-white px-3 py-2 text-right text-lg font-bold outline-none focus:border-orange-500"
              />
              <div className="mt-1.5 flex justify-between text-sm font-semibold">
                <span className="text-zinc-500">Kembalian</span>
                <span className={kembalian < 0 ? "text-red-600" : "text-orange-700"}>
                  {cash ? rupiah(Math.max(0, kembalian)) : "—"}
                </span>
              </div>
            </>
          ) : (
            <p className="mt-3 rounded-lg bg-zinc-900 p-3 text-center text-xs text-zinc-300">
              Tunjukkan QR toko ke pembeli,
              <br />
              tekan Bayar setelah lunas.
            </p>
          )}

          {error && (
            <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              ⚠️ {error}
            </p>
          )}
          <button
            onClick={bayar}
            disabled={!canPay}
            className="mt-3 w-full rounded-lg bg-orange-600 py-3 font-bold text-white shadow hover:bg-orange-700 disabled:opacity-40"
          >
            {loading ? "Memproses…" : `Bayar ${rupiah(total)}`}
          </button>
        </div>
      </aside>
    </div>
  );
}
