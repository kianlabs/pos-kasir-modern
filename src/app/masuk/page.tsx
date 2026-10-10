import { redirect } from "next/navigation";
import { getSession } from "@/server/tenant";
import LoginTunggal from "./LoginTunggal";

export const dynamic = "force-dynamic";

// /masuk — HALAMAN LOGIN TUNGGAL publik (root, tanpa daftar warung).
// Daftar warung publik SENGAJA dihapus: privasi tenant (nama semua pelanggan
// tidak boleh tampil publik). Warung di-resolve dari email owner atau kode
// warung yang diinput user lewat /api/auth/warung. Login per-warung tetap ada
// di /masuk/<slug> untuk tablet masing-masing warung.
export default async function MasukPage() {
  const session = await getSession();
  if (session) redirect("/");

  return <LoginTunggal />;
}
