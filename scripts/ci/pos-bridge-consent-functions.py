import re
from pathlib import Path
sources = [
 ('supabase/migrations/20260903154054_tenant_crm_role_foundation.sql','get_current_crm_access'),
 ('supabase/migrations/20260903142617_atomic_channel_consent_management.sql','set_customer_marketing_consent'),
 ('supabase/migrations/20260903235000_authorize_staff_consent_changes.sql','set_customer_marketing_consent_authorized'),
]
functions=[]
for path,name in sources:
 text=Path(path).read_text()
 match=re.search(r'CREATE OR REPLACE FUNCTION public\.'+name+r'\([\s\S]*?\n\$\$;',text)
 assert match, 'Production consent function moved: '+name
 functions.append(match.group())
Path('/tmp/pos-consent-functions.sql').write_text('\n'.join(functions))
