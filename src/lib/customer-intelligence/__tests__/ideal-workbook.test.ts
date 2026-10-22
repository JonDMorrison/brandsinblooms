import {describe,it,expect} from 'vitest';
import * as XLSX from 'xlsx';
import {collectIdealWorkbookRows} from '../../../../supabase/functions/_shared/customer-intelligence/ideal-workbook';
import {inspectIdealSource} from '../../../../supabase/functions/_shared/customer-intelligence/ideal-source-review';
function workbook(sheets:unknown[][][]){const wb=XLSX.utils.book_new();sheets.forEach((rows,i)=>XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),`Sheet${i+1}`));return wb;}
describe('all-worksheet Ideal source extraction',()=>{
 it('retains all worksheets and exact source row coordinates, including hidden sheets',()=>{
  const wb=workbook([[['Customer Code','Amount'],['000001',10]],[['Customer Code','Amount'],['000002',20]]]);
  wb.Workbook={Sheets:[{name:'Sheet1',Hidden:0},{name:'Sheet2',Hidden:1}]};
  expect(collectIdealWorkbookRows(wb)).toEqual([{__sourceSheet:'Sheet1',__sourceRow:2,'Customer Code':'000001',Amount:'10'},{__sourceSheet:'Sheet2',__sourceRow:2,'Customer Code':'000002',Amount:'20'}]);
 });
 it('preserves formatted leading-zero IDs',()=>{const wb=workbook([[['Customer Code'],[123]]]);wb.Sheets.Sheet1.A2.w='000123';expect(collectIdealWorkbookRows(wb)[0]['Customer Code']).toBe('000123');});
 it('carries Crystal group context across worksheets without losing provenance',()=>{
  const line=['','Product','Perennials','','','','',2,'',20];
  const wb=workbook([[['','Customer 000123 - Synthetic'],['','Sales Category 2 Nursery'],line],[line]]);
  const rows=collectIdealWorkbookRows(wb);const review=inspectIdealSource('Customer Sales.xls',Object.keys(rows[0]),rows);
  expect(review.review.accepted).toBe(2);expect(review.normalizedRows[1]).toMatchObject({'Customer Code':'000123',__sourceSheet:'Sheet2',__sourceRow:1});expect(review.review.canMeasureVisits).toBe(false);
 });
 it('fails before partial extraction when the aggregate worksheet row budget is exceeded',()=>expect(()=>collectIdealWorkbookRows(workbook([[['Code'],['1']],[['Code'],['2']]]),3)).toThrow('row limit'));
 it('rejects mixed worksheets and duplicate headings rather than silently discarding columns',()=>{
  expect(()=>collectIdealWorkbookRows(workbook([[['Code'],['1']],[['Coupon'],['2']]]))).toThrow('different column layouts');
  expect(()=>collectIdealWorkbookRows(workbook([[['Code','Code'],['1','2']]]))).toThrow('Duplicate');
 });
 it('rejects values under a missing heading',()=>expect(()=>collectIdealWorkbookRows(workbook([[['Code',''],['1','unmapped']]]))).toThrow('no column heading'));
});
