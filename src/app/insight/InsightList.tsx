"use client";

import Link from "next/link";

// Daftar Insight owner (lampiran AI §5, §6) — kartu per temuan/narasi.
//
// Tipe: NARRATIVE (ringkasan tutup-shift/harian), ANOMALY ("mata owner"), dan
// CHAT_SUMMARY. Setiap kartu menampilkan badge tipe, judul, badan narasi,
// tautan sumber (angka harus bisa diverifikasi, §1.6), tombol "Tandai dibaca",
// aksi "Kirim ke WA" (enqueue ke outbox WhatsApp, §6/§12-D), dan — bila ada —
// daftar temuan rule §4 sebagai bukti angka.

export type Insight = {
  id: string;
  type: string;
  title: string;
  body: string;
  findings: string | null;
  source: string | null;
  readAt: string | null;
  createdAt: string;
};

// Status antrean kirim per kartu (dikelola pemanggil): null = belum, "sibuk" =
// sedang enqueue, "terkirim" = sudah masuk antrean WA, "gagal" = enqueue gagal.
export type StatusKirim = "sibuk" | "terkirim" | "gagal";

// Tipe Insight sinkron dengan backend (String + const union, lampiran §5).
const TIPE: Record<string, { label: string; icon: string; cls: string }> = {
  NARRATIVE: { label: "Ringkasan", icon: "📝", cls: "bg-accent-bg text-primary" },
  ANOMALY: { label: "Anomali", icon: "⚠️", cls: "bg-danger-bg text-danger" },
  CHAT_SUMMARY: { label: "Chat", icon: "💬", cls: "bg-success-bg text-tertiary" },
};

function tipeMeta(type: string) {
  return TIPE[type] ?? { label: type, icon: "✨", cls: "bg-accent-bg text-primary" };
}

function tanggalID(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// `findings` = JSON ringan temuan rule §4 (bukti angka). Parse defensif: teks
// cacat → tampilkan kosong, bukan crash.
function temuan(findings: string | null): string[] {
  if (!findings) return [];
  try {
    const parsed = JSON.parse(findings) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map((f) => (typeof f === "string" ? f : JSON.stringify(f)));
    }
    return [];
  } catch {
    return [];
  }
}

export default function InsightList({
  items,
  onRead,
  onKirim,
  statusKirim,
}: {
  items: Insight[];
  onRead: (id: string) => void;
  onKirim: (id: string) => void;
  statusKirim: Record<string, StatusKirim | undefined>;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border bg-white p-4 text-sm text-text-muted shadow-xs">
        Belum ada insight. Klik “Lihat ringkasan hari ini” untuk membuat ringkasan
        pertama, atau buka chat untuk bertanya.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((n) => {
        const meta = tipeMeta(n.type);
        const bukti = temuan(n.findings);
        return (
          <div key={n.id} className="rounded-xl border bg-white p-4 shadow-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${meta.cls}`}
              >
                {meta.icon} {meta.label}
              </span>
              <b className="text-body-sm">{n.title}</b>
              {!n.readAt && (
                <span className="rounded-full bg-danger-bg px-2 py-0.5 text-[11px] font-bold text-danger">
                  Baru
                </span>
              )}
              <span className="ml-auto text-xs text-zinc-400">{tanggalID(n.createdAt)}</span>
            </div>

            <p className="mt-3 whitespace-pre-wrap text-body-sm">{n.body}</p>

            {bukti.length > 0 && (
              <ul className="mt-2 list-disc rounded-lg bg-neutral p-3 pl-7 text-xs text-text-muted">
                {bukti.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-2">
              {!n.readAt && (
                <button
                  type="button"
                  onClick={() => onRead(n.id)}
                  className="rounded-lg border px-3.5 py-1.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-50"
                >
                  Tandai dibaca
                </button>
              )}
              <button
                type="button"
                onClick={() => onKirim(n.id)}
                disabled={statusKirim[n.id] === "sibuk"}
                className="rounded-lg border px-3.5 py-1.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {statusKirim[n.id] === "sibuk" ? "Mengantre…" : "📤 Kirim ke WA"}
              </button>
              {statusKirim[n.id] === "terkirim" && (
                <span role="status" className="text-sm font-semibold text-tertiary">
                  ✓ Terkirim ke antrean WA
                </span>
              )}
              {statusKirim[n.id] === "gagal" && (
                <span role="status" className="text-sm font-semibold text-danger">
                  Gagal mengantre. Coba lagi.
                </span>
              )}
              {n.source && (
                <Link
                  href={n.source}
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  Lihat sumber angka →
                </Link>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
