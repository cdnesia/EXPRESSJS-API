#!/usr/bin/env bash
# Build & jalankan container API ini dengan satu perintah:
#   ./deploy.sh
#
# Asumsi (sesuai docker-compose.yml):
# - Network eksternal `proxy` (Traefik) dan `mariadb_database` (MariaDB
#   di server, dipakai bareng oleh service lain) sudah ada. Kalau belum,
#   script ini yang membuatkannya.
# - File .env sudah terisi (DATABASE_URL, JWT secret, dll) — kalau belum
#   ada, script berhenti dan minta diisi dulu dari .env.example.
set -euo pipefail
cd "$(dirname "$0")"

COMPOSE="docker compose"
SERVICE="expressjs-api"

if [ ! -f .env ]; then
  echo "File .env tidak ditemukan. Menyalin dari .env.example..."
  cp .env.example .env
  echo "Isi dulu .env (DATABASE_URL, JWT secret, dll) lalu jalankan ulang ./deploy.sh"
  exit 1
fi

for net in proxy mariadb_database; do
  if ! docker network inspect "$net" >/dev/null 2>&1; then
    echo "Membuat network eksternal '$net'..."
    docker network create "$net"
  fi
done

echo "Build & start container..."
# --force-recreate: pastikan container selalu dibuat ulang dari image baru,
# tidak cuma dilanjutkan/di-reuse — penting karena base image Dockerfile
# pakai tag `latest`, jadi Compose tidak selalu mendeteksi ada perubahan.
$COMPOSE up -d --build --force-recreate

echo "Menunggu container siap..."
sleep 3

echo "Menjalankan migrasi Prisma (migrate deploy)..."
$COMPOSE exec -T "$SERVICE" npx prisma migrate deploy

echo
echo "Selesai. Status container:"
$COMPOSE ps

echo
echo "Log terbaru (Ctrl+C untuk keluar):"
$COMPOSE logs -f --tail=50 "$SERVICE"
