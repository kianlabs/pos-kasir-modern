"use client";

import { useEffect, useState } from "react";
import { rupiah } from "@/lib/rupiah";

type Product = { id: string; name: string; price: number; stock: number; category: string };

export default function ProdukPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState({ name: "", price: "", stock: "", category: "Umum" });
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/products");
    setProducts(await res.json());
  }
  useEffect(() => {
    load();
  }, []);

  async function tambah(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        price: Number(form.price),
        stock: Number(form.stock || 0),
        category: form.category,
      }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setForm({ name: "", price: "", stock: "", category: "Umum" });
    load();
  }

  async function hapus(id: string) {
    if (!confirm("Hapus produk ini?")) return;
    await fetch(`/api/products/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="grid gap-6 md:grid-cols-[320px_1fr]">
      <form onSubmit={tambah} className="h-fit rounded border bg-white p-4">
        <h2 className="mb-3 font-bold">Tambah produk</h2>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Nama" className="mb-2 w-full rounded border px-3 py-2" />
        <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value.replace(/\D/g, "") })}
          placeholder="Harga (Rp)" inputMode="numeric" className="mb-2 w-full rounded border px-3 py-2" />
        <input value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value.replace(/\D/g, "") })}
          placeholder="Stok" inputMode="numeric" className="mb-2 w-full rounded border px-3 py-2" />
        <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
          placeholder="Kategori" className="mb-2 w-full rounded border px-3 py-2" />
        {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
        <button className="w-full rounded bg-black py-2 font-bold text-white">Simpan</button>
      </form>

      <div className="overflow-x-auto rounded border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-zinc-500">
              <th className="p-3">Nama</th>
              <th className="p-3">Harga</th>
              <th className="p-3">Stok</th>
              <th className="p-3">Kategori</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-b last:border-0">
                <td className="p-3 font-medium">{p.name}</td>
                <td className="p-3">{rupiah(p.price)}</td>
                <td className="p-3">{p.stock}</td>
                <td className="p-3">{p.category}</td>
                <td className="p-3 text-right">
                  <button onClick={() => hapus(p.id)} className="text-red-600 hover:underline">
                    Hapus
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
