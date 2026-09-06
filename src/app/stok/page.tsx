"use client";

import { useEffect, useState } from "react";
import { productIcon } from "@/lib/meta";

type Move = {
  id: string;
  qty: number;
  reason: string;
  refId: string | null;
  createdAt: string;
  product: { name: string; category: string; icon: string };
};

const REASON_LABEL: Record<string, string> = {
  PENJUALAN: "Penjualan",
  KULAKAN: "Kulakan",
  KOREKSI: "Koreksi",
  STOK_AWAL: "Stok awal",
};

export default function StokPage() {
  const [moves, setMoves] = useState<Move[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    fetch("/api/stock-moves").then((r) => r.json()).then(setMoves).catch(() => {});
  }, []);

  const filtered = moves.filter(
    (m) =>
      m.product.name.toLowerCase().includes(filter.toLowerCase()) ||
      (REASON_LABEL[m.reason] ?? m.reason).toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">Riwayat Stok</h1>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="🔍 Cari produk / alasan…"
          className="ml-auto w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-orange-500 sm:max-w-xs"
        />
      </div>
      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="p-3">Waktu</th>
                <th className="p-3">Produk</th>
                <th className="p-3">Alasan</th>
                <th className="p-3 text-right">Perubahan</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id} className="border-b last:border-0 hover:bg-zinc-50">
                  <td className="p-3 text-zinc-600">
                    {new Date(m.createdAt).toLocaleString("id-ID", {
                      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                    })}
                  </td>
                  <td className="p-3 font-medium">
                    <span className="mr-2">{productIcon(m.product)}</span>
                    {m.product.name}
                  </td>
                  <td className="p-3">
                    <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold">
                      {REASON_LABEL[m.reason] ?? m.reason}
                    </span>
                  </td>
                  <td className={`p-3 text-right font-bold ${m.qty < 0 ? "text-red-600" : "text-green-700"}`}>
                    {m.qty > 0 ? `+${m.qty}` : m.qty}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={4} className="p-8 text-center text-zinc-500">Belum ada pergerakan stok.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
