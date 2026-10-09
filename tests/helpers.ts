import { prisma } from "@/lib/prisma";

// Helper bersama untuk test.
//
// Di Postgres (Supabase) DB bersifat PERSISTEN — beda dari SQLite yang file-nya
// dihapus tiap run. Jadi test WAJIB membersihkan warung ujinya sendiri, kalau
// tidak run berikutnya akan gagal karena data sisa (mis. bill DRAFT yang
// menggantung). Warung uji dikenali dari slug berawalan "warung-".

/**
 * Hapus warung uji (slug berawalan "warung-") beserta seluruh data turunannya.
 * Warung asli (mis. "warung-berkah-jaya" dari seed produksi) tidak tersentuh
 * karena slug-nya tidak diawali "warung-meja-", "warung-sync-", dst. — lihat
 * daftar DI BAWAH. Helper ini dipakai di afterAll setiap file test.
 */
export async function bersihkanWarungUji(nama: string[]): Promise<void> {
  await prisma.warung.deleteMany({
    where: { nama: { in: nama } },
  });
}
