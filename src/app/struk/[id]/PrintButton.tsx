"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex-1 rounded border py-2 font-sans font-bold"
    >
      Cetak
    </button>
  );
}
