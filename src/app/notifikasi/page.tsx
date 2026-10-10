"use client";

import { useCallback, useEffect, useState } from "react";

// Halaman outbox notifikasi (Fase 2 §7a) — SEMI-MANUAL.
//
// Owner melihat laporan shift terbaru dan MENYALIN teksnya untuk dikirim ke WA
// sendiri (belum ada adapter transport). Owner-only: nav menyembunyikan tautan
// untuk kasir, dan GET /api/notifikasi menolak kasir dengan 403.

type Notif = {
  id: string;
  jenis: string;
  subject: string;
  body: string;
  status: string;
  refId: string | null;
  createdAt: string;
  readAt: string | null;
};

export default function NotifikasiPage() {
  const [items, setItems] = useState<Notif[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [tersalin, setTersalin] = useState<string | null>(null);

  const muat = useCallback(() => {
    fetch("/api/notifikasi?limit=20")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((rows: Notif[]) => setItems(rows))
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    muat();
  }, [muat]);

  async function salin(n: Notif) {
    try {
      await navigator.clipboard.writeText(n.body);
      setTersalin(n.id);
      setTimeout(() => setTersalin((v) => (v === n.id ? null : v)), 2000);
      await tandaiBaca(n);
    } catch {
      // Fallback: clipboard API bisa ditolak (izin/konteks non-HTTPS) — biarkan
      // owner menyalin manual dari area teks di bawah.
    }
  }

  async function tandaiBaca(n: Notif) {
    if (n.readAt) return;
    await fetch(`/api/notifikasi/${n.id}/baca`, { method: "POST" }).catch(() => null);
    setItems((prev) =>
      prev ? prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)) : prev
    );
  }

  if (failed) return <p className="text-danger">Gagal memuat notifikasi. Refresh halaman.</p>;
  if (!items) return <p className="text-ink-500">Memuat notifikasi…</p>;

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-headline-md text-ink-950">Notifikasi</h1>
        <p className="mt-0.5 text-body-sm text-ink-500">
          Laporan shift otomatis. Salin teks lalu kirim ke WhatsApp owner (semi-manual).
        </p>
      </div>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-ink-200 bg-surface p-4 text-body-sm text-ink-500">
          Belum ada laporan. Laporan dibuat otomatis saat shift ditutup.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((n) => (
            <div key={n.id} className="rounded-2xl border border-ink-200 bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-ink-100 px-2 py-0.5 text-caption uppercase tracking-wide text-ink-700">
                  {n.jenis}
                </span>
                <b className="text-body-sm text-ink-950">{n.subject}</b>
                {!n.readAt && (
                  <span className="rounded-full bg-ink-100 px-2 py-0.5 text-caption text-danger">
                    Baru
                  </span>
                )}
                <span className="ml-auto text-caption text-ink-500">
                  {new Date(n.createdAt).toLocaleString("id-ID", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-xl bg-ink-100 p-3 text-body-sm text-ink-700">
                {n.body}
              </pre>

              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  onClick={() => salin(n)}
                  className="rounded-xl bg-ink-950 px-3.5 py-1.5 text-label-lg text-surface hover:opacity-90"
                >
                  {tersalin === n.id ? "✓ Tersalin" : "📋 Salin"}
                </button>
                {!n.readAt && (
                  <button
                    onClick={() => tandaiBaca(n)}
                    className="rounded-xl border border-ink-200 px-3.5 py-1.5 text-body-sm text-ink-700 hover:bg-ink-100"
                  >
                    Tandai dibaca
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
