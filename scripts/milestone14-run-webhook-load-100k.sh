#!/usr/bin/env bash
set -euo pipefail

if ! command -v npx >/dev/null 2>&1; then
  echo "npx is required"
  exit 1
fi

: "${WEBHOOK_URL:?WEBHOOK_URL is required, e.g. http://127.0.0.1:54321/functions/v1/email-tracking-webhook}"

OUT_DIR="${OUT_DIR:-./tmp/milestone14-load}"
SCENARIO_FILE="$OUT_DIR/artillery-webhook-100k.yml"
REPORT_FILE="$OUT_DIR/artillery-webhook-100k-report.json"

mkdir -p "$OUT_DIR"

cat > "$SCENARIO_FILE" <<'YAML'
config:
  target: "__WEBHOOK_URL__"
  phases:
    - duration: 600
      arrivalRate: 167
  defaults:
    headers:
      content-type: application/json
  processor: "./scripts/milestone14-webhook-processor.cjs"

scenarios:
  - name: "resend-like-webhook-100k"
    flow:
      - post:
          url: "/"
          beforeRequest: "attachHeaders"
          json:
            type: "email.sent"
            created_at: "{{ now_iso }}"
            data:
              email_id: "{{ email_id }}"
              to:
                - "{{ recipient_email }}"
              from: "noreply@example.com"
              subject: "Milestone 14 load test"
              tags:
                - name: "campaign_id"
                  value: "{{ campaign_id }}"
                - name: "tenant_id"
                  value: "{{ tenant_id }}"
YAML

cat > "$OUT_DIR/milestone14-webhook-processor.cjs" <<'JS'
'use strict';

module.exports = {
  attachHeaders: function attachHeaders(req, _context, _events, done) {
    const now = Date.now();
    const rand = Math.floor(Math.random() * 1_000_000_000);

    _context.vars.now_iso = new Date(now).toISOString();
    _context.vars.email_id = `load-${now}-${rand}`;
    _context.vars.recipient_email = `load+${rand}@example.com`;
    _context.vars.campaign_id = process.env.LOAD_CAMPAIGN_ID || '00000000-0000-0000-0000-000000000000';
    _context.vars.tenant_id = process.env.LOAD_TENANT_ID || '00000000-0000-0000-0000-000000000000';

    if (process.env.WEBHOOK_SECRET && process.env.WEBHOOK_SIGNATURE) {
      req.headers = req.headers || {};
      req.headers['resend-timestamp'] = String(Math.floor(now / 1000));
      req.headers['resend-signature'] = process.env.WEBHOOK_SIGNATURE;
    }

    return done();
  },
};
JS

ESCAPED_URL="${WEBHOOK_URL//\//\/}"
sed "s/__WEBHOOK_URL__/${ESCAPED_URL}/g" "$SCENARIO_FILE" > "$SCENARIO_FILE.tmp"
mv "$SCENARIO_FILE.tmp" "$SCENARIO_FILE"

echo "Running Artillery 100k webhook load against: $WEBHOOK_URL"

npx artillery run "$SCENARIO_FILE" --output "$REPORT_FILE"

echo "Load test complete. Raw report: $REPORT_FILE"
