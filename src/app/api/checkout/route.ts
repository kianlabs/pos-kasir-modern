import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type CartItem = { productId: string; qty: number };

// POST /api/checkout { items, cash, payment }
// Validasi stok, kurangi stok atomik, simpan transaksi + snapshot harga.
export async function POST(req: Request) {
  const body = await req.json();
  const items = (body.items ?? []) as CartItem[];
  const cash = Number(body.cash);
  const payment = body.payment === "QRIS" ? "QRIS" : "CASH";

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Keranjang kosong." }, { status: 400 });
  }
  if (payment === "CASH" && (!Number.isFinite(cash) || cash < 0)) {
    return NextResponse.json({ error: "Nominal tunai tidak valid." }, { status: 400 });
  }

  const ids = items.map((i) => i.productId);
  const products = await prisma.product.findMany({ where: { id: { in: ids } } });
  const byId = new Map(products.map((p) => [p.id, p]));

  let total = 0;
  for (const item of items) {
    const p = byId.get(item.productId);
    if (!p) return NextResponse.json({ error: "Produk tidak ditemukan." }, { status: 400 });
    if (!Number.isInteger(item.qty) || item.qty <= 0)
      return NextResponse.json({ error: `Qty ${p.name} tidak valid.` }, { status: 400 });
    if (p.stock < item.qty)
      return NextResponse.json({ error: `Stok ${p.name} kurang (sisa ${p.stock}).` }, { status: 400 });
    total += p.price * item.qty;
  }

  const paid = payment === "QRIS" ? total : cash;
  if (paid < total) {
    return NextResponse.json({ error: `Uang kurang ${total - paid}.` }, { status: 400 });
  }

  const trx = await prisma.$transaction(async (tx) => {
    const created = await tx.transaction.create({
      data: { total, cash: paid, change: paid - total, payment },
    });
    for (const item of items) {
      const p = byId.get(item.productId)!;
      await tx.transactionItem.create({
        data: { transactionId: created.id, productId: p.id, qty: item.qty, price: p.price },
      });
      await tx.product.update({
        where: { id: p.id },
        data: { stock: { decrement: item.qty } },
      });
    }
    return tx.transaction.findUnique({
      where: { id: created.id },
      include: { items: { include: { product: true } } },
    });
  });

  return NextResponse.json(trx, { status: 201 });
}
