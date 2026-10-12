"use client";

import Link from "next/link";
import { ArrowLeft, MessageSquare } from "lucide-react";
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
          className="inline-flex items-center gap-1 text-body-sm text-label-lg text-ink-950 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali ke Insight
        </Link>
        <h1 className="mt-1 flex items-center gap-2 text-headline-md text-ink-950">
          <MessageSquare className="h-5 w-5" /> Tanya Insight
        </h1>
        <p className="mt-0.5 text-body-sm text-ink-500">
          Tanya tentang omzet, tren, produk terlaris, stok, kasir, atau anomali —
          jawaban memakai data warung Anda sendiri.
        </p>
      </div>

      <ChatPanel />
    </div>
  );
}
