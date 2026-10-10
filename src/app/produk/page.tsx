"use client";

import { useEffect, useState } from "react";
import { rupiah } from "@/shared/rupiah";
import { productIcon, ICON_CHOICES } from "@/shared/category-icon";

type Product = { id: string; name: string; price: number; stock: number; category: string; icon: string };

const EMPTY = { name: "", price: "", stock: "", category: "Umum", icon: "" };

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
    setForm({ name: p.name, price: String(p.price), stock: String(p.stock), category: p.category, icon: p.icon ?? "" });
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
      icon: form.icon,
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
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="text-headline-md text-ink-950">Produk</h1>
        <div className="ml-auto flex flex-wrap gap-2 text-label-md">
          <span className="rounded-xl border border-ink-200 bg-surface px-3 py-1.5 text-ink-700">
            <b className="text-ink-950 tabular-nums">{products.length}</b> produk
          </span>
          <span className="rounded-xl border border-ink-200 bg-surface px-3 py-1.5 text-ink-700">
            Nilai stok <b className="text-ink-950 tabular-nums">{rupiah(totalNilai)}</b>
          </span>
          <a href="/stok" className="rounded-xl border border-ink-200 bg-surface px-3 py-1.5 text-ink-700 hover:bg-ink-100">
            📋 Riwayat stok
          </a>
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[320px_1fr]">
        <form onSubmit={submit} className="rounded-2xl border border-ink-200 bg-surface p-4">
          <h2 className="mb-3 text-headline-sm text-ink-950">{editingId ? "✏️ Edit produk" : "➕ Tambah produk"}</h2>
          <label className="mb-1 block text-caption text-ink-500">Nama</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="mis. Ayam Goreng" className="mb-2 w-full rounded-xl border border-ink-200 bg-surface px-3 py-2 text-body-sm text-ink-950 outline-none focus:border-ink-950" />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-caption text-ink-500">Harga (Rp)</label>
              <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value.replace(/\D/g, "") })}
                placeholder="10000" inputMode="numeric" className="mb-2 w-full rounded-xl border border-ink-200 bg-surface px-3 py-2 text-body-sm tabular-nums text-ink-950 outline-none focus:border-ink-950" />
            </div>
            <div>
              <label className="mb-1 block text-caption text-ink-500">Stok</label>
              <input value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value.replace(/\D/g, "") })}
                placeholder="20" inputMode="numeric" className="mb-2 w-full rounded-xl border border-ink-200 bg-surface px-3 py-2 text-body-sm tabular-nums text-ink-950 outline-none focus:border-ink-950" />
            </div>
          </div>
          <label className="mb-1 block text-caption text-ink-500">Kategori</label>
          <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
            placeholder="Nasi / Mie / Lauk / Sayur / Gorengan / Minuman" className="mb-2 w-full rounded-xl border border-ink-200 bg-surface px-3 py-2 text-body-sm text-ink-950 outline-none focus:border-ink-950" />
          <label className="mb-1 block text-caption text-ink-500">
            Ikon {form.icon && <span className="text-base">{form.icon}</span>}
          </label>
          <div className="mb-2 flex flex-wrap gap-1 rounded-xl border border-ink-200 bg-ink-100 p-2">
            {ICON_CHOICES.map((ic) => (
              <button
                type="button"
                key={ic}
                onClick={() => setForm({ ...form, icon: form.icon === ic ? "" : ic })}
                className={`rounded-md px-1.5 py-0.5 text-lg hover:bg-surface ${
                  form.icon === ic ? "bg-surface ring-2 ring-ink-950" : ""
                }`}
              >
                {ic}
              </button>
            ))}
          </div>
          {error && <p className="mb-2 text-body-sm text-danger">⚠️ {error}</p>}
          <div className="flex gap-2">
            <button className="flex-1 rounded-xl bg-ink-950 py-2 text-label-lg text-surface hover:opacity-90">
              {editingId ? "Simpan" : "Tambah"}
            </button>
            {editingId && (
              <button type="button" onClick={cancelEdit}
                className="rounded-xl border border-ink-200 px-4 py-2 text-label-lg text-ink-950 hover:bg-ink-100">
                Batal
              </button>
            )}
          </div>
        </form>

        <div className="overflow-hidden rounded-2xl border border-ink-200 bg-surface">
          <div className="border-b border-ink-200 p-3">
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 Cari produk…"
              className="w-full rounded-xl border border-ink-200 bg-surface px-3 py-2 text-body-sm text-ink-950 outline-none focus:border-ink-950 sm:max-w-xs" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-body-sm">
              <thead>
                <tr className="border-b border-ink-200 bg-ink-100 text-left text-caption uppercase tracking-wide text-ink-500">
                  <th className="p-3">Produk</th>
                  <th className="p-3">Kategori</th>
                  <th className="p-3 text-right">Harga</th>
                  <th className="p-3 text-center">Stok</th>
                  <th className="p-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className={`border-b border-ink-200 last:border-0 hover:bg-ink-100 ${editingId === p.id ? "bg-ink-100" : ""}`}>
                    <td className="p-3">
                      <span className="mr-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-ink-100 text-lg">
                        {productIcon(p)}
                      </span>
                      <span className="text-label-lg text-ink-950">{p.name}</span>
                    </td>
                    <td className="p-3">
                      <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-caption text-ink-700">
                        {p.category}
                      </span>
                    </td>
                    <td className="p-3 text-right text-label-lg tabular-nums text-ink-950">{rupiah(p.price)}</td>
                    <td className="p-3">
                      <span className="flex items-center justify-center gap-1">
                        <button onClick={() => adjustStock(p, -1)}
                          className="h-6 w-6 rounded-sm bg-ink-100 text-ink-950 hover:bg-ink-200">−</button>
                        <span className={`w-10 text-center text-label-lg tabular-nums ${p.stock <= 5 ? "text-danger" : "text-ink-950"}`}>
                          {p.stock}
                        </span>
                        <button onClick={() => adjustStock(p, 1)}
                          className="h-6 w-6 rounded-sm bg-ink-100 text-ink-950 hover:bg-ink-200">+</button>
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button onClick={() => startEdit(p)}
                        className="mr-3 text-label-lg text-ink-950 hover:underline">Edit</button>
                      <button onClick={() => hapus(p.id, p.name)}
                        className="text-label-lg text-danger hover:underline">Hapus</button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-ink-500">Tidak ada produk.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
