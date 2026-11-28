import {fireEvent,render,screen} from '@testing-library/react';
import {describe,it,expect} from 'vitest';
import {FormPreviewRenderer} from '../preview/FormPreviewRenderer';
import {DEFAULT_FORM_SETTINGS,DEFAULT_FORM_COMPLIANCE} from '@/types/formBuilder';
import {normalizeFormSettings} from '@/lib/forms/designSettings';
import {applyFormBrandColors,NEUTRAL_FORM_COLORS,resolveFormColors} from '@/lib/forms/formColors';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {join} from 'node:path';
const fields=[{id:'phone',type:'phone' as const,label:'Mobile',mapping_key:'phone',required:false}];
describe('published form appearance',()=>{
 it('preserves saved appearance and renders image, instructions, floating labels and transparent background',()=>{
  const settings=normalizeFormSettings({...DEFAULT_FORM_SETTINGS,label_position:'floating',header_image_url:'https://example.com/hero.jpg',header_image_alt:'Garden',header_image_position:'right',footer_text:'Privacy instructions',theme:{...DEFAULT_FORM_SETTINGS.theme,background_style:'transparent'}});
  const {container}=render(<FormPreviewRenderer fields={fields} settings={settings} compliance={DEFAULT_FORM_COMPLIANCE}/>);
  expect(screen.getByAltText('Garden')).toHaveAttribute('src','https://example.com/hero.jpg');
  expect(screen.getByText('Privacy instructions')).toBeVisible();
  expect(container.querySelector('form')?.parentElement?.style.backgroundColor).toBe('transparent');
  const input=screen.getByLabelText('Mobile');
  expect(input).toHaveStyle({paddingTop:'22px'});
  fireEvent.change(input,{target:{value:'letters'}});
  expect(screen.getByText('Please enter a valid phone number')).toBeVisible();
  fireEvent.change(input,{target:{value:'604 555 1234'}});
  expect(screen.queryByText('Please enter a valid phone number')).toBeNull();
 });
 it('preserves description line breaks and formats bullets as safe text',()=>{
  const {container}=render(<FormPreviewRenderer fields={fields} compliance={DEFAULT_FORM_COMPLIANCE} settings={{...DEFAULT_FORM_SETTINGS,form_description:'Intro\n\n- Garden tips\n* Offers\n<img src=x onerror=alert(1)>'}}/>);
  const description=Array.from(container.querySelectorAll('p')).find(p=>p.textContent?.startsWith('Intro'));
  expect(description?.textContent).toBe('Intro\n\n• Garden tips\n• Offers\n<img src=x onerror=alert(1)>');
  expect(description).toHaveStyle({whiteSpace:'pre-wrap'});
  expect(description?.querySelector('img')).toBeNull();
 });
 it('renders each header once, in the order shown in the editor',()=>{
  render(<FormPreviewRenderer fields={fields} compliance={DEFAULT_FORM_COMPLIANCE} settings={{...DEFAULT_FORM_SETTINGS,form_headline:'Headline',form_subheadline:'Subheadline',form_title:'Title',form_description:'Description'}}/>);
  const ordered=['Headline','Subheadline','Title','Description'].map(t=>screen.getByText(t));
  for(let i=1;i<ordered.length;i++) expect(ordered[i-1].compareDocumentPosition(ordered[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 });
});

describe('form colours follow the brand, never the stock green',()=>{
 const STOCK=/#22c55e|rgba?\(\s*34\s*,\s*197\s*,\s*94|#16a34a|#1e40af/i;
 it('resolves form choice, then brand, then neutral, skipping stock defaults',()=>{
  expect(resolveFormColors({primary_color:'#AA3366'},{primary:'#41A9BE'}).primary_color).toBe('#AA3366');
  expect(resolveFormColors({},{primary:'#41a9be'}).primary_color).toBe('#41A9BE');
  expect(resolveFormColors({primary_color:'#22C55E',secondary_color:'#1E40AF'},{primary:'#22c55e',secondary:'#1e40af'})).toEqual({
   primary_color:NEUTRAL_FORM_COLORS.primary,secondary_color:NEUTRAL_FORM_COLORS.secondary,text_color:NEUTRAL_FORM_COLORS.text,
  });
 });
 it('new forms store no colours, and stored stock colours normalize away',()=>{
  expect(DEFAULT_FORM_SETTINGS.theme.primary_color).toBeUndefined();
  expect(normalizeFormSettings({theme:{primary_color:'#22C55E'}}).theme.primary_color).toBeUndefined();
 });
 it('renders the brand colour, and no stock green when the brand is unset',()=>{
  const branded=applyFormBrandColors(normalizeFormSettings(DEFAULT_FORM_SETTINGS),{primary:'#41A9BE'});
  const {container,unmount}=render(<FormPreviewRenderer fields={fields} settings={branded} compliance={DEFAULT_FORM_COMPLIANCE}/>);
  expect(container.innerHTML).toMatch(/rgb\(65, 169, 190\)|#41A9BE/i);
  unmount();
  const unset=applyFormBrandColors(normalizeFormSettings(DEFAULT_FORM_SETTINGS),{primary:'#22c55e'});
  const second=render(<FormPreviewRenderer fields={fields} settings={unset} compliance={DEFAULT_FORM_COMPLIANCE}/>);
  expect(second.container.innerHTML).not.toMatch(STOCK);
  expect(Array.from(document.querySelectorAll('style')).map(s=>s.textContent).join('')).not.toMatch(/rgb\(34, 197, 94\)/);
 });
 it('form builder, runtime and embed source contain no stock colours',()=>{
  const roots=['src/components/forms','src/lib/forms','src/pages/PublicFormPage.tsx','src/types/formBuilder.ts','public/forms','supabase/functions/get-form-config','supabase/functions/serve-embed-js'];
  const files:string[]=[];
  const walk=(p:string)=>{const st=statSync(p);if(st.isDirectory()){for(const n of readdirSync(p))walk(join(p,n));}else if(/\.(tsx?|js|css|html)$/.test(p)&&!/__tests__|\.test\./.test(p))files.push(p);};
  roots.forEach(r=>walk(join(process.cwd(),r)));
  expect(files.length).toBeGreaterThan(10);
  expect(files.filter(f=>STOCK.test(readFileSync(f,'utf8')))).toEqual([]);
 });
});
