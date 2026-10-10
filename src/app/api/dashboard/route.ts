import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { currentWarungId, requireOwnerResponse } from "@/server/tenant";
import { handleApiError } from "@/server/api-error";

export const dynamic = "force-dynamic";

// GET /api/dashboard — snapshot LIVE kecil untuk dashboard owner (Fase 2 §7a:
// "pantau penjualan live dari HP"). Owner-only (kasir tak boleh lihat omzet).
//
// Desain polling-first (MVP): endpoint sengaja dibuat MURAH & TERBATAS agar
// aman dipanggil tiap ~15 detik dari HP. Bentuk respons stabil & sederhana
// sehingga upgrade ke SSE/WebSocket nanti TIDAK perlu ubah kontrak — cukup
// dorong payload yang sama lewat channel push. warungId selalu dari session.
//
// Semua date-math dipaksa zona WIB (offset tetap UTC+7, tanpa DST) — meniru
// src/app/api/stats/route.ts & src/server/ai/tools.ts agar batas "hari ini"
// sama dengan yang dilihat owner.

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

// Awal hari (00:00:00.000) WIB untuk instan `d`, dikembalikan sebagai Date.
function awalHariWib(d: Date): Date {
  const shifted = new Date(d.getTime() + WIB_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - WIB_OFFSET_MS);
}

// Awal jam (menit/detik = 0) pada zona WIB untuk instan `d`.
function awalJamWib(d: Date): Date {
  const shifted = new Date(d.getTime() + WIB_OFFSET_MS);
  shifted.setUTCMinutes(0, 0, 0);
  return new Date(shifted.getTime() - WIB_OFFSET_MS);
}

// Label jam "HH:00" WIB untuk instan `d` (untuk sumbu sparkline).
function labelJamWib(d: Date): string {
  const shifted = new Date(d.getTime() + WIB_OFFSET_MS);
  return String(shifted.getUTCHours()).padStart(2, "0") + ":00";
}

export async function GET() {
  try {
    const denied = await requireOwnerResponse();
    if (denied) return denied;

    const warungId = await currentWarungId();

    const sekarang = new Date();
    const mulaiHari = awalHariWib(sekarang);

    // Sparkline: 12 jam terakhir (termasuk jam berjalan), WIB. Rentang ini juga
    // memberi data cukup untuk menghitung omzet harian bila hari baru dimulai.
    const jamIni = awalJamWib(sekarang);
    const mulaiSpark = new Date(jamIni.getTime() - 11 * 60 * 60 * 1000);

    const [hariIni, transaksiTerakhir, trxSpark] = await Promise.all([
      // Omzet + jumlah trx hari ini (WIB). Bounded: satu agregat.
      prisma.transaction.aggregate({
        _sum: { total: true },
        _count: true,
        where: { warungId, status: "LUNAS", createdAt: { gte: mulaiHari } },
      }),
      // 5 transaksi terakhir untuk feed live. Bounded: take 5 + include items
      // (hanya untuk hitung qty item, kolom ringan).
      prisma.transaction.findMany({
        where: { warungId, status: "LUNAS" },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          total: true,
          payment: true,
          createdAt: true,
          items: { select: { qty: true } },
        },
      }),
      // Transaksi (hanya total + waktu) untuk bucket sparkline 12 jam.
      // Bounded: dibatasi jendela 12 jam — bukan seluruh tabel.
      prisma.transaction.findMany({
        where: { warungId, status: "LUNAS", createdAt: { gte: mulaiSpark } },
        select: { total: true, createdAt: true },
      }),
    ]);

    // Bucket omzet per jam (WIB) — 12 titik kontinu; jam tanpa trx = 0.
    const omzetPerJam: { jam: string; total: number }[] = [];
    for (let i = 0; i < 12; i++) {
      const mulai = new Date(mulaiSpark.getTime() + i * 60 * 60 * 1000);
      const selesai = new Date(mulai.getTime() + 60 * 60 * 1000);
      const total = trxSpark
        .filter((t) => t.createdAt >= mulai && t.createdAt < selesai)
        .reduce((n, t) => n + t.total, 0);
      omzetPerJam.push({ jam: labelJamWib(mulai), total });
    }

    const omzetHariIni = hariIni._sum.total ?? 0;
    const trxHariIni = hariIni._count;

    return NextResponse.json({
      omzetHariIni,
      trxHariIni,
      rataRata: trxHariIni > 0 ? Math.round(omzetHariIni / trxHariIni) : 0,
      transaksiTerakhir: transaksiTerakhir.map((t) => ({
        id: t.id,
        total: t.total,
        payment: t.payment,
        createdAt: t.createdAt,
        itemCount: t.items.reduce((n, i) => n + i.qty, 0),
      })),
      omzetPerJam,
      jamServer: sekarang.toISOString(),
    });
  } catch (e) {
    return handleApiError(e);
  }
}
