"use client";

import { useEffect, useState } from "react";
import { productIcon } from "@/shared/category-icon";

type Move = {
  id: string;
  qty: number;
  type?: string;
  reason?: string;
  refId: string | null;
  createdAt: string;
  product: { name: string; category: string; icon: string };
};

type ProductStok = { id: string; name: string; stock: number };

const REASON_LABEL: Record<string, string> = {
  PENJUALAN: "Penjualan",
  KULAKAN: "Kulakan",
  KOREKSI: "Koreksi",
  STOK_AWAL: "Stok awal",
};

export default function StokPage() {
  const [moves, setMoves] = useState<Move[]>([]);
  const [products, setProducts] = useState<ProductStok[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    fetch("/api/stock-moves").then((r) => r.json()).then(setMoves).catch(() => {});
    fetch("/api/products").then((r) => r.json()).then(setProducts).catch(() => {});
  }, []);

  const menipis = products.filter((p) => p.stock > 0 && p.stock <= 5);
  const habis = products.filter((p) => p.stock <= 0);

  const filtered = moves.filter((m) => {
    const rawReason = m.type || m.reason || "";
    const label = REASON_LABEL[rawReason] ?? rawReason;
    return (
      m.product.name.toLowerCase().includes(filter.toLowerCase()) ||
      label.toLowerCase().includes(filter.toLowerCase())
    );
  });

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="text-headline-md text-ink-950">Riwayat Stok</h1>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="🔍 Cari produk / alasan…"
          className="ml-auto w-full rounded-xl border border-ink-200 bg-surface px-3 py-2 text-body-sm text-ink-950 outline-none focus:border-ink-950 sm:max-w-xs"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-ink-200 bg-surface p-4">
          <div className="text-caption uppercase tracking-wide text-ink-500">Stok menipis (≤ 5)</div>
          <div className="mt-1 text-numeral-lg tabular-nums text-ink-950">{menipis.length}</div>
          {menipis.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {menipis.slice(0, 6).map((p) => (
                <span key={p.id} className="rounded-full bg-ink-100 px-2 py-0.5 text-caption text-ink-700">
                  {p.name} · {p.stock}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-ink-200 bg-surface p-4">
          <div className="text-caption uppercase tracking-wide text-ink-500">Stok habis</div>
          <div className="mt-1 text-numeral-lg tabular-nums text-danger">{habis.length}</div>
          {habis.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {habis.slice(0, 6).map((p) => (
                <span key={p.id} className="rounded-full bg-ink-100 px-2 py-0.5 text-caption text-ink-700">
                  {p.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-ink-200 bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-body-sm">
            <thead>
              <tr className="border-b border-ink-200 bg-ink-100 text-left text-caption uppercase tracking-wide text-ink-500">
                <th className="p-3">Waktu</th>
                <th className="p-3">Produk</th>
                <th className="p-3">Alasan</th>
                <th className="p-3 text-right">Perubahan</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => {
                const rawReason = m.type || m.reason || "";
                return (
                  <tr key={m.id} className="border-b border-ink-200 last:border-0 hover:bg-ink-100">
                    <td className="p-3 text-ink-500">
                      {new Date(m.createdAt).toLocaleString("id-ID", {
                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                    <td className="p-3 text-label-lg text-ink-950">
                      <span className="mr-2">{productIcon(m.product)}</span>
                      {m.product.name}
                    </td>
                    <td className="p-3">
                      <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-caption text-ink-700">
                        {REASON_LABEL[rawReason] ?? rawReason}
                      </span>
                    </td>
                    <td className={`p-3 text-right text-label-lg tabular-nums ${m.qty < 0 ? "text-danger" : "text-success"}`}>
                      {m.qty > 0 ? `+${m.qty}` : m.qty}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={4} className="p-8 text-center text-ink-500">Belum ada pergerakan stok.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
