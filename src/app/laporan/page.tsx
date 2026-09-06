"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { rupiah } from "@/lib/rupiah";

type Stats = {
  omzetHariIni: number;
  trxHariIni: number;
  rataRata: number;
  totalProduk: number;
  lowStock: { id: string; name: string; stock: number }[];
  weekly: { label: string; total: number }[];
  top: { name: string; qty: number; omzet: number }[];
  recent: { id: string; total: number; payment: string; itemCount: number; createdAt: string }[];
  range: { from: string; to: string; omzet: number; trx: number; rata2: number } | null;
};

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-extrabold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-zinc-500">{sub}</div>}
    </div>
  );
}

export default function LaporanPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [failed, setFailed] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  function loadStats(f?: string, t?: string) {
    const q = f && t ? `?from=${f}&to=${t}` : "";
    fetch(`/api/stats${q}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setStats)
      .catch(() => setFailed(true));
  }

  useEffect(() => {
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (failed) return <p className="text-red-600">Gagal memuat laporan. Refresh halaman.</p>;

  if (!stats) return <p className="text-zinc-500">Memuat laporan…</p>;

  const maxWeek = Math.max(1, ...stats.weekly.map((d) => d.total));
  const maxTop = Math.max(1, ...stats.top.map((t) => t.qty));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold">Laporan</h1>
        <div className="ml-auto flex flex-wrap items-center gap-2 text-sm">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border bg-white px-2.5 py-1.5 outline-none focus:border-orange-500" />
          <span className="text-zinc-400">→</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border bg-white px-2.5 py-1.5 outline-none focus:border-orange-500" />
          <button onClick={() => from && to && loadStats(from, to)}
            className="rounded-lg bg-zinc-900 px-3.5 py-1.5 font-bold text-white hover:bg-zinc-700">
            Terapkan
          </button>
          {from && to && (
            <a href={`/api/export?from=${from}&to=${to}`}
              className="rounded-lg bg-orange-600 px-3.5 py-1.5 font-bold text-white hover:bg-orange-700">
              ⬇ CSV
            </a>
          )}
        </div>
      </div>

      {stats?.range && (
        <div className="mb-3 grid grid-cols-3 gap-3">
          <Card label={`Omzet ${stats.range.from} → ${stats.range.to}`} value={rupiah(stats.range.omzet)} sub={`${stats.range.trx} transaksi`} />
          <Card label="Transaksi periode" value={String(stats.range.trx)} />
          <Card label="Rata-rata / struk" value={rupiah(stats.range.rata2)} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card label="Omzet hari ini" value={rupiah(stats.omzetHariIni)} sub={`${stats.trxHariIni} transaksi`} />
        <Card label="Transaksi hari ini" value={String(stats.trxHariIni)} />
        <Card label="Rata-rata / struk" value={rupiah(stats.rataRata)} />
        <Card label="Total produk" value={String(stats.totalProduk)} />
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
        {/* Grafik 7 hari */}
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-bold">📈 Omzet 7 hari terakhir</h2>
          <div className="flex h-40 items-end gap-2">
            {stats.weekly.map((d) => (
              <div key={d.label} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] font-bold text-zinc-600">
                  {d.total > 0 ? `${Math.round(d.total / 1000)}rb` : ""}
                </span>
                <div
                  className="w-full rounded-t-md bg-orange-500"
                  style={{ height: `${Math.max(4, (d.total / maxWeek) * 100)}%` }}
                  title={rupiah(d.total)}
                />
                <span className="text-[11px] font-semibold text-zinc-500">{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Terlaris */}
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-bold">🏆 Produk terlaris</h2>
          {stats.top.length === 0 ? (
            <p className="text-sm text-zinc-500">Belum ada penjualan.</p>
          ) : (
            stats.top.map((t) => (
              <div key={t.name} className="mb-2">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold">{t.name}</span>
                  <span className="text-zinc-500">{t.qty} terjual • {rupiah(t.omzet)}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-zinc-100">
                  <div
                    className="h-2 rounded-full bg-amber-500"
                    style={{ width: `${(t.qty / maxTop) * 100}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h2 className="mb-2 font-bold">⚠️ Stok menipis (≤ 5)</h2>
          {stats.lowStock.length === 0 ? (
            <p className="text-sm text-zinc-500">Semua stok aman. ✅</p>
          ) : (
            stats.lowStock.map((p) => (
              <div key={p.id} className="flex justify-between border-b py-1.5 text-sm last:border-0">
                <span className="font-medium">{p.name}</span>
                <b className="text-red-600">sisa {p.stock}</b>
              </div>
            ))
          )}
          <Link href="/produk" className="mt-2 inline-block text-sm font-semibold text-orange-700 hover:underline">
            Kelola stok di Produk →
          </Link>
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h2 className="mb-2 font-bold">🧾 Transaksi terakhir</h2>
          {stats.recent.map((t) => (
            <Link key={t.id} href={`/struk/${t.id}`}
              className="flex justify-between border-b py-2 text-sm last:border-0 hover:bg-zinc-50">
              <span>
                {new Date(t.createdAt).toLocaleString("id-ID", {
                  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                })}
                {" "}• {t.itemCount} item • {t.payment}
              </span>
              <b>{rupiah(t.total)}</b>
            </Link>
          ))}
          <Link href="/transaksi" className="mt-2 inline-block text-sm font-semibold text-orange-700 hover:underline">
            Semua transaksi →
          </Link>
        </div>
      </div>
    </div>
  );
}
