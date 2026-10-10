import { NextResponse } from "next/server";
import { readJson } from "@/server/http";
import { currentWarungId, currentKasirId, getSession } from "@/server/tenant";
import { handleApiError } from "@/server/api-error";
import { evaluatePromo } from "@/server/promo";
import type { PromoItem } from "@/shared/promo-types";

export const dynamic = "force-dynamic";

// POST /api/promo/evaluate
// Body: { items: { productId, qty }[], jam? }
//
// Dipakai KASIR saat jualan (read-only, tanpa mutasi) — boleh owner & kasir.
// Server memuat promo aktif + harga produk MILIK TENANT (dari session),
// menghitung subtotal DARI HARGA SERVER (jangan percaya subtotal client),
// lalu mengembalikan { diskon, dipakai[] }. Diskon ini dipakai kasir sebagai
// nilai `discount` di checkout — jalur uang kanonik tidak diubah.
export async function POST(req: Request) {
  try {
    // Hanya user yang login (gate 401 bila belum). Evaluasi aman untuk dua role.
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Belum login." }, { status: 401 });
    }
    const warungId = await currentWarungId();
    // Pastikan user memang aktif & berada di warung session (cegah token basi).
    await currentKasirId(warungId);

    const body = await readJson(req);
    if (!body) return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });

    const rawItems = Array.isArray(body.items) ? body.items : [];
    const items: PromoItem[] = [];
    for (const it of rawItems) {
      if (!it || typeof it !== "object") continue;
      const rec = it as Record<string, unknown>;
      const productId = typeof rec.productId === "string" ? rec.productId : "";
      const qty = Number(rec.qty);
      if (!productId || !Number.isInteger(qty) || qty <= 0) continue;
      items.push({ productId, qty });
    }

    // jam opsional "HH:MM" (WIB) — bila tak ada, server pakai jam WIB saat ini.
    const jam = typeof body.jam === "string" ? body.jam : undefined;

    const hasil = await evaluatePromo({ warungId, items, subtotal: 0, jam });
    return NextResponse.json(hasil);
  } catch (e) {
    return handleApiError(e);
  }
}
