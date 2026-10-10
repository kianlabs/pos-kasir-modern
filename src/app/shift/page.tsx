"use client";

import { useEffect, useState } from "react";
import { rupiah } from "@/shared/rupiah";
import { shortId } from "@/shared/category-icon";

type Shift = {
  id: string;
  openedAt: string;
  closedAt: string | null;
  modalAwal: number;
  kasFisik: number | null;
  status: string;
  tunai: number;
  qris: number;
  trxCount: number;
  expected: number;
  selisih: number | null;
};

// Pecahan uang rupiah untuk rincian kas fisik (Warm Monochrome POS).
const PECAHAN = [
  { value: 100000, unit: "lbr" },
  { value: 50000, unit: "lbr" },
  { value: 20000, unit: "lbr" },
  { value: 10000, unit: "lbr" },
  { value: 5000, unit: "lbr" },
  { value: 2000, unit: "kpg" },
] as const;

const pad = (n: number) => String(n).padStart(2, "0");

function waktu(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ShiftPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [modal, setModal] = useState("");
  const [kasFisik, setKasFisik] = useState("");
  const [pecahan, setPecahan] = useState<Record<number, string>>({});
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [catatan, setCatatan] = useState("");
  const [error, setError] = useState("");
  const [closingId, setClosingId] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/shifts");
      if (!res.ok) throw new Error();
      setShifts(await res.json());
    } catch {
      setError("Gagal memuat shift.");
    }
  }
  useEffect(() => {
    load();
  }, []);

  const active = shifts.find((s) => s.status === "BUKA");

  async function buka(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modalAwal: Number(modal || 0) }),
    }).catch(() => null);
    if (!res) return setError("Tidak bisa hubungi server.");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(data.error ?? "Gagal buka shift.");
    setModal("");
    load();
  }

  async function tutup(id: string) {
    setError("");
    const res = await fetch(`/api/shifts/${id}/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kasFisik: Number(kasFisik || 0) }),
    }).catch(() => null);
    if (!res) return setError("Tidak bisa hubungi server.");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(data.error ?? "Gagal tutup shift.");
    setKasFisik("");
    setPecahan({});
    setCatatan("");
    setClosingId(null);
    load();
  }

  // --- Turunan angka (visual) ---
  const kasFisikNum = Number(kasFisik || 0);
  const selisih = active ? kasFisikNum - active.expected : 0;
  const selisihLabel = selisih === 0 ? "Pas" : selisih > 0 ? "Lebih" : "Kurang";
  const totalPecahan = PECAHAN.reduce(
    (n, p) => n + (Number(pecahan[p.value] || 0) * p.value),
    0
  );

  function setPecahanVal(value: number, val: string) {
    setPecahan((prev) => ({ ...prev, [value]: val.replace(/\D/g, "") }));
  }
  function hitungDariPecahan() {
    const total = PECAHAN.reduce(
      (n, p) => n + (Number(pecahan[p.value] || 0) * p.value),
      0
    );
    setKasFisik(String(total));
  }

  return (
    <div className="flex flex-col gap-space-lg">
      {/* ==== HEADER: status shift + buka shift ==== */}
      {!active ? (
        <section className="rounded-2xl border border-ink-200 bg-surface p-space-lg">
          <div className="flex items-center gap-space-sm border-b border-ink-200 pb-space-sm mb-space-md">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-ink-200 bg-ink-100 text-ink-950 text-[20px]">
              🔓
            </span>
            <div>
              <span className="text-caption font-caption tracking-wider text-ink-500">
                REGISTER OPERASIONAL
              </span>
              <h1 className="font-headline-sm text-headline-sm font-bold text-ink-950">
                Belum Ada Shift Buka
              </h1>
            </div>
          </div>
          <form onSubmit={buka} className="flex flex-col gap-space-md sm:flex-row sm:items-end">
            <label className="flex-1">
              <span className="mb-1.5 block font-label-md text-label-md text-ink-950">
                Modal awal laci (Rp)
              </span>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 font-numeral-lg text-numeral-lg text-ink-500">
                  Rp
                </span>
                <input
                  value={modal}
                  onChange={(e) => setModal(e.target.value.replace(/\D/g, ""))}
                  inputMode="numeric"
                  placeholder="0"
                  className="h-14 w-full rounded-xl border-2 border-ink-200 bg-surface pl-12 pr-4 font-numeral-hero text-numeral-hero tabular-nums tracking-tight text-ink-950 outline-none focus:border-ink-950"
                />
              </div>
            </label>
            <button className="h-14 rounded-xl bg-ink-950 px-6 font-label-lg text-label-lg font-bold text-surface transition-all hover:opacity-90 active:scale-[0.98]">
              BUKA SHIFT
            </button>
          </form>
        </section>
      ) : (
        <section className="flex flex-wrap items-center gap-space-sm rounded-2xl border border-ink-200 bg-surface px-space-lg py-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-ink-100 px-3 py-1 font-label-md text-label-md text-ink-950">
            <span className="h-2 w-2 rounded-full bg-ink-950 animate-pulse" />
            Shift Sedang Berjalan
          </span>
          <span className="font-caption text-caption text-ink-500">
            Dibuka {new Date(active.openedAt).toLocaleString("id-ID")} • {active.trxCount} transaksi
          </span>
        </section>
      )}

      {error && (
        <p className="rounded-xl border border-danger-bg bg-danger-bg px-4 py-3 text-body-md font-medium text-danger">
          ⚠️ {error}
        </p>
      )}

      {active && (
        <div className="grid grid-cols-1 items-start gap-space-lg lg:grid-cols-12">
          {/* ============ KOLOM KIRI: RINGKASAN PENJUALAN SHIFT ============ */}
          <section className="flex flex-col gap-space-md lg:col-span-5">
            <div className="rounded-2xl border border-ink-200 bg-surface p-space-lg">
              <div className="mb-space-md flex items-center justify-between border-b border-ink-200 pb-space-sm">
                <div>
                  <span className="font-caption text-caption tracking-wider text-ink-500">
                    REGISTER OPERASIONAL
                  </span>
                  <h2 className="font-headline-sm text-headline-sm text-ink-950">
                    Ringkasan Penjualan Shift Ini
                  </h2>
                </div>
                <span className="rounded border border-ink-200 bg-ink-100 px-2.5 py-1 font-caption text-caption text-ink-700">
                  {waktu(new Date(active.openedAt))} - Sekarang
                </span>
              </div>

              {/* Hero omzet */}
              <div className="mb-space-md rounded-xl border border-ink-200 bg-ink-100 p-space-md">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-caption text-caption text-ink-500">
                      Total Omzet Penjualan Shift
                    </p>
                    <p className="mt-0.5 font-numeral-hero text-numeral-hero tabular-nums tracking-tight text-ink-950">
                      {rupiah(active.tunai + active.qris)}
                    </p>
                  </div>
                  <span className="rounded-lg border border-ink-200 bg-surface px-2.5 py-1 font-label-md text-label-md text-ink-950">
                    {active.trxCount} Transaksi
                  </span>
                </div>
              </div>

              {/* Breakdown rows */}
              <div className="space-y-space-sm">
                <div className="flex items-center justify-between rounded-xl border border-ink-200 bg-surface p-3">
                  <div className="flex items-center gap-space-sm">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 bg-ink-100 text-ink-950 text-[16px]">
                      💵
                    </span>
                    <div>
                      <p className="font-label-md text-label-md text-ink-950">
                        Modal Awal Kas (Laci Kasir)
                      </p>
                      <p className="font-caption text-caption text-ink-500">
                        Saldo dasar saat Buka Shift
                      </p>
                    </div>
                  </div>
                  <span className="font-numeral-md text-numeral-md tabular-nums text-ink-950">
                    {rupiah(active.modalAwal)}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-ink-200 bg-surface p-3">
                  <div className="flex items-center gap-space-sm">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 bg-ink-100 text-ink-950 text-[16px]">
                      💰
                    </span>
                    <div>
                      <p className="font-label-md text-label-md text-ink-950">
                        Total Penjualan Tunai
                      </p>
                      <p className="font-caption text-caption text-ink-500">Masuk ke laci kasir</p>
                    </div>
                  </div>
                  <span className="font-numeral-md text-numeral-md tabular-nums text-ink-950">
                    + {rupiah(active.tunai)}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-ink-200 bg-surface p-3">
                  <div className="flex items-center gap-space-sm">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 bg-ink-100 text-ink-950 text-[16px]">
                      📱
                    </span>
                    <div>
                      <p className="font-label-md text-label-md text-ink-950">
                        Total QRIS / Non-Tunai
                      </p>
                      <p className="font-caption text-caption text-ink-500">Masuk ke rekening</p>
                    </div>
                  </div>
                  <span className="font-numeral-md text-numeral-md tabular-nums text-ink-700">
                    {rupiah(active.qris)}
                  </span>
                </div>

                <div className="my-space-sm border-t border-ink-200 pt-space-xs" />

                {/* Kas seharusnya — inverted black card */}
                <div className="flex items-center justify-between rounded-xl bg-ink-950 p-space-md text-surface">
                  <div>
                    <p className="font-caption text-caption text-ink-300">Target Kas Fisik di Laci</p>
                    <p className="font-headline-sm text-headline-sm font-bold text-surface">
                      Kas Seharusnya di Laci
                    </p>
                    <p className="mt-0.5 font-caption text-caption text-ink-300">
                      Modal Awal + Penjualan Tunai
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-numeral-hero text-numeral-hero tabular-nums text-surface">
                      {rupiah(active.expected)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ============ KOLOM KANAN: FORM PENGHITUNGAN KAS FISIK ============ */}
          <section className="flex flex-col gap-space-lg rounded-2xl border border-ink-200 bg-surface p-space-lg lg:col-span-7">
            <div className="flex items-start justify-between border-b border-ink-200 pb-space-sm">
              <div>
                <h2 className="font-headline-md text-headline-md text-ink-950">
                  Penghitungan Kas Fisik Laci
                </h2>
                <p className="mt-0.5 font-body-md text-body-md text-ink-500">
                  Hitung dan masukkan uang fisik aktual di laci kasir.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBreakdown((v) => !v)}
                className="flex items-center gap-1.5 rounded-lg border border-ink-200 px-3 py-1.5 font-label-md text-label-md text-ink-700 transition-colors hover:bg-ink-100 hover:text-ink-950"
              >
                🧮 {showBreakdown ? "Sembunyikan Rincian" : "Rincian Pecahan Uang"}
              </button>
            </div>

            {/* Hero input kas fisik */}
            <div>
              <label
                className="mb-1.5 block font-label-md text-label-md text-ink-950"
                htmlFor="actual-cash-input"
              >
                Total Uang Fisik Aktual di Laci (Rp)
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 font-numeral-lg text-numeral-lg text-ink-500">
                  Rp
                </span>
                <input
                  id="actual-cash-input"
                  value={kasFisik}
                  onChange={(e) => { setKasFisik(e.target.value.replace(/\D/g, "")); setClosingId(active.id); }}
                  inputMode="numeric"
                  placeholder="0"
                  className="h-14 w-full rounded-xl border-2 border-ink-950 bg-surface pl-12 pr-4 font-numeral-hero text-numeral-hero tabular-nums tracking-tight text-ink-950 outline-none focus:ring-0"
                />
              </div>
              <p className="mt-1.5 font-caption text-caption text-ink-500">
                Masukkan jumlah total rupiah aktual yang dihitung di dalam cash drawer.
              </p>
            </div>

            {/* Collapsible breakdown pecahan */}
            {showBreakdown && (
              <div className="rounded-xl border border-ink-200 bg-canvas p-space-md">
                <div className="mb-space-sm flex items-center justify-between">
                  <span className="font-label-md text-label-md text-ink-950">
                    Rincian Lembar &amp; Keping Pecahan
                  </span>
                  <span className="font-caption text-caption text-ink-500">
                    Otomatis menjumlahkan
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-space-sm sm:grid-cols-3">
                  {PECAHAN.map((p) => {
                    const count = Number(pecahan[p.value] || 0);
                    return (
                      <div key={p.value} className="rounded-lg border border-ink-200 bg-surface p-2.5">
                        <label className="mb-1 block font-caption text-caption text-ink-500">
                          {rupiah(p.value)}
                        </label>
                        <div className="flex items-center gap-1">
                          <input
                            value={pecahan[p.value] ?? ""}
                            onChange={(e) => setPecahanVal(p.value, e.target.value)}
                            inputMode="numeric"
                            placeholder="0"
                            className="h-10 w-full rounded border border-ink-200 px-2 text-right font-numeral-md text-numeral-md tabular-nums text-ink-950 outline-none focus:border-ink-950"
                          />
                          <span className="font-caption text-caption text-ink-500">{p.unit}</span>
                        </div>
                        <span className="mt-1 block text-right font-caption text-caption tabular-nums text-ink-700">
                          {rupiah(count * p.value)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={hitungDariPecahan}
                  className="mt-space-md flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-ink-200 bg-surface font-label-md text-label-md text-ink-950 transition-colors hover:bg-ink-100"
                >
                  Pakai Total Rincian {rupiah(totalPecahan)}
                </button>
              </div>
            )}

            {/* Selisih status box — label eksplisit, bukan hanya warna */}
            <div
              className={`flex items-center justify-between rounded-xl border-2 p-space-md ${
                selisih === 0
                  ? "border-ink-950 bg-ink-100"
                  : selisih > 0
                    ? "border-ink-700 bg-surface"
                    : "border-danger bg-surface"
              }`}
            >
              <div className="flex items-center gap-space-sm">
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-lg text-surface text-[20px] ${
                    selisih === 0 ? "bg-ink-950" : selisih > 0 ? "bg-ink-700" : "bg-danger"
                  }`}
                >
                  {selisih === 0 ? "✓" : selisih > 0 ? "▲" : "!"}
                </span>
                <div>
                  <p className="font-caption text-caption text-ink-500">Status Rekonsiliasi Kas</p>
                  <h3 className="font-headline-sm text-headline-sm font-bold tabular-nums text-ink-950">
                    Selisih Kas: {selisih > 0 ? "+" : ""}
                    {rupiah(selisih)} ({selisihLabel})
                  </h3>
                </div>
              </div>
              <div className="text-right">
                <span
                  className={`rounded-full px-3 py-1 font-label-md text-label-md text-surface ${
                    selisih === 0 ? "bg-ink-950" : selisih > 0 ? "bg-ink-700" : "bg-danger"
                  }`}
                >
                  {selisih === 0
                    ? "Sesuai Pembukuan"
                    : selisih > 0
                      ? "Kelebihan Uang Fisik"
                      : "Kekurangan Uang Fisik"}
                </span>
              </div>
            </div>

            {/* Catatan shift */}
            <div>
              <label
                className="mb-1 block font-label-md text-label-md text-ink-950"
                htmlFor="shift-notes"
              >
                Catatan Shift (Opsional)
              </label>
              <textarea
                id="shift-notes"
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                rows={2}
                placeholder="Catatan kasir pergantian shift (misal: stok struk kertas hampir habis, uang kembalian Rp2.000 banyak)."
                className="w-full resize-none rounded-xl border border-ink-200 bg-surface p-3 font-body-md text-body-md text-ink-950 outline-none focus:border-ink-950"
              />
            </div>

            {/* Aksi dominan */}
            <div className="flex flex-col items-center gap-space-md border-t border-ink-200 pt-space-sm sm:flex-row">
              {closingId === active.id ? (
                <>
                  <button
                    type="button"
                    onClick={() => tutup(active.id)}
                    className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-ink-950 font-label-lg text-label-lg font-bold text-surface transition-all hover:opacity-90 active:scale-[0.98] sm:flex-1"
                  >
                    🔒 KONFIRMASI &amp; TUTUP SHIFT
                  </button>
                  <button
                    type="button"
                    onClick={() => { setClosingId(null); setKasFisik(""); setPecahan({}); }}
                    className="flex h-14 w-full items-center justify-center gap-2 rounded-xl border border-ink-200 bg-surface px-6 font-label-lg text-label-lg text-ink-950 transition-all hover:bg-ink-100 active:scale-[0.98] sm:w-auto"
                  >
                    Batal
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setClosingId(active.id)}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-ink-950 font-label-lg text-label-lg font-bold text-surface transition-all hover:opacity-90 active:scale-[0.98] sm:flex-1"
                >
                  🔒 KONFIRMASI &amp; TUTUP SHIFT
                </button>
              )}
            </div>
          </section>
        </div>
      )}

      {/* ==== RIWAYAT SHIFT ==== */}
      <section className="overflow-hidden rounded-2xl border border-ink-200 bg-surface">
        <div className="border-b border-ink-200 px-space-lg py-3">
          <h2 className="font-headline-sm text-headline-sm text-ink-950">Riwayat Shift</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-body-md">
            <thead>
              <tr className="border-b border-ink-200 bg-ink-100 text-left font-caption text-caption uppercase tracking-wide text-ink-500">
                <th className="p-3">Shift</th>
                <th className="p-3 text-right">Modal</th>
                <th className="p-3 text-right">Tunai</th>
                <th className="p-3 text-right">QRIS</th>
                <th className="p-3 text-right">Seharusnya</th>
                <th className="p-3 text-right">Fisik</th>
                <th className="p-3 text-right">Selisih</th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((s) => {
                const label = s.selisih == null ? "" : s.selisih === 0 ? " (Pas)" : s.selisih > 0 ? " (Lebih)" : " (Kurang)";
                return (
                  <tr key={s.id} className="border-b border-ink-200 last:border-0 hover:bg-ink-100">
                    <td className="p-3">
                      <span className="font-mono font-bold">#{shortId(s.id)}</span>
                      <div className="font-caption text-caption text-ink-500">
                        {new Date(s.openedAt).toLocaleString("id-ID", {
                          day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                        })}
                        {" "}• {s.trxCount} trx {s.status === "BUKA" ? "• BUKA" : ""}
                      </div>
                    </td>
                    <td className="p-3 text-right tabular-nums">{rupiah(s.modalAwal)}</td>
                    <td className="p-3 text-right tabular-nums">{rupiah(s.tunai)}</td>
                    <td className="p-3 text-right tabular-nums">{rupiah(s.qris)}</td>
                    <td className="p-3 text-right font-bold tabular-nums">{rupiah(s.expected)}</td>
                    <td className="p-3 text-right tabular-nums">{s.kasFisik != null ? rupiah(s.kasFisik) : "—"}</td>
                    <td className={`p-3 text-right font-bold tabular-nums ${
                      s.selisih == null ? "" : s.selisih === 0 ? "text-success" : "text-danger"
                    }`}>
                      {s.selisih == null ? "—" : `${s.selisih > 0 ? "+" : ""}${rupiah(s.selisih)}${label}`}
                    </td>
                  </tr>
                );
              })}
              {shifts.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-ink-500">
                    Belum ada shift.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
