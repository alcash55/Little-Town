#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
: "${RENDER_EXTERNAL_URL:?Render must supply this instance URL}"
export VITE_BASEURL="$RENDER_EXTERNAL_URL"
export VITE_CLAN_ID=diamond-dogs
(cd frontend && NODE_ENV=development bun install --frozen-lockfile && bun run build)
(cd backend && bun install --production --frozen-lockfile && bun run build)
