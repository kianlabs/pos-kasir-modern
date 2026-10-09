import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTaxSetting } from "@/lib/settings";
import { readJson } from "@/lib/request";
import { currentWarungId, currentKasirId } from "@/lib/warung";
import {
  prosesCheckout,
  isUniqueConstraintError,
  type CheckoutLine,
} from "@/lib/offline/sync";

export const dynamic = "force-dynamic";

// POST /api/checkout { items, cash, payment, discount, mejaId?, id?, dibuatOffline? }
// payment: CASH | QRIS. total = subtotal - discount + pajak otomatis.
// Pajak diambil dari pengaturan warung (bukan input kasir).
//
// IDEMPOTENCY (Tahap 4): `id` (UUID) OPSIONAL dari client. Bila dikirim DAN
// transaksi dengan id itu sudah ada untuk warung ini → kembalikan yang ada
// (200) TANPA decrement stok lagi. Inti idempotency ada di prosesCheckout()
// (dipakai bersama endpoint /api/sync).
export async function POST(req: Request) {
  const warungId = await currentWarungId();
  const cashierId = await currentKasirId(warungId);

  const body = await readJson(req);
  if (!body) return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });

  const rawItems = (body.items ?? []) as CheckoutLine[];
  const cash = Number(body.cash);
  const payment = body.payment === "QRIS" ? "QRIS" : "CASH";
  const discount = Math.max(0, Math.floor(Number(body.discount) || 0));
  // Meja OPSIONAL (jalur "bayar langsung di meja"). Ini bukan tenant key —
  // warungId tetap dari session (aturan #8); mejaId tetap divalidasi milik warung.
  const mejaId = typeof body.mejaId === "string" && body.mejaId ? body.mejaId : null;
  // id: UUID dari client (offline/retry). Harus string non-kosong bila ada.
  const id = typeof body.id === "string" && body.id ? body.id : null;
  const dibuatOffline = body.dibuatOffline === true;

  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return NextResponse.json({ error: "Keranjang kosong." }, { status: 400 });
  }
  if (payment === "CASH" && (!Number.isInteger(cash) || cash < 0)) {
    return NextResponse.json({ error: "Nominal tunai tidak valid." }, { status: 400 });
  }
  if (payment === "CASH" && cash > 1000000000) {
    return NextResponse.json({ error: "Nominal tunai di luar batas wajar." }, { status: 400 });
  }

  // Fast-path idempotent: id sudah ada → kembalikan tanpa membuka tx tulis.
  if (id) {
    const existing = await prisma.transaction.findUnique({
      where: { id },
      select: { id: true, warungId: true },
    });
    if (existing) {
      if (existing.warungId !== warungId) {
        return NextResponse.json({ error: "Transaksi tidak ditemukan." }, { status: 404 });
      }
      return NextResponse.json({ id: existing.id }, { status: 200 });
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const taxCfg = await getTaxSetting(tx, warungId);
      return prosesCheckout(tx, {
        id,
        warungId,
        cashierId,
        items: rawItems,
        cash,
        payment,
        discount,
        mejaId,
        dibuatOffline,
        createdAt: null,
        taxCfg,
        allowStokMinus: false, // jalur online: stok kurang ditolak
      });
    });

    return NextResponse.json({ id: result.id }, { status: result.sudahAda ? 200 : 201 });
  } catch (e) {
    // Balapan id (dua request id sama nyaris bersamaan): id sudah tercipta di
    // request lain → kembalikan yang ada (tetap idempotent), bukan error.
    if (isUniqueConstraintError(e) && id) {
      return NextResponse.json({ id }, { status: 200 });
    }
    const message = e instanceof Error ? e.message : "Gagal checkout.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
