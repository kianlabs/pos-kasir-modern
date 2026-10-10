import { describe, expect, it } from "vitest";
import {
  clampTaxPct,
  hitungUang,
  seimbangkanKeTotal,
} from "@/shared/hitung-uang";

// Test unit MURNI untuk sumber kebenaran rumus uang (src/shared/hitung-uang.ts).
//
// Tujuan: mengunci rumus kanonik setelah konsolidasi m5, supaya refactor
// (atau perubahan masa depan) tak diam-diam mengubah angka uang. Tidak
// menyentuh DB — murni matematika integer rupiah.

describe("clampTaxPct", () => {
  it("loloskan nilai dalam rentang", () => {
    expect(clampTaxPct(10)).toBe(10);
    expect(clampTaxPct(0)).toBe(0);
    expect(clampTaxPct(100)).toBe(100);
  });

  it("clamp di atas 100", () => {
    expect(clampTaxPct(150)).toBe(100);
    expect(clampTaxPct(101)).toBe(100);
  });

  it("clamp di bawah 0", () => {
    expect(clampTaxPct(-5)).toBe(0);
    expect(clampTaxPct(-0.5)).toBe(0);
  });
});

describe("hitungUang — rumus kanonik", () => {
  it("pajak aktif: round((subtotal - disc) * pct / 100)", () => {
    const r = hitungUang({ subtotal: 10000, discount: 0, taxEnabled: true, taxPct: 10 });
    expect(r.subtotal).toBe(10000);
    expect(r.discount).toBe(0);
    expect(r.tax).toBe(1000);
    expect(r.total).toBe(11000);
  });

  it("pajak nonaktif: tax 0, total = subtotal - disc", () => {
    const r = hitungUang({ subtotal: 10000, discount: 0, taxEnabled: false, taxPct: 10 });
    expect(r.tax).toBe(0);
    expect(r.total).toBe(10000);
  });

  it("diskon dihitung setelah dikurangi, pajak dari subtotal-diskon", () => {
    const r = hitungUang({ subtotal: 10000, discount: 2000, taxEnabled: true, taxPct: 10 });
    expect(r.discount).toBe(2000);
    expect(r.tax).toBe(800); // round((10000-2000)*10/100)
    expect(r.total).toBe(8800);
  });

  it("diskon > subtotal di-clamp ke subtotal → total = tax saja", () => {
    const r = hitungUang({ subtotal: 5000, discount: 9999, taxEnabled: true, taxPct: 10 });
    expect(r.discount).toBe(5000);
    expect(r.tax).toBe(0);
    expect(r.total).toBe(0);
  });

  it("diskon 0 → sama seperti tanpa diskon", () => {
    const r = hitungUang({ subtotal: 12345, discount: 0, taxEnabled: true, taxPct: 11 });
    expect(r.discount).toBe(0);
    expect(r.tax).toBe(Math.round((12345 * 11) / 100));
    expect(r.total).toBe(12345 + r.tax);
  });

  it("pct 0 → pajak 0, total = subtotal - disc", () => {
    const r = hitungUang({ subtotal: 10000, discount: 1000, taxEnabled: true, taxPct: 0 });
    expect(r.tax).toBe(0);
    expect(r.total).toBe(9000);
  });

  it("pembulatan: subtotal 9999 pct 10 → integer eksak", () => {
    const r = hitungUang({ subtotal: 9999, discount: 0, taxEnabled: true, taxPct: 10 });
    expect(r.tax).toBe(1000); // round(999.9) = 1000
    expect(Number.isInteger(r.tax)).toBe(true);
    expect(r.total).toBe(10999);
  });

  it("pembulatan .5 ke atas (Math.round)", () => {
    // 150 * 11 / 100 = 16.5 → 17
    const r = hitungUang({ subtotal: 150, discount: 0, taxEnabled: true, taxPct: 11 });
    expect(r.tax).toBe(17);
  });

  it("subtotal 0 / keranjang kosong → semua 0", () => {
    const r = hitungUang({ subtotal: 0, discount: 0, taxEnabled: true, taxPct: 10 });
    expect(r).toEqual({ subtotal: 0, discount: 0, tax: 0, total: 0 });
  });

  it("discountMax membatasi klamp diskon (jalur sync)", () => {
    const r = hitungUang({
      subtotal: 10000,
      discount: 500000,
      discountMax: 1000,
      taxEnabled: false,
      taxPct: 10,
    });
    expect(r.discount).toBe(1000);
    expect(r.total).toBe(9000);
  });
});

describe("seimbangkanKeTotal — jalur sync offline", () => {
  const kasus = [
    { subtotal: 10000, discountIn: 0, tax0: 1000, total: 11000 },
    { subtotal: 10000, discountIn: 2000, tax0: 800, total: 8800 },
    { subtotal: 9999, discountIn: 0, tax0: 1000, total: 10950 }, // total client beda bulat
    { subtotal: 5000, discountIn: 9999, tax0: 0, total: 0 },
    { subtotal: 12345, discountIn: 1000, tax0: 1234, total: 12500 },
  ];

  it.each(kasus)(
    "invarian subtotal - discount + tax === total ($subtotal/$discountIn/$total)",
    ({ subtotal, discountIn, tax0, total }) => {
      const { discount, tax } = seimbangkanKeTotal({ subtotal, discountIn, tax0, total });
      expect(subtotal - discount + tax).toBe(total);
    }
  );

  it("diskon tersimpan tak pernah < niat kasir, tak pernah > subtotal", () => {
    const { discount, tax } = seimbangkanKeTotal({
      subtotal: 10000,
      discountIn: 2000,
      tax0: 800,
      total: 8800,
    });
    expect(discount).toBe(2000);
    expect(tax).toBe(800);
  });

  it("menyerap selisih ke diskon (bukan pajak) bila total client lebih rendah", () => {
    // total client 10500 < normal 11000 → diskon naik ke 500 menyerap selisih;
    // pajak tetap sama dengan acuan (tax0 = 1000). Invarian tetap eksak.
    const { discount, tax } = seimbangkanKeTotal({
      subtotal: 10000,
      discountIn: 0,
      tax0: 1000,
      total: 10500,
    });
    expect(discount).toBe(500);
    expect(tax).toBe(1000);
    expect(10000 - discount + tax).toBe(10500);
  });

  it("total client > normal → diskon turun ke 0 dulu sebelum pajak negatif", () => {
    // total client 11200 > normal 11000: diskon tak bisa < 0, jadi pajak menyerap.
    const { discount, tax } = seimbangkanKeTotal({
      subtotal: 10000,
      discountIn: 0,
      tax0: 1000,
      total: 11200,
    });
    expect(discount).toBe(0);
    expect(tax).toBe(1200);
    expect(10000 - discount + tax).toBe(11200);
  });
});
