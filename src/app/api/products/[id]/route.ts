import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

export async function PATCH(req: Request, { params }: Params) {
  const body = await req.json();
  const data: { name?: string; price?: number; stock?: number; category?: string } = {};
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

  try {
    const before = await prisma.product.findUnique({ where: { id: params.id } });
    if (!before) return NextResponse.json({ error: "Produk tidak ditemukan." }, { status: 404 });
    const product = await prisma.product.update({ where: { id: params.id }, data });
    // Catat selisih stok sebagai KOREKSI (kulakan manual lewat +/- juga masuk sini)
    if (data.stock !== undefined && data.stock !== before.stock) {
      await prisma.stockMove.create({
        data: {
          productId: product.id,
          qty: data.stock - before.stock,
          reason: data.stock > before.stock ? "KULAKAN" : "KOREKSI",
        },
      });
    }
    return NextResponse.json(product);
  } catch {
    return NextResponse.json({ error: "Produk tidak ditemukan." }, { status: 404 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const used = await prisma.transactionItem.count({
    where: { productId: params.id },
  });
  if (used > 0) {
    return NextResponse.json(
      { error: "Produk sudah ada di riwayat penjualan, tidak bisa dihapus. Habiskan stoknya saja." },
      { status: 400 }
    );
  }
  try {
    await prisma.product.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Produk tidak ditemukan." }, { status: 404 });
  }
}
