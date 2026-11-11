# Local destructive fixture test only. Fixed localhost/database; never use production.
import subprocess,time,json
from pathlib import Path
base=['/opt/homebrew/opt/postgresql@18/bin/psql','-X','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p','55439','-d','bloom_search_benchmark']
def sql(q):return subprocess.run(base,input=q,text=True,capture_output=True)
sql('DROP INDEX crm_customers_bloom_population_page_idx; DROP FUNCTION bloom_summary_search_page(uuid,uuid,timestamptz,uuid,text);')
body=Path('supabase/migrations/20261105003000_bloom_bounded_summary_search.sql').read_text()
writer=subprocess.Popen(base,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
writer.stdin.write("BEGIN; LOCK TABLE crm_customers IN ROW EXCLUSIVE MODE; SELECT 'locked'; SELECT pg_sleep(2); ROLLBACK;\n");writer.stdin.close()
while True:
 line=writer.stdout.readline()
 if not line: raise RuntimeError('Fixture lock was not established')
 if 'locked' in line: break
start=time.monotonic();blocked=sql('BEGIN;'+body+'COMMIT;');blocked_ms=(time.monotonic()-start)*1000
assert blocked.returncode!=0 and 'lock timeout' in blocked.stderr,blocked
check=sql("SELECT to_regclass('public.crm_customers_bloom_population_page_idx');");assert 'crm_customers_bloom_population_page_idx' not in check.stdout
writer.wait()
start=time.monotonic();success=sql('BEGIN;'+body+'COMMIT;');success_ms=(time.monotonic()-start)*1000
assert success.returncode==0,success.stderr
start=time.monotonic();guard=sql("BEGIN; SET LOCAL transaction_timeout='500ms'; SELECT pg_sleep(1); COMMIT;");guard_ms=(time.monotonic()-start)*1000
assert guard.returncode!=0 and 'transaction timeout' in guard.stderr,guard
print(json.dumps({'targetTenantCustomers':47934,'wholeTableRows':int(sql('SELECT count(*) FROM crm_customers;').stdout.splitlines()[2].strip()),'blockedBuildMs':blocked_ms,'blockedError':blocked.stderr.strip(),'rollbackLeftNoIndex':True,'uncontendedMigrationMs':success_ms,'transactionTimeoutProbeMs':guard_ms,'guardError':guard.stderr.strip()},indent=2))
