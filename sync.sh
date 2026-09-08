#!/usr/bin/env bash
# Paling ringan dari ketiga script deploy: buat perubahan file .js murni
# di src/ (controller, route, service, dll) — TIDAK ada perubahan
# dependency (package.json) ATAUPUN skema Prisma. Tidak ada build Docker
# sama sekali: file baru langsung di-copy ke container yang sedang jalan,
# lalu proses Node-nya di-restart.
#
# - Ada perubahan package.json atau prisma/schema.prisma -> ./deploy.sh
# - Ada perubahan Dockerfile/dependency sistem, tapi tidak butuh migrasi
#   image lama tetap dipakai (cache) -> ./restart.sh
# - Cuma tambah/ubah controller, route, service (file biasa) -> ini
set -euo pipefail
cd "$(dirname "$0")"

COMPOSE="docker compose"
SERVICE="expressjs-api"

if ! docker inspect -f '{{.State.Running}}' "$SERVICE" 2>/dev/null | grep -q true; then
  echo "Container '$SERVICE' belum jalan. Jalankan ./deploy.sh dulu untuk setup awal."
  exit 1
fi

echo "Menarik update terbaru dari git..."
if [ -n "$(git status --porcelain)" ]; then
  echo "Ada perubahan lokal yang belum di-commit di server ini. Commit/stash dulu, baru jalankan ulang ./sync.sh:"
  git status --short
  exit 1
fi
git pull

echo "Menyalin src/ ke dalam container..."
docker cp src/. "$SERVICE":/app/src

echo "Restart proses Node di dalam container..."
$COMPOSE restart "$SERVICE"

echo
echo "Selesai. Status container:"
$COMPOSE ps

echo
echo "Log terbaru (Ctrl+C untuk keluar):"
$COMPOSE logs -f --tail=50 "$SERVICE"
