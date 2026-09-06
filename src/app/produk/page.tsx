"use client";

import { useEffect, useState } from "react";
import { rupiah } from "@/lib/rupiah";
import { categoryIcon } from "@/lib/meta";

type Product = { id: string; name: string; price: number; stock: number; category: string };

const EMPTY = { name: "", price: "", stock: "", category: "Umum" };

export default function ProdukPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  async function load() {
    try {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error();
      setProducts(await res.json());
    } catch {
      setError("Gagal memuat produk.");
    }
  }
  useEffect(() => {
    load();
  }, []);

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );
  const totalNilai = products.reduce((n, p) => n + p.price * p.stock, 0);

  function startEdit(p: Product) {
    setEditingId(p.id);
    setForm({ name: p.name, price: String(p.price), stock: String(p.stock), category: p.category });
    setError("");
  }
  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY);
    setError("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const payload = {
      name: form.name,
      price: Number(form.price),
      stock: Number(form.stock || 0),
      category: form.category || "Umum",
    };
    const res = await fetch(
      editingId ? `/api/products/${editingId}` : "/api/products",
      {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    ).catch(() => null);
    if (!res) return setError("Tidak bisa hubungi server.");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(data.error ?? "Gagal menyimpan.");
    cancelEdit();
    load();
  }

  async function adjustStock(p: Product, delta: number) {
    const next = p.stock + delta;
    if (next < 0) return;
    const res = await fetch(`/api/products/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stock: next }),
    }).catch(() => null);
    if (!res || !res.ok) return setError("Gagal update stok.");
    load();
  }

  async function hapus(id: string, name: string) {
    if (!confirm(`Hapus "${name}"?`)) return;
    const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Gagal menghapus.");
      return;
    }
    load();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">Produk</h1>
        <div className="ml-auto flex gap-2 text-sm">
          <span className="rounded-lg bg-white px-3 py-1.5 font-semibold ring-1 ring-zinc-200">
            {products.length} produk
          </span>
          <span className="rounded-lg bg-white px-3 py-1.5 font-semibold ring-1 ring-zinc-200">
            Nilai stok {rupiah(totalNilai)}
          </span>
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[320px_1fr]">
        <form onSubmit={submit} className="rounded-xl border bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-bold">{editingId ? "✏️ Edit produk" : "➕ Tambah produk"}</h2>
          <label className="mb-1 block text-xs font-semibold text-zinc-500">Nama</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="mis. Ayam Goreng" className="mb-2 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-orange-500" />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-500">Harga (Rp)</label>
              <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value.replace(/\D/g, "") })}
                placeholder="10000" inputMode="numeric" className="mb-2 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-500">Stok</label>
              <input value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value.replace(/\D/g, "") })}
                placeholder="20" inputMode="numeric" className="mb-2 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-orange-500" />
            </div>
          </div>
          <label className="mb-1 block text-xs font-semibold text-zinc-500">Kategori</label>
          <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
            placeholder="Nasi / Mie / Lauk / Sayur / Gorengan / Minuman" className="mb-2 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-orange-500" />
          {error && <p className="mb-2 text-sm text-red-600">⚠️ {error}</p>}
          <div className="flex gap-2">
            <button className="flex-1 rounded-lg bg-orange-600 py-2 text-sm font-bold text-white hover:bg-orange-700">
              {editingId ? "Simpan" : "Tambah"}
            </button>
            {editingId && (
              <button type="button" onClick={cancelEdit}
                className="rounded-lg border px-4 py-2 text-sm font-bold hover:bg-zinc-50">
                Batal
              </button>
            )}
          </div>
        </form>

        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="border-b p-3">
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 Cari produk…"
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-orange-500 sm:max-w-xs" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                  <th className="p-3">Produk</th>
                  <th className="p-3">Kategori</th>
                  <th className="p-3 text-right">Harga</th>
                  <th className="p-3 text-center">Stok</th>
                  <th className="p-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className={`border-b last:border-0 hover:bg-zinc-50 ${editingId === p.id ? "bg-orange-50" : ""}`}>
                    <td className="p-3">
                      <span className="mr-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-lg">
                        {categoryIcon(p.category)}
                      </span>
                      <span className="font-semibold">{p.name}</span>
                    </td>
                    <td className="p-3">
                      <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold">
                        {p.category}
                      </span>
                    </td>
                    <td className="p-3 text-right font-bold">{rupiah(p.price)}</td>
                    <td className="p-3">
                      <span className="flex items-center justify-center gap-1">
                        <button onClick={() => adjustStock(p, -1)}
                          className="h-6 w-6 rounded bg-zinc-100 font-bold hover:bg-zinc-200">−</button>
                        <span className={`w-10 text-center font-bold ${p.stock <= 5 ? "text-red-600" : ""}`}>
                          {p.stock}
                        </span>
                        <button onClick={() => adjustStock(p, 1)}
                          className="h-6 w-6 rounded bg-zinc-100 font-bold hover:bg-zinc-200">+</button>
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button onClick={() => startEdit(p)}
                        className="mr-3 font-semibold text-orange-700 hover:underline">Edit</button>
                      <button onClick={() => hapus(p.id, p.name)}
                        className="font-semibold text-red-600 hover:underline">Hapus</button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-zinc-500">Tidak ada produk.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
