"use client";

// Banner status koneksi + antrean offline (PRD §9).
//
// - Offline          → kuning: "Mode offline — N transaksi tersimpan lokal"
// - Online & antrean → hijau : "Menyinkronkan…" (memanggil syncOutbox)
// - Online & antrean 0 → sembunyi (render null)
//
// SSR-safe: state awal `online=true` + `count=0` sehingga render server & klien
// pertama identik (null). IndexedDB hanya disentuh di dalam useEffect.

import { useCallback, useEffect, useRef, useState } from "react";
import { countOutbox } from "@/client/offline-db";
import { syncOutbox } from "@/client/offline-sync";

/**
 * Nama event window yang dipancarkan setiap kali antrean outbox berubah
 * (mis. setelah kasir menyimpan transaksi offline). Komponen lain dapat
 * memanggil `window.dispatchEvent(new Event(OUTBOX_CHANGED_EVENT))` agar
 * banner segera memperbarui jumlah antrean tanpa polling.
 */
export const OUTBOX_CHANGED_EVENT = "kring:outbox-changed";

const RETRY_MS = 20000;

export default function ConnectionBanner() {
  const [online, setOnline] = useState(true);
  const [count, setCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      setCount(await countOutbox());
    } catch {
      // IndexedDB tak tersedia (SSR / mode privat) — abaikan.
    }
  }, []);

  const runSync = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      await syncOutbox();
    } catch {
      // Gagal sync → biarkan antrean utuh, coba lagi nanti.
    } finally {
      syncingRef.current = false;
      setSyncing(false);
      await refresh();
    }
  }, [refresh]);

  useEffect(() => {
    setOnline(navigator.onLine);

    const goOnline = () => {
      setOnline(true);
      void refresh();
    };
    const goOffline = () => setOnline(false);
    const changed = () => void refresh();

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    window.addEventListener(OUTBOX_CHANGED_EVENT, changed);
    void refresh();

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener(OUTBOX_CHANGED_EVENT, changed);
    };
  }, [refresh]);

  // Selama online dan masih ada antrean → jalankan sync (dan coba ulang berkala
  // bila batch sebelumnya gagal). `syncingRef` mencegah tumpang-tindih.
  useEffect(() => {
    if (!online || count === 0) return;
    void runSync();
    const timer = setInterval(() => void runSync(), RETRY_MS);
    return () => clearInterval(timer);
  }, [online, count, runSync]);

  if (online && count === 0 && !syncing) return null;

  if (!online) {
    return (
      <div className="sticky top-0 z-30 border-b border-warning bg-warning-bg px-4 py-2 text-center text-sm font-semibold text-warning print:hidden">
        ⚠️ Mode offline — {count} transaksi tersimpan lokal
      </div>
    );
  }

  return (
    <div className="sticky top-0 z-30 border-b border-success bg-success-bg px-4 py-2 text-center text-sm font-semibold text-success print:hidden">
      🔄 Menyinkronkan… ({count})
    </div>
  );
}
