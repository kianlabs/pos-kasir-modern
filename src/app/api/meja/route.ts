import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { readJson } from "@/server/http";
import { catat } from "@/server/audit";
import { currentWarungId, requireOwnerResponse } from "@/server/tenant";
import { handleApiError } from "@/server/api-error";

export const dynamic = "force-dynamic";

// POST /api/meja — owner menambah meja baru.
//
// Body: { nomor?: string, jumlah?: number }
//  - `nomor`  : nomor meja eksplisit (mis. "A1"). Bila kosong → dibuat otomatis
//               (nomor terkecil berikutnya: 1, 2, 3, …).
//  - `jumlah` : tambah N meja sekaligus dengan nomor otomatis (1..N). Berguna
//               untuk warung yang baru buka dan mau langsung punya 10 meja.
//
// Nomor WAJIB unik per warung (index `@@unique([warungId, nomor])`). Bila bentrok
// → 409 dengan pesan yang jelas (bukan 500).
export async function POST(req: Request) {
  try {
    const denied = await requireOwnerResponse();
    if (denied) return denied;
    const warungId = await currentWarungId();

    const body = await readJson(req);
    const nomorManual = typeof body?.nomor === "string" ? body.nomor.trim().slice(0, 20) : "";
    const jumlahRaw = Number(body?.jumlah);
    const jumlah = Number.isInteger(jumlahRaw) && jumlahRaw > 0 ? Math.min(jumlahRaw, 100) : 0;

    // Nomor yang sudah dipakai (untuk cari nomor berikutnya & cegah duplikat).
    const ada = await prisma.meja.findMany({ where: { warungId }, select: { nomor: true } });
    const dipakai = new Set(ada.map((m) => m.nomor));

    // Nomor otomatis berikutnya: 1, 2, 3, … (lewati yang sudah ada).
    function nomorBerikutnya(mulaiDari = 1): string {
      let n = mulaiDari;
      while (dipakai.has(String(n))) n++;
      return String(n);
    }

    if (nomorManual) {
      // Tambah SATU meja dengan nomor eksplisit.
      if (dipakai.has(nomorManual)) {
        return NextResponse.json({ error: `Meja nomor "${nomorManual}" sudah ada.` }, { status: 409 });
      }
      const meja = await prisma.meja.create({ data: { warungId, nomor: nomorManual } });
      await catat({ warungId, action: "MEJA_TAMBAH", meta: { mejaId: meja.id, nomor: meja.nomor } });
      return NextResponse.json(meja, { status: 201 });
    }

    if (jumlah > 0) {
      // Tambah N meja dengan nomor otomatis berurutan.
      const dibuat: { id: string; nomor: string }[] = [];
      for (let i = 0; i < jumlah; i++) {
        const nomor = nomorBerikutnya();
        dipakai.add(nomor); // penting: cegah bentrok di iterasi berikutnya
        const m = await prisma.meja.create({ data: { warungId, nomor } });
        dibuat.push({ id: m.id, nomor: m.nomor });
      }
      await catat({ warungId, action: "MEJA_TAMBAH", meta: { jumlah: dibuat.length } });
      return NextResponse.json({ dibuat, jumlah: dibuat.length }, { status: 201 });
    }

    // Default: tambah SATU meja dengan nomor otomatis berikutnya.
    const nomor = nomorBerikutnya();
    const meja = await prisma.meja.create({ data: { warungId, nomor } });
    await catat({ warungId, action: "MEJA_TAMBAH", meta: { mejaId: meja.id, nomor: meja.nomor } });
    return NextResponse.json(meja, { status: 201 });
  } catch (e) {
    return handleApiError(e, "Gagal menambah meja.");
  }
}
