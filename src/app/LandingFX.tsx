"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * LandingFX — efek gerak halaman landing KRING!.
 *
 * PEMBAGIAN TUGAS (sama seperti yang terbukti di proyek KyanDev):
 * - Animasi MASUK hero dijalankan CSS murni (lihat globals.css, penanda
 *   `data-fx-hero-copy` / `data-fx-hero-side`) supaya konten pertama langsung
 *   tampil tanpa menunggu bundel JS.
 * - Reveal saat MENGGULIR dijalankan GSAP ScrollTrigger di sini. GSAP dipilih
 *   (bukan `animation-timeline: view()`) karena animasi berbasis posisi gulir
 *   CSS belum didukung Firefox & Safari — memakainya mematikan animasi di sana.
 *
 * KOSAKATA GERAK — sengaja cuma 3, semuanya ringan & mulus:
 * - `rise`     naik halus (opacity + translateY)   → gerak utama/default
 * - `fade`     pudar saja                          → footer, elemen diam
 * - `scale-in` naik + membesar sangat sedikit      → kartu, mockup, harga
 *
 * Hanya `opacity` + `transform` 2D (compositor-only, GPU) → tidak ada
 * layout/paint ulang, jadi tetap 60fps walau digulir cepat di HP.
 *
 * Cara pakai (atribut di JSX):
 * - `data-fx="<nama>"`        → satu elemen memakai gerak itu.
 * - `data-fx-stagger`         → anak-anaknya berjenjang; gerak anak diambil
 *                                dari `data-fx-child="<nama>"`.
 * - `data-fx-step="0.06"`     → jeda antar-anak (detik), opsional.
 * - `data-fx-count="1248000"` → angka naik dari 0 (format id-ID); prefix
 *                                opsional `data-fx-count-prefix="Rp"`.
 *
 * ANTI-CACAT "KONTEN HILANG":
 * ScrollTrigger hanya menyampel posisi gulir sekali per frame; lompatan
 * (Ctrl+Home, gulir sangat cepat) bisa terlewat sehingga `onEnter` tak
 * terpicu dan elemen tertinggal `opacity:0`. Pertahanan berlapis:
 *   1) elemen yang SUDAH terlihat saat skrip siap tidak pernah disembunyikan;
 *   2) jaring pengaman rAF menyapu elemen terlewati setiap gulir/resize.
 *
 * Hormati `prefers-reduced-motion`: bila aktif, GSAP tidak dipasang sama
 * sekali dan konten tampil apa adanya. GSAP diimpor DINAMIS agar tidak ikut
 * bundel awal dan tidak menahan First Contentful Paint.
 */

/**
 * Hook reduced-motion SSR-safe. Server menganggap `true` (reduced) supaya
 * GSAP tidak dipasang sebelum hidrasi; di client nilai dibaca dari
 * `matchMedia` dan ikut berubah bila preferensi pengguna berganti.
 */
function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true,
  );
}

/** Kurva gerak: tenang, melambat di ujung. */
const EASE = "power2.out";

/**
 * Kamus gerak — SENGAJA MINIMAL & RINGAN.
 *
 * Semua gerak HANYA memakai `opacity` + `transform` 2D (translateY/scale).
 * Keduanya diproses GPU (compositor-only) → tidak memicu layout/paint,
 * jadi mulus bahkan di HP kelas bawah. Gerak yang lebih berat SENGAJA
 * TIDAK dipakai: `clip-path` & `rotationX` (flip 3D) memaksa repaint /
 * lapisan 3D dan gampang tersendat saat menggulir cepat.
 *
 * `from` = keadaan awal, `to` = keadaan akhir eksplisit (dipakai `gsap.to`,
 * bukan `gsap.from`, supaya tak ada tween yang bisa terbalik dan
 * menyembunyikan konten saat menggulir naik).
 */
const MOTIONS = {
  // Gerak utama: naik halus sambil muncul. Dipakai di hampir semua elemen.
  rise: { from: { opacity: 0, y: 22 }, to: { opacity: 1, y: 0 }, dur: 0.5 },
  // Hanya pudar — untuk elemen yang sudah pas posisinya (footer, dsb).
  fade: { from: { opacity: 0 }, to: { opacity: 1 }, dur: 0.55 },
  // Naik + membesar sangat sedikit — untuk kartu & mockup.
  "scale-in": {
    from: { opacity: 0, y: 14, scale: 0.985 },
    to: { opacity: 1, y: 0, scale: 1 },
    dur: 0.5,
  },
} as const;

type MotionName = keyof typeof MOTIONS;

/** Ambil gerak berdasarkan nama. Nama tak dikenal → `rise` (aman). */
function motionFor(name: string | null) {
  const key = (name && name in MOTIONS ? name : "rise") as MotionName;
  return MOTIONS[key];
}

type Reveal = { el: HTMLElement; run: () => void };

export default function LandingFX() {
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) return;

    let ctx: { revert: () => void } | undefined;
    let cancelled = false;

    (async () => {
      const [{ default: gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      if (cancelled) return;

      gsap.registerPlugin(ScrollTrigger);
      ScrollTrigger.config({ ignoreMobileResize: true });

      ctx = gsap.context(() => {
        const vh = window.innerHeight;
        const reveals: Reveal[] = [];
        const seen = new Set<HTMLElement>();

        /** Elemen sudah terlihat/terlewati saat skrip siap? Jangan sentuh. */
        const visibleNow = (el: HTMLElement) => el.getBoundingClientRect().top < vh;

        // (1) GRUP BERJENJANG — satu pemicu untuk sekelompok anak.
        gsap.utils.toArray<HTMLElement>("[data-fx-stagger]").forEach((grid) => {
          if (visibleNow(grid)) return;

          const children = Array.from(grid.children).filter(
            (c): c is HTMLElement => c instanceof HTMLElement,
          );
          if (!children.length) return;

          const name = grid.getAttribute("data-fx-child");
          const step = Number(grid.getAttribute("data-fx-step") || 0.07);

          children.forEach((child) => {
            seen.add(child);
            gsap.set(child, motionFor(name).from);
          });

          reveals.push({
            el: grid,
            run: () => {
              children.forEach((child, i) => {
                const m = motionFor(name);
                gsap.to(child, {
                  ...m.to,
                  duration: m.dur,
                  ease: EASE,
                  delay: i * step,
                  overwrite: true,
                });
              });
            },
          });
        });

        // (2) SASARAN BERNAMA — `data-fx="<nama>"` pada satu elemen.
        const inStagger = (node: HTMLElement) =>
          gsap.utils
            .toArray<HTMLElement>("[data-fx-stagger]")
            .some((root) => root !== node && root.contains(node));

        gsap.utils.toArray<HTMLElement>("[data-fx]").forEach((el) => {
          if (seen.has(el) || inStagger(el)) return;
          if (visibleNow(el)) return;

          const m = motionFor(el.getAttribute("data-fx"));
          seen.add(el);
          gsap.set(el, m.from);
          reveals.push({
            el,
            run: () => gsap.to(el, { ...m.to, duration: m.dur, ease: EASE, overwrite: true }),
          });
        });

        // (3) ANAK LANGSUNG SECTION — gerak dari `data-fx-motion` section.
        gsap.utils.toArray<HTMLElement>("[data-fx-section]").forEach((sec) => {
          if (sec.hasAttribute("data-fx-hero")) return;

          const name = sec.getAttribute("data-fx-motion");

          Array.from(sec.children).forEach((child) => {
            const node = child as HTMLElement;
            if (seen.has(node) || visibleNow(node)) return;
            if (
              node.hasAttribute("data-fx-stagger") ||
              node.querySelector("[data-fx-stagger]") ||
              node.querySelector("[data-fx]")
            ) {
              return;
            }

            const m = motionFor(name);
            seen.add(node);
            gsap.set(node, m.from);
            reveals.push({
              el: node,
              run: () => gsap.to(node, { ...m.to, duration: m.dur, ease: EASE, overwrite: true }),
            });
          });
        });

        // (4) Picu semua reveal saat elemen masuk layar.
        reveals.forEach(({ el, run }) => {
          ScrollTrigger.create({ trigger: el, start: "top 92%", once: true, onEnter: run });
        });

        // (5) JARING PENGAMAN — sapu elemen terlewati yang belum terpicu.
        const pending = new Set(reveals);
        let raf = 0;
        const sweep = () => {
          raf = 0;
          if (!pending.size) return;
          const limit = window.innerHeight * 0.92;
          pending.forEach((r) => {
            if (r.el.getBoundingClientRect().top < limit) {
              pending.delete(r);
              r.run();
            }
          });
        };
        const onScroll = () => {
          if (!raf) raf = requestAnimationFrame(sweep);
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll, { passive: true });
        requestAnimationFrame(sweep);

        // (6) ANGKA NAIK DARI NOL — hanya menyentuh teks.
        //     Nilai diambil dari `data-fx-count` (angka polos), diformat
        //     ke gaya Indonesia (Rp1.248.000) supaya titik ribuan benar.
        gsap.utils.toArray<HTMLElement>("[data-fx-count]").forEach((el) => {
          const raw = el.getAttribute("data-fx-count");
          const target = Number((raw || "").replace(/[^\d]/g, ""));
          if (!target) return;
          const prefix = el.getAttribute("data-fx-count-prefix") || "";
          const box = { v: 0 };
          gsap.to(box, {
            v: target,
            duration: 1.4,
            ease: "power2.out",
            scrollTrigger: { trigger: el, start: "top 92%", once: true },
            onUpdate: () => {
              el.textContent = `${prefix}${Math.round(box.v).toLocaleString("id-ID")}`;
            },
          });
        });

        // (7) PROGRESS BAR gulir di tepi atas.
        const bar = document.querySelector("[data-fx-progress]");
        if (bar) {
          gsap.to(bar, {
            scaleX: 1,
            ease: "none",
            scrollTrigger: {
              trigger: document.body,
              start: "top top",
              end: "bottom bottom",
              scrub: 0.25,
            },
          });
        }
      });

      ScrollTrigger.refresh();
    })();

    return () => {
      cancelled = true;
      ctx?.revert();
    };
  }, [reduced]);

  return (
    <div
      data-fx-progress
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[3px] origin-left scale-x-0 bg-ink-950"
    />
  );
}
