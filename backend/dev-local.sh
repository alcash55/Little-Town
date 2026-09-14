#!/usr/bin/env bash
set -euo pipefail

# The backend dir — this script lives in it. It used to live in backend/scripts/,
# which is where the trailing "/.." came from; the move (d3169d7) left the "/.."
# behind, so the script cd'd to the repo root, found no package.json there, and
# `bun run dev` died in `npm install`. Resolve to the script's own directory.
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

RESET_DB=false
for arg in "$@"; do
  case "$arg" in
    --reset)
      RESET_DB=true
      ;;
    --help|-h)
      cat <<'HELP'
Usage:
  bash dev-local.sh          Start Supabase, export local env, build, and run API
  bash dev-local.sh --reset  Also reset local DB and apply migrations first

Run this from WSL. If Docker Desktop is not running, this starts it and waits.
To run or debug Docker and Supabase by hand, see "Docker Desktop and WSL"
in backend/README.md.
This script never overwrites an existing .env file.
HELP
      exit 0
      ;;
    *)
      echo "Unknown option: $arg"
      exit 1
      ;;
  esac
done

need_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    exit 1
  fi
}

# Read one KEY="value" pair out of `supabase status -o env`. The bare
# `supabase status` this used to scrape now prints JSON, so the old
# box-drawing-table parse ("Project URL", "Secret", ...) silently returned
# empty strings and the script aborted. `-o env` is the stable machine format,
# and is what tests/integration/helpers.ts already parses.
extract_status_value() {
  printf '%s\n' "$STATUS" | sed -n "s/^$1=\"\(.*\)\"$/\1/p" | head -n 1
}

need_command npm
need_command npx

# Docker Desktop mounts its CLI into the distro at this path only while the app
# is running, and /usr/bin/docker is a symlink into it. With the app stopped the
# symlink dangles, `docker` falls through to the Windows-side shim, and that shim
# prints "could not be found in this WSL 2 distro... activate the WSL
# integration". The integration was on every time that message showed up (#87):
# the app just hadn't started. So check for the app before blaming the toggle.
DOCKER_DESKTOP_CLI=/mnt/wsl/docker-desktop/cli-tools/usr/bin/docker
DOCKER_DESKTOP_EXE='C:\Program Files\Docker\Docker\Docker Desktop.exe'

ensure_docker() {
  if docker info >/dev/null 2>&1; then
    return 0
  fi

  if [ ! -e "$DOCKER_DESKTOP_CLI" ] && command -v cmd.exe >/dev/null 2>&1; then
    echo "Docker Desktop is not running. Starting it (its window may take focus)..."
    cmd.exe /c start "" "$DOCKER_DESKTOP_EXE" >/dev/null 2>&1 || true
    for _ in $(seq 1 60); do
      if docker info >/dev/null 2>&1; then
        echo "Docker is up."
        return 0
      fi
      sleep 3
    done
    echo "Docker Desktop did not come up within 3 minutes."
    echo "Open it on Windows and check it finished starting, then rerun."
    echo "To stop this recurring: Docker Desktop -> Settings -> General ->"
    echo "'Start Docker Desktop when you sign in to your computer'."
    exit 1
  fi

  echo "Docker Desktop is running but not reachable from this distro."
  echo "Enable it for this distro: Settings -> Resources -> WSL integration,"
  echo "apply, then run 'wsl --shutdown' in PowerShell and reopen the terminal."
  exit 1
}

ensure_docker

if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi

if [ ! -f .env ]; then
  echo "Creating .env from .env.example..."
  cp .env.example .env
else
  echo "Keeping existing .env unchanged."
fi

echo "Starting local Supabase..."
npx supabase start >/dev/null

STATUS="$(npx supabase status -o env)"
API_URL="$(extract_status_value API_URL)"
DB_URL="$(extract_status_value DB_URL)"
STUDIO_URL="$(extract_status_value STUDIO_URL)"
SERVICE_ROLE_KEY="$(extract_status_value SERVICE_ROLE_KEY)"

if [ -z "$API_URL" ] || [ -z "$SERVICE_ROLE_KEY" ]; then
  echo "Could not read local Supabase URL/key from 'npx supabase status -o env'."
  echo "$STATUS"
  exit 1
fi

# When Docker Desktop cold-starts, it restarts the Supabase containers on its
# own and they report healthy, but the host port can be left resetting every
# connection. `supabase status` still prints the URLs, and the integration
# tests quietly skip against it (299 skips on 2026-09-14, #87). A stop/start
# rebuilds the port mapping and keeps the data volume.
if command -v curl >/dev/null 2>&1 && ! curl -s -m 5 -o /dev/null "$API_URL/rest/v1/"; then
  echo "Supabase API at $API_URL is not answering. Restarting the local stack..."
  npx supabase stop >/dev/null
  npx supabase start >/dev/null
  if ! curl -s -m 5 -o /dev/null "$API_URL/rest/v1/"; then
    echo "Supabase API at $API_URL still is not answering after a restart."
    exit 1
  fi
fi

export NODE_ENV="${NODE_ENV:-development}"
export PORT="${PORT:-8081}"
export FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"
export SUPABASE_URL="$API_URL"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"

if [ -z "${JWT_SECRET:-}" ]; then
  if grep -q '^JWT_SECRET=' .env 2>/dev/null; then
    JWT_SECRET="$(grep '^JWT_SECRET=' .env | tail -n 1 | cut -d '=' -f 2-)"
    export JWT_SECRET
  elif command -v openssl >/dev/null 2>&1; then
    export JWT_SECRET="$(openssl rand -hex 32)"
  else
    export JWT_SECRET="$(date +%s%N | sha256sum | awk '{print $1}')"
  fi
fi

cat > .env.local.generated <<EOF
# Generated by scripts/dev-local.sh for reference only.
# The script exports these values for its current process.
# Your existing .env is not modified.
NODE_ENV=$NODE_ENV
PORT=$PORT
FRONTEND_URL=$FRONTEND_URL
SUPABASE_URL=$SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY
EOF

if [ "$RESET_DB" = true ]; then
  echo "Resetting local database and applying migrations..."
  npx supabase db reset
fi

echo "Building backend..."
npm run build

cat <<INFO

Local backend configuration is ready.

API server:    http://localhost:8081
Supabase API:  $API_URL
Supabase DB:   $DB_URL
Studio:        $STUDIO_URL

Your .env file was not modified.
Reference local values were written to .env.local.generated.

Open Studio directly in your Windows browser. If Chrome shows a chrome-error:// page,
open a new tab and paste the Studio URL manually instead of reloading the error page.

Starting backend...
INFO

# `npm run dev:raw` (not `dev`) — `dev` now runs this script by default
# (TEAM-BRIEF.md Sprint 16, Track A item A2); calling it here would recurse.
npm run dev:raw
