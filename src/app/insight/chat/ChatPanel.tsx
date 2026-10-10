"use client";

import { useEffect, useRef, useState } from "react";

// Chat owner "KRING! Insight" (lampiran AI §6, §8, §9).
//
// Mengirim POST /api/ai/chat lalu membaca SSE token-per-token lewat
// fetch+ReadableStream (bukan EventSource: endpoint ini POST, bukan GET).
// Format stream = `data: <json>\n\n`; delta = potongan teks, event terakhir
// `{ done, tool, degradasi }`. Gating 403 (plan gratis/AI mati) dan 429
// (rate limit) ditampilkan sebagai pesan ramah, bukan crash (§9).

const CONTOH = [
  "Bagaimana omzet hari ini?",
  "Tren penjualan 7 hari terakhir?",
  "Produk apa yang paling laris?",
  "Stok apa yang menipis?",
  "Bagaimana performa tiap kasir?",
  "Ada anomali atau transaksi mencurigakan?",
];

const PESAN_OFFLINE = "Fitur Insight butuh internet. Sambungkan perangkat lalu coba lagi.";

type Pesan = { role: "user" | "assistant"; content: string; degradasi?: boolean; tool?: string | null };

// Label ramah untuk tool backend (lampiran §3) — ditampilkan sebagai badge
// kecil agar owner tahu angka diambil dari mana.
const TOOL_LABEL: Record<string, string> = {
  getRingkasanHari: "ringkasan hari",
  getRekapShift: "rekap shift",
  getStokMenipis: "stok menipis",
  getPenjualanProduk: "produk terlaris",
  getPenjualanKasir: "performa kasir",
  getTren: "tren penjualan",
  getAnomaliAktif: "anomali",
};

export default function ChatPanel() {
  const [pesan, setPesan] = useState<Pesan[]>([]);
  const [input, setInput] = useState("");
  const [mengirim, setMengirim] = useState(false);
  const [online, setOnline] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const riwayatRef = useRef<Pesan[]>([]);
  const areaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    areaRef.current?.scrollTo({ top: areaRef.current.scrollHeight, behavior: "smooth" });
  }, [pesan]);

  // Kirim pertanyaan, baca SSE, tambahkan token ke pesan assistant terakhir.
  async function kirim(teks: string) {
    const pertanyaan = teks.trim();
    if (!pertanyaan || mengirim) return;
    setGalat(null);
    setInput("");
    setMengirim(true);

    // Riwayat dikirim sebagai { role, content } (dipangkas backend ke 6 turn).
    const riwayat = riwayatRef.current.map((p) => ({ role: p.role, content: p.content }));
    const pesanUser: Pesan = { role: "user", content: pertanyaan };
    setPesan((prev) => [...prev, pesanUser, { role: "assistant", content: "" }]);

    try {
      const r = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pertanyaan, riwayat }),
      });

      if (!r.ok || !r.body) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        const msg =
          r.status === 403
            ? j.error ?? "Fitur ini hanya untuk plan berbayar."
            : r.status === 429
              ? j.error ?? "Terlalu banyak pertanyaan. Coba lagi sebentar lagi."
              : "Layanan Insight sedang gangguan — coba lagi.";
        setGalat(msg);
        setPesan((prev) => prev.slice(0, -1));
        return;
      }

      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let jawaban = "";
      let degradasi = false;
      let tool: string | null = null;

      // Baca stream; proses tiap baris `data:` lengkap yang berakhir newline.
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const baris = buffer.split("\n");
        buffer = baris.pop() ?? "";

        for (const b of baris) {
          const line = b.trim();
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          try {
            const ev = JSON.parse(payload) as {
              delta?: string;
              done?: boolean;
              tool?: string | null;
              degradasi?: boolean;
            };
            if (ev.delta) {
              jawaban += ev.delta;
              const isi = jawaban;
              setPesan((prev) => {
                const next = [...prev];
                next[next.length - 1] = { role: "assistant", content: isi };
                return next;
              });
            }
            if (ev.done) {
              degradasi = Boolean(ev.degradasi);
              tool = ev.tool ?? null;
            }
          } catch {
            // Baris SSE cacat — lewati, jangan gagalkan seluruh stream.
          }
        }
      }

      // Finalkan metadata (degradasi/tool) ke pesan assistant terakhir.
      setPesan((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", content: jawaban, degradasi, tool };
        return next;
      });
      riwayatRef.current = [
        ...riwayatRef.current,
        pesanUser,
        { role: "assistant", content: jawaban },
      ];
    } catch {
      setGalat("Gagal menghubungi layanan. Periksa koneksi lalu coba lagi.");
      setPesan((prev) => prev.slice(0, -1));
    } finally {
      setMengirim(false);
    }
  }

  if (!online) {
    return (
      <p className="rounded-2xl border border-ink-300 bg-ink-100 p-4 text-body-sm text-ink-700">
        📶 {PESAN_OFFLINE}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {pesan.length === 0 && (
        <div className="rounded-2xl border border-ink-200 bg-surface p-4">
          <p className="text-body-sm text-ink-500">
            Tanyakan apa saja tentang warung Anda. Contoh:
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {CONTOH.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => kirim(c)}
                className="rounded-full border border-ink-200 bg-ink-100 px-3 py-1.5 text-body-sm text-ink-700 hover:bg-ink-200"
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      <div
        ref={areaRef}
        aria-live="polite"
        aria-label="Percakapan dengan Insight"
        className="nice-scroll flex max-h-[55vh] flex-col gap-3 overflow-y-auto"
      >
        {pesan.map((p, i) =>
          p.role === "user" ? (
            <div key={i} className="self-end rounded-2xl bg-ink-950 px-4 py-2 text-body-sm text-surface">
              {p.content}
            </div>
          ) : (
            <div key={i} className="self-start rounded-2xl border border-ink-200 bg-surface px-4 py-2">
              <p className="whitespace-pre-wrap text-body-sm text-ink-700">{p.content || "…"}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {p.tool && TOOL_LABEL[p.tool] && (
                  <span className="rounded-full bg-ink-100 px-2 py-0.5 text-caption text-ink-700">
                    sumber: {TOOL_LABEL[p.tool]}
                  </span>
                )}
                {p.degradasi && (
                  <span className="rounded-full bg-ink-100 px-2 py-0.5 text-caption text-ink-700">
                    mode offline angka
                  </span>
                )}
              </div>
            </div>
          )
        )}
      </div>

      {galat && (
        <p
          role="status"
          className="rounded-2xl border border-ink-300 bg-ink-100 p-3 text-body-sm text-ink-700"
        >
          {galat}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          kirim(input);
        }}
        className="flex items-end gap-2"
      >
        <label htmlFor="pertanyaan-insight" className="sr-only">
          Pertanyaan untuk Insight
        </label>
        <textarea
          id="pertanyaan-insight"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              kirim(input);
            }
          }}
          rows={2}
          maxLength={300}
          placeholder="Contoh: stok apa yang menipis hari ini?"
          className="flex-1 resize-none rounded-2xl border border-ink-200 bg-surface px-3 py-2 text-body-sm text-ink-950 outline-none focus:border-ink-950"
        />
        <button
          type="submit"
          disabled={mengirim || !input.trim()}
          className="rounded-xl bg-ink-950 px-4 py-2 text-label-lg text-surface hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {mengirim ? "…" : "Kirim"}
        </button>
      </form>
    </div>
  );
}
