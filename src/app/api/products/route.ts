import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/request";

export const dynamic = "force-dynamic";

export async function GET() {
  const products = await prisma.product.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(products);
}

export async function POST(req: Request) {
  const body = await readJson(req);
  if (!body) return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });
  const name = String(body.name ?? "").trim();
  const price = Number(body.price);
  const stock = Number(body.stock ?? 0);
  const category = String(body.category ?? "Umum").trim() || "Umum";

  if (!name || !Number.isInteger(price) || price <= 0) {
    return NextResponse.json(
      { error: "Nama dan harga (>0) wajib diisi." },
      { status: 400 }
    );
  }
  if (!Number.isInteger(stock) || stock < 0) {
    return NextResponse.json({ error: "Stok harus bilangan >= 0." }, { status: 400 });
  }

  const product = await prisma.product.create({
    data: { name, price, stock, category },
  });
  if (stock > 0) {
    await prisma.stockMove.create({
      data: { productId: product.id, qty: stock, reason: "STOK_AWAL" },
    });
  }
  return NextResponse.json(product, { status: 201 });
}
