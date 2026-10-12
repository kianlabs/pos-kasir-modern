"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Loader2 } from "lucide-react";

// Tombol "Tambah Meja" (owner-only). Membuka panel kecil dengan pilihan cepat
// (tambah 1/5/10 meja ber-nomor otomatis) atau nomor kustom (mis. "A1").
// Setelah sukses → router.refresh() agar peta meja (server component) memuat
// ulang daftar terbaru tanpa reload penuh.
export default function TambahMejaButton() {
  const router = useRouter();
  const [buka, setBuka] = useState(false);
  const [nomor, setNomor] = useState("");
  const [loading, setLoading] = useState(false);
  const [pesan, setPesan] = useState("");

  async function kirim(payload: { nomor?: string; jumlah?: number }) {
    setLoading(true);
    setPesan("");
    try {
      const res = await fetch("/api/meja", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPesan(data.error ?? "Gagal menambah meja.");
        return;
      }
      setNomor("");
      setBuka(false);
      router.refresh();
    } catch {
      setPesan("Tidak bisa menghubungi server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setBuka((v) => !v);
          setPesan("");
        }}
        className="flex h-12 shrink-0 items-center gap-2 rounded-xl border border-ink-950 bg-ink-950 px-4 text-label-md text-surface transition-all hover:opacity-90 active:scale-[0.98]"
      >
        <Plus className="h-4 w-4" />
        Tambah Meja
      </button>

      {buka && (
        <div className="absolute right-0 z-30 mt-2 w-72 rounded-2xl border border-ink-200 bg-surface p-4 shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-headline-sm text-ink-950">Tambah Meja</h3>
            <button
              type="button"
              onClick={() => setBuka(false)}
              aria-label="Tutup"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink-950"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="mb-2 text-caption text-ink-500">Tambah cepat (nomor otomatis)</p>
          <div className="mb-4 grid grid-cols-3 gap-2">
            {[1, 5, 10].map((n) => (
              <button
                key={n}
                type="button"
                disabled={loading}
                onClick={() => kirim({ jumlah: n })}
                className="h-11 rounded-xl border border-ink-200 bg-surface text-label-md text-ink-950 transition-all hover:border-ink-950 hover:bg-ink-100 active:scale-[0.98] disabled:opacity-40"
              >
                +{n}
              </button>
            ))}
          </div>

          <p className="mb-1.5 text-caption text-ink-500">Atau nomor khusus (mis. A1)</p>
          <div className="flex gap-2">
            <input
              value={nomor}
              onChange={(e) => setNomor(e.target.value)}
              placeholder="A1"
              maxLength={20}
              className="h-11 min-w-0 flex-1 rounded-xl border border-ink-200 bg-surface px-3 text-body-sm text-ink-950 outline-none focus:border-ink-950"
            />
            <button
              type="button"
              disabled={loading || !nomor.trim()}
              onClick={() => kirim({ nomor: nomor.trim() })}
              className="flex h-11 items-center gap-1.5 rounded-xl border border-ink-950 bg-ink-950 px-4 text-label-md text-surface transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Tambah"}
            </button>
          </div>

          {pesan && <p className="mt-3 text-caption text-danger">{pesan}</p>}
        </div>
      )}
    </div>
  );
}
