import { redirect } from "next/navigation";
import { sesiWarungAktif } from "@/server/tenant";
import LoginTunggal from "./LoginTunggal";

export const dynamic = "force-dynamic";

// /masuk — HALAMAN LOGIN TUNGGAL publik (root, tanpa daftar warung).
// Daftar warung publik SENGAJA dihapus: privasi tenant (nama semua pelanggan
// tidak boleh tampil publik). Warung di-resolve dari email owner atau kode
// warung yang diinput user lewat /api/auth/warung. Login per-warung tetap ada
// di /masuk/<slug> untuk tablet masing-masing warung.
export default async function MasukPage() {
  // Sesi yatim (warung terhapus) → tetap tampilkan form login, jangan redirect.
  if (await sesiWarungAktif()) redirect("/kasir");

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <LoginTunggal />
    </div>
  );
}
