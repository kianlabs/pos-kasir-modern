"use client";

// Pembungkus tipis untuk worker-3: mount <OfflineShell> di layout.tsx.
// Komponen ini merender banner status koneksi (ConnectionBanner) lalu children.
//
// Sengaja dipisah dari layout.tsx supaya hanya satu pihak (worker-3) yang
// menyentuh file layout, sementara UI offline tetap satu paket dari worker-2.

import type { ReactNode } from "react";
import ConnectionBanner from "./ConnectionBanner";

export default function OfflineShell({ children }: { children: ReactNode }) {
  return (
    <>
      <ConnectionBanner />
      {children}
    </>
  );
}
