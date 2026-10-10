"use client";

import { useEffect, useState } from "react";
import { rupiah } from "@/shared/rupiah";
import { PROMO_TIPE, type PromoTipe } from "@/shared/promo-types";

// Halaman owner: CRUD promo (Fase 2 §7a) — beli 1 gratis 1, happy hour, voucher.
// Mirror struktur src/app/produk/page.tsx (list + form + toggle + hapus).
type Promo = {
  id: string;
  kode: string | null;
  nama: string;
  tipe: PromoTipe;
  nilai: number;
  minSubtotal: number;
  jamMulai: string | null;
  jamSelesai: string | null;
  aktif: boolean;
};

// Label Indonesia per tipe + nilai default form.
const TIPE_LABEL: Record<PromoTipe, string> = {
  PERSEN: "Diskon persen (%)",
  NOMINAL: "Potongan rupiah",
  BELI_1_GRATIS_1: "Beli 1 gratis 1",
  HAPPY_HOUR: "Diskon jam sepi (happy hour)",
};

const EMPTY = {
  nama: "",
  kode: "",
  tipe: "PERSEN" as PromoTipe,
  nilai: "",
  minSubtotal: "",
  jamMulai: "14:00",
  jamSelesai: "17:00",
};

// Ringkas nilai promo untuk kolom tabel.
function ringkasNilai(p: Promo): string {
  switch (p.tipe) {
    case "PERSEN":
      return `${p.nilai}%`;
    case "NOMINAL":
      return rupiah(p.nilai);
    case "BELI_1_GRATIS_1":
      return "Gratis 1 tiap 2";
    case "HAPPY_HOUR":
      return p.nilai > 100 ? rupiah(p.nilai) : `${p.nilai}%`;
    default:
      return String(p.nilai);
  }
}

export default function PromoPage() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      const res = await fetch("/api/promo");
      if (!res.ok) throw new Error();
      setPromos(await res.json());
    } catch {
      setError("Gagal memuat promo.");
    }
  }
  useEffect(() => {
    load();
  }, []);

  function startEdit(p: Promo) {
    setEditingId(p.id);
    setForm({
      nama: p.nama,
      kode: p.kode ?? "",
      tipe: p.tipe,
      nilai: String(p.nilai),
      minSubtotal: String(p.minSubtotal),
      jamMulai: p.jamMulai ?? "14:00",
      jamSelesai: p.jamSelesai ?? "17:00",
    });
    setError("");
  }
  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY);
    setError("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const payload = {
      nama: form.nama,
      kode: form.kode,
      tipe: form.tipe,
      nilai: form.tipe === "BELI_1_GRATIS_1" ? 0 : Number(form.nilai || 0),
      minSubtotal: Number(form.minSubtotal || 0),
      jamMulai: form.tipe === "HAPPY_HOUR" ? form.jamMulai : null,
      jamSelesai: form.tipe === "HAPPY_HOUR" ? form.jamSelesai : null,
    };
    const res = await fetch(editingId ? `/api/promo/${editingId}` : "/api/promo", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => null);
    if (!res) return setError("Tidak bisa hubungi server.");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(data.error ?? "Gagal menyimpan.");
    cancelEdit();
    load();
  }

  async function toggleAktif(p: Promo) {
    const res = await fetch(`/api/promo/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aktif: !p.aktif }),
    }).catch(() => null);
    if (!res || !res.ok) return setError("Gagal mengubah status promo.");
    load();
  }

  async function hapus(id: string, nama: string) {
    if (!confirm(`Hapus promo "${nama}"?`)) return;
    const res = await fetch(`/api/promo/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Gagal menghapus.");
      return;
    }
    load();
  }

  const nilaiLabel =
    form.tipe === "PERSEN"
      ? "Persen (%)"
      : form.tipe === "NOMINAL"
        ? "Nominal (Rp)"
        : form.tipe === "HAPPY_HOUR"
          ? "Nilai (% bila ≤100, Rp bila >100)"
          : "— (otomatis)";

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="text-headline-md text-ink-950">Promo</h1>
        <span className="ml-auto rounded-xl border border-ink-200 bg-surface px-3 py-1.5 text-label-md text-ink-700">
          <b className="tabular-nums text-ink-950">{promos.filter((p) => p.aktif).length}</b> aktif /{" "}
          <b className="tabular-nums text-ink-950">{promos.length}</b> total
        </span>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[320px_1fr]">
        <form onSubmit={submit} className="rounded-2xl border border-ink-200 bg-surface p-4">
          <h2 className="mb-3 text-headline-sm text-ink-950">{editingId ? "✏️ Edit promo" : "➕ Tambah promo"}</h2>
          <label className="mb-1 block text-caption text-ink-500">Nama</label>
          <input
            value={form.nama}
            onChange={(e) => setForm({ ...form, nama: e.target.value })}
            placeholder="mis. Happy Hour Sore"
            className="mb-2 w-full rounded-xl border border-ink-200 bg-surface px-3 py-2 text-body-sm text-ink-950 outline-none focus:border-ink-950"
          />
          <label className="mb-1 block text-caption text-ink-500">Tipe</label>
          <select
            value={form.tipe}
            onChange={(e) => setForm({ ...form, tipe: e.target.value as PromoTipe })}
            className="mb-2 w-full rounded-xl border border-ink-200 bg-surface px-3 py-2 text-body-sm text-ink-950 outline-none focus:border-ink-950"
          >
            {PROMO_TIPE.map((t) => (
              <option key={t} value={t}>
                {TIPE_LABEL[t]}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-caption text-ink-500">{nilaiLabel}</label>
              <input
                value={form.tipe === "BELI_1_GRATIS_1" ? "" : form.nilai}
                disabled={form.tipe === "BELI_1_GRATIS_1"}
                onChange={(e) => setForm({ ...form, nilai: e.target.value.replace(/\D/g, "") })}
                placeholder="10"
                inputMode="numeric"
                className="mb-2 w-full rounded-xl border border-ink-200 bg-surface px-3 py-2 text-body-sm tabular-nums text-ink-950 outline-none focus:border-ink-950 disabled:bg-ink-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-caption text-ink-500">Min. subtotal (Rp)</label>
              <input
                value={form.minSubtotal}
                onChange={(e) => setForm({ ...form, minSubtotal: e.target.value.replace(/\D/g, "") })}
                placeholder="0"
                inputMode="numeric"
                className="mb-2 w-full rounded-xl border border-ink-200 bg-surface px-3 py-2 text-body-sm tabular-nums text-ink-950 outline-none focus:border-ink-950"
              />
            </div>
          </div>
          {form.tipe === "HAPPY_HOUR" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-caption text-ink-500">Jam mulai</label>
                <input
                  type="time"
                  value={form.jamMulai}
                  onChange={(e) => setForm({ ...form, jamMulai: e.target.value })}
                  className="mb-2 w-full rounded-xl border border-ink-200 bg-surface px-3 py-2 text-body-sm text-ink-950 outline-none focus:border-ink-950"
                />
              </div>
              <div>
                <label className="mb-1 block text-caption text-ink-500">Jam selesai</label>
                <input
                  type="time"
                  value={form.jamSelesai}
                  onChange={(e) => setForm({ ...form, jamSelesai: e.target.value })}
                  className="mb-2 w-full rounded-xl border border-ink-200 bg-surface px-3 py-2 text-body-sm text-ink-950 outline-none focus:border-ink-950"
                />
              </div>
            </div>
          )}
          <label className="mb-1 block text-caption text-ink-500">Kode voucher (opsional)</label>
          <input
            value={form.kode}
            onChange={(e) => setForm({ ...form, kode: e.target.value })}
            placeholder="mis. HEMAT10"
            className="mb-2 w-full rounded-xl border border-ink-200 bg-surface px-3 py-2 text-body-sm text-ink-950 outline-none focus:border-ink-950"
          />
          {error && <p className="mb-2 text-body-sm text-danger">⚠️ {error}</p>}
          <div className="flex gap-2">
            <button className="flex-1 rounded-xl bg-ink-950 py-2 text-label-lg text-surface hover:opacity-90">
              {editingId ? "Simpan" : "Tambah"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-xl border border-ink-200 px-4 py-2 text-label-lg text-ink-950 hover:bg-ink-100"
              >
                Batal
              </button>
            )}
          </div>
        </form>

        <div className="overflow-hidden rounded-2xl border border-ink-200 bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-body-sm">
              <thead>
                <tr className="border-b border-ink-200 bg-ink-100 text-left text-caption uppercase tracking-wide text-ink-500">
                  <th className="p-3">Promo</th>
                  <th className="p-3">Tipe</th>
                  <th className="p-3 text-right">Nilai</th>
                  <th className="p-3 text-right">Min. belanja</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {promos.map((p) => (
                  <tr
                    key={p.id}
                    className={`border-b border-ink-200 last:border-0 hover:bg-ink-100 ${editingId === p.id ? "bg-ink-100" : ""}`}
                  >
                    <td className="p-3">
                      <div className="text-label-lg text-ink-950">{p.nama}</div>
                      {p.kode && (
                        <span className="rounded-full bg-ink-100 px-2 py-0.5 text-caption text-ink-700">
                          🎟️ {p.kode}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-caption text-ink-700">
                        {TIPE_LABEL[p.tipe]}
                      </span>
                      {p.tipe === "HAPPY_HOUR" && p.jamMulai && p.jamSelesai && (
                        <div className="mt-1 text-caption tabular-nums text-ink-500">
                          {p.jamMulai}–{p.jamSelesai}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-right text-label-lg tabular-nums text-ink-950">{ringkasNilai(p)}</td>
                    <td className="p-3 text-right tabular-nums text-ink-700">{p.minSubtotal > 0 ? rupiah(p.minSubtotal) : "—"}</td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => toggleAktif(p)}
                        className={`rounded-full px-3 py-1 text-caption ${
                          p.aktif ? "bg-ink-950 text-surface" : "bg-ink-100 text-ink-500"
                        }`}
                      >
                        {p.aktif ? "Aktif" : "Nonaktif"}
                      </button>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => startEdit(p)}
                        className="mr-3 text-label-lg text-ink-950 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => hapus(p.id, p.nama)}
                        className="text-label-lg text-danger hover:underline"
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
                {promos.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-ink-500">
                      Belum ada promo.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
