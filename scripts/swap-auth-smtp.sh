#!/usr/bin/env bash
# Swap Supabase Auth's outbound SMTP to Resend for the BloomSuite project.
# Idempotent — safe to re-run; PATCH only overwrites listed fields.
#
# Required env:
#   SUPABASE_PAT     Personal access token from https://supabase.com/dashboard/account/tokens
#   RESEND_API_KEY   Sending-scoped API key from https://resend.com/api-keys (recommend scoping to bloomsuite.app)
#
# Optional env (with defaults):
#   SUPABASE_PROJECT_REF   default: udldmkqwnxhdeztyqcau (BloomSuite production)
#   SMTP_ADMIN_EMAIL       default: no-reply@bloomsuite.app
#   SMTP_SENDER_NAME       default: BloomSuite
#   SMTP_MAX_FREQUENCY     default: 60 (seconds between emails to same address)
#   RATE_LIMIT_EMAIL_SENT  default: 30 (per hour, project-wide)
#
# Usage:
#   SUPABASE_PAT=sbp_... RESEND_API_KEY=re_... ./scripts/swap-auth-smtp.sh

set -euo pipefail

: "${SUPABASE_PAT:?SUPABASE_PAT is required — mint at https://supabase.com/dashboard/account/tokens}"
: "${RESEND_API_KEY:?RESEND_API_KEY is required — mint a Sending-scoped key at https://resend.com/api-keys}"

PROJECT_REF="${SUPABASE_PROJECT_REF:-udldmkqwnxhdeztyqcau}"
SMTP_ADMIN_EMAIL="${SMTP_ADMIN_EMAIL:-no-reply@bloomsuite.app}"
SMTP_SENDER_NAME="${SMTP_SENDER_NAME:-BloomSuite}"
SMTP_MAX_FREQUENCY="${SMTP_MAX_FREQUENCY:-60}"
RATE_LIMIT_EMAIL_SENT="${RATE_LIMIT_EMAIL_SENT:-30}"

ENDPOINT="https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth"

echo "→ Patching auth config for project ${PROJECT_REF}"
echo "  sender:        ${SMTP_SENDER_NAME} <${SMTP_ADMIN_EMAIL}>"
echo "  host:port:     smtp.resend.com:465"
echo "  max frequency: ${SMTP_MAX_FREQUENCY}s"
echo "  hourly cap:    ${RATE_LIMIT_EMAIL_SENT}"
echo

http_status=$(curl --silent --show-error --output /tmp/swap-auth-smtp.body --write-out '%{http_code}' \
  -X PATCH "${ENDPOINT}" \
  -H "Authorization: Bearer ${SUPABASE_PAT}" \
  -H "Content-Type: application/json" \
  --data @- <<JSON
{
  "external_email_enabled": true,
  "mailer_secure_email_change_enabled": true,
  "smtp_admin_email": "${SMTP_ADMIN_EMAIL}",
  "smtp_sender_name": "${SMTP_SENDER_NAME}",
  "smtp_host": "smtp.resend.com",
  "smtp_port": 465,
  "smtp_user": "resend",
  "smtp_pass": "${RESEND_API_KEY}",
  "smtp_max_frequency": ${SMTP_MAX_FREQUENCY},
  "rate_limit_email_sent": ${RATE_LIMIT_EMAIL_SENT}
}
JSON
)

if [[ "${http_status}" != "200" ]]; then
  echo "✗ FAILED — HTTP ${http_status}"
  cat /tmp/swap-auth-smtp.body
  exit 1
fi

echo "✓ Auth SMTP swapped to Resend (HTTP ${http_status})"
echo
echo "Verifying current config (smtp fields only):"
curl --silent --show-error \
  -X GET "${ENDPOINT}" \
  -H "Authorization: Bearer ${SUPABASE_PAT}" \
  | python3 -c '
import json, sys
cfg = json.load(sys.stdin)
fields = ["smtp_admin_email","smtp_sender_name","smtp_host","smtp_port","smtp_user","smtp_max_frequency","rate_limit_email_sent","external_email_enabled"]
for k in fields:
    v = cfg.get(k, "<unset>")
    print(f"  {k}: {v}")
'

echo
echo "Done. Smoke test by requesting a password reset at https://bloomsuite.app/forgot-password"
echo "and confirming the mail arrives from ${SMTP_ADMIN_EMAIL} (check Resend → Logs)."
