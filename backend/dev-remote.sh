#!/usr/bin/env bash
set -euo pipefail

# TEAM-BRIEF.md Sprint 16, Track A item A2 — the deliberate, explicit escape
# hatch for pointing a local backend at the hosted PRODUCTION Supabase
# project (and, if DISCORD_ENABLED=true is also set, the real Discord bot).
#
# `bun run dev` (dev-local.sh) is the safe default and targets the local
# Supabase stack. This script exists for the rare case where you actually
# need to run against real prod data locally. It requires typed
# confirmation on every run — that friction is the entire point (see
# backend/src/config/envGuard.ts).

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if [ ! -f .env.production ]; then
  echo "backend/.env.production not found."
  echo "Copy backend/.env.production.example to backend/.env.production and fill in real values first."
  exit 1
fi

cat <<'BANNER'
=====================================================================
 DELIBERATE REMOTE MODE

 This starts the backend against the HOSTED PRODUCTION Supabase
 project (backend/.env.production), and — only if DISCORD_ENABLED=true
 is also set in that file — logs in the REAL shared Discord bot.

 Any reads/writes this process makes touch REAL data.
=====================================================================
BANNER

read -r -p "Type 'yes-hit-prod' to continue: " CONFIRM
if [ "$CONFIRM" != "yes-hit-prod" ]; then
  echo "Aborted."
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env.production
set +a

export NODE_ENV="${NODE_ENV:-development}"
export ALLOW_REMOTE_DB=true

echo "Connecting to SUPABASE_URL=$SUPABASE_URL (ALLOW_REMOTE_DB=true set for this process)."

npm run dev:raw
