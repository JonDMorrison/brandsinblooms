"""Read original BIFF print boundaries, including standard CONTINUE payloads."""
import struct

def horizontal_breaks(raw, sheet_offsets=None):
    records=[];p=0
    while p+4<=len(raw):
        typ,size=struct.unpack_from('<HH',raw,p)
        if p+4+size>len(raw):raise ValueError('Truncated BIFF record')
        records.append((typ,bytes(raw[p+4:p+4+size]),p));p+=4+size
    if p!=len(raw):raise ValueError('Truncated BIFF header')
    out=[];locations=[]
    for i,(typ,data,offset) in enumerate(records):
        if typ!=27:continue
        j=i+1
        while j<len(records) and records[j][0]==60:data+=records[j][1];j+=1
        if len(data)<2:raise ValueError('Missing page-break count')
        count=struct.unpack_from('<H',data)[0]
        if len(data)!=2+6*count:raise ValueError('Incomplete page-break payload')
        triples=[struct.unpack_from('<HHH',data,2+k*6)for k in range(count)]
        if any(a!=1 or b!=256 for _,a,b in triples):raise ValueError('Unsupported partial-width break')
        rows=[x[0]for x in triples]
        if rows!=sorted(set(rows)):raise ValueError('Unordered page breaks')
        out.append(rows);locations.append(offset)
    if sheet_offsets is not None:
        starts=list(sheet_offsets)
        if starts!=sorted(set(starts)):raise ValueError('Invalid sheet offsets')
        result=[]
        for index,start in enumerate(starts):
            end=starts[index+1] if index+1<len(starts) else len(raw)
            matches=[rows for pos,rows in zip(locations,out) if start<=pos<end]
            if len(matches)!=1:raise ValueError('Expected one page-break record per worksheet')
            result.append(matches[0])
        if len(locations)!=len(result):raise ValueError('Page-break record outside worksheet')
        return result
    return out

def page_order(streams,breaks_by_sheet):
    from bisect import bisect_right
    ordered=[]
    sheet_order={name:i for i,name in enumerate(breaks_by_sheet)}
    for side,events in enumerate(streams):
        for index,e in enumerate(events):
            source=e['receipt'] if e['kind']=='header' else e
            sheet=source['sheet'];row=source['row']
            page=bisect_right(breaks_by_sheet[sheet],row-1)
            ordered.append(((sheet_order[sheet],page,side,row,index),side,e))
    return [(side,e)for _,side,e in sorted(ordered,key=lambda x:x[0])]
