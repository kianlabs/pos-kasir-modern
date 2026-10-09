import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { readJson } from "@/server/http";
import { catat } from "@/server/audit";
import { currentWarungId, currentKasirId, requireOwnerResponse } from "@/server/tenant";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

// PATCH /api/products/[id] → owner-only (ubah harga/Stok/katalog).
export async function PATCH(req: Request, { params }: Params) {
  const denied = await requireOwnerResponse();
  if (denied) return denied;

  const warungId = await currentWarungId();
  const kasirId = await currentKasirId(warungId);

  const body = await readJson(req);
  if (!body) return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });
  const data: { name?: string; price?: number; stock?: number; category?: string; icon?: string } = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: "Nama kosong." }, { status: 400 });
    data.name = name;
  }
  if (body.price !== undefined) {
    const price = Number(body.price);
    if (!Number.isInteger(price) || price <= 0)
      return NextResponse.json({ error: "Harga harus > 0." }, { status: 400 });
    data.price = price;
  }
  if (body.stock !== undefined) {
    const stock = Number(body.stock);
    if (!Number.isInteger(stock) || stock < 0)
      return NextResponse.json({ error: "Stok harus >= 0." }, { status: 400 });
    data.stock = stock;
  }
  if (body.category !== undefined) {
    data.category = String(body.category).trim() || "Umum";
  }
  if (body.icon !== undefined) {
    data.icon = String(body.icon).trim().slice(0, 16);
  }

  try {
    const before = await prisma.product.findFirst({
      where: { id: params.id, warungId },
    });
    if (!before) return NextResponse.json({ error: "Produk tidak ditemukan." }, { status: 404 });

    const product = await prisma.product.update({
      where: { id: params.id },
      data,
    });
    // Catat selisih stok sebagai KOREKSI (kulakan manual lewat +/- juga masuk sini)
    if (data.stock !== undefined && data.stock !== before.stock) {
      await prisma.stockMove.create({
        data: {
          warungId,
          productId: product.id,
          qty: data.stock - before.stock,
          type: data.stock > before.stock ? "KULAKAN" : "KOREKSI",
          createdBy: kasirId,
        },
      });
    }
    // Audit mutasi penting (lampiran skema §2 aturan #10) — angka ringkas saja.
    if (data.price !== undefined && data.price !== before.price) {
      await catat({
        warungId,
        userId: kasirId,
        action: "PRICE_CHANGE",
        meta: { before: before.price, after: data.price },
      });
    }
    if (data.stock !== undefined && data.stock !== before.stock) {
      await catat({
        warungId,
        userId: kasirId,
        action: "STOCK_KOREKSI",
        meta: { before: before.stock, after: data.stock },
      });
    }
    return NextResponse.json(product);
  } catch {
    return NextResponse.json({ error: "Produk tidak ditemukan." }, { status: 404 });
  }
}

// DELETE /api/products/[id] → owner-only.
export async function DELETE(_req: Request, { params }: Params) {
  const denied = await requireOwnerResponse();
  if (denied) return denied;

  const warungId = await currentWarungId();
  const kasirId = await currentKasirId(warungId);

  const used = await prisma.transactionItem.count({
    where: { productId: params.id, warungId },
  });
  if (used > 0) {
    return NextResponse.json(
      { error: "Produk sudah ada di riwayat penjualan, tidak bisa dihapus. Habiskan stoknya saja." },
      { status: 400 }
    );
  }
  try {
    const before = await prisma.product.findFirst({
      where: { id: params.id, warungId },
    });
    if (!before) return NextResponse.json({ error: "Produk tidak ditemukan." }, { status: 404 });

    await prisma.product.delete({ where: { id: params.id } });
    await catat({
      warungId,
      userId: kasirId,
      action: "DELETE_PRODUCT",
      meta: { name: before.name },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Produk tidak ditemukan." }, { status: 404 });
  }
}
