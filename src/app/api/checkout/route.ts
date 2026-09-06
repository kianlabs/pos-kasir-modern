import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type CartItem = { productId: string; qty: number };

// POST /api/checkout { items, cash, payment }
// Gabung duplikat, validasi + potong stok atomik di dalam transaksi DB.
export async function POST(req: Request) {
  const body = await req.json();
  const rawItems = (body.items ?? []) as CartItem[];
  const cash = Number(body.cash);
  const payment = body.payment === "QRIS" ? "QRIS" : "CASH";

  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return NextResponse.json({ error: "Keranjang kosong." }, { status: 400 });
  }

  // Gabung item duplikat per productId
  const merged = new Map<string, number>();
  for (const item of rawItems) {
    if (typeof item.productId !== "string" || !Number.isInteger(item.qty) || item.qty <= 0) {
      return NextResponse.json({ error: "Item keranjang tidak valid." }, { status: 400 });
    }
    merged.set(item.productId, (merged.get(item.productId) ?? 0) + item.qty);
  }

  if (payment === "CASH" && (!Number.isInteger(cash) || cash < 0)) {
    return NextResponse.json({ error: "Nominal tunai tidak valid." }, { status: 400 });
  }

  try {
    const items = Array.from(merged.entries());
    const trx = await prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: { id: { in: items.map(([id]) => id) } },
      });
      const byId = new Map(products.map((p) => [p.id, p]));

      let total = 0;
      for (const [id, qty] of items) {
        const p = byId.get(id);
        if (!p) throw new Error("Produk tidak ditemukan.");
        if (p.stock < qty) throw new Error(`Stok ${p.name} kurang (sisa ${p.stock}).`);
        total += p.price * qty;
      }

      const paid = payment === "QRIS" ? total : cash;
      if (paid < total) throw new Error(`Uang kurang ${total - paid}.`);

      const created = await tx.transaction.create({
        data: { total, cash: paid, change: paid - total, payment },
      });
      for (const [id, qty] of items) {
        const p = byId.get(id)!;
        await tx.transactionItem.create({
          data: { transactionId: created.id, productId: p.id, qty, price: p.price },
        });
        await tx.product.update({
          where: { id: p.id },
          data: { stock: { decrement: qty } },
        });
      }
      return created.id;
    });

    return NextResponse.json({ id: trx }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Gagal checkout.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
