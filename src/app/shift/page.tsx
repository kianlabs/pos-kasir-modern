"use client";

import { useEffect, useState } from "react";
import { rupiah } from "@/lib/rupiah";
import { shortId } from "@/lib/meta";

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

export default function ShiftPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [modal, setModal] = useState("");
  const [kasFisik, setKasFisik] = useState("");
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
    setClosingId(null);
    load();
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Shift Kasir</h1>

      {active ? (
        <div className="mb-5 rounded-xl border border-orange-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
              ● SHIFT BUKA
            </span>
            <span className="text-sm text-zinc-500">
              sejak {new Date(active.openedAt).toLocaleString("id-ID")}
            </span>
            <span className="ml-auto text-sm">
              Modal <b>{rupiah(active.modalAwal)}</b> • Tunai masuk <b>{rupiah(active.tunai)}</b> •{" "}
              Seharusnya <b className="text-orange-700">{rupiah(active.expected)}</b>
            </span>
          </div>
          {closingId === active.id ? (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                value={kasFisik}
                onChange={(e) => setKasFisik(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                placeholder="Hitung kas fisik di laci…"
                className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:border-orange-500"
              />
              <button onClick={() => tutup(active.id)}
                className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-bold text-white hover:bg-zinc-700">
                Tutup shift
              </button>
              <button onClick={() => setClosingId(null)}
                className="rounded-lg border px-4 py-2 text-sm font-bold hover:bg-zinc-50">
                Batal
              </button>
            </div>
          ) : (
            <button onClick={() => setClosingId(active.id)}
              className="mt-3 rounded-lg bg-zinc-900 px-5 py-2 text-sm font-bold text-white hover:bg-zinc-700">
              Tutup shift…
            </button>
          )}
        </div>
      ) : (
        <form onSubmit={buka} className="mb-5 flex flex-col gap-2 rounded-xl border bg-white p-4 shadow-sm sm:flex-row sm:items-center">
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-500">
            ○ TIDAK ADA SHIFT BUKA
          </span>
          <input
            value={modal}
            onChange={(e) => setModal(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            placeholder="Modal awal laci (Rp)…"
            className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:border-orange-500"
          />
          <button className="rounded-lg bg-orange-600 px-5 py-2 text-sm font-bold text-white hover:bg-orange-700">
            Buka shift
          </button>
        </form>
      )}

      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">⚠️ {error}</p>}

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
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
              {shifts.map((s) => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-zinc-50">
                  <td className="p-3">
                    <span className="font-mono font-bold">#{shortId(s.id)}</span>
                    <div className="text-xs text-zinc-500">
                      {new Date(s.openedAt).toLocaleString("id-ID", {
                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                      {" "}• {s.trxCount} trx {s.status === "BUKA" ? "• BUKA" : ""}
                    </div>
                  </td>
                  <td className="p-3 text-right">{rupiah(s.modalAwal)}</td>
                  <td className="p-3 text-right">{rupiah(s.tunai)}</td>
                  <td className="p-3 text-right">{rupiah(s.qris)}</td>
                  <td className="p-3 text-right font-bold">{rupiah(s.expected)}</td>
                  <td className="p-3 text-right">{s.kasFisik != null ? rupiah(s.kasFisik) : "—"}</td>
                  <td className={`p-3 text-right font-bold ${
                    s.selisih == null ? "" : s.selisih === 0 ? "text-green-700" : "text-red-600"
                  }`}>
                    {s.selisih == null ? "—" : `${s.selisih > 0 ? "+" : ""}${rupiah(s.selisih)}`}
                  </td>
                </tr>
              ))}
              {shifts.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-zinc-500">Belum ada shift.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
