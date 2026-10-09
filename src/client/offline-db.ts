// Pembungkus IndexedDB native (tanpa dependency) untuk antrean offline.
//
// Keputusan D1: pakai API IndexedDB native alih-alih library `idb` agar nol
// dependency baru (box ini dibagi bersama; hindari menambah rantai build).
// API di bawah sengaja kecil & stabil supaya worker lain cukup bergantung ke sini.
//
// ⚠️ Modul ini HANYA boleh dipakai di browser (client). Di server `indexedDB`
// tidak ada — semua fungsi mengembalikan error/promise yang jelas bila dipanggil
// di non-browser, TIDAK melempar saat import (aman untuk SSR).

import type { OutboxEntry } from "@/client/offline-types";

const DB_NAME = "kring-offline";
const DB_VERSION = 1;
export const OUTBOX_STORE = "outbox";
export const CACHE_STORE = "cache";

/** True bila kode berjalan di browser dengan IndexedDB tersedia. */
export function hasIndexedDB(): boolean {
  return typeof indexedDB !== "undefined";
}

/** Buka (dan buat bila perlu) database offline. */
export function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDB()) {
      reject(new Error("IndexedDB tidak tersedia (bukan browser)."));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      // Antrean transaksi offline, key = id (UUID client-side).
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        const store = db.createObjectStore(OUTBOX_STORE, { keyPath: "id" });
        // Urutkan berdasarkan waktu dibuat → sync FIFO.
        store.createIndex("createdAt", "createdAt");
        store.createIndex("status", "status");
      }
      // Cache produk/settings/shift agar kasir bisa jualan saat offline
      // sebelum data server ter-fetch. key = string bebas (mis. "products").
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Gagal membuka IndexedDB."));
  });
}

function txRequest<T>(store: IDBObjectStore, req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Operasi IndexedDB gagal."));
    void store; // tx ditutup otomatis oleh browser
  });
}

// ── Outbox ────────────────────────────────────────────────────────

export async function putOutbox(entry: OutboxEntry): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(OUTBOX_STORE, "readwrite");
  await txRequest(tx.objectStore(OUTBOX_STORE), tx.objectStore(OUTBOX_STORE).put(entry));
  db.close();
}

export async function getOutbox(id: string): Promise<OutboxEntry | undefined> {
  const db = await openDb();
  const tx = db.transaction(OUTBOX_STORE, "readonly");
  const out = await txRequest(tx.objectStore(OUTBOX_STORE), tx.objectStore(OUTBOX_STORE).get(id));
  db.close();
  return out as OutboxEntry | undefined;
}

export async function deleteOutbox(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(OUTBOX_STORE, "readwrite");
  await txRequest(tx.objectStore(OUTBOX_STORE), tx.objectStore(OUTBOX_STORE).delete(id));
  db.close();
}

/** Seluruh antrean, terurut dari yang paling lama (FIFO) — untuk sync batch. */
export async function listOutbox(): Promise<OutboxEntry[]> {
  const db = await openDb();
  const tx = db.transaction(OUTBOX_STORE, "readonly");
  const all = (await txRequest(
    tx.objectStore(OUTBOX_STORE),
    tx.objectStore(OUTBOX_STORE).getAll()
  )) as OutboxEntry[];
  db.close();
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

/** Hitung antrean yang belum selesai (pending/syncing/error/conflict). */
export async function countOutbox(): Promise<number> {
  const all = await listOutbox();
  return all.length;
}

// ── Cache (produk/settings/shift) ─────────────────────────────────

export async function putCache(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(CACHE_STORE, "readwrite");
  await txRequest(tx.objectStore(CACHE_STORE), tx.objectStore(CACHE_STORE).put(value, key));
  db.close();
}

export async function getCache<T = unknown>(key: string): Promise<T | undefined> {
  const db = await openDb();
  const tx = db.transaction(CACHE_STORE, "readonly");
  const out = await txRequest(tx.objectStore(CACHE_STORE), tx.objectStore(CACHE_STORE).get(key));
  db.close();
  return out as T | undefined;
}

/** Hapus SELURUH data offline (outbox + cache). Dipakai saat logout. */
export async function clearAll(): Promise<void> {
  if (!hasIndexedDB()) return;
  const db = await openDb();
  const tx = db.transaction([OUTBOX_STORE, CACHE_STORE], "readwrite");
  tx.objectStore(OUTBOX_STORE).clear();
  tx.objectStore(CACHE_STORE).clear();
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Gagal membersihkan IndexedDB."));
  });
  db.close();
}
