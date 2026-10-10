"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { rupiah } from "@/shared/rupiah";

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
    <div className="rounded-2xl border border-ink-200 bg-surface p-4">
      <div className="text-caption uppercase tracking-wide text-ink-500">{label}</div>
      <div className="mt-1 text-numeral-lg tabular-nums text-ink-950">{value}</div>
      {sub && <div className="mt-0.5 text-caption text-ink-500">{sub}</div>}
    </div>
  );
}

function ringkasBayar(recent: Stats["recent"]) {
  const map = new Map<string, { count: number; total: number }>();
  for (const t of recent) {
    const cur = map.get(t.payment) ?? { count: 0, total: 0 };
    map.set(t.payment, { count: cur.count + 1, total: cur.total + t.total });
  }
  return Array.from(map.entries())
    .map(([payment, v]) => ({ payment, ...v }))
    .sort((a, b) => b.total - a.total);
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

  if (failed) return <p className="text-danger">Gagal memuat laporan. Refresh halaman.</p>;

  if (!stats) return <p className="text-ink-500">Memuat laporan…</p>;

  const maxWeek = Math.max(1, ...stats.weekly.map((d) => d.total));
  const maxTop = Math.max(1, ...stats.top.map((t) => t.qty));
  const bayar = ringkasBayar(stats.recent);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="text-headline-md text-ink-950">Laporan</h1>
        <div className="ml-auto flex flex-wrap items-center gap-2 text-body-sm">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="rounded-xl border border-ink-200 bg-surface px-2.5 py-1.5 text-ink-950 outline-none focus:border-ink-950" />
          <span className="text-ink-300">→</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="rounded-xl border border-ink-200 bg-surface px-2.5 py-1.5 text-ink-950 outline-none focus:border-ink-950" />
          <button onClick={() => from && to && loadStats(from, to)}
            className="rounded-xl bg-ink-950 px-3.5 py-1.5 text-label-lg text-surface hover:opacity-90">
            Terapkan
          </button>
          {from && to && (
            <a href={`/api/export?from=${from}&to=${to}`}
              className="rounded-xl bg-ink-950 px-3.5 py-1.5 text-label-lg text-surface hover:opacity-90">
              ⬇ CSV
            </a>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-ink-200 bg-surface p-5">
        <div className="text-caption uppercase tracking-wide text-ink-500">Omzet hari ini</div>
        <div className="mt-1 text-numeral-hero tabular-nums text-ink-950">{rupiah(stats.omzetHariIni)}</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-caption text-ink-700">
            <b className="tabular-nums text-ink-950">{stats.trxHariIni}</b> transaksi
          </span>
          <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-caption text-ink-700">
            rata-rata <b className="tabular-nums text-ink-950">{rupiah(stats.rataRata)}</b>/struk
          </span>
          <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-caption text-ink-700">
            <b className="tabular-nums text-ink-950">{stats.totalProduk}</b> produk
          </span>
        </div>
      </div>

      {stats.range && (
        <div className="mt-3 grid grid-cols-3 gap-3">
          <Card label={`Omzet ${stats.range.from} → ${stats.range.to}`} value={rupiah(stats.range.omzet)} sub={`${stats.range.trx} transaksi`} />
          <Card label="Transaksi periode" value={String(stats.range.trx)} />
          <Card label="Rata-rata / struk" value={rupiah(stats.range.rata2)} />
        </div>
      )}

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-ink-200 bg-surface p-4">
          <h2 className="mb-3 text-headline-sm text-ink-950">📈 Omzet 7 hari terakhir</h2>
          <div className="flex h-40 items-stretch gap-2">
            {stats.weekly.map((d) => (
              <div key={d.label} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-caption tabular-nums text-ink-700">
                  {d.total > 0 ? `${Math.round(d.total / 1000)}rb` : ""}
                </span>
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-md bg-ink-950"
                    style={{ height: `${Math.max(4, (d.total / maxWeek) * 100)}%` }}
                    title={rupiah(d.total)}
                  />
                </div>
                <span className="text-caption text-ink-500">{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-ink-200 bg-surface p-4">
          <h2 className="mb-3 text-headline-sm text-ink-950">🏆 Produk terlaris</h2>
          {stats.top.length === 0 ? (
            <p className="text-body-sm text-ink-500">Belum ada penjualan.</p>
          ) : (
            stats.top.map((t) => (
              <div key={t.name} className="mb-2">
                <div className="flex justify-between text-body-sm">
                  <span className="text-label-lg text-ink-950">{t.name}</span>
                  <span className="tabular-nums text-ink-500">{t.qty} terjual • {rupiah(t.omzet)}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-ink-100">
                  <div
                    className="h-2 rounded-full bg-ink-950"
                    style={{ width: `${(t.qty / maxTop) * 100}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-ink-200 bg-surface p-4">
          <h2 className="mb-2 text-headline-sm text-ink-950">⚠️ Stok menipis (≤ 5)</h2>
          {stats.lowStock.length === 0 ? (
            <p className="text-body-sm text-ink-500">Semua stok aman. ✅</p>
          ) : (
            stats.lowStock.map((p) => (
              <div key={p.id} className="flex justify-between border-b border-ink-200 py-1.5 text-body-sm last:border-0">
                <span className="text-ink-700">{p.name}</span>
                <b className="tabular-nums text-danger">sisa {p.stock}</b>
              </div>
            ))
          )}
          <Link href="/produk" className="mt-2 inline-block text-body-sm text-label-lg text-ink-950 hover:underline">
            Kelola stok di Produk →
          </Link>
        </div>

        <div className="rounded-2xl border border-ink-200 bg-surface p-4">
          <h2 className="mb-2 text-headline-sm text-ink-950">💳 Metode pembayaran</h2>
          {bayar.length === 0 ? (
            <p className="text-body-sm text-ink-500">Belum ada transaksi.</p>
          ) : (
            bayar.map((b) => (
              <div key={b.payment} className="flex justify-between border-b border-ink-200 py-1.5 text-body-sm last:border-0">
                <span className="text-ink-700">{b.payment} · {b.count} trx</span>
                <b className="tabular-nums text-ink-950">{rupiah(b.total)}</b>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-ink-200 bg-surface p-4">
        <h2 className="mb-2 text-headline-sm text-ink-950">🧾 Transaksi terakhir</h2>
        {stats.recent.map((t) => (
          <Link key={t.id} href={`/struk/${t.id}`}
            className="flex justify-between border-b border-ink-200 py-2 text-body-sm last:border-0 hover:bg-ink-100">
            <span className="text-ink-700">
              {new Date(t.createdAt).toLocaleString("id-ID", {
                day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
              })}
              {" "}• {t.itemCount} item • {t.payment}
            </span>
            <b className="tabular-nums text-ink-950">{rupiah(t.total)}</b>
          </Link>
        ))}
        <Link href="/transaksi" className="mt-2 inline-block text-label-lg text-ink-950 hover:underline">
          Semua transaksi →
        </Link>
      </div>
    </div>
  );
}
