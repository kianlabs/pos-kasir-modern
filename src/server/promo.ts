import { prisma } from "@/server/db";
import type {
  CartCtx,
  EvaluateInput,
  EvaluateResult,
  Promo,
  PromoDipakai,
  PromoItem,
  PromoTipe,
} from "@/shared/promo-types";
import { dalamJam, jamWIB, PROMO_TIPE } from "@/shared/promo-types";

// ── Promo engine (Fase 2 §7a) — KALKULATOR + KATALOG, BUKAN jalur uang ──────
//
// Alur: kasir memanggil /api/promo/evaluate → server menghitung diskon promo
// (integer rupiah, cap <= subtotal) → kasir mengirim (diskon manual + diskon
// promo) lewat field `discount` yang SUDAH ADA di checkout. Dengan begitu
// `prosesCheckout` & `hitungUang` tidak perlu diubah: invarian
// `subtotal - discount + tax === total` tetap satu-satunya sumber kebenaran.
//
// KEPUTUSAN STACKING: SATU promo terbaik saja (diskon terbesar). Alasan:
// (1) prediktabel buat kasir & owner — tak ada promo yang "diam-diam" saling
//     mengubah; (2) mustahil menghasilkan total negatif dari perkalian promo
//     bertumpuk; (3) sederhana untuk dijelaskan di struk. Bila diskon sama,
//     promo pertama menang (urut DB) — deterministik.

/** Benar bila `tipe` adalah salah satu tipe promo yang dikenal. */
export function isPromoTipe(v: unknown): v is PromoTipe {
  return typeof v === "string" && (PROMO_TIPE as readonly string[]).includes(v);
}

/**
 * Hitung diskon SATU promo atas satu keranjang (MURNI — tanpa DB).
 *
 * Kontrak: selalu mengembalikan integer rupiah >= 0, dan TIDAK PERNAH melebihi
 * `ctx.subtotal`. Bila promo tidak berlaku (nonaktif, di bawah minSubtotal,
 * di luar jam untuk HAPPY_HOUR, atau tipe tak dikenal) → 0.
 *
 * Semua tipe integer rupiah. BELI_1_GRATIS_1 butuh `ctx.prices` (harga server).
 */
export function hitungPromo(promo: Pick<Promo, "tipe" | "nilai" | "minSubtotal" | "jamMulai" | "jamSelesai" | "aktif">, items: PromoItem[], ctx: CartCtx): number {
  if (!promo.aktif) return 0;
  if (!Number.isInteger(promo.nilai) && promo.tipe !== "BELI_1_GRATIS_1") return 0;
  const subtotal = Math.max(0, Math.floor(ctx.subtotal) || 0);
  if (subtotal <= 0) return 0;
  // Syarat minimum subtotal berlaku semua tipe.
  if (subtotal < Math.max(0, Math.floor(promo.minSubtotal) || 0)) return 0;

  const nilai = Math.max(0, Math.floor(promo.nilai) || 0);
  let diskon = 0;

  switch (promo.tipe) {
    case "PERSEN": {
      // floor(subtotal * persen/100) — jangan memihak pelanggan dengan ceil.
      const pct = Math.min(100, nilai);
      diskon = Math.floor((subtotal * pct) / 100);
      break;
    }
    case "NOMINAL": {
      diskon = nilai;
      break;
    }
    case "BELI_1_GRATIS_1": {
      // Kelompokkan qty per produk; tiap kelipatan 2 → 1 gratis (floor(qty/2)).
      // Diskon = Σ (qtyGratis × harga produk). Harga dari peta server.
      const perProduk = new Map<string, number>();
      for (const it of items) {
        if (!it || typeof it.productId !== "string" || !it.productId) continue;
        if (!Number.isInteger(it.qty) || it.qty <= 0) continue;
        perProduk.set(it.productId, (perProduk.get(it.productId) ?? 0) + it.qty);
      }
      let total = 0;
      for (const [pid, qty] of perProduk) {
        const gratis = Math.floor(qty / 2);
        if (gratis <= 0) continue;
        const harga = ctx.prices.get(pid) ?? 0;
        if (harga > 0) total += gratis * harga;
      }
      diskon = total;
      break;
    }
    case "HAPPY_HOUR": {
      // Diskon jam sepi: hanya berlaku bila jam evaluasi (WIB) di dalam jendela.
      // Bentuk potongan mengikuti `nilai`: >100 dianggap NOMINAL (rupiah),
      // <=100 dianggap PERSEN — sesuai janji schema (nilai = persen ATAU rupiah).
      const jam = ctx.jam ?? jamWIB();
      if (!dalamJam(jam, promo.jamMulai, promo.jamSelesai)) return 0;
      if (nilai > 100) {
        diskon = nilai; // nominal rupiah
      } else {
        diskon = Math.floor((subtotal * nilai) / 100); // persen
      }
      break;
    }
    default:
      return 0;
  }

  // Cap: tak boleh melebihi subtotal, tak boleh negatif.
  return Math.max(0, Math.min(diskon, subtotal));
}

/** Deskripsi singkat alasan promo dipakai (untuk struk/UI kasir). */
function alasanPromo(promo: Pick<Promo, "tipe" | "nilai">, diskon: number): string {
  switch (promo.tipe) {
    case "PERSEN":
      return `Diskon ${promo.nilai}%`;
    case "NOMINAL":
      return "Potongan rupiah";
    case "BELI_1_GRATIS_1":
      return "Beli 1 gratis 1";
    case "HAPPY_HOUR":
      return "Diskon jam sepi (happy hour)";
    default:
      return `Promo Rp${diskon}`;
  }
}

/**
 * Evaluasi kumpulan promo (MURNI) — pilih SATU yang memberi diskon TERBESAR.
 *
 * Tidak menyentuh DB: pemanggil menyediakan daftar promo (sudah ter-scope
 * tenant & aktif) + daftar item + ctx. Bila tak ada yang cocok → diskon 0.
 */
export function pilihPromoTerbaik(promos: Promo[], items: PromoItem[], ctx: CartCtx): EvaluateResult {
  let terbaik: { promo: Promo; diskon: number } | null = null;
  for (const promo of promos) {
    const diskon = hitungPromo(promo, items, ctx);
    if (diskon <= 0) continue;
    if (!terbaik || diskon > terbaik.diskon) {
      terbaik = { promo, diskon };
    }
  }
  if (!terbaik) return { diskon: 0, dipakai: [] };

  const dipakai: PromoDipakai = {
    promoId: terbaik.promo.id,
    kode: terbaik.promo.kode,
    nama: terbaik.promo.nama,
    alasan: alasanPromo(terbaik.promo, terbaik.diskon),
  };
  return { diskon: terbaik.diskon, dipakai: [dipakai] };
}

/**
 * Muat promo aktif tenant + harga produk (ter-scope warungId dari session),
 * hitung subtotal DARI HARGA SERVER (jangan percaya subtotal client), lalu
 * jalankan `pilihPromoTerbaik`. Read-only — aman dipanggil kasir saat jualan.
 */
export async function evaluatePromo(input: EvaluateInput): Promise<EvaluateResult> {
  const warungId = input.warungId;

  // Gabung item duplikat + validasi bentuk (qty integer > 0).
  const merged = new Map<string, number>();
  for (const it of input.items ?? []) {
    if (!it || typeof it.productId !== "string" || !it.productId) continue;
    if (!Number.isInteger(it.qty) || it.qty <= 0) continue;
    merged.set(it.productId, (merged.get(it.productId) ?? 0) + it.qty);
  }
  if (merged.size === 0) return { diskon: 0, dipakai: [] };

  const productIds = Array.from(merged.keys());
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, warungId },
    select: { id: true, price: true },
  });
  const prices = new Map(products.map((p) => [p.id, p.price]));

  // Subtotal OTORITATIF dari harga server — item yang tak dikenal produknya
  // (mis. milik tenant lain) diabaikan; tidak ada produk → tak ada promo.
  let subtotal = 0;
  const items: PromoItem[] = [];
  for (const [pid, qty] of merged) {
    const harga = prices.get(pid);
    if (harga === undefined) continue;
    subtotal += harga * qty;
    items.push({ productId: pid, qty });
  }
  if (items.length === 0 || subtotal <= 0) return { diskon: 0, dipakai: [] };

  const promosRaw = await prisma.promo.findMany({
    where: { warungId, aktif: true },
    orderBy: { createdAt: "asc" },
  });
  // Saring tipe tak dikenal (pertahanan terhadap data lama/liar) + rapatkan bentuk.
  const promos: Promo[] = promosRaw
    .filter((p) => isPromoTipe(p.tipe))
    .map((p) => ({
      id: p.id,
      kode: p.kode,
      nama: p.nama,
      tipe: p.tipe as PromoTipe,
      nilai: p.nilai,
      minSubtotal: p.minSubtotal,
      jamMulai: p.jamMulai,
      jamSelesai: p.jamSelesai,
      aktif: p.aktif,
    }));

  const ctx: CartCtx = { subtotal, prices, jam: input.jam ?? jamWIB() };
  return pilihPromoTerbaik(promos, items, ctx);
}
