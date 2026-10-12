"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Layers, MessageCircle, Tag, Wallet, X, Sparkles } from "lucide-react";

// Menu interaksi melayang (floating action button) untuk LANDING page publik.
// Satu tombol bulat yang mengembang jadi daftar aksi:
//   • Chat WhatsApp (kontak owner/penjual)
//   • Lompat ke seksi (Fitur / Harga / Cara mulai)
//   • Kembali ke atas
//
// Ringan & aksesibel: tanpa dependensi, animasi CSS murni, hormati
// prefers-reduced-motion, tutup dengan Esc / klik luar, dan label aria lengkap.
// Tombol "ke atas" baru muncul setelah menggulir sedikit agar tak mengganggu.

const WA_NUMBER = "6281318679190";
const WA_TEXT = encodeURIComponent("Halo, saya mau tanya soal KRING! kasir warung.");

const SECTION_LINKS = [
  { id: "highlights", label: "Unggulan", icon: Sparkles },
  { id: "fitur", label: "Fitur", icon: Sparkles },
  { id: "harga", label: "Harga", icon: Tag },
  { id: "cara", label: "Cara mulai", icon: Layers },
] as const;

export default function LandingFAB() {
  const [open, setOpen] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Tampilkan tombol "ke atas" setelah menggulir melewati hero.
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Tutup menu saat Esc / klik di luar.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  function jumpTo(id: string) {
    setOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.history.replaceState(null, "", `#${id}`);
    }
  }

  function keAtas() {
    setOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div
      ref={wrapRef}
      className="fixed bottom-5 right-4 z-40 flex flex-col items-end gap-2.5 sm:bottom-7 sm:right-7 print:hidden"
    >
      {/* Panel aksi (muncul saat terbuka) */}
      {open && (
        <div
          role="menu"
          aria-label="Menu interaksi"
          className="flex flex-col items-end gap-2.5"
        >
          {SECTION_LINKS.map((s) => (
            <FabItem
              key={s.id}
              onClick={() => jumpTo(s.id)}
              icon={<s.icon className="h-[18px] w-[18px]" />}
              label={s.label}
            />
          ))}
          <a
            role="menuitem"
            href={`https://wa.me/${WA_NUMBER}?text=${WA_TEXT}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="group flex items-center gap-2.5 rounded-full border border-ink-200 bg-surface py-2 pl-4 pr-2 shadow-lg transition-all hover:border-ink-950 active:scale-[0.97]"
          >
            <span className="font-label-md text-label-md text-ink-950">Tanya via WhatsApp</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-success-bg text-success">
              <MessageCircle className="h-[18px] w-[18px]" />
            </span>
          </a>
        </div>
      )}

      {/* Tombol "ke atas" — muncul saat sudah menggulir */}
      {showTop && !open && (
        <button
          type="button"
          onClick={keAtas}
          aria-label="Kembali ke atas"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-ink-200 bg-surface text-ink-700 shadow-lg transition-all hover:border-ink-950 hover:text-ink-950 active:scale-[0.95]"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      )}

      {/* Tombol utama (toggle) */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={open ? "Tutup menu interaksi" : "Buka menu interaksi"}
        className={`flex h-14 w-14 items-center justify-center rounded-full bg-ink-950 text-surface shadow-[0_8px_24px_rgba(0,0,0,0.28)] transition-all hover:bg-black active:scale-[0.95] ${
          open ? "rotate-90" : "rotate-0"
        }`}
      >
        {open ? <X className="h-6 w-6" /> : <Wallet className="h-6 w-6" />}
      </button>
    </div>
  );
}

function FabItem({
  onClick,
  icon,
  label,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="group flex items-center gap-2.5 rounded-full border border-ink-200 bg-surface py-2 pl-4 pr-2 shadow-lg transition-all hover:border-ink-950 active:scale-[0.97]"
    >
      <span className="font-label-md text-label-md text-ink-950">{label}</span>
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-100 text-ink-700 transition-colors group-hover:bg-ink-950 group-hover:text-surface">
        {icon}
      </span>
    </button>
  );
}
