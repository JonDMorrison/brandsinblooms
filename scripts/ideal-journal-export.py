"""Write staged receipt NDJSON for one journal year. Local times are America/Vancouver."""
import json,sys,hashlib,datetime,collections,re,xlrd
from zoneinfo import ZoneInfo
src,lines_path,out=sys.argv[1],sys.argv[2],sys.argv[3]
sha=hashlib.sha256(open(src,'rb').read()).hexdigest()
w=xlrd.open_workbook(src,on_demand=True);s=w.sheet_by_index(0)
period=s.row_values(5)[4];m=re.match(r'(\d\d \w\w\w \d{4}) [\d:]+ to (\d\d \w\w\w \d{4})',period)
ps=datetime.datetime.strptime(m[1],'%d %b %Y').date().isoformat();pe=datetime.datetime.strptime(m[2],'%d %b %Y').date().isoformat()
tz=ZoneInfo('America/Vancouver');base=datetime.datetime(1899,12,30)
keys=collections.Counter();recs=[];stats=collections.Counter();outside=0
for line in open(lines_path):
  d=json.loads(line)
  local=(base+datetime.timedelta(days=d['date'])).replace(microsecond=0)
  if not (ps<=local.date().isoformat()<=pe):outside+=1
  t=local.replace(tzinfo=tz).isoformat()
  key=f"{int(d['terminal'])}-{d['number']}"
  keys[key]+=1
  recs.append([d['code'],t,key,':'.join(map(str,d['src'])),[[l['code'],l['name'],l['qty'],l['gross_cents'],l['discount_cents'],l['net_cents'],l['kind'],':'.join(map(str,l['src']))] for l in d['lines']]])
  stats['lines']+=len(d['lines']);stats['net']+=sum(l['net_cents'] for l in d['lines'])
dups={k:v for k,v in keys.items() if v>1}
# Duplicate terminal/number pairs get their source position appended so every receipt key is unique.
for r in recs:
  if r[2] in dups:r[2]=r[2]+'@'+r[3]
head={'file':src.rsplit('/',1)[-1],'sha256':sha,'period_start':ps,'period_end':pe,'receipts':len(recs),'lines':stats['lines'],'net_cents':stats['net'],'customers':len({r[0] for r in recs}),'duplicate_keys':len(dups),'outside_period':outside,'timezone':'America/Vancouver'}
with open(out,'w') as f:
  f.write(json.dumps(head)+'\n')
  for r in recs:f.write(json.dumps(r,separators=(',',':'),ensure_ascii=False)+'\n')
print(json.dumps(head))
