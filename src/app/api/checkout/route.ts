import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type CartItem = { productId: string; qty: number };

// POST /api/checkout { items, cash, payment, discount, taxPct, customerName }
// payment: CASH | QRIS | HUTANG (hutang wajib sertakan customerName)
// total = subtotal - discount + tax. Kasir shift aktif ditempel bila ada.
export async function POST(req: Request) {
  const body = await req.json();
  const rawItems = (body.items ?? []) as CartItem[];
  const cash = Number(body.cash);
  const payment = body.payment === "QRIS" ? "QRIS" : body.payment === "HUTANG" ? "HUTANG" : "CASH";
  const discount = Math.max(0, Math.floor(Number(body.discount) || 0));
  const taxPct = Math.min(100, Math.max(0, Number(body.taxPct) || 0));
  const customerName = String(body.customerName ?? "").trim();

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
  if (payment === "HUTANG" && !customerName) {
    return NextResponse.json({ error: "Nama pelanggan wajib untuk kasbon." }, { status: 400 });
  }

  try {
    const items = Array.from(merged.entries());
    const id = await prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: { id: { in: items.map(([pid]) => pid) } },
      });
      const byId = new Map(products.map((p) => [p.id, p]));

      let subtotal = 0;
      for (const [pid, qty] of items) {
        const p = byId.get(pid);
        if (!p) throw new Error("Produk tidak ditemukan.");
        if (p.stock < qty) throw new Error(`Stok ${p.name} kurang (sisa ${p.stock}).`);
        subtotal += p.price * qty;
      }

      const disc = Math.min(discount, subtotal);
      const tax = Math.round(((subtotal - disc) * taxPct) / 100);
      const total = subtotal - disc + tax;

      const paid = payment === "CASH" ? cash : payment === "QRIS" ? total : 0;
      if (payment !== "HUTANG" && paid < total) throw new Error(`Uang kurang ${total - paid}.`);

      const shift = await tx.shift.findFirst({
        where: { status: "BUKA" },
        orderBy: { openedAt: "desc" },
      });

      let customerId: string | null = null;
      if (payment === "HUTANG") {
        const found = await tx.customer.findFirst({ where: { name: customerName } });
        customerId =
          found?.id ??
          (await tx.customer.create({ data: { name: customerName } })).id;
      }

      const created = await tx.transaction.create({
        data: {
          subtotal,
          discount: disc,
          tax,
          total,
          cash: paid,
          change: payment === "HUTANG" ? 0 : paid - total,
          payment,
          shiftId: shift?.id ?? null,
          customerId,
        },
      });

      for (const [pid, qty] of items) {
        const p = byId.get(pid)!;
        await tx.transactionItem.create({
          data: { transactionId: created.id, productId: p.id, qty, price: p.price },
        });
        await tx.product.update({
          where: { id: p.id },
          data: { stock: { decrement: qty } },
        });
        await tx.stockMove.create({
          data: { productId: p.id, qty: -qty, reason: "PENJUALAN", refId: created.id },
        });
      }

      if (payment === "HUTANG" && customerId) {
        await tx.debt.create({
          data: { customerId, transactionId: created.id, total },
        });
      }

      return created.id;
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Gagal checkout.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
