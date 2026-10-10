"use client";

// Dashboard LIVE owner (PRD §7a: "pantau penjualan live dari HP di rumah").
//
// Desain POLLING-FIRST (MVP): refetch /api/dashboard tiap 15 detik. Dirancang
// agar mudah di-upgrade ke SSE/WebSocket tanpa rework — data & tampilan sudah
// terpisah, sehingga channel push hanya perlu mengganti sumber update. Owner-
// only: nav menyembunyikan tautan untuk kasir; GET /api/dashboard menolak 403.
//
// Hemat baterai HP: polling DIJEDA saat tab tak terlihat (document.hidden) —
// pola standar halaman live; saat terlihat lagi langsung refetch.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { rupiah } from "@/shared/rupiah";

// Interval polling snapshot live (ms). Cukup responsif untuk "pantau live",
// cukup jarang untuk ramah baterai/kuota.
const POLL_MS = 15000;

type TrxRingkas = {
  id: string;
  total: number;
  payment: string;
  createdAt: string;
  itemCount: number;
};

type Snapshot = {
  omzetHariIni: number;
  trxHariIni: number;
  rataRata: number;
  transaksiTerakhir: TrxRingkas[];
  omzetPerJam: { jam: string; total: number }[];
  jamServer: string;
};

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border bg-surface p-4 shadow-xs">
      <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</div>
      <div className="mt-1 text-2xl font-extrabold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-text-muted">{sub}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [failed, setFailed] = useState(false);
  const [diperbarui, setDiperbarui] = useState<Date | null>(null);
  const [online, setOnline] = useState(true);
  // Cegah tumpang-tindih fetch bila respons lambat (mis. jaringan warung lelet).
  const inFlight = useRef(false);

  const muat = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const r = await fetch("/api/dashboard", { cache: "no-store" });
      if (!r.ok) throw new Error();
      const data: Snapshot = await r.json();
      setSnap(data);
      setDiperbarui(new Date());
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      inFlight.current = false;
    }
  }, []);

  // Polling: jeda saat tab tersembunyi (hemat baterai HP). Saat tab kembali
  // terlihat, langsung muat sekali agar data tak basi.
  useEffect(() => {
    void muat();

    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void muat();
    }, POLL_MS);

    const onVisible = () => {
      if (!document.hidden) void muat();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [muat]);

  // Status koneksi HP (pola sama dengan ConnectionBanner / halaman lain).
  useEffect(() => {
    setOnline(navigator.onLine);
    const up = () => {
      setOnline(true);
      void muat();
    };
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, [muat]);

  if (failed && !snap) {
    return <p className="text-danger">Gagal memuat dashboard. Refresh halaman.</p>;
  }

  if (!snap) return <p className="text-text-muted">Memuat dashboard…</p>;

  const maxJam = Math.max(1, ...snap.omzetPerJam.map((j) => j.total));

  return (
    <div>
      {!online && (
        <div className="mb-3 rounded-lg border border-amber-300 bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-900">
          📵 Butuh internet — data mungkin tidak terbaru.
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold">Dashboard Live</h1>
        <span className="flex items-center gap-1.5 rounded-full bg-accent-bg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-primary">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-tertiary" />
          Live
        </span>
        {diperbarui && (
          <span className="ml-auto text-xs text-text-muted">
            Diperbarui {diperbarui.toLocaleTimeString("id-ID")}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Card label="Omzet hari ini" value={rupiah(snap.omzetHariIni)} sub={`${snap.trxHariIni} transaksi`} />
        <Card label="Jumlah transaksi" value={String(snap.trxHariIni)} />
        <Card label="Rata-rata / trx" value={rupiah(snap.rataRata)} />
      </div>

      {/* Sparkline omzet per jam — murni CSS/div, tanpa chart library. */}
      <div className="mt-4 rounded-xl border bg-surface p-4 shadow-xs">
        <h2 className="mb-3 font-bold">📈 Omzet per jam (12 jam WIB terakhir)</h2>
        <div className="flex h-32 items-stretch gap-1.5">
          {snap.omzetPerJam.map((j) => (
            <div key={j.jam} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] font-bold text-text-muted">
                {j.total > 0 ? `${Math.round(j.total / 1000)}rb` : ""}
              </span>
              <div className="flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-t-md bg-primary"
                  style={{ height: `${Math.max(3, (j.total / maxJam) * 100)}%` }}
                  title={rupiah(j.total)}
                />
              </div>
              <span className="text-[10px] font-semibold text-text-muted">{j.jam}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Feed 5 transaksi terakhir — efek "kasir bunyi". */}
      <div className="mt-4 rounded-xl border bg-surface p-4 shadow-xs">
        <h2 className="mb-2 font-bold">🧾 Transaksi terakhir</h2>
        {snap.transaksiTerakhir.length === 0 ? (
          <p className="text-sm text-text-muted">Belum ada penjualan.</p>
        ) : (
          snap.transaksiTerakhir.map((t) => (
            <Link
              key={t.id}
              href={`/struk/${t.id}`}
              className="flex justify-between border-b py-2 text-sm last:border-0 hover:bg-accent-bg"
            >
              <span>
                {new Date(t.createdAt).toLocaleTimeString("id-ID", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
                {" "}• {t.itemCount} item • {t.payment}
              </span>
              <b>{rupiah(t.total)}</b>
            </Link>
          ))
        )}
        <Link href="/transaksi" className="mt-2 inline-block text-sm font-semibold text-primary hover:underline">
          Semua transaksi →
        </Link>
      </div>
    </div>
  );
}
