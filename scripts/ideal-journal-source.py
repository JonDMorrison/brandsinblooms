from ideal_journal_geometry import numeric_anchor_side
import xlrd,json,re,collections
from ideal_journal_pages import horizontal_breaks,page_order
from pathlib import Path
from ideal_journal_rules import inline_void_description,change_amount,source_change_event,unresolved_void_boundary
import sys,resource,math,bisect,os
from ideal_journal_anchors import validate_event_anchors
from ideal_journal_gate import classify_receipt
source=sys.argv[1]
MEMORY_BUDGET=1536*1024*1024
MAX_ROWS=2000000
MAX_EVENTS=1000000
decoded_events=0
def append_event(stream,event):
 global decoded_events
 decoded_events+=1
 if decoded_events>MAX_EVENTS:raise ValueError('Journal exceeds event limit')
 stream.append(event)
if os.path.getsize(source)>128*1024*1024:raise ValueError('Journal source exceeds 128 MB limit')
def check_memory():
 peak=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss;peak=peak if sys.platform=='darwin'else peak*1024
 if peak>MEMORY_BUDGET:raise MemoryError('Journal decoder exceeds sampled 1536 MB RSS budget')
def validate_sheet(sheet):
 if sheet.nrows>MAX_ROWS or sheet.ncols>512:raise ValueError('Journal worksheet dimensions exceed limits')
 check_memory()
w=xlrd.open_workbook(source,on_demand=True)
if len(w.sheet_names())>256:raise ValueError('Journal exceeds worksheet limit')
receipts=[];customer=None;source_sheets=[];source_rows=0
for sn in w.sheet_names():
 sheet=w.sheet_by_name(sn);validate_sheet(sheet);source_rows+=sheet.nrows
 if source_rows>MAX_ROWS:raise ValueError('Journal exceeds source row limit')
 source_sheets.append((sn,sheet.nrows))
 for i in range(sheet.nrows):
  if i%500==0:check_memory()
  row=sheet.row_values(i)
  if isinstance(row[0],str):
   match=re.match(r'^(.+?)\s{5}(\S+)\s*$',row[0])
   if match:customer=match[2]
  for c in [0,7,8,10]:
   if c+3<len(row) and isinstance(row[c],(int,float))and 20000<=row[c]<80000 and isinstance(row[c+2],(int,float))and isinstance(row[c+3],str)and row[c+3]:
    
    if len(receipts)>=250000:raise ValueError('Journal exceeds receipt limit')
    receipts.append({'code':customer,'date':row[c],'terminal':row[c+2],'number':row[c+3],'sheet':sn,'row':i+1,'column':c})
 w.unload_sheet(sn)
headers={(r['sheet'],r['row'],r['column']):r for r in receipts};codes={r['code']for r in receipts};sections=[];section=None;safe={'GST','PST','CASH','DEBIT/CREDIT','SA','GIFT CARD','ROUNDING','CREDIT NOTE','ONLINE GIFT CARD','PROMOTIONAL','CHEQUE','Points','Total Accumulated Points','Total Savings','Change'};counts=collections.Counter()
page_breaks=horizontal_breaks(w.mem[:w.stream_len],w._sh_abs_posn)
if len(page_breaks)!=len(w.sheet_names()):raise ValueError('Sheet boundary inventory mismatch')
breaks_by_sheet=dict(zip(w.sheet_names(),page_breaks))
for sn in w.sheet_names():
 s=w.sheet_by_name(sn);validate_sheet(s)
 for i in range(s.nrows):
  if i%500==0:check_memory()
  r=s.row_values(i);v=r[0]
  if isinstance(v,str):
   m=re.match(r'^(.+?)\s{2,}(\S+)\s*$',v)
   if m and m[2]in codes:section={'code':m[2],'streams':[[],[]],'heading':{'sheet':sn,'row':i+1}};sections.append(section)
  if not section:continue
  for c in [0,7,8,10]:
   if (sn,i+1,c)in headers:append_event(section['streams'][0 if c==0 else 1],{'kind':'header','receipt':headers[(sn,i+1,c)]})
  inline=set()
  for c,v in enumerate(r):
   if v!='VOID':continue
   side=0 if c==0 else 1;d=inline_void_description(r,c)
   if d is not None:inline.add(d);append_event(section['streams'][side],{'sheet':sn,'row':i+1,'col':d,'kind':'voided_detail','cents':round(r[d+6]*100),'qty':r[d+4],'sourceVoidColumn':c})
   else:append_event(section['streams'][side],{'sheet':sn,'row':i+1,'col':c,'kind':'standalone_void'})
  for c,v in enumerate(r):
   val=lambda j:r[j]if 0<=j<len(r)else ''
   if not isinstance(v,str)or not v or c in inline or v=='VOID':continue
   if v=='Change':
    event=source_change_event(r,c,sn,i+1)
    append_event(section['streams'][0 if c==2 else 1],event)
    if event['kind']=='unresolved_change':counts['unsupportedChangeFields']+=1
    continue
   if c not in [2,9,10,11,12]or not isinstance(val(c+4),(int,float))or not isinstance(val(c+6),(int,float)):continue
   product=isinstance(val(c-2),str)and bool(val(c-2));kind='product'if product else v if v in safe else 'coupon'if v.startswith('COUPON:')else 'discount'if 'DISCOUNT'in v.upper()else 'unclassified'
   e={'sheet':sn,'row':i+1,'col':c,'kind':kind,'cents':round(val(c+6)*100),'qty':val(c+4),'creditIssue':product and bool(re.match(r'^CREDIT NOTE(?:\s*:|$)',v)),'giftIssue':product and bool(re.match(r'^(?:ONLINE )?GIFT CARD(?:\s*:|$)',v)),'ownershipExactHeading':True}
   if product:e.update({'sourceCode':val(c-2),'description':v})
   if kind=='discount':e['description']=v
   append_event(section['streams'][0 if c==2 else 1],e)
 w.unload_sheet(sn)
if sum(len(stream)for sec in sections for stream in sec['streams'])>MAX_EVENTS:raise ValueError('Journal exceeds event limit')
check_memory()
groups=[];orphans=[];continuations=[]
for sec in sections:
 active=None;pending=None;lastdate=None
 for side,event in page_order(sec['streams'],breaks_by_sheet):
  events=[event]
  for e in events:
   if e['kind']=='header':
    if unresolved_void_boundary(active,pending,'receipt_boundary'):counts['pendingVoidAtReceiptBoundary']+=1
    pending=None
    active={'receipt':e['receipt'],'events':[],'ambiguities':[]};groups.append(active)
    if lastdate is not None and e['receipt']['date']<lastdate:counts['chronologicalInversions']+=1
    lastdate=e['receipt']['date'];continue
   if not active:orphans.append({'code':sec['code'],'event':e});continue
   if active['receipt']['code']!=sec['code']:active['ambiguities'].append('header_code_mismatch')
   if side==1 and active['receipt']['column']==0:continuations.append({'receipt':active['receipt'],'event':e})
   if e['kind']=='standalone_void':
    if pending:
     active['ambiguities'].append('multiple_standalone_voids')
     unresolved_void_boundary(active,pending,'repeated_marker')
    pending=e;continue
   if pending:e['precedingStandaloneVoid']=pending;pending=None;active['ambiguities'].append('standalone_void_relationship')
   if e['kind']=='unresolved_change':active['ambiguities'].append('unresolved_change_amount')
   if e['col']==11 and e['kind']!='voided_detail':active['ambiguities'].append('unexplained_L_description')
   active['events'].append(e)
 if unresolved_void_boundary(active,pending,'section_end'):counts['pendingVoidAtSectionEnd']+=1
for key in ['pendingVoidAtReceiptBoundary','pendingVoidAtSectionEnd','unsupportedChangeFields','chronologicalInversions']:counts.setdefault(key,0)
counts.update({'sections':len(sections),'receipts':len(groups),'orphanDetails':len(orphans),'rightContinuationDetails':len(continuations),'continuedReceipts':len({(x['receipt']['sheet'],x['receipt']['row'])for x in continuations}),'ambiguousReceipts':sum(bool(g['ambiguities'])for g in groups)})

# Independent first-pass headers and decoded detail anchors must be represented exactly once.
def header_key(r):return(r['sheet'],r['row'],r['column'],r['code'],r['date'],r['terminal'],r['number'])
if collections.Counter(header_key(r)for r in receipts)!=collections.Counter(header_key(g['receipt'])for g in groups):raise ValueError('Journal header inventory differs after ownership traversal')
def detail_key(e):return(e['sheet'],e['row'],e['col'],e['kind'],e.get('qty'),e.get('cents'))
raw_details=collections.Counter(detail_key(e)for sec in sections for stream in sec['streams']for e in stream if e['kind']not in {'header','standalone_void'})
emitted_details=collections.Counter(detail_key(e)for g in groups for e in g['events'])
if raw_details!=emitted_details or orphans:raise ValueError('Journal numeric detail inventory differs after ownership traversal')
# Final pass verifies original NUMBER display formats and values; original bytes untouched.
import struct
raw=bytearray(w.mem[:w.stream_len]);pos=0
while pos+4<=len(raw):
 typ,size=struct.unpack_from('<HH',raw,pos)
 if typ==27:struct.pack_into('<H',raw,pos,65535)
 pos+=4+size
fw=xlrd.open_workbook(file_contents=bytes(raw),on_demand=True,formatting_info=True)
by_sheet=collections.defaultdict(list);errors=collections.defaultdict(set);covered=set();numeric=[]
for gi,g in enumerate(groups):
 if gi%500==0:check_memory()
 r=g['receipt']
 for col in [r['column'],r['column']+2]:covered.add((r['sheet'],r['row'],col))
 for e in g['events']:
  by_sheet[e['sheet']].append((gi,e))
  cols=[e['col']+(5 if e['col']==9 else 4)]if e['kind']=='Change'else[e['col']+4,e['col']+6]
  for col in cols:covered.add((e['sheet'],e['row'],col))
numeric_customer=None
for sn in fw.sheet_names():
 sheet=fw.sheet_by_name(sn);validate_sheet(sheet)
 for gi,e in by_sheet[sn]:
  rn=e['row']-1;formats={c:fw.format_map[fw.xf_list[sheet.cell(rn,c).xf_index].format_key].format_str for c in range(sheet.ncols)}
  errors[gi].update(validate_event_anchors(e,sheet.row_values(rn),formats))
 for rn in range(sheet.nrows):
  if rn%500==0:check_memory()
  row=sheet.row_values(rn)
  if isinstance(row[0],str):
   match=re.match(r'^(.+?)\s{5}(\S+)\s*$',row[0])
   if match and match[2]in codes:numeric_customer=match[2]
  for col,v in enumerate(row):
   if isinstance(v,(int,float))and(sn,rn+1,col)not in covered:numeric.append((sn,rn+1,col,numeric_customer,numeric_anchor_side(row,col)))
 fw.unload_sheet(sn)
# Attribute unknown anchors only inside their exact customer section and print-page order.
sheet_order={name:i for i,name in enumerate(w.sheet_names())}
def source_order(sn,row,col):return(sheet_order[sn],bisect.bisect_right(breaks_by_sheet[sn],row-1),0 if col<10 else 1,row)
header_index=collections.defaultdict(list)
for gi,g in enumerate(groups):
 if gi%500==0:check_memory()
 r=g['receipt'];header_index[r['code']].append((source_order(r['sheet'],r['row'],0 if r['column']==0 else 10),gi))
for values in header_index.values():values.sort()
unknown_by_group=collections.defaultdict(list);unowned=[]
for sn,row,col,code,side in numeric:
 if side is None:unowned.append([sn,row,col]);continue
 entries=header_index.get(code,[]);at=bisect.bisect_right(entries,(source_order(sn,row,0 if side==0 else 10),10**9))-1
 if at>=0:unknown_by_group[entries[at][1]].append([sn,row,col])
 else:unowned.append([sn,row,col])

keys=collections.Counter((g['receipt']['terminal'],g['receipt']['number'],g['receipt']['date'])for g in groups)
output=collections.defaultdict(list)
for gi,g in enumerate(groups):
 if gi%500==0:check_memory()
 r=g['receipt'];financial,merch,tax,rounding,tender=classify_receipt(g,1,keys[(r['terminal'],r['number'],r['date'])])
 reasons=sorted(set(financial)|errors[gi])
 if unknown_by_group[gi]:reasons.append('receipt_contains_unrepresented_numeric_anchors')
 if unowned:reasons.append('source_contains_unowned_numeric_anchors')
 fields={'header':r,'events':g['events'],'ambiguities':g['ambiguities'],'originalAnchorErrors':sorted(errors[gi]),'sourceFinancialExclusions':reasons,'sourceEquation':{'merchandiseCents':merch,'taxCents':tax,'roundingCents':rounding,'netTenderCents':tender},'localExcelDate':r['date'],'terminal':r['terminal'],'receiptNumber':r['number'],'timezone':None,'sourceCoverage':{'unrepresentedNumericCoordinates':unknown_by_group[gi],'globalUnrepresentedNumericCount':len(numeric),'unownedNumericCoordinates':unowned},'pageBoundaryProvenance':'original_biff_horizontal_breaks_and_continue','certificationState':'incomplete','identityState':'master_link_required'}
 output[r['sheet']].append({'row':r['row'],'normalized':{'kind':'receipt_evidence','customerCode':r['code'],'fields':fields}})
for sn,nrows in source_sheets:
 print(json.dumps({'sheetStart':sn,'rows':nrows}))
 for record in output[sn]:print(json.dumps(record,separators=(',',':')))
 peak=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss;peak=peak if sys.platform=='darwin'else peak*1024
 print(json.dumps({'sheetEnd':sn,'peakRssBytes':peak,'sampledBudgetBytes':MEMORY_BUDGET}))
