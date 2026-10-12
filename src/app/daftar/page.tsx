import { redirect } from "next/navigation";
import { sesiWarungAktif } from "@/server/tenant";
import DaftarClient from "./DaftarClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Daftar Warung — KRING!",
  description: "Buat akun warung KRING! gratis 30 hari. Tanpa kartu kredit.",
};

// /daftar — pendaftaran warung baru (publik). Bila sudah login → ke kasir.
export default async function DaftarPage() {
  // Sesi yatim (warung terhapus) → tetap tampilkan form daftar, jangan redirect.
  if (await sesiWarungAktif()) redirect("/kasir");

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <DaftarClient />
    </div>
  );
}
