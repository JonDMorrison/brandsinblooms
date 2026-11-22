import {fireEvent,render,screen} from '@testing-library/react';
import {describe,it,expect} from 'vitest';
import {FormPreviewRenderer} from '../preview/FormPreviewRenderer';
import {DEFAULT_FORM_SETTINGS,DEFAULT_FORM_COMPLIANCE} from '@/types/formBuilder';
import {normalizeFormSettings} from '@/lib/forms/designSettings';
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
 it('renders each header once, in the order shown in the editor',()=>{
  render(<FormPreviewRenderer fields={fields} compliance={DEFAULT_FORM_COMPLIANCE} settings={{...DEFAULT_FORM_SETTINGS,form_headline:'Headline',form_subheadline:'Subheadline',form_title:'Title',form_description:'Description'}}/>);
  const ordered=['Headline','Subheadline','Title','Description'].map(t=>screen.getByText(t));
  for(let i=1;i<ordered.length;i++) expect(ordered[i-1].compareDocumentPosition(ordered[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 });
});
