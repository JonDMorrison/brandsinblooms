#!/usr/bin/env bash
set -euo pipefail

# NOTE: GitHub Actions auto-deploys changed edge functions on push to main.
# This script is for manual deploys (hotfixes, testing, or if CI is unavailable).

PROJECT_REF="udldmkqwnxhdeztyqcau"

CORE_FUNCTIONS=(
  send-test-email-v2
  send-email-campaign
  process-automation-outbox
  refresh-constant-contact-token
  handle-sms-reply
  birthday-automation-checker
  lapsed-customer-checker
  lightspeed-webhook-handler
  lightspeed-webhook-health
  square-webhook-handler
  clover-webhook-handler
)

# --- Preflight checks ---

# Must be in brandsinblooms directory
if [[ "$(basename "$PWD")" != "brandsinblooms" ]]; then
  echo "ERROR: Must be run from the brandsinblooms directory."
  echo "  cd to your project root and try again."
  exit 1
fi

# Supabase CLI must be installed
if ! command -v supabase &>/dev/null; then
  echo "ERROR: supabase CLI not found."
  echo "  Install it: brew install supabase/tap/supabase"
  exit 1
fi

# --- Determine which functions to deploy ---

declare -a FUNCTIONS_TO_DEPLOY=()

if [[ $# -eq 0 ]]; then
  # No argument — deploy core functions
  echo "Deploying core functions..."
  FUNCTIONS_TO_DEPLOY=("${CORE_FUNCTIONS[@]}")

elif [[ "$1" == "all" ]]; then
  # Deploy every function in supabase/functions/
  echo "Deploying ALL functions in supabase/functions/..."
  for dir in supabase/functions/*/; do
    fn="$(basename "$dir")"
    # Skip internal directories
    [[ "$fn" == _* ]] && continue
    FUNCTIONS_TO_DEPLOY+=("$fn")
  done

else
  # Deploy a single named function
  fn="$1"
  if [[ ! -d "supabase/functions/$fn" ]]; then
    echo "ERROR: Function '$fn' not found in supabase/functions/"
    exit 1
  fi
  FUNCTIONS_TO_DEPLOY=("$fn")
fi

# --- Deploy ---

total=${#FUNCTIONS_TO_DEPLOY[@]}
succeeded=0
failed=0
declare -a FAILED_NAMES=()

echo ""
echo "=== Deploying $total function(s) to project $PROJECT_REF ==="
echo ""

for fn in "${FUNCTIONS_TO_DEPLOY[@]}"; do
  printf "[%d/%d] Deploying %-40s " "$((succeeded + failed + 1))" "$total" "$fn"

  if npx supabase functions deploy "$fn" --project-ref "$PROJECT_REF" --no-verify-jwt 2>/dev/null; then
    echo "✓"
    ((succeeded++))
  else
    echo "FAILED"
    ((failed++))
    FAILED_NAMES+=("$fn")
  fi
done

# --- Summary ---

echo ""
echo "=== Deployment Summary ==="
echo "  Total:     $total"
echo "  Succeeded: $succeeded"
echo "  Failed:    $failed"

if [[ $failed -gt 0 ]]; then
  echo ""
  echo "  Failed functions:"
  for fn in "${FAILED_NAMES[@]}"; do
    echo "    - $fn"
  done
  echo ""
  echo "Re-run a single function with: ./scripts/deploy-functions.sh $fn"
  exit 1
fi

echo ""
echo "All deployments succeeded."
