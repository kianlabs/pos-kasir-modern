import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { catat } from "@/lib/audit";
import { readJson } from "@/lib/request";
import { currentWarungId, currentKasirId } from "@/lib/warung";
import { requireBillDraft, hitungUlangBill, BillError } from "@/lib/meja";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

// PATCH /api/bills/[id] { items?: [{ productId, qty }], discount? }
//
// Tambah/ubah item pada bill DRAFT. qty diperlakukan sebagai DELTA yang
// digabung per productId (merge, sama seperti checkout menggabung item
// duplikat): qty positif menambah, qty negatif mengurangi. Bila hasil qty
// item ≤ 0 → item dihapus. `items` OPSIONAL: bila hanya ingin mengubah
// diskon, cukup kirim { discount }. Setelah semua item diproses, subtotal/
// discount/tax/total dihitung ulang server-side (hitungUlangBill) DI DALAM
// $transaction yang sama — angka client tidak dipercaya. DRAFT TIDAK
// menyentuh stok/StockMove (plan §7 keputusan 3).
export async function PATCH(req: Request, { params }: Params) {
  const warungId = await currentWarungId();

  const body = await readJson(req);
  if (!body) return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });

  // items OPSIONAL (boleh hanya kirim discount). Bila ada, wajib array item valid.
  const rawItems: unknown = body.items ?? [];
  if (!Array.isArray(rawItems)) {
    return NextResponse.json({ error: "Item tidak valid." }, { status: 400 });
  }

  // Gabung delta per productId (merge) — pola sama dengan checkout.
  const merged = new Map<string, number>();
  for (const item of rawItems) {
    if (!item || typeof item !== "object") {
      return NextResponse.json({ error: "Item tidak valid." }, { status: 400 });
    }
    const { productId, qty } = item as { productId?: unknown; qty?: unknown };
    if (typeof productId !== "string" || !productId) {
      return NextResponse.json({ error: "Item tidak valid." }, { status: 400 });
    }
    if (!Number.isInteger(qty) || qty === 0) {
      return NextResponse.json({ error: "Qty item tidak valid." }, { status: 400 });
    }
    merged.set(productId, (merged.get(productId) ?? 0) + (qty as number));
  }

  // discount opsional: integer rupiah ≥ 0 (aturan #3). Bila tak dikirim,
  // diskon lama dipertahankan.
  let discount: number | undefined;
  if (body.discount !== undefined) {
    const d = Number(body.discount);
    if (!Number.isInteger(d) || d < 0) {
      return NextResponse.json({ error: "Diskon tidak valid." }, { status: 400 });
    }
    discount = d;
  }

  // Minimal satu aksi: tambah/ubah item ATAU set diskon.
  if (merged.size === 0 && discount === undefined) {
    return NextResponse.json({ error: "Tidak ada perubahan." }, { status: 400 });
  }

  try {
    // Guard tenant + DRAFT (lempar BillError 404 bila bukan milik warung ini).
    await requireBillDraft(params.id, warungId);

    const items = Array.from(merged.entries());
    const updated = await prisma.$transaction(async (tx) => {
      // Cek ulang DI DALAM tx (bill bisa berubah status setelah guard di atas).
      const bill = await tx.transaction.findFirst({
        where: { id: params.id, warungId, status: "DRAFT" },
        select: { id: true },
      });
      if (!bill) throw new BillError("Bill tidak ditemukan.", 404);

      if (discount !== undefined) {
        await tx.transaction.update({
          where: { id: bill.id },
          data: { discount },
        });
      }

      for (const [productId, delta] of items) {
        const existing = await tx.transactionItem.findFirst({
          where: { transactionId: bill.id, productId, warungId },
          select: { id: true, qty: true },
        });

        const nextQty = (existing?.qty ?? 0) + delta;

        if (nextQty <= 0) {
          if (existing) {
            await tx.transactionItem.delete({ where: { id: existing.id } });
          }
          continue;
        }

        if (existing) {
          await tx.transactionItem.update({
            where: { id: existing.id },
            data: { qty: nextQty },
          });
        } else {
          const product = await tx.product.findFirst({
            where: { id: productId, warungId },
            select: { id: true, name: true, price: true },
          });
          if (!product) throw new BillError("Produk tidak ditemukan.", 400);
          // Snapshot nama & harga saat item pertama masuk (aturan #4).
          await tx.transactionItem.create({
            data: {
              warungId,
              transactionId: bill.id,
              productId: product.id,
              name: product.name,
              price: product.price,
              qty: nextQty,
            },
          });
        }
      }

      // Hitung ulang total dari item SETELAH semua mutasi item, DI DALAM tx
      // yang sama agar atomik. PENTING: pakai `tx` — hitungUlangBill(`prisma`)
      // di dalam $transaction membaca snapshot pra-mutasi (total stale).
      const totals = await hitungUlangBill(bill.id, warungId, tx);
      const fresh = await tx.transaction.update({
        where: { id: bill.id },
        data: {
          subtotal: totals.subtotal,
          discount: totals.discount,
          tax: totals.tax,
          total: totals.total,
        },
        include: { items: true },
      });

      return fresh;
    });

    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof BillError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    const message = e instanceof Error ? e.message : "Gagal ubah bill.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// DELETE /api/bills/[id] → batalkan bill DRAFT (hapus bill + item cascade).
//
// Stok TIDAK perlu dikembalikan: DRAFT belum pernah mengurangi stok
// (plan §7 keputusan 3), jadi batal cukup menghapus baris. Audit MEJA_BATAL.
export async function DELETE(_req: Request, { params }: Params) {
  const warungId = await currentWarungId();
  const kasirId = await currentKasirId(warungId);

  try {
    const bill = await requireBillDraft(params.id, warungId);

    await prisma.$transaction(async (tx) => {
      const current = await tx.transaction.findFirst({
        where: { id: params.id, warungId, status: "DRAFT" },
        select: { id: true },
      });
      if (!current) throw new BillError("Bill tidak ditemukan.", 404);
      // Hapus item dulu (eksplisit), lalu bill — tidak bergantung pada cascade FK.
      await tx.transactionItem.deleteMany({ where: { transactionId: current.id, warungId } });
      await tx.transaction.delete({ where: { id: current.id } });
    });

    await catat({
      warungId,
      userId: kasirId,
      action: "MEJA_BATAL",
      meta: { billId: bill.id, mejaId: bill.mejaId, total: bill.total },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof BillError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    const message = e instanceof Error ? e.message : "Gagal batalkan bill.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
