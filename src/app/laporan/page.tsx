"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { rupiah } from "@/lib/rupiah";

type Stats = {
  omzetHariIni: number;
  trxHariIni: number;
  totalProduk: number;
  lowStock: { id: string; name: string; stock: number }[];
  recent: { id: string; total: number; payment: string; itemCount: number; createdAt: string }[];
};

export default function LaporanPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/stats").then((r) => r.json()).then(setStats);
  }, []);

  if (!stats) return <p>Memuat…</p>;

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded border bg-white p-4">
          <div className="text-xs text-zinc-500">Omzet hari ini</div>
          <div className="text-2xl font-bold">{rupiah(stats.omzetHariIni)}</div>
        </div>
        <div className="rounded border bg-white p-4">
          <div className="text-xs text-zinc-500">Transaksi hari ini</div>
          <div className="text-2xl font-bold">{stats.trxHariIni}</div>
        </div>
        <div className="rounded border bg-white p-4">
          <div className="text-xs text-zinc-500">Total produk</div>
          <div className="text-2xl font-bold">{stats.totalProduk}</div>
        </div>
      </div>

      <div className="rounded border bg-white p-4">
        <h2 className="mb-2 font-bold">⚠️ Stok menipis (≤ 5)</h2>
        {stats.lowStock.length === 0 ? (
          <p className="text-sm text-zinc-500">Semua stok aman.</p>
        ) : (
          stats.lowStock.map((p) => (
            <div key={p.id} className="flex justify-between border-b py-1 text-sm last:border-0">
              <span>{p.name}</span>
              <b className="text-red-600">sisa {p.stock}</b>
            </div>
          ))
        )}
      </div>

      <div className="rounded border bg-white p-4">
        <h2 className="mb-2 font-bold">Transaksi terakhir</h2>
        {stats.recent.map((t) => (
          <Link key={t.id} href={`/struk/${t.id}`}
            className="flex justify-between border-b py-2 text-sm last:border-0 hover:bg-zinc-50">
            <span>
              {new Date(t.createdAt).toLocaleString("id-ID")} • {t.itemCount} item • {t.payment}
            </span>
            <b>{rupiah(t.total)}</b>
          </Link>
        ))}
      </div>
    </div>
  );
}
