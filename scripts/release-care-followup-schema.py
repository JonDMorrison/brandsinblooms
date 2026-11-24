"""Narrow CRM release: apply reviewed care migrations with canonical version history."""
import json
import os
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REF = "udldmkqwnxhdeztyqcau"
MIGRATIONS = (
    "20261124143000_care_followup_campaigns.sql",
    "20261124151000_website_care_followup_campaigns.sql",
    "20261124152000_native_pos_care_order_location.sql",
    "20261124153000_care_followup_editor_permission_names.sql",
)
if os.environ.get("PROJECT_ID") != REF:
    raise SystemExit("Care follow-up migration target is not the verified CRM production project")
token = os.environ.get("SUPABASE_ACCESS_TOKEN")
if not token:
    raise SystemExit("Missing configured Supabase access token")
if os.environ.get("GITHUB_REF") != "refs/heads/main":
    raise SystemExit("Care follow-up schema can only be released from main")

def query(sql):
    request = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{REF}/database/query",
        data=json.dumps({"query": sql}).encode(),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            return json.load(response)
    except Exception as error:
        # Do not emit request bodies, credentials, or database diagnostic data.
        raise SystemExit(f"Scoped care migration query failed ({type(error).__name__})") from None

def literal(value):
    return "'" + value.replace("'", "''") + "'"

for file in MIGRATIONS:
    version, name = file[:-4].split("_", 1)
    rows = query(f"select version,name from supabase_migrations.schema_migrations where version={literal(version)} or name={literal(name)}")
    if rows:
        if len(rows) != 1 or rows[0]["version"] != version or rows[0]["name"] != name:
            raise SystemExit(f"Migration history conflict: {file}; no changes applied for this file")
        print(f"Already recorded: {file}")
        continue
    body = (ROOT / "supabase" / "migrations" / file).read_text()
    # Each reviewed file has a single outer BEGIN/COMMIT pair. Strip only those
    # boundaries so DDL and the canonical migration record commit atomically.
    match = re.fullmatch(r"\s*BEGIN;\s*(.*?)\s*COMMIT;\s*", body, flags=re.DOTALL | re.IGNORECASE)
    if not match:
        raise SystemExit(f"Unexpected migration transaction boundaries: {file}")
    statement = match.group(1)
    query("BEGIN; SET LOCAL lock_timeout='5s'; "
          "SELECT pg_advisory_xact_lock(hashtextextended('care-followup-release',0)); "
          + statement + "; INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES("
          + literal(version) + "," + literal(name) + ",ARRAY[" + literal(body) + "]); COMMIT;")
    print(f"Applied and recorded: {file}")

rows = query("""SELECT to_regclass('bloom_pos_private.care_followup_campaigns') IS NOT NULL AS pos_table,
 to_regclass('bloom_pos_private.care_website_followup_campaigns') IS NOT NULL AS website_table,
 to_regprocedure('public.care_followup_delivery_guard(uuid,jsonb)') IS NOT NULL AS guard,
 has_function_privilege('service_role','public.care_followup_delivery_guard(uuid,jsonb)','EXECUTE') AS service_guard,
 NOT has_function_privilege('authenticated','public.care_followup_delivery_guard(uuid,jsonb)','EXECUTE') AS member_denied""")
if len(rows) != 1 or not all(rows[0].values()):
    raise SystemExit("Care follow-up schema verification failed; affected functions were NOT deployed")
print("Verified both private campaign evidence authorities and service-only delivery guard.")
