#!/usr/bin/env bash
set -euo pipefail

# Builds the LOCAL CRM database from a schema-only dump of the hosted project.
#
# The tracked migrations can't build the schema from an empty database: the
# first file alters `campaigns`, which no tracked migration creates. So a fresh
# local stack is loaded from a schema-only dump instead, and every migration
# file the Supabase CLI recognises is recorded as applied, so a later
# `supabase migration up --local` runs only new files.
#
# Usage (from anywhere):
#   ./scripts/local-db-bootstrap.sh /path/to/crm-schema.sql
#   ./scripts/local-db-bootstrap.sh --finish-only   # an already-loaded database:
#                                                   # only the idempotent steps after the load
#
# Safety:
#   - It talks only to the local database container of this repo's
#     `project_id`, through `docker exec`. It never opens a network connection
#     to any database, local or remote.
#   - It refuses unless that container is running and publishes the local
#     database port from supabase/config.toml, and unless the database is still
#     empty (no tables in `public`); --finish-only instead requires the loaded
#     schema (`public.users` present).
#   - It prints counts only.

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
config="$repo_root/supabase/config.toml"
migrations_dir="$repo_root/supabase/migrations"
finish_only=false
dump="${1:-}"
if [[ "$dump" == "--finish-only" ]]; then
  finish_only=true
  dump=""
fi

fail() {
  echo "local-db-bootstrap: $*" >&2
  exit 1
}

if [[ "$finish_only" == false ]]; then
  [[ -n "$dump" ]] || fail "usage: $0 /path/to/schema-only-dump.sql | --finish-only"
  [[ -f "$dump" ]] || fail "dump not found: $dump"
fi
[[ -f "$config" ]] || fail "config not found: $config"
command -v docker >/dev/null 2>&1 || fail "docker is not available"

project_id="$(sed -n 's/^project_id = "\(.*\)"$/\1/p' "$config")"
db_port="$(awk '/^\[db\]/{in_db=1; next} /^\[/{in_db=0} in_db && /^port *=/{gsub(/[^0-9]/, ""); print; exit}' "$config")"
[[ -n "$project_id" ]] || fail "no project_id in $config"
[[ -n "$db_port" ]] || fail "no [db] port in $config (the local port block is required)"

container="supabase_db_${project_id}"
[[ "$(docker inspect -f '{{.State.Running}}' "$container" 2>/dev/null || true)" == "true" ]] \
  || fail "container $container is not running; start the local stack first"
published="$(docker port "$container" 5432/tcp 2>/dev/null || true)"
grep -qE "(^|[[:space:]])(0\.0\.0\.0|127\.0\.0\.1|\[::\]):${db_port}$" <<<"$published" \
  || fail "container $container does not publish the local database port $db_port"

psql_local() {
  docker exec -i "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -X -q "$@"
}

echo "target: $container (local port $db_port)"
if [[ "$finish_only" == false ]]; then
  existing_tables="$(psql_local -At -c "select count(*) from pg_tables where schemaname = 'public'" </dev/null)"
  [[ "$existing_tables" == "0" ]] \
    || fail "the local database already has $existing_tables tables in public; refusing to load over it"
  # A fresh local database already has Supabase's default privileges for objects
  # postgres creates in public (everything to anon, authenticated and
  # service_role). Left in place, every object the dump creates would get those
  # on top of the dump's own GRANT/REVOKE lines, so local grants would be wider
  # than hosted. Clear them for the load; the dump ends by setting them again.
  psql_local <<'SQL'
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated, service_role;
SQL
  echo "loading the schema dump ($(wc -l <"$dump") lines)..."
  psql_local >/dev/null <"$dump"
else
  [[ "$(psql_local -At -c "select to_regclass('public.users') is not null" </dev/null)" == "t" ]] \
    || fail "--finish-only needs the loaded schema (public.users is missing)"
fi

# A schema dump leaves out the auth schema, so triggers on auth.users don't
# travel with it. Re-attach the one the migrations define
# (20250702163830-c9f2a787…, still current per 20260408120000): it creates the
# public.users, tenants and subscriptions rows for a new sign-up.
psql_local <<'SQL'
drop trigger if exists on_auth_user_created_user_record on auth.users;
create trigger on_auth_user_created_user_record
  after insert on auth.users
  for each row execute function public.handle_new_user_signup();
SQL

# The other two on-signup functions (handle_new_user_team: teams and
# company_profiles; handle_new_user_subscription: the trial subscription) were
# attached outside the migrations, so their hosted trigger names aren't in the
# repo. 20260408120000 names all three as on-signup trigger functions, and both
# read NEW.raw_user_meta_data, a column only auth.users has. Attached here under
# local names so a local sign-up gets the same rows as a hosted one.
psql_local <<'SQL'
drop trigger if exists on_auth_user_created_team on auth.users;
create trigger on_auth_user_created_team
  after insert on auth.users
  for each row execute function public.handle_new_user_team();
drop trigger if exists on_auth_user_created_subscription on auth.users;
create trigger on_auth_user_created_subscription
  after insert on auth.users
  for each row execute function public.handle_new_user_subscription();
SQL

# The CLI names a migration <version>_<name>.sql. Files named any other way are
# not read by the CLI, so they are not recorded either.
versions_sql=""
recorded=0
skipped=0
for file in "$migrations_dir"/*.sql; do
  base="$(basename "$file" .sql)"
  if [[ "$base" =~ ^([0-9]+)_(.+)$ ]]; then
    versions_sql+="('${BASH_REMATCH[1]}', '${BASH_REMATCH[2]//\'/\'\'}'),"
    recorded=$((recorded + 1))
  else
    skipped=$((skipped + 1))
  fi
done
[[ "$recorded" -gt 0 ]] || fail "no migration files found in $migrations_dir"

psql_local <<SQL
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text not null primary key,
  statements text[],
  name text
);
insert into supabase_migrations.schema_migrations (version, name)
values ${versions_sql%,}
on conflict (version) do nothing;
SQL

echo "migration files: $((recorded + skipped)) (recorded as applied: $recorded; not CLI-named, skipped: $skipped)"
psql_local -At </dev/null -c "
select 'tables: ' || count(*) filter (where c.relkind in ('r', 'p'))
  || ', views: ' || count(*) filter (where c.relkind in ('v', 'm'))
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname not in ('pg_catalog', 'information_schema', 'auth', 'storage', 'realtime', 'extensions',
                        'graphql', 'graphql_public', 'net', 'pgsodium', 'vault', 'supabase_functions',
                        'supabase_migrations', 'cron', 'pgbouncer', '_realtime', '_analytics')
  and n.nspname not like 'pg_toast%' and n.nspname not like 'pg_temp%';"
psql_local -At </dev/null -c "
select 'functions in public: ' || count(*) from pg_proc where pronamespace = 'public'::regnamespace;"
psql_local -At </dev/null -c "select 'policies: ' || count(*) from pg_policies;"
psql_local -At </dev/null -c "select 'history rows: ' || count(*) from supabase_migrations.schema_migrations;"
psql_local -At </dev/null -c "select 'triggers on auth.users: ' || count(*) from pg_trigger where tgrelid = 'auth.users'::regclass and not tgisinternal;"
psql_local -At </dev/null -c "
select 'default privileges for new public objects (tables, sequences, functions): ' || count(*)
from pg_default_acl
where defaclrole = 'postgres'::regrole and defaclnamespace = 'public'::regnamespace
  and array_to_string(defaclacl, ' ') like '%anon=%';"
