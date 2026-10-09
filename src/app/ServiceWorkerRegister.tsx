"use client";

import { useEffect } from "react";

// Mendaftarkan service worker /sw.js.
//
// Sengaja HANYA di production: service worker meng-cache aset secara agresif
// dan bisa membuat hot-reload `next dev` menyajikan versi basi. Untuk uji SW
// di lokal, jalankan `npm run build && npm start`.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    // Tahan SSR: `serviceWorker` hanya ada di browser.
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        // Registrasi gagal (mis. diblokir) tak boleh merusak aplikasi kasir.
        console.warn("[KRING!] Gagal mendaftarkan service worker:", err);
      });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
