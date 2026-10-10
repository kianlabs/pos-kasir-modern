"use client";

import { useEffect, useState } from "react";

// Mode kios fullscreen (PRD §7a: "Mode kios fullscreen") — untuk tablet kasir
// yang hanya menampilkan halaman kasir tanpa menu navigasi.
//
// Cara kerja:
//   - Menambah/menghapus kelas `kios-mode` pada <body>; CSS di globals.css
//     menyembunyikan sidebar, topbar, dan bottom-nav saat kelas ini aktif.
//   - Minta Fullscreen API bila tersedia; gagal/tak didukung → tetap aktif
//     (hanya menyembunyikan chrome, tanpa fullscreen browser).
//   - Pilihan disimpan di localStorage agar bertahan setelah reload.

const KUNCI_SIMPAN = "kring-kios-mode";

export default function KiosToggle() {
  const [kios, setKios] = useState(false);

  // Hidrasi dari localStorage saat mount. Dipisah dari efek kelas agar kelas
  // <body> ikut terpasang pada reload (localStorage tidak tersedia saat SSR).
  useEffect(() => {
    setKios(localStorage.getItem(KUNCI_SIMPAN) === "1");
  }, []);

  // Sinkronkan kelas <body> + fullscreen tiap kali status berubah.
  useEffect(() => {
    document.body.classList.toggle("kios-mode", kios);

    const fs = document.fullscreenElement;
    if (kios && !fs) {
      // Fullscreen bisa ditolak browser (butuh gesture pengguna) — kita abaikan,
      // karena menyembunyikan chrome tetap berfungsi walau fullscreen gagal.
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else if (!kios && fs) {
      document.exitFullscreen?.().catch(() => {});
    }

    localStorage.setItem(KUNCI_SIMPAN, kios ? "1" : "0");
  }, [kios]);

  return (
    <button
      type="button"
      onClick={() => setKios((v) => !v)}
      aria-pressed={kios}
      aria-label={kios ? "Keluar dari mode kios" : "Masuk mode kios fullscreen"}
      title={kios ? "Keluar mode kios" : "Mode kios fullscreen"}
      className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
        kios
          ? "border-primary bg-primary text-white hover:bg-primary-hover"
          : "border-ink-300 bg-surface text-ink-700 hover:bg-ink-100"
      }`}
    >
      {kios ? "🖥️ Keluar kios" : "🖥️ Mode kios"}
    </button>
  );
}
