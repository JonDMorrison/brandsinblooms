/** Bounded row extraction for the small-file endpoint. Large originals use local preparation. */
type Cell = { v?: unknown; w?: string };
export type IdealWorkbook = { SheetNames: string[]; Sheets: Record<string, Record<string, unknown>> };
const columnName = (index: number): string => { let name=''; for(let n=index+1;n>0;n=Math.floor((n-1)/26))name=String.fromCharCode(65+(n-1)%26)+name; return name; };
const columnNumber = (name: string): number => [...name].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0)-1;
function bounds(sheet: Record<string,unknown>) {
 const match=/^([A-Z]+)([1-9]\d*)(?::([A-Z]+)([1-9]\d*))?$/.exec(String(sheet['!ref']??''));
 if(!match)return null;
 const start=Number(match[2])-1,end=Number(match[4]??match[2])-1,columns=columnNumber(match[3]??match[1])+1;
 if(end<start||end>1_048_575||columns>256)throw new Error('Worksheet range exceeds reviewed limits. Use local source preparation.');
 return {start,end,columns};
}
function text(sheet:Record<string,unknown>,column:number,row:number):string {
 const cell=sheet[`${columnName(column)}${row+1}`] as Cell|undefined;
 if(!cell||cell.v===null||cell.v===undefined)return '';
 return typeof cell.w==='string'?cell.w:String(cell.v);
}
export function collectIdealWorkbookRows(workbook:IdealWorkbook,maxRows=120000):Record<string,unknown>[] {
 if(!workbook.SheetNames.length)throw new Error('No worksheet in the supplied Ideal report.');
 let scanned=0,crystal=false;
 // Scan all worksheets before selecting a layout: later sheets can continue a group.
 for(const name of workbook.SheetNames){const sheet=workbook.Sheets[name];if(!sheet)throw new Error('Worksheet missing from source.');const range=bounds(sheet);if(!range)continue;
  scanned+=range.end-range.start+1;if(scanned>maxRows)throw new Error('Workbook exceeds the reviewed row limit. Use local source preparation; do not remove source rows.');
  for(let r=range.start;r<=range.end;r++)if(/^Customer\s+\S+\s+-\s+/i.test(text(sheet,1,r).trim()))crystal=true;
 }
 const result:Record<string,unknown>[]=[];let expectedHeaders:string[]|null=null;
 for(const name of workbook.SheetNames){const sheet=workbook.Sheets[name],range=bounds(sheet);if(!range)continue;
  let headers:string[]|null=null;
  for(let r=range.start;r<=range.end;r++){
   const cells=Array.from({length:range.columns},(_,c)=>text(sheet,c,r));if(cells.every(v=>!v.trim()))continue;
   if(!crystal&&!headers){headers=cells.map(v=>v.trim());if(new Set(headers.filter(Boolean)).size!==headers.filter(Boolean).length)throw new Error('Duplicate source column headings require a reviewed mapping.');
    if(expectedHeaders&&JSON.stringify(headers)!==JSON.stringify(expectedHeaders))throw new Error('Worksheets have different column layouts. Review each report family separately.');expectedHeaders=headers;continue;}
   const row:Record<string,unknown>=Object.create(null);
   for(let c=0;c<cells.length;c++){const key=crystal?columnName(c):headers?.[c];if(key)row[key]=cells[c];else if(cells[c].trim())throw new Error('A source value has no column heading; mapping required.');}
   row.__sourceSheet=name;row.__sourceRow=r+1;result.push(row);
  }
 }
 return result;
}
