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
20260217225255
20260221120000
20260221121500
20260221123000
20260221123500
20260222120000
20260222120000
20260222121000
20260222121500
20260222130000
20260222130500
20260222133000
20260223120000
20260223143000
20260224103000
20260224113000
20260224153000
20260224173500
20260224201000
20260225103000
20260225113000
20260225140000
20260225160000
20260225173000
20260225190000
20260225213000
20260226093000
20260226113000
20260226150000
20260226162000
20260226200000
20260227103000
20260227120000
20260227153000
20260227184500
20260227201500
20260227223000
20260227235500
20260227235900
)

echo "Running ${#ids[@]} migration repair commands..."
for id in "${ids[@]}"; do
  echo "- ${supabase_cmd[*]} migration repair --status applied ${id}";
  "${supabase_cmd[@]}" migration repair --status applied "${id}" "${extra_args[@]}"
done

echo "Done."
