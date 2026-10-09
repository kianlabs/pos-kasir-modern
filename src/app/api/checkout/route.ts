import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTaxSetting } from "@/lib/settings";
import { readJson } from "@/lib/request";
import { currentWarungId, currentKasirId } from "@/lib/warung";

export const dynamic = "force-dynamic";

type CartItem = { productId: string; qty: number };

// POST /api/checkout { items, cash, payment, discount }
// payment: CASH | QRIS. total = subtotal - discount + pajak otomatis.
// Pajak diambil dari pengaturan warung (bukan input kasir).
export async function POST(req: Request) {
  const warungId = await currentWarungId();
  const cashierId = await currentKasirId(warungId);

  const body = await readJson(req);
  if (!body) return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });
  const rawItems = (body.items ?? []) as CartItem[];
  const cash = Number(body.cash);
  const payment = body.payment === "QRIS" ? "QRIS" : "CASH";
  const discount = Math.max(0, Math.floor(Number(body.discount) || 0));
  // Meja OPSIONAL (jalur "bayar langsung di meja"). Ini bukan tenant key —
  // warungId tetap dari session (aturan #8); mejaId tetap divalidasi milik warung.
  const mejaId = typeof body.mejaId === "string" && body.mejaId ? body.mejaId : null;

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
  if (payment === "CASH" && cash > 1000000000) {
    return NextResponse.json({ error: "Nominal tunai di luar batas wajar." }, { status: 400 });
  }

  try {
    const items = Array.from(merged.entries());
    const id = await prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: { id: { in: items.map(([pid]) => pid) }, warungId },
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
      const taxCfg = await getTaxSetting(tx, warungId);
      const tax = taxCfg.enabled ? Math.round(((subtotal - disc) * taxCfg.pct) / 100) : 0;
      const total = subtotal - disc + tax;

      const paid = payment === "CASH" ? cash : total;
      if (paid < total) throw new Error(`Uang kurang ${total - paid}.`);

      const shift = await tx.shift.findFirst({
        where: { warungId, status: "BUKA" },
        orderBy: { openedAt: "desc" },
      });

      // Validasi kepemilikan meja (aturan #1 & #8) bila kasir memilih meja.
      if (mejaId) {
        const meja = await tx.meja.findFirst({ where: { id: mejaId, warungId } });
        if (!meja) throw new Error("Meja tidak ditemukan.");
      }

      const created = await tx.transaction.create({
        data: {
          warungId,
          cashierId,
          mejaId,
          status: "LUNAS",
          subtotal,
          discount: disc,
          tax,
          total,
          cash: paid,
          change: paid - total,
          payment,
          shiftId: shift?.id ?? null,
        },
      });

      for (const [pid, qty] of items) {
        const p = byId.get(pid)!;
        await tx.transactionItem.create({
          data: {
            warungId,
            transactionId: created.id,
            productId: p.id,
            name: p.name,
            qty,
            price: p.price,
          },
        });
        await tx.product.update({
          where: { id: p.id },
          data: { stock: { decrement: qty } },
        });
        await tx.stockMove.create({
          data: {
            warungId,
            productId: p.id,
            qty: -qty,
            type: "PENJUALAN",
            refId: created.id,
            createdBy: cashierId,
          },
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
