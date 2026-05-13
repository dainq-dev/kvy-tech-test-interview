#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[setup]${NC} $1"; }
warn()  { echo -e "${YELLOW}[warn]${NC}  $1"; }
die()   { echo -e "${RED}[error]${NC} $1"; exit 1; }

# ── 1. Check required tools ──────────────────────────────────────────────────
command -v bun    >/dev/null 2>&1 || die "bun is not installed. Visit https://bun.sh"
command -v docker >/dev/null 2>&1 || die "docker is not installed."
docker info       >/dev/null 2>&1 || die "Docker daemon is not running."

# ── 2. Copy .env if not exists ───────────────────────────────────────────────
if [ ! -f "$BACKEND/.env" ]; then
  cp "$ROOT/.env.example" "$BACKEND/.env"
  info "Created backend/.env from .env.example"
else
  info "backend/.env already exists — skipping"
fi

if [ ! -f "$FRONTEND/.env.local" ]; then
  echo "NEXT_PUBLIC_API_URL=http://localhost:4000" > "$FRONTEND/.env.local"
  info "Created frontend/.env.local"
else
  info "frontend/.env.local already exists — skipping"
fi

# ── 3. Start Docker services (postgres + redis) ───────────────────────────────
info "Starting Docker services (postgres + redis)..."
docker compose -f "$ROOT/docker-compose.yml" up -d

info "Waiting for postgres to be healthy..."
until docker compose -f "$ROOT/docker-compose.yml" exec -T postgres \
  pg_isready -U postgres -d doc_verification >/dev/null 2>&1; do
  sleep 1
done
info "Postgres is ready"

# ── 4. Install dependencies ───────────────────────────────────────────────────
info "Installing backend dependencies..."
cd "$BACKEND" && bun install

info "Installing frontend dependencies..."
cd "$FRONTEND" && bun install

# ── 5. Run DB migrations + seed ───────────────────────────────────────────────
info "Running database migrations..."
cd "$BACKEND" && bun run db:migrate

info "Seeding database..."
cd "$BACKEND" && bun run db:seed

# ── 6. Done ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Setup complete! Run the project:${NC}"
echo ""
echo -e "  Terminal 1 — Backend:   ${YELLOW}cd backend && bun dev${NC}"
echo -e "  Terminal 2 — Frontend:  ${YELLOW}cd frontend && bun dev${NC}"
echo ""
echo -e "  Frontend:  http://localhost:3000"
echo -e "  Backend:   http://localhost:4000"
echo ""
echo -e "  Seller:  seller@example.com / seller123"
echo -e "  Admin:   admin@kvy.io     / admin123"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
