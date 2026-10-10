import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { readJson } from "@/server/http";
import { currentWarungId, currentKasirId, requireOwnerResponse } from "@/server/tenant";
import { catat } from "@/server/audit";
import { handleApiError } from "@/server/api-error";
import { str, optionalStr, isHHMM } from "@/server/validate";
import { isPromoTipe } from "@/server/promo";

export const dynamic = "force-dynamic";

// GET /api/promo → daftar promo warung (ter-scope tenant). Baca aman utk
// owner & kasir (kasir tak menampilkan UI-nya, tapi endpoint tak membocorkan
// data tenant lain).
export async function GET() {
  try {
    const warungId = await currentWarungId();
    const promos = await prisma.promo.findMany({
      where: { warungId },
      orderBy: [{ aktif: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(promos);
  } catch (e) {
    return handleApiError(e);
  }
}

// POST /api/promo → owner-only (kasir tak boleh mengubah promo/harga).
export async function POST(req: Request) {
  try {
    const denied = await requireOwnerResponse();
    if (denied) return denied;

    const warungId = await currentWarungId();
    const kasirId = await currentKasirId(warungId);

    const body = await readJson(req);
    if (!body) return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });

    const nama = str(body.nama, 120);
    const tipe = str(body.tipe, 30);
    const kode = optionalStr(body.kode, 60);
    const nilai = Number(body.nilai ?? 0);
    const minSubtotal = Number(body.minSubtotal ?? 0);
    const jamMulai = optionalStr(body.jamMulai);
    const jamSelesai = optionalStr(body.jamSelesai);
    const aktif = body.aktif === undefined ? true : Boolean(body.aktif);

    if (!nama) {
      return NextResponse.json({ error: "Nama promo wajib diisi." }, { status: 400 });
    }
    if (!isPromoTipe(tipe)) {
      return NextResponse.json(
        { error: "Tipe promo tidak dikenal." },
        { status: 400 }
      );
    }
    if (!Number.isInteger(nilai) || nilai < 0) {
      return NextResponse.json({ error: "Nilai promo harus bilangan >= 0." }, { status: 400 });
    }
    if (!Number.isInteger(minSubtotal) || minSubtotal < 0) {
      return NextResponse.json(
        { error: "Minimal subtotal harus bilangan >= 0." },
        { status: 400 }
      );
    }
    // PERSEN/NOMINAL wajib punya nilai bermakna; B1G1 mengabaikan nilai.
    if (tipe === "PERSEN" && (nilai < 1 || nilai > 100)) {
      return NextResponse.json({ error: "Persen diskon harus 1–100." }, { status: 400 });
    }
    if (tipe === "NOMINAL" && nilai < 1) {
      return NextResponse.json({ error: "Nominal diskon harus > 0." }, { status: 400 });
    }
    // HAPPY_HOUR wajib jendela jam valid "HH:MM".
    if (tipe === "HAPPY_HOUR") {
      if (!jamMulai || !jamSelesai || !isHHMM(jamMulai) || !isHHMM(jamSelesai)) {
        return NextResponse.json(
          { error: "Happy hour butuh jam mulai & selesai (HH:MM)." },
          { status: 400 }
        );
      }
      if (nilai < 1) {
        return NextResponse.json({ error: "Nilai happy hour harus > 0." }, { status: 400 });
      }
    }
    // Jam selain HAPPY_HOUR tidak relevan → jangan simpan agar tak menyesatkan.
    const jamMulaiFinal = tipe === "HAPPY_HOUR" ? jamMulai : null;
    const jamSelesaiFinal = tipe === "HAPPY_HOUR" ? jamSelesai : null;

    const promo = await prisma.promo.create({
      data: {
        warungId,
        kode,
        nama,
        tipe,
        nilai: tipe === "BELI_1_GRATIS_1" ? 0 : nilai,
        minSubtotal,
        jamMulai: jamMulaiFinal,
        jamSelesai: jamSelesaiFinal,
        aktif,
      },
    });

    // Audit mutasi penting (lampiran skema §2 aturan #10) — id & tipe ringkas saja.
    await catat({
      warungId,
      userId: kasirId,
      action: "PROMO_CREATE",
      meta: { promoId: promo.id, tipe, nama },
    });

    return NextResponse.json(promo, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
