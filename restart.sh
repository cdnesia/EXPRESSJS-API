#!/usr/bin/env bash
# Deploy cepat untuk perubahan kode biasa (tambah/ubah controller, route,
# service) — TIDAK ada perubahan dependency (package.json) atau skema
# Prisma. Kalau ada salah satu dari itu, pakai ./deploy.sh saja (itu yang
# bersih-bersih image lama & jalankan migrasi).
#
# Beda dari deploy.sh:
# - Tidak `compose down --rmi local --volumes` dulu -> image lama tetap
#   ada, jadi build ulang bisa pakai cache layer (lebih cepat).
# - Tidak menjalankan `prisma migrate deploy` (tidak relevan buat
#   perubahan controller/route/service saja).
# - Tidak `docker image prune`.
set -euo pipefail
cd "$(dirname "$0")"

COMPOSE="docker compose"
SERVICE="expressjs-api"

echo "Menarik update terbaru dari git..."
if [ -n "$(git status --porcelain)" ]; then
  echo "Ada perubahan lokal yang belum di-commit di server ini. Commit/stash dulu, baru jalankan ulang ./quick-deploy.sh:"
  git status --short
  exit 1
fi
git pull

if [ ! -f .env ]; then
  echo "File .env tidak ditemukan. Jalankan ./deploy.sh dulu untuk setup awal."
  exit 1
fi

echo "Build & restart container (pakai cache layer)..."
$COMPOSE up -d --build "$SERVICE"

echo
echo "Selesai. Status container:"
$COMPOSE ps

echo
echo "Log terbaru (Ctrl+C untuk keluar):"
$COMPOSE logs -f --tail=50 "$SERVICE"
