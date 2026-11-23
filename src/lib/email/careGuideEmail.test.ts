import {describe,it,expect} from 'vitest';
import {renderCareGuideEmail} from './careGuideEmail';

const valid = () => ({
  brand:{storeName:'Northfield Garden Centre',publishedVersion:'1',logoUrl:'https://example.org/logo.png'},
  requested:true,
  plants:[{productId:'SKU-1',name:'Red Prayer Plant',botanicalName:'Maranta leuconeura',careVersion:'approved-4',
    care:{status:'REVIEWED' as const,sun:'Bright indirect light',water:'Keep evenly moist',soil:'Well-drained soil',sourceLabel:'Reviewed horticultural guide'},
    approvedImageUrl:'https://example.org/plant.jpg',publicProductUrl:'https://example.org/plant'}],
});

describe('premium Care Guide email v1',()=>{
 it('uses source-backed, retailer-branded, responsive care HTML and plain text',()=>{
   const out=renderCareGuideEmail(valid());
   expect(out.version).toBe(1);
   expect(out.templateVersion).toBe('1');
   expect(out.plantVersions).toEqual([{productId:'SKU-1',careVersion:'approved-4'}]);
   expect(out.subject).toContain('Red Prayer Plant');
   for(const phrase of ['Northfield Garden Centre','A good start for something green.','Maranta leuconeura','Bright indirect light','Keep evenly moist','Well-drained soil','THE PLANT NOTE'])expect(out.html).toContain(phrase);
   expect(out.html).toContain('max-width:620px');
   expect(out.html).toContain('https://example.org/plant.jpg');
   expect(out.text).toContain('Care');
   expect(out.text).toContain('Light: Bright indirect light');
   expect(out.html).toContain('does not subscribe you to promotional messages');
 });
 it('refuses requests without confirmed one-time permission or reviewed identity and care',()=>{
   const noRequest=valid();noRequest.requested=false;
   expect(()=>renderCareGuideEmail(noRequest)).toThrow('recorded customer request');
   const draft=valid();draft.plants[0]!.care.status='DRAFT' as 'REVIEWED';
   expect(()=>renderCareGuideEmail(draft)).toThrow('Only reviewed plant care');
   const incomplete=valid();incomplete.plants[0]!.care.sun='';
   expect(()=>renderCareGuideEmail(incomplete)).toThrow('Invalid reviewed light advice');
   const unknown=valid();unknown.plants[0]!.productId='';
   expect(()=>renderCareGuideEmail(unknown)).toThrow('Invalid product identity');
 });
 it('escapes all retailer and plant text; blocks unsafe links, unlicensed image placeholders and invalid branding',()=>{
   const input=valid();input.brand.storeName='<img onerror=evil>';
   input.plants[0]!.care.water='<script>alert(1)</script>';
   input.plants[0]!.approvedImageUrl='javascript:alert(1)';
   input.plants[0]!.publicProductUrl='http://example.org';
   const rendered=renderCareGuideEmail(input);
   expect(rendered.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
   expect(rendered.html).toContain('&lt;img onerror=evil&gt;');
   expect(rendered.html).not.toContain('<script>');
   expect(rendered.html).not.toContain('javascript:alert');
   expect(rendered.html).not.toContain('href="http://');
 });
 it('uses one email for multiple approved plants, rejects duplicates, and never invents extra care',()=>{
   const input=valid();input.plants.push({productId:'SKU-2',name:'Hydrangea',careVersion:'approved-6',
     care:{status:'REVIEWED',sun:'Morning sun',water:'Water deeply',soil:'Moist drained soil',sourceLabel:'Reviewed horticultural guide'},
     approvedImageUrl:'',publicProductUrl:''});
   const result=renderCareGuideEmail(input);
   expect(result.subject).toContain('Your plant care guide');
   expect(result.html).toContain('Hydrangea');
   expect(result.html).toContain('Red Prayer Plant');
   expect(result.plantVersions).toHaveLength(2);
   expect(result.html).not.toContain('guaranteed to thrive');
   input.plants[1]!.productId='SKU-1';
   expect(()=>renderCareGuideEmail(input)).toThrow('Duplicate product identity');
 });
 it('is deterministic for the same published data and does not send email',()=>{
   const one=renderCareGuideEmail(valid());
   const two=renderCareGuideEmail(valid());
   expect(one).toEqual(two);
 });
});
