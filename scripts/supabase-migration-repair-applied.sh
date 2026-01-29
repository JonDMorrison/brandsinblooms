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
  20260120182146
  20260120182659
  20260120192029
  20260120192722
  20260120211301
  20260120214809
  20260120220950
  20260120221337
  20260120221739
  20260120222223
  20260120222949
  20260120230927
  20260120234718
  20260121193518
  20260122183409
  20260128180610
  20260128183959
  20260128184042
  20260128195905
  20260128200815
)

echo "Running ${#ids[@]} migration repair commands..."
for id in "${ids[@]}"; do
  echo "- ${supabase_cmd[*]} migration repair --status applied ${id}";
  "${supabase_cmd[@]}" migration repair --status applied "${id}" "${extra_args[@]}"
done

echo "Done."
