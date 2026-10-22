"""Read-only legacy XLS adapter: mmap + on-demand sheets, streamed JSON rows."""
import json, os, resource, sys
import xlrd
source=sys.argv[1]
limit=512*1024*1024

def memory():
    value=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return value if sys.platform=='darwin' else value*1024

def emit(obj):
    print(json.dumps(obj,separators=(',',':'),ensure_ascii=False),flush=False)

book=xlrd.open_workbook(source,on_demand=True,use_mmap=True,formatting_info=False)
try:
    if len(book.sheet_names())>256:
        raise ValueError('Workbook exceeds 256 worksheet limit')
    for name in book.sheet_names():
        sheet=book.sheet_by_name(name)
        if sheet.nrows>2000000 or sheet.ncols>512:
            raise ValueError('Worksheet dimensions exceed reviewed limit')
        if memory()>limit:
            raise MemoryError('Legacy XLS exceeds 512 MB review budget')
        emit({'sheetStart':name,'rows':sheet.nrows})
        for i in range(sheet.nrows):
            if i%1000==0 and memory()>limit:
                raise MemoryError('Legacy XLS exceeds 512 MB review budget')
            emit({'row':i+1,'cells':[None if v=='' else v for v in sheet.row_values(i)]})
        emit({'sheetEnd':name,'peakRssBytes':memory()})
        book.unload_sheet(name)
finally:
    book.release_resources()
