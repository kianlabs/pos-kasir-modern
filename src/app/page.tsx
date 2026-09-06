"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { rupiah } from "@/lib/rupiah";

type Product = { id: string; name: string; price: number; stock: number; category: string };
type Cart = Record<string, number>; // productId -> qty

export default function KasirPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Cart>({});
  const [cash, setCash] = useState("");
  const [payment, setPayment] = useState<"CASH" | "QRIS">("CASH");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  async function load() {
    const res = await fetch("/api/products");
    setProducts(await res.json());
  }
  useEffect(() => {
    load();
  }, []);

  const filtered = products.filter((p) =>
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
  const cashNum = Number(cash) || 0;
  const kembalian = payment === "QRIS" ? 0 : cashNum - total;

  function add(id: string) {
    setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
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
      if (!res.ok) return setError(data.error ?? "Gagal checkout.");
      setCart({});
      setCash("");
      load(); // refresh stok
      router.push(`/struk/${data.id}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_340px]">
      <section>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari produk…"
          className="mb-4 w-full rounded border bg-white px-3 py-2"
        />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => p.stock > 0 && add(p.id)}
              disabled={p.stock === 0}
              className="rounded border bg-white p-3 text-left hover:border-black disabled:opacity-40"
            >
              <div className="text-xs text-zinc-500">{p.category}</div>
              <div className="font-semibold">{p.name}</div>
              <div className="mt-1 font-bold">{rupiah(p.price)}</div>
              <div className="text-xs text-zinc-500">Stok: {p.stock}</div>
            </button>
          ))}
        </div>
      </section>

      <aside className="h-fit rounded border bg-white p-4">
        <h2 className="mb-3 font-bold">Keranjang</h2>
        {lines.length === 0 && <p className="text-sm text-zinc-500">Belum ada item.</p>}
        {lines.map((l) => (
          <div key={l.product.id} className="mb-2 flex items-center justify-between text-sm">
            <span>
              {l.product.name} × {l.qty}
            </span>
            <span className="flex items-center gap-2">
              <button onClick={() => dec(l.product.id)} className="rounded border px-2">−</button>
              <button onClick={() => add(l.product.id)} className="rounded border px-2">+</button>
              <b>{rupiah(l.product.price * l.qty)}</b>
            </span>
          </div>
        ))}

        <div className="mt-4 border-t pt-3 text-lg font-bold">Total: {rupiah(total)}</div>

        <div className="mt-3 flex gap-2 text-sm">
          {(["CASH", "QRIS"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setPayment(m)}
              className={`flex-1 rounded border py-1.5 font-semibold ${
                payment === m ? "bg-black text-white" : "bg-white"
              }`}
            >
              {m === "CASH" ? "Tunai" : "QRIS"}
            </button>
          ))}
        </div>

        {payment === "CASH" && (
          <input
            value={cash}
            onChange={(e) => setCash(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            placeholder="Uang diterima, mis. 50000"
            className="mt-3 w-full rounded border px-3 py-2"
          />
        )}
        {payment === "CASH" && cash && (
          <p className={`mt-1 text-sm ${kembalian < 0 ? "text-red-600" : "text-green-700"}`}>
            Kembalian: {rupiah(Math.max(0, kembalian))}
          </p>
        )}

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <button
          onClick={bayar}
          disabled={loading || lines.length === 0}
          className="mt-3 w-full rounded bg-black py-2.5 font-bold text-white disabled:opacity-40"
        >
          {loading ? "Memproses…" : "Bayar"}
        </button>
      </aside>
    </div>
  );
}
