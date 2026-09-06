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
    });
    if (!res.ok) return setError("Gagal menyimpan.");
    setSaved("Tersimpan ✓ Berlaku untuk struk berikutnya.");
  }

  return (
    <div className="max-w-md">
      <h1 className="mb-4 text-xl font-bold">Pengaturan</h1>
      <form onSubmit={simpan} className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-bold">🧾 Pajak otomatis (PB1)</h2>
        <label className="flex cursor-pointer items-center justify-between rounded-lg bg-zinc-50 px-3 py-2.5 text-sm font-semibold">
          <span>Kenakan pajak di setiap struk</span>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled((v) => !v)}
            className={`relative h-6 w-11 rounded-full transition ${enabled ? "bg-orange-600" : "bg-zinc-300"}`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                enabled ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>
        </label>
        <div className="mt-3 flex items-center gap-2">
          <label className="text-sm font-semibold text-zinc-600">Tarif</label>
          <input
            value={pct}
            onChange={(e) => setPct(e.target.value.replace(/[^\d.]/g, "").slice(0, 5))}
            inputMode="decimal"
            disabled={!enabled}
            className="w-24 rounded-lg border px-3 py-2 text-sm outline-none focus:border-orange-500 disabled:opacity-40"
          />
          <span className="text-sm font-bold">%</span>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Pajak dihitung otomatis dari (subtotal − diskon) dan tercatat per transaksi + struk.
        </p>
        {error && <p className="mt-2 text-sm text-red-600">⚠️ {error}</p>}
        {saved && <p className="mt-2 text-sm text-green-700">{saved}</p>}
        <button className="mt-3 w-full rounded-lg bg-orange-600 py-2 text-sm font-bold text-white hover:bg-orange-700">
          Simpan
        </button>
      </form>
    </div>
  );
}
