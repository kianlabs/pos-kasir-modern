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
    <div className="rounded-2xl border border-ink-200 bg-surface p-4">
      <div className="text-caption uppercase tracking-wide text-ink-500">{label}</div>
      <div className="mt-1 text-numeral-lg tabular-nums text-ink-950">{value}</div>
      {sub && <div className="mt-0.5 text-caption text-ink-500">{sub}</div>}
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

  if (!snap) return <p className="text-ink-500">Memuat dashboard…</p>;

  const maxJam = Math.max(1, ...snap.omzetPerJam.map((j) => j.total));

  return (
    <div>
      {!online && (
        <div className="mb-3 rounded-xl border border-ink-300 bg-ink-100 px-3 py-2 text-body-sm text-ink-700">
          📵 Butuh internet — data mungkin tidak terbaru.
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="text-headline-md text-ink-950">Dashboard Live</h1>
        <span className="flex items-center gap-1.5 rounded-full bg-ink-100 px-2.5 py-1 text-caption uppercase tracking-wide text-ink-700">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-ink-950" />
          Live
        </span>
        {diperbarui && (
          <span className="ml-auto text-caption text-ink-500">
            Diperbarui {diperbarui.toLocaleTimeString("id-ID")}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Card label="Omzet hari ini" value={rupiah(snap.omzetHariIni)} sub={`${snap.trxHariIni} transaksi`} />
        <Card label="Jumlah transaksi" value={String(snap.trxHariIni)} />
        <Card label="Rata-rata / trx" value={rupiah(snap.rataRata)} />
      </div>

      <div className="mt-4 rounded-2xl border border-ink-200 bg-surface p-4">
        <h2 className="mb-3 text-headline-sm text-ink-950">📈 Omzet per jam (12 jam WIB terakhir)</h2>
        <div className="flex h-32 items-stretch gap-1.5">
          {snap.omzetPerJam.map((j) => (
            <div key={j.jam} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-caption tabular-nums text-ink-700">
                {j.total > 0 ? `${Math.round(j.total / 1000)}rb` : ""}
              </span>
              <div className="flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-t-md bg-ink-950"
                  style={{ height: `${Math.max(3, (j.total / maxJam) * 100)}%` }}
                  title={rupiah(j.total)}
                />
              </div>
              <span className="text-caption tabular-nums text-ink-500">{j.jam}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-ink-200 bg-surface p-4">
        <h2 className="mb-2 text-headline-sm text-ink-950">🧾 Transaksi terakhir</h2>
        {snap.transaksiTerakhir.length === 0 ? (
          <p className="text-body-sm text-ink-500">Belum ada penjualan.</p>
        ) : (
          snap.transaksiTerakhir.map((t) => (
            <Link
              key={t.id}
              href={`/struk/${t.id}`}
              className="flex justify-between border-b border-ink-200 py-2 text-body-sm last:border-0 hover:bg-ink-100"
            >
              <span className="text-ink-700">
                {new Date(t.createdAt).toLocaleTimeString("id-ID", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
                {" "}• {t.itemCount} item • {t.payment}
              </span>
              <b className="tabular-nums text-ink-950">{rupiah(t.total)}</b>
            </Link>
          ))
        )}
        <Link href="/transaksi" className="mt-2 inline-block text-label-lg text-ink-950 hover:underline">
          Semua transaksi →
        </Link>
      </div>
    </div>
  );
}
