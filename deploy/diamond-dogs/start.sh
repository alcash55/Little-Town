#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../backend"
: "${RENDER_EXTERNAL_URL:?Render must supply this instance URL}"
: "${INSTANCE_SUPABASE_PROJECT_REF:?Set the separate Diamond Dogs project ref}"
if [[ "$INSTANCE_SUPABASE_PROJECT_REF" == faqivcgrhrvuwpistivp || "${SUPABASE_URL:-}" != "https://${INSTANCE_SUPABASE_PROJECT_REF}.supabase.co" ]]; then
  echo "Refusing to start: configure the separate Diamond Dogs database." >&2
  exit 1
fi
export FRONTEND_URL="$RENDER_EXTERNAL_URL"
export FRONTEND_DIST_DIR=../frontend/dist
exec bun --bun dist/index.js
