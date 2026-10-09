# Konvensi Penamaan: Client vs Server

Panduan pemisahan kode **client** (browser) dan **server** (Node/edge) untuk
project `pos-kasir-modern` (Next.js 14 App Router + Prisma).

Tujuan: mencegah bug kelas "modul server bocor ke bundle client" (mis.
`node:crypto`, Prisma, `process.env` ter-import di komponen browser), dan
membuat lokasi kode **terprediksi** dari namanya.

---

## 1. Prinsip dasar (Next.js App Router)

Next.js memutuskan client/server lewat **directive**, bukan folder:

| Directive | Artinya |
|---|---|
| `"use client"` di baris 1 | Komponen + turunannya jalan di **browser** |
| (tanpa directive) | **Server Component** / kode server — default |
| `src/app/api/**/route.ts` | **Selalu server** (route handler) |
| `src/middleware.ts` | **Selalu edge** (server, subset API) |

Konsekuensi: **kita tidak memindahkan `app/`** — itu routing Next.js. Pemisahan
dilakukan pada **kode non-routing** (`lib/`, `components/`, `types/`).

---

## 2. Struktur folder usulan

```
src/
├── app/                    # ROUTING (jangan pindah sembarangan)
│   ├── api/**/route.ts     #   server — route handler
│   ├── **/page.tsx         #   server component default
│   └── **/*Client.tsx      #   client component (mis. LoginClient)
│
├── server/                 # ONLY SERVER — aman pakai node:crypto/Prisma
│   ├── db.ts               #   PrismaClient (was lib/prisma.ts)
│   ├── session.ts          #   HMAC cookie (was lib/session.ts)
│   ├── tenant.ts           #   resolusi warung dari session (was lib/warung.ts)
│   ├── audit.ts            #   catat AuditLog (was lib/audit.ts)
│   ├── settings.ts         #   baca/tulis Setting (was lib/settings.ts)
│   ├── rate-limit.ts       #   rate-limit PIN (was lib/rate-limit.ts)
│   ├── meja.ts             #   domain bill/meja (was lib/meja.ts)
│   └── http.ts             #   readJson dll (was lib/request.ts)
│
├── client/                 # ONLY CLIENT — aman pakai IndexedDB/browser API
│   ├── offline-db.ts       #   wrapper IndexedDB (was lib/offline/db.ts)
│   └── offline-sync.ts     #   syncOutbox (was lib/offline/sync.ts)
│
├── shared/                 # AMAN DUA SISI — tanpa efek samping
│   ├── session-types.ts    #   tipe + nama cookie (was lib/auth-session.ts)
│   ├── rupiah.ts           #   format uang (was lib/rupiah.ts)
│   ├── nav.ts              #   definisi menu (was lib/nav.ts)
│   └── category-icon.ts    #   peta emoji kategori (was lib/meta.ts)
│
├── components/             # UI reusable (client/server sesuai directive)
│   └── ...
│
├── types/                  # Tipe global (tetap)
│   └── index.ts
│
└── middleware.ts           # edge — hanya import dari shared/
```

### Aturan folder

| Folder | Boleh import dari | Dilarang import |
|---|---|---|
| `server/` | shared, server, node:* | client, app |
| `client/` | shared, client, react | server, node:* |
| `shared/` | types, shared | server, client, node:*, react hooks |
| `components/` | shared, client, react | server (kecuali via props) |
| `middleware.ts` | shared saja | server, node:crypto, Prisma |

---

## 3. Aturan penamaan file

| Pola nama | Arti | Contoh |
|---|---|---|
| `*.server.ts` | **Keras server-only** (opsional, untuk lib) | `session.server.ts` |
| `*.client.ts` | **Keras client-only** | `offline-db.client.ts` |
| `*Client.tsx` | Komponen dengan `"use client"` | `LoginClient.tsx` |
| `use*.ts(x)` | React hook (selalu client) | `useShift.ts` |
| `page.tsx` / `layout.tsx` / `route.ts` | Konvensi Next.js — **jangan ganti** | — |

**Pilihan penerapan (dua opsi):**

- **Opsi A — folder-based (direkomendasikan):** pisah lewat folder
  (`server/`, `client/`, `shared/`). Nama file tetap deskriptif tanpa suffix.
  Lebih ringkas, sesuai idiom Next.js modern.
- **Opsi B — suffix-based:** tetap di `lib/`, tapi sufiks
  (`.server.ts`/`.client.ts`). Lebih eksplisit, tapi nama lebih panjang.

Dokumen ini memakai **Opsi A**.

---

## 4. Contoh pemakaian

**Server component (halaman) — aman panggil `server/tenant.ts`:**
```tsx
// src/app/produk/page.tsx  (server component — tanpa "use client")
import { currentWarungId } from "@/server/tenant";
export default async function ProdukPage() {
  const warungId = await currentWarungId();
  // ...
}
```

**Client component — TIDAK boleh sentuh server/:**
```tsx
"use client";
// src/app/LoginClient.tsx
import { rupiah } from "@/shared/rupiah";        // ✅ shared
// import { prisma } from "@/server/db";         // ❌ BOCOR ke bundle
```
Untuk data dari server: **fetch ke `/api/...`**, jangan import server module.

**Route handler — bebas server:**
```ts
// src/app/api/checkout/route.ts
import { prisma, transaksi } from "@/server/db";
import { currentWarungId } from "@/server/tenant";
```

---

## 5. Kenapa `shared/` penting untuk `middleware.ts`

`middleware.ts` jalan di **edge runtime** (bukan Node penuh). Ia **tidak boleh**
import `node:crypto` atau Prisma. Karena itu tipe + nama cookie session
dipisah ke `shared/session-types.ts`:

```ts
// src/shared/session-types.ts  — aman di edge
export const SESSION_COOKIE = "kring_session";
export type SessionPayload = { ... };
```
```ts
// src/server/session.ts  — Node-only, pakai node:crypto
import { createHmac } from "node:crypto";
import { SESSION_COOKIE } from "@/shared/session-types";
```

---

## 6. Cara verifikasi (mencegah regresi)

Setelah refactor, jalankan gate:
```bash
npx tsc --noEmit   # pastikan tak ada import salah
npm run lint
npm run build      # Next.js akan gagal bila modul server bocor ke client
npm test
```
`next build` adalah penjaga utama: ia error bila `node:*`/Prisma ter-import di
komponen client.

---

## 7. Checklist migrasi (dari `lib/` sekarang)

| Pindah ke | Dari | Catatan |
|---|---|---|
| `server/db.ts` | `lib/prisma.ts` | + helper `transaksi` |
| `server/session.ts` | `lib/session.ts` | node:crypto |
| `server/tenant.ts` | `lib/warung.ts` | Prisma + next/headers |
| `server/audit.ts` | `lib/audit.ts` | Prisma |
| `server/settings.ts` | `lib/settings.ts` | Prisma |
| `server/rate-limit.ts` | `lib/rate-limit.ts` | in-memory |
| `server/meja.ts` | `lib/meja.ts` | domain |
| `server/http.ts` | `lib/request.ts` | readJson |
| `client/offline-db.ts` | `lib/offline/db.ts` | IndexedDB |
| `client/offline-sync.ts` | `lib/offline/sync.ts` | fetch + IndexedDB |
| `shared/session-types.ts` | `lib/auth-session.ts` | edge-safe |
| `shared/rupiah.ts` | `lib/rupiah.ts` | murni |
| `shared/nav.ts` | `lib/nav.ts` | murni + tipe |
| `shared/category-icon.ts` | `lib/meta.ts` | murni |
| `types/index.ts` | `types/index.ts` | tetap |

> Catatan: `client/offline-sync.ts` mengimpor `@/client/offline-db` — keduanya
> satu domain (offline queue), konsisten di `client/`.

---

**Status:** ✅ **DITERAPKAN** (refactor selesai). Verifikasi: `tsc --noEmit` 0
error · `npm run lint` bersih · `npm run build` sukses · `npm test` 32/32 di
Supabase Postgres.
