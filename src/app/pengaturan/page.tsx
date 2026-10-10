"use client";

import { useEffect, useState } from "react";

export default function PengaturanPage() {
  const [enabled, setEnabled] = useState(true);
  const [pct, setPct] = useState("10");
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => {
        setEnabled(!!s.taxEnabled);
        setPct(String(s.taxPct ?? 10));
      })
      .catch(() => setError("Gagal memuat pengaturan."));
  }, []);

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved("");
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taxEnabled: enabled, taxPct: Number(pct) || 0 }),
    }).catch(() => null);
    if (!res) return setError("Tidak bisa hubungi server.");
    if (!res.ok) return setError("Gagal menyimpan.");
    setSaved("Tersimpan ✓ Berlaku untuk struk berikutnya.");
  }

  return (
    <div className="max-w-md">
      <h1 className="mb-4 text-headline-md text-ink-950">Pengaturan</h1>
      <form onSubmit={simpan} className="rounded-2xl border border-ink-200 bg-surface p-4">
        <h2 className="mb-3 text-headline-sm text-ink-950">🧾 Pajak otomatis (PB1)</h2>
        <label className="flex cursor-pointer items-center justify-between rounded-xl bg-ink-100 px-3 py-2.5 text-body-sm text-ink-950">
          <span className="text-label-lg">Kenakan pajak di setiap struk</span>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled((v) => !v)}
            className={`relative h-6 w-11 rounded-full transition ${enabled ? "bg-ink-950" : "bg-ink-300"}`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow-sm transition-all ${
                enabled ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>
        </label>
        <div className="mt-3 flex items-center gap-2">
          <label className="text-label-lg text-ink-700">Tarif</label>
          <input
            value={pct}
            onChange={(e) => setPct(e.target.value.replace(/[^\d.]/g, "").slice(0, 5))}
            inputMode="decimal"
            disabled={!enabled}
            className="w-24 rounded-xl border border-ink-200 bg-surface px-3 py-2 text-body-sm tabular-nums text-ink-950 outline-none focus:border-ink-950 disabled:opacity-40"
          />
          <span className="text-label-lg text-ink-950">%</span>
        </div>
        <p className="mt-2 text-caption text-ink-500">
          Pajak dihitung otomatis dari (subtotal − diskon) dan tercatat per transaksi + struk.
        </p>
        {error && <p className="mt-2 text-body-sm text-danger">⚠️ {error}</p>}
        {saved && <p className="mt-2 text-body-sm text-success">{saved}</p>}
        <button className="mt-3 w-full rounded-xl bg-ink-950 py-2 text-label-lg text-surface hover:opacity-90">
          Simpan
        </button>
      </form>
    </div>
  );
}
