#!/usr/bin/env bash
set -euo pipefail

# Runs a batch of Supabase migration-history repair commands.
# Usage:
#   ./scripts/supabase-migration-repair-applied.sh
# Optional:
#   SUPABASE_PROJECT_REF=xxxx ./scripts/supabase-migration-repair-applied.sh

# Run from repo root for predictable behavior.
if git_root=$(git rev-parse --show-toplevel 2>/dev/null); then
  cd "$git_root"
fi

# Prefer the globally installed CLI, but fall back to npx (works with the
# `supabase` dependency in package.json).
supabase_cmd=()
if command -v supabase >/dev/null 2>&1; then
  supabase_cmd+=(supabase)
elif command -v npx >/dev/null 2>&1; then
  supabase_cmd+=(npx --yes supabase)
else
  echo "Error: neither 'supabase' nor 'npx' is available in PATH." >&2
  exit 1
fi

extra_args=()
if [[ -n "${SUPABASE_PROJECT_REF:-}" ]]; then
  extra_args+=(--project-ref "$SUPABASE_PROJECT_REF")
fi

ids=(
20260204001016
20260204024631
20260204133649
20260204133837
20260204134221
20260204134402
20260204134703
20260204134954
20260204180836
20260204182316
20260205161608
20260205163416
20260206090000
)

echo "Running ${#ids[@]} migration repair commands..."
for id in "${ids[@]}"; do
  echo "- ${supabase_cmd[*]} migration repair --status applied ${id}";
  "${supabase_cmd[@]}" migration repair --status applied "${id}" "${extra_args[@]}"
done

echo "Done."
