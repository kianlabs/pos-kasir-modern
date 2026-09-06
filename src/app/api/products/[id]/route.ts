import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
    if (!Number.isFinite(price) || price <= 0)
      return NextResponse.json({ error: "Harga harus > 0." }, { status: 400 });
    data.price = price;
  }
  if (body.stock !== undefined) {
    const stock = Number(body.stock);
    if (!Number.isInteger(stock) || stock < 0)
      return NextResponse.json({ error: "Stok harus >= 0." }, { status: 400 });
    data.stock = stock;
  }
  if (body.category !== undefined) data.category = String(body.category);

  try {
    const product = await prisma.product.update({ where: { id: params.id }, data });
    return NextResponse.json(product);
  } catch {
    return NextResponse.json({ error: "Produk tidak ditemukan." }, { status: 404 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    await prisma.product.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Produk tidak ditemukan." }, { status: 404 });
  }
}
