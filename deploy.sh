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

echo "Membersihkan container/image/volume lama milik project ini..."
# Scoped ke service di docker-compose.yml ini saja (--rmi local: hanya image
# hasil build sendiri, bukan base image dari registry; --volumes: volume
# anonim/punya compose ini). Tidak menyentuh container lain di server yang
# sama pakai network `proxy`/`mariadb_database` yang di-share. `|| true`
# karena run pertama kali belum ada apa-apa untuk dibersihkan.
$COMPOSE down --rmi local --volumes --remove-orphans || true

echo "Build & start container..."
$COMPOSE up -d --build

echo "Menunggu container siap..."
sleep 3

echo "Menjalankan migrasi Prisma (migrate deploy)..."
$COMPOSE exec -T "$SERVICE" npx prisma migrate deploy

echo "Membersihkan dangling image sisa build lama..."
docker image prune -f

echo
echo "Selesai. Status container:"
$COMPOSE ps

echo
echo "Log terbaru (Ctrl+C untuk keluar):"
$COMPOSE logs -f --tail=50 "$SERVICE"
