#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker ist nicht installiert oder nicht im PATH."
  exit 1
fi

if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    echo ".env wurde aus .env.example erstellt. Bitte Werte setzen und dann erneut starten."
  else
    echo "Keine .env gefunden. Bitte eine .env anlegen."
  fi
  exit 1
fi

ACTION="${1:-up}"

case "$ACTION" in
  up)
    docker compose build
    docker compose up -d
    docker compose ps
    ;;
  down)
    docker compose down
    ;;
  restart)
    docker compose down
    docker compose up -d --build
    docker compose ps
    ;;
  logs)
    docker compose logs -f --tail=200
    ;;
  pull)
    docker compose pull
    ;;
  *)
    echo "Usage: ./docker.sh {up|down|restart|logs|pull}"
    exit 1
    ;;
esac
