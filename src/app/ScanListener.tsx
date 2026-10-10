"use client";

import { useEffect, useRef, useState } from "react";

// Mode barcode scanner (PRD §7a: "input keyboard wedge").
//
// Barcode scanner USB/Bluetooth bekerja seperti KEYBOARD: ia "mengetikkan"
// deretan digit lalu menekan Enter. Karena itu kita TIDAK memakai input khusus,
// melainkan mendengarkan keydown di window dan mengenali POLA scanner:
//   - beberapa karakter berangka berturut-turut, masing-masing berjarak sangat
//     cepat (< AMBANG_JEDA_MS), lalu
//   - diakhiri tekan Enter.
// Manusia mengetik jauh lebih lambat dan jarang diakhiri Enter → tidak terpicu.
//
// Batasan: skema Product TIDAK punya kolom barcode khusus (lihat prisma/schema).
// Jadi kode hasil scan dicocokkan ke id produk dulu, lalu ke nama produk (tanpa
// beda huruf besar/kecil). Warung yang ingin barcode sungguhan bisa menamai
// produknya sesuai angka barcode, atau menyisipkan barcode sebagai id (UUID)
// bila encoder mendukung. Fungsi cocok di sini memusatkan aturan tsb.

const AMBANG_JEDA_MS = 50; // jeda antar-tombol di atas ini → anggap bukan scanner
const PANJANG_MIN = 3; // minimal digit agar tidak salah picu dari ketikan singkat
const PANJANG_MAKS = 64; // batas aman untuk mencegah buffer tak terbatas

type ScanListenerProps = {
  /** Dipanggil saat sebuah kode scanner selesai (diakhiri Enter). */
  onScan: (code: string) => void;
};

export default function ScanListener({ onScan }: ScanListenerProps) {
  const bufferRef = useRef("");
  const waktuRef = useRef(0);
  const [kodeTerakhir, setKodeTerakhir] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Abaikan saat mengetik di input/textarea/contenteditable agar pencarian
      // & nominal bayar tetap normal — KECUALI polanya jelas ala scanner
      // (digit cepat berturut + Enter). Kita izinkan kata kunci angka lewat,
      // tapi tetap batasi dengan ambang waktu di bawah.
      const el = document.activeElement as HTMLElement | null;
      const diInput =
        !!el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable);

      const now = Date.now();
      const jeda = now - waktuRef.current;
      waktuRef.current = now;

      // Jeda terlalu lama → anggap buffer sebelumnya bukan scanner, reset.
      if (jeda > AMBANG_JEDA_MS) bufferRef.current = "";

      if (e.key === "Enter") {
        const kode = bufferRef.current;
        bufferRef.current = "";
        // Hanya picu bila panjangnya masuk akal (bukan Enter biasa/edit form).
        if (kode.length >= PANJANG_MIN && kode.length <= PANJANG_MAKS) {
          // Cegah Enter memicu submit/default saat kita menangani scan.
          e.preventDefault();
          onScan(kode);
          setKodeTerakhir(kode);
          return;
        }
        return;
      }

      // Kumpulkan HANYA karakter tunggal (digit/alfanumerik) — abaikan Shift,
      // Ctrl, panah, Tab, dsb. Scanner mengetik digit; sebagian model mengirim
      // huruf/kode produk. Kita terima alfanumerik tunggal.
      if (e.key.length !== 1) {
        // Tombol non-karakter (Shift, Alt, dsb) tidak mereset buffer, tapi
        // jangan ikut mengumpulkannya. Tanda jeda tetap diperbarui di atas.
        return;
      }

      // Kalau fokus sedang di input dan jeda LAMBAT (ketikan manusia), jangan
      // ganggu — buffer tetap dibangun tapi akan direset oleh jeda besar tadi.
      if (diInput && jeda > AMBANG_JEDA_MS / 2) {
        bufferRef.current = "";
        return;
      }

      bufferRef.current = (bufferRef.current + e.key).slice(-PANJANG_MAKS);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onScan]);

  // Indikator halus (pointer-events-none) — bukan kontrol, sekadar status.
  return (
    <span
      aria-live="polite"
      className="pointer-events-none select-none text-[11px] font-medium text-zinc-400"
    >
      {kodeTerakhir ? `🔍 terakhir: ${kodeTerakhir}` : "🔍 scanner siap"}
    </span>
  );
}
