#!/usr/bin/env bash
#
# Weekly refresh for the cached trip plans behind "Get estimate" and
# "Generate itinerary" on the travel guides.
#
# Writes to both public/trip-plans/ (the source of truth, committed) and
# dist/trip-plans/ (what the running server actually serves), so the refresh
# goes live without a rebuild, a restart, or any downtime.
#
# Install on the production host:
#
#   chmod +x scripts/refresh-trip-plans.sh
#   crontab -e
#
#   # Trypinn — refresh cached trip plans, Mondays at 03:17
#   17 3 * * 1 /path/to/TrypInn/scripts/refresh-trip-plans.sh >> /path/to/TrypInn/logs/trip-plans.log 2>&1
#
# An odd minute is deliberate: it keeps this off the top of the hour when
# every other cron on the box fires.
#
# What actually changes week to week:
#   - Cost estimates and plan structure are rebuilt every run (free, no API).
#   - Place lists are only re-fetched from OpenAI when older than
#     PLACES_TTL_DAYS (default 90). Re-rolling them weekly would cost more and
#     make recommendations look random to anyone who comes back. To force a
#     full refresh: scripts/refresh-trip-plans.sh --force
set -euo pipefail

cd "$(dirname "$0")/.."

# cron runs with a minimal PATH; bun usually is not on it.
export PATH="$HOME/.bun/bin:/usr/local/bin:/opt/homebrew/bin:$PATH"

if ! command -v bun >/dev/null 2>&1; then
    echo "[$(date -Is)] ERROR: bun not found on PATH ($PATH)" >&2
    exit 1
fi

# Pick up OPENAI_API_KEY (and anything else) from .env without exporting
# comments or blank lines.
if [ -f .env ]; then
    set -a
    # shellcheck disable=SC1091
    . ./.env
    set +a
fi

echo "[$(date -Is)] refreshing trip plans${1:+ ($1)}"

# Itinerary cards: re-resolves any stop whose coordinates are older than 25
# days (Google's terms allow caching lat/lng for at most 30). Add --gpt once the
# OpenAI key works to extract itineraries from new trip-shaped posts.
bun run scripts/build-itineraries.js --dist "$@"

echo "[$(date -Is)] done"
