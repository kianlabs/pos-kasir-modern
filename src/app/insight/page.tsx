"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import InsightList, { type Insight } from "./InsightList";

// Dashboard "KRING! Insight" (lampiran AI §6, §9, §11).
//
// Owner-only: nav menyembunyikan tautan untuk kasir, proxy mengalihkan kasir ke
// "/?denied=1", dan GET /api/ai/insights menolak kasir dengan 403 (guard yang
// mengikat). Struktur halaman ini mencerminkan src/app/notifikasi/page.tsx.
//
// Offline (§9): AI butuh internet — saat navigator.onLine false kita tampilkan
// notice, bukan biarkan fetch gagal. Plan gratis → endpoint preview/chat 403
// dengan pesan jelas; UI menampilkannya sebagai pemberitahuan ramah.

const PESAN_OFFLINE = "Fitur Insight butuh internet. Sambungkan perangkat lalu coba lagi.";

type Preview = { id: string; title: string; body: string; source: string | null; viaAi: boolean };

export default function InsightPage() {
  const [items, setItems] = useState<Insight[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [online, setOnline] = useState(true);
  const [sibuk, setSibuk] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const muat = useCallback(() => {
    fetch("/api/ai/insights")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((rows: Insight[]) => setItems(rows))
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    muat();
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [muat]);

  async function tandaiBaca(id: string) {
    await fetch(`/api/ai/insights/${id}/read`, { method: "POST" }).catch(() => null);
    setItems((prev) =>
      prev ? prev.map((x) => (x.id === id ? { ...x, readAt: new Date().toISOString() } : x)) : prev
    );
  }

  async function ringkasHariIni() {
    setNotice(null);
    setSibuk(true);
    try {
      const r = await fetch("/api/ai/report/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (r.status === 403) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        setNotice(j.error ?? "Fitur Insight hanya untuk plan berbayar.");
        return;
      }
      if (!r.ok) {
        setNotice("Gagal membuat ringkasan. Coba lagi sebentar lagi.");
        return;
      }
      const p = (await r.json()) as Preview;
      setPreview(p);
      // Sertakan hasil baru ke daftar tanpa fetch ulang (dedup by id).
      setItems((prev) => {
        const kartu: Insight = {
          id: p.id,
          type: "NARRATIVE",
          title: p.title,
          body: p.body,
          findings: null,
          source: p.source,
          readAt: null,
          createdAt: new Date().toISOString(),
        };
        const lain = prev ? prev.filter((x) => x.id !== p.id) : [];
        return [kartu, ...lain];
      });
    } catch {
      setNotice("Gagal membuat ringkasan. Coba lagi sebentar lagi.");
    } finally {
      setSibuk(false);
    }
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold">✨ Insight</h1>
        <p className="mt-0.5 text-sm text-text-muted">
          Ringkasan otomatis, deteksi anomali, dan tanya-laporan untuk owner.
        </p>
      </div>

      {!online ? (
        <p className="rounded-xl border border-amber-300 bg-warning-bg p-4 text-sm font-semibold text-warning">
          📶 {PESAN_OFFLINE}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={ringkasHariIni}
              disabled={sibuk}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sibuk ? "Menyusun ringkasan…" : "✨ Lihat ringkasan hari ini"}
            </button>
            <Link
              href="/insight/chat"
              className="rounded-lg border px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-50"
            >
              💬 Tanya owner
            </Link>
          </div>

          {notice && (
            <p
              role="status"
              className="mt-3 rounded-xl border border-amber-300 bg-warning-bg p-3 text-sm font-semibold text-warning"
            >
              {notice}
            </p>
          )}

          {preview && (
            <div className="mt-3 rounded-xl border-2 border-primary bg-white p-4 shadow-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-accent-bg px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary">
                  {preview.viaAi ? "Ringkasan AI" : "Ringkasan angka"}
                </span>
                <b className="text-body-sm">{preview.title}</b>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-body-sm">{preview.body}</p>
              {preview.source && (
                <Link
                  href={preview.source}
                  className="mt-2 inline-block text-sm font-semibold text-primary hover:underline"
                >
                  Lihat sumber angka →
                </Link>
              )}
            </div>
          )}

          <div className="mt-5">
            <h2 className="mb-2 font-bold">Daftar insight</h2>
            {failed ? (
              <p className="text-danger">Gagal memuat insight. Refresh halaman.</p>
            ) : !items ? (
              <p className="text-zinc-500">Memuat insight…</p>
            ) : (
              <InsightList items={items} onRead={tandaiBaca} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
