import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/request";
import { catat } from "@/lib/audit";
import { currentWarungId, currentKasirId } from "@/lib/warung";
import { hitungUlangBill, BillError } from "@/lib/meja";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

type PisahItem = { transactionItemId: string; qty: number };

// POST /api/bills/[id]/pisah { targetMejaId, items: [{ transactionItemId, qty }] }
// Buat bill DRAFT baru di targetMejaId (WAJIB KOSONG = belum punya bill DRAFT),
// lalu PINDAHKAN item terpilih (bukan salin) dari bill [id] ke bill baru.
//
// - qty boleh sebagian: baris asal dikurangi, sisanya dibuat sebagai baris baru
//   di bill tujuan (snapshot name/price disalin — aturan #4, item bukan referensi
//   data produk hidup). qty = penuh → baris dipindah (update transactionId).
// - Stok TIDAK disentuh (§7 keputusan 3).
// - Meja tujuan pindah di sini juga menutup kebutuhan "pindah meja".
export async function POST(req: Request, { params }: Params) {
  const warungId = await currentWarungId();
  const kasirId = await currentKasirId(warungId);

  const body = await readJson(req);
  if (!body) return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });

  const targetMejaId = typeof body.targetMejaId === "string" ? body.targetMejaId.trim() : "";
  if (!targetMejaId) return NextResponse.json({ error: "targetMejaId wajib." }, { status: 400 });

  const rawItems = Array.isArray(body.items) ? (body.items as PisahItem[]) : [];
  if (rawItems.length === 0) {
    return NextResponse.json({ error: "Tidak ada item yang dipisah." }, { status: 400 });
  }

  // Gabung permintaan duplikat per transactionItemId agar qty tidak dobel-hitung.
  const wanted = new Map<string, number>();
  for (const it of rawItems) {
    const itemId = typeof it?.transactionItemId === "string" ? it.transactionItemId.trim() : "";
    const qty = Number(it?.qty);
    if (!itemId || !Number.isInteger(qty) || qty <= 0) {
      return NextResponse.json({ error: "Item pisah tidak valid." }, { status: 400 });
    }
    wanted.set(itemId, (wanted.get(itemId) ?? 0) + qty);
  }

  try {
    let newBillId = "";
    let sourceTotals: {
      subtotal: number;
      rawDiscount: number;
      discount: number;
      tax: number;
      total: number;
    } = {
      subtotal: 0,
      rawDiscount: 0,
      discount: 0,
      tax: 0,
      total: 0,
    };
    let targetTotals = { ...sourceTotals };

    await prisma.$transaction(async (tx) => {
      // Bill sumber harus DRAFT & milik warung ini (aturan #1 & #8).
      const source = await tx.transaction.findFirst({
        where: { id: params.id, warungId, status: "DRAFT" },
        select: { id: true, shiftId: true, cashierId: true },
      });
      if (!source) throw new BillError("Bill tidak ditemukan.", 404);

      // Meja tujuan harus milik warung ini...
      const meja = await tx.meja.findFirst({
        where: { id: targetMejaId, warungId },
        select: { id: true },
      });
      if (!meja) throw new BillError("Meja tujuan tidak ditemukan.", 404);

      // ...dan WAJIB KOSONG (tidak punya bill DRAFT) — invarian satu DRAFT/meja.
      const occupied = await tx.transaction.findFirst({
        where: { warungId, mejaId: targetMejaId, status: "DRAFT" },
        select: { id: true },
      });
      if (occupied) throw new BillError("Meja tujuan sudah punya bill terbuka.", 409);

      // Ambil item yang diminta, ter-scope tenant, hanya milik bill sumber.
      const ids = Array.from(wanted.keys());
      const items = await tx.transactionItem.findMany({
        where: { id: { in: ids }, transactionId: source.id, warungId },
        select: { id: true, productId: true, name: true, price: true, qty: true },
      });
      if (items.length !== ids.length) {
        throw new BillError("Ada item yang tidak ada di bill ini.", 400);
      }

      // Buat bill DRAFT baru di meja tujuan (total dihitung ulang setelah pindah).
      const created = await tx.transaction.create({
        data: {
          warungId,
          mejaId: targetMejaId,
          shiftId: source.shiftId,
          cashierId: source.cashierId,
          status: "DRAFT",
          total: 0,
        },
        select: { id: true },
      });
      newBillId = created.id;

      for (const it of items) {
        const moveQty = wanted.get(it.id)!;
        if (moveQty > it.qty) {
          throw new BillError("Qty pisah melebihi qty item.", 400);
        }
        if (moveQty === it.qty) {
          // Pindah utuh: cukup ganti pemilik baris, snapshot ikut terbawa.
          await tx.transactionItem.update({
            where: { id: it.id },
            data: { transactionId: created.id },
          });
        } else {
          // Pisah sebagian: kurangi baris asal, buat baris baru dengan snapshot sama.
          await tx.transactionItem.update({
            where: { id: it.id },
            data: { qty: it.qty - moveQty },
          });
          await tx.transactionItem.create({
            data: {
              warungId,
              transactionId: created.id,
              productId: it.productId,
              name: it.name,
              price: it.price,
              qty: moveQty,
            },
          });
        }
      }

      // Hitung ulang KEDUA bill dari item, DI DALAM tx yang sama (atomik).
      // Wajib pakai `tx`: hitungUlangBill(`prisma`) di dalam $transaction
      // membaca snapshot pra-mutasi (total stale).
      sourceTotals = await hitungUlangBill(source.id, warungId, tx);
      targetTotals = await hitungUlangBill(created.id, warungId, tx);
      // Fix A13: STORE rawDiscount (diskon diniatkan kasir) untuk KEDUA bill —
      // `discount` yang ter-clamp hanya untuk math pajak/total, jangan disimpan.
      await tx.transaction.update({
        where: { id: source.id },
        data: {
          subtotal: sourceTotals.subtotal,
          discount: sourceTotals.rawDiscount,
          tax: sourceTotals.tax,
          total: sourceTotals.total,
        },
      });
      await tx.transaction.update({
        where: { id: created.id },
        data: {
          subtotal: targetTotals.subtotal,
          discount: targetTotals.rawDiscount,
          tax: targetTotals.tax,
          total: targetTotals.total,
        },
      });
    });

    await catat({
      warungId,
      userId: kasirId,
      action: "MEJA_PISAH",
      meta: {
        source: params.id,
        targetBill: newBillId,
        targetMeja: targetMejaId,
        items: wanted.size,
        sourceTotal: sourceTotals.total,
        targetTotal: targetTotals.total,
      },
    });

    return NextResponse.json({
      ok: true,
      billId: newBillId,
      targetMejaId,
      source: { id: params.id, ...sourceTotals },
      target: { id: newBillId, ...targetTotals },
    });
  } catch (e) {
    if (e instanceof BillError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    const message = e instanceof Error ? e.message : "Gagal pisah bill.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
