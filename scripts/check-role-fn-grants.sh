#!/usr/bin/env bash
# Pre-deploy guard: ensure has_role / user_has_restaurant_access / user_owns_restaurant
# remain EXECUTE-able by `authenticated` and `anon`. Exits non-zero on failure.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -z "${PGHOST:-}" ]; then
  echo "ERROR: PGHOST not set — cannot connect to the database." >&2
  exit 2
fi
psql -v ON_ERROR_STOP=1 -f "$DIR/check-role-fn-grants.sql"
echo "✅ All role-check functions are EXECUTE-able by authenticated and anon."
