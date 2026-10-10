#!/usr/bin/env bash
# Aktifkan WhatsApp KRING!: isi WA_API_TOKEN + nyalakan WA_ENABLED di .env.
#
# Pemakaian:
#   bash scripts/aktifkan-wa.sh <TOKEN_FONNTE> [PROVIDER]
#   PROVIDER: "fonnte" (default) | "cloud_api"
#
# Setelah jalan, verifikasi: login owner → POST /api/notifikasi/kirim-pending.
set -euo pipefail

TOKEN="${1:-}"
PROVIDER="${2:-fonnte}"

if [ -z "$TOKEN" ]; then
  echo "ERROR: token kosong. Pemakaian: bash scripts/aktifkan-wa.sh <TOKEN> [fonnte|cloud_api]" >&2
  exit 1
fi
if [ "$PROVIDER" != "fonnte" ] && [ "$PROVIDER" != "cloud_api" ]; then
  echo "ERROR: PROVIDER harus 'fonnte' atau 'cloud_api'." >&2
  exit 1
fi

ENV_FILE=".env"
[ -f "$ENV_FILE" ] || { echo "ERROR: .env tidak ada di $(pwd)" >&2; exit 1; }

# Idempoten: hapus baris WA_* lama, lalu tulis ulang blok WA.
TMP="$(mktemp)"
grep -vE '^(WA_ENABLED|WA_PROVIDER|WA_API_TOKEN|WA_BASE_URL)=' "$ENV_FILE" > "$TMP" || true

BASE_URL="https://api.fonnte.com"
[ "$PROVIDER" = "cloud_api" ] && BASE_URL="https://graph.facebook.com/v21.0"

{
  cat "$TMP"
  echo ""
  echo "# ── WhatsApp (diaktifkan $(date +%Y-%m-%d)) ──"
  echo "WA_PROVIDER=\"$PROVIDER\""
  echo "WA_BASE_URL=\"$BASE_URL\""
  echo "WA_API_TOKEN=\"$TOKEN\""
  echo "WA_ENABLED=\"true\""
} > "$ENV_FILE"

rm -f "$TMP"
echo "OK: WA aktif (provider=$PROVIDER). WA_ENABLED=true, token tersimpan di .env (di-ignore git)."
echo "Langkah berikut:"
echo "  1. Pastikan nomor WA owner ada: set Warung.telepon (dipakai sbg tujuan notifikasi)."
echo "  2. Restart server (npm run dev / redeploy Vercel)."
echo "  3. Uji: POST /api/notifikasi/kirim-pending (owner-only)."
