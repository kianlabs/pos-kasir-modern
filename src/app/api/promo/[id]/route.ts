import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { readJson } from "@/server/http";
import { currentWarungId, currentKasirId, requireOwnerResponse } from "@/server/tenant";
import { catat } from "@/server/audit";
import { str, optionalStr, isHHMM } from "@/server/validate";
import { isPromoTipe } from "@/server/promo";
import { isRecordNotFound } from "@/client/offline-sync";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/promo/[id] → owner-only. Utamanya toggle `aktif`, juga edit field.
export async function PATCH(req: Request, props: Params) {
  const params = await props.params;
  const denied = await requireOwnerResponse();
  if (denied) return denied;

  const warungId = await currentWarungId();
  const kasirId = await currentKasirId(warungId);
  const body = await readJson(req);
  if (!body) return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });

  const data: {
    nama?: string;
    tipe?: string;
    kode?: string | null;
    nilai?: number;
    minSubtotal?: number;
    jamMulai?: string | null;
    jamSelesai?: string | null;
    aktif?: boolean;
  } = {};

  if (body.aktif !== undefined) {
    data.aktif = Boolean(body.aktif);
  }
  if (body.nama !== undefined) {
    const nama = str(body.nama, 120);
    if (!nama) return NextResponse.json({ error: "Nama kosong." }, { status: 400 });
    data.nama = nama;
  }
  if (body.kode !== undefined) {
    data.kode = optionalStr(body.kode, 60);
  }
  if (body.tipe !== undefined) {
    const tipe = str(body.tipe, 30);
    if (!isPromoTipe(tipe)) {
      return NextResponse.json({ error: "Tipe promo tidak dikenal." }, { status: 400 });
    }
    data.tipe = tipe;
  }
  if (body.nilai !== undefined) {
    const nilai = Number(body.nilai);
    if (!Number.isInteger(nilai) || nilai < 0)
      return NextResponse.json({ error: "Nilai harus >= 0." }, { status: 400 });
    data.nilai = nilai;
  }
  if (body.minSubtotal !== undefined) {
    const minSubtotal = Number(body.minSubtotal);
    if (!Number.isInteger(minSubtotal) || minSubtotal < 0)
      return NextResponse.json({ error: "Minimal subtotal harus >= 0." }, { status: 400 });
    data.minSubtotal = minSubtotal;
  }
  if (body.jamMulai !== undefined) {
    const jam = optionalStr(body.jamMulai);
    if (jam !== null && !isHHMM(jam))
      return NextResponse.json({ error: "Format jam mulai harus HH:MM." }, { status: 400 });
    data.jamMulai = jam;
  }
  if (body.jamSelesai !== undefined) {
    const jam = optionalStr(body.jamSelesai);
    if (jam !== null && !isHHMM(jam))
      return NextResponse.json({ error: "Format jam selesai harus HH:MM." }, { status: 400 });
    data.jamSelesai = jam;
  }

  try {
    // Tulis ter-scope tenant (aturan #1) + assert tepat 1 baris → 404 bila 0.
    const res = await prisma.promo.updateMany({
      where: { id: params.id, warungId },
      data,
    });
    if (res.count !== 1) {
      return NextResponse.json({ error: "Promo tidak ditemukan." }, { status: 404 });
    }
    const promo = await prisma.promo.findFirstOrThrow({
      where: { id: params.id, warungId },
    });
    // Audit mutasi penting (lampiran skema §2 aturan #10) — daftar field yang berubah.
    const fields = Object.keys(data);
    if (fields.length > 0) {
      await catat({
        warungId,
        userId: kasirId,
        action: "PROMO_UPDATE",
        meta: { promoId: promo.id, fields },
      });
    }
    return NextResponse.json(promo);
  } catch (e) {
    if (isRecordNotFound(e)) {
      return NextResponse.json({ error: "Promo tidak ditemukan." }, { status: 404 });
    }
    console.error("PATCH /api/promo/[id] gagal:", e);
    return NextResponse.json({ error: "Gagal memperbarui promo." }, { status: 500 });
  }
}

// DELETE /api/promo/[id] → owner-only (hapus promo — bukan data historis).
export async function DELETE(_req: Request, props: Params) {
  const params = await props.params;
  const denied = await requireOwnerResponse();
  if (denied) return denied;

  const warungId = await currentWarungId();
  const kasirId = await currentKasirId(warungId);

  try {
    // Tulis ter-scope tenant (aturan #1) + assert tepat 1 baris → 404 bila 0.
    const del = await prisma.promo.deleteMany({
      where: { id: params.id, warungId },
    });
    if (del.count !== 1) {
      return NextResponse.json({ error: "Promo tidak ditemukan." }, { status: 404 });
    }
    await catat({
      warungId,
      userId: kasirId,
      action: "PROMO_DELETE",
      meta: { promoId: params.id },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (isRecordNotFound(e)) {
      return NextResponse.json({ error: "Promo tidak ditemukan." }, { status: 404 });
    }
    console.error("DELETE /api/promo/[id] gagal:", e);
    return NextResponse.json({ error: "Gagal menghapus promo." }, { status: 500 });
  }
}
