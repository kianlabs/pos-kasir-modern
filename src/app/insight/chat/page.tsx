"use client";

import Link from "next/link";
import ChatPanel from "./ChatPanel";

// Halaman chat owner "KRING! Insight" (lampiran AI §6, §11).
//
// Owner-only: nav menyembunyikan tautan, proxy mengalihkan kasir ke "/?denied=1",
// dan POST /api/ai/chat menolak kasir/plan gratis dengan 403.
export default function InsightChatPage() {
  return (
    <div>
      <div className="mb-4">
        <Link
          href="/insight"
          className="text-sm font-semibold text-primary hover:underline"
        >
          ← Kembali ke Insight
        </Link>
        <h1 className="mt-1 text-xl font-bold">💬 Tanya Insight</h1>
        <p className="mt-0.5 text-sm text-text-muted">
          Tanya tentang omzet, tren, produk terlaris, stok, kasir, atau anomali —
          jawaban memakai data warung Anda sendiri.
        </p>
      </div>

      <ChatPanel />
    </div>
  );
}
