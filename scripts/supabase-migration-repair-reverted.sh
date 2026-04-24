#!/usr/bin/env bash
set -euo pipefail

# Runs a batch of Supabase migration-history repair commands (status=reverted).
# Usage:
#   ./scripts/supabase-migration-repair-reverted.sh
# Optional:
#   SUPABASE_PROJECT_REF=xxxx ./scripts/supabase-migration-repair-reverted.sh

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
20260417214821
20260418103148
20260418105352
20260419192837
)

echo "Running ${#ids[@]} migration repair commands (reverted)..."
for id in "${ids[@]}"; do
  echo "- ${supabase_cmd[*]} migration repair --status reverted ${id}";
  "${supabase_cmd[@]}" migration repair --status reverted "${id}" "${extra_args[@]}"
done

echo "Done."
