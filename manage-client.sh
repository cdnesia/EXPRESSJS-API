#!/usr/bin/env bash
# Jalankan CLI interaktif "npm run manage-client" di dalam container yang
# sedang jalan di server — supaya pakai koneksi database & env production
# yang sama dengan API-nya, bukan .env lokal.
set -euo pipefail
cd "$(dirname "$0")"

COMPOSE="docker compose"
SERVICE="expressjs-api"

if ! docker inspect -f '{{.State.Running}}' "$SERVICE" 2>/dev/null | grep -q true; then
  echo "Container '$SERVICE' belum jalan. Jalankan ./deploy.sh dulu untuk setup awal."
  exit 1
fi

$COMPOSE exec "$SERVICE" npm run manage-client
