"use client";

import { useRef, type ChangeEvent } from "react";

// Input uang rupiah dengan pemisah ribuan otomatis (titik) yang REACT-SAFE.
//
// Nilai yang dipakai aplikasi tetap DIGIT MENTAH (mis. "10000"), bukan
// "10.000" — supaya semua perhitungan & penyimpanan tidak berubah. Yang
// diformat hanya tampilan; onChange mengembalikan digit saja.
//
// Kenapa caret dijaga manual? Saat user mengetik di tengah angka, nilai berubah
// dari "1.000" → "10.000"; tanpa koreksi posisi kursor akan melompat ke akhir.
// Kita hitung ulang posisi berdasarkan jumlah digit di kiri caret.
//
// Catatan penting: `inputMode="numeric"` + pemisah titik. Di iOS angka desimal
// menampilkan keyboard berbeda — di sini kita murni bilangan bulat rupiah, jadi
// tetap numeric.
type Props = {
  /** Nilai digit mentah, mis. "10000" (boleh "" bila kosong). */
  value: string;
  /** Terima digit mentah (sudah dibersihkan dari non-digit). */
  onValueChange: (digits: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  "aria-label"?: string;
  /** Awalan tetap di dalam input (mis. "Rp"). Opsional. */
  prefix?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  /** Batas panjang digit (default 15 — cukup untuk ratusan triliun). */
  maxDigits?: number;
};

/** "10000" → "10.000" (pemisah titik ribuan, gaya Indonesia). */
export function formatRibuan(digits: string): string {
  if (!digits) return "";
  // Hilangkan leading zero berlebih (mis. "007" → "7") tapi sisakan satu "0".
  const bersih = digits.replace(/^0+(?=\d)/, "");
  return bersih.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Ambil hanya digit dari sebuah string. */
export function hanyaDigit(s: string): string {
  return s.replace(/\D/g, "");
}

export default function MoneyInput({
  value,
  onValueChange,
  placeholder,
  className,
  id,
  prefix,
  autoFocus,
  disabled,
  maxDigits = 15,
  ...aria
}: Props) {
  const ref = useRef<HTMLInputElement>(null);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const el = e.target;
    const caret = el.selectionStart ?? el.value.length;
    // Jumlah digit di kiri caret (acuan posisi kursor setelah reformat).
    const digitKiri = hanyaDigit(el.value.slice(0, caret)).length;

    const digits = hanyaDigit(el.value).slice(0, maxDigits);
    onValueChange(digits);

    // Reformat + kembalikan caret ke posisi logis (setelah digit ke-N).
    const formatted = formatRibuan(digits);
    requestAnimationFrame(() => {
      const input = ref.current;
      if (!input) return;
      let pos = 0;
      let terlihat = 0;
      // Cari indeks karakter di `formatted` yang jatuh setelah `digitKiri` digit.
      while (pos < formatted.length && terlihat < digitKiri) {
        if (/\d/.test(formatted[pos])) terlihat++;
        pos++;
      }
      input.setSelectionRange(pos, pos);
    });
  }

  return (
    <div className="relative">
      {prefix && (
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-numeral-lg text-numeral-lg text-ink-500">
          {prefix}
        </span>
      )}
      <input
        ref={ref}
        id={id}
        value={formatRibuan(value)}
        onChange={handleChange}
        inputMode="numeric"
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        aria-label={aria["aria-label"]}
        className={`${prefix ? "pl-12" : ""} ${className ?? ""}`}
      />
    </div>
  );
}
