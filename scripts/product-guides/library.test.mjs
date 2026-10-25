import test from 'node:test';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { products, categories } from '../../content/product-libraries/catalog.mjs';
import { deepDives } from '../../content/product-libraries/deep-dives.mjs';
import { comparisons } from '../../content/product-libraries/comparisons.mjs';
const read=p=>readFileSync(p,'utf8');
const manifest=JSON.parse(read('dist/product-guides-manifest.json'));
const config=JSON.parse(read('vercel.json'));
const script=read('public/product-guides/guides.js');
const html=url=>read('dist/'+manifest.find(p=>p.url===url).filename);
const dom=url=>new JSDOM(html(new URL(url,'https://bloomsuite.app').pathname),{url:new URL(url,'https://bloomsuite.app').href,runScripts:'outside-only'});

test('all 168 pages have unique metadata, complete public routes and sitemap entries',()=>{
 assert.equal(manifest.length,168);
 const canonical=new Set(),titles=new Set(),sitemap=read('dist/sitemap.xml');
 for(const p of manifest){const d=new JSDOM(read('dist/'+p.filename)).window.document;
  const title=d.title,canonicalUrl=d.querySelector('link[rel=canonical]').href;
  assert(!titles.has(title),`Duplicate title ${title}`);titles.add(title);
  assert(!canonical.has(canonicalUrl));canonical.add(canonicalUrl);
  assert.equal(canonicalUrl,'https://bloomsuite.app'+p.url);
  assert.equal(d.querySelectorAll('h1').length,1,p.url);
  assert(d.querySelector('meta[name=description]').content.length>80);
  assert.equal(d.querySelector('meta[property="og:image"]').content,`https://bloomsuite.app/product-guides/${p.product}-social.png`);
  assert(existsSync(`public/product-guides/${p.product}-social.png`));
  assert(d.querySelector('main#main'));
  for(const node of d.querySelectorAll('script[type="application/ld+json"]'))assert(JSON.parse(node.textContent)['@graph']);
  for(const suffix of ['','/']){const route=config.rewrites.find(r=>r.source===p.url+suffix);assert.equal(route?.destination,'/'+p.filename);}
  assert(sitemap.includes(`<loc>${canonicalUrl}</loc>`),p.url);
 }
 assert(sitemap.includes('https://bloomsuite.app/pos/features/'), 'POS sitemap must remain present');
});
test('unknown marketing routes are 404s before the application fallback; authenticated CRM is untouched',()=>{
 const fallback=config.rewrites.findIndex(r=>r.source==='/(.*)');
 for(const p of products)for(const base of [p.base,p.compare]){const index=config.rewrites.findIndex(r=>r.source===base+'/:path*');assert(index>=0&&index<fallback);assert.equal(config.rewrites[index].destination,'/api/product-guide-not-found');}
 assert(!config.rewrites.some(r=>r.source==='/crm'||r.source==='/crm/:path*'));
 const source=read('api/product-guide-not-found.ts');assert(source.includes('statusCode = 404'));assert(source.includes('noindex, follow'));
});
test('every guide and related category is linked; internal library links resolve to generated pages',()=>{
 const paths=new Set(manifest.map(p=>p.url));
 for(const p of products){const hubDoc=new JSDOM(html(p.base)).window.document;
  for(const c of categories[p.id])for(const f of c.features){assert(hubDoc.querySelector(`a[href="${p.base}/${f.slug}"]`),f.slug);}
 }
 for(const page of manifest){const document=new JSDOM(read('dist/'+page.filename)).window.document;
  for(const a of document.querySelectorAll('a[href]')){const u=new URL(a.href,'https://bloomsuite.app');if(u.origin!=='https://bloomsuite.app')continue;
   if(products.some(p=>u.pathname===p.base||u.pathname.startsWith(p.base+'/')||u.pathname===p.compare||u.pathname.startsWith(p.compare+'/')||u.pathname===p.switching))assert(paths.has(u.pathname),`${page.url} => ${u.pathname}`);
  }
 }
});
for(const p of products){
 test(`${p.id}: search, category, empty state and URL restoration`,()=>{
  const d=dom(p.base);d.window.eval(script);const doc=d.window.document;
  assert.equal(doc.querySelectorAll('[data-feature]:not([hidden])').length,categories[p.id].flatMap(c=>c.features).length);
  const filter=doc.querySelectorAll('[data-filter]')[1];filter.click();assert.equal(doc.querySelectorAll('[data-feature]:not([hidden])').length,6);
  const input=doc.querySelector('#feature-search');input.value='never-match-this-query';input.dispatchEvent(new d.window.Event('input'));assert.equal(doc.querySelectorAll('[data-feature]:not([hidden])').length,0);assert(!doc.querySelector('#no-results').hidden);
  doc.querySelector('[data-reset]').click();assert.equal(doc.querySelectorAll('[data-feature]:not([hidden])').length,categories[p.id].flatMap(c=>c.features).length);assert.equal(doc.activeElement,input);
  const f=categories[p.id][0].features[0];d.window.history.replaceState(null,'',`${p.base}?q=${encodeURIComponent(f.title)}&category=${categories[p.id][0].id}`);d.window.dispatchEvent(new d.window.PopStateEvent('popstate'));
  assert.equal(doc.querySelectorAll('[data-feature]:not([hidden])').length,1);assert(doc.querySelector('#feature-count').textContent.startsWith('1 feature'));
 });
 test(`${p.id}: shortlist is shareable, capped, removable and carries into the enquiry`,()=>{
  const d=dom(p.base);d.window.eval(script);const doc=d.window.document,buttons=[...doc.querySelectorAll('[data-shortlist]')];
  for(const b of buttons.slice(0,6))b.click();assert.equal(doc.querySelectorAll('[data-shortlist-list] li').length,6);assert(buttons[6].disabled);
  const href=new URL(doc.querySelector('[data-shortlist-link]').href);assert.equal(href.searchParams.get('product'),p.id);assert.equal(href.searchParams.get('topics').split(',').length,6);
  const shared=dom(d.window.location.href);shared.window.eval(script);assert.equal(shared.window.document.querySelectorAll('[data-shortlist-list] li').length,6);
  doc.querySelector('[data-shortlist-list] button').click();assert.equal(doc.querySelectorAll('[data-shortlist-list] li').length,5);assert(!buttons[6].disabled);assert.equal(doc.activeElement,buttons[0]);
  doc.querySelector('[data-shortlist-clear]').click();assert(doc.querySelector('.shortlist').hidden);assert(!d.window.location.search.includes('topics='));
 });
 test(`${p.id}: unknown URL values are ignored and no content is injected`,()=>{
  const d=dom(p.base+'?category=__proto__&q=%3Cscript%3E&topics=constructor,__proto__,nope');d.window.eval(script);const doc=d.window.document;
  assert(doc.querySelector('[data-filter=all]').getAttribute('aria-pressed')==='true');assert.equal(doc.querySelectorAll('[data-shortlist-list] li').length,0);assert.equal(doc.querySelector('#feature-search').value,'<script>');
 });
 test(`${p.id}: comparison claims have official sources and feature-specific evaluation tasks`,()=>{
  assert.equal(comparisons[p.id].length,4);
  for(const c of comparisons[p.id]){const d=new JSDOM(html(p.compare+'/'+c.id)).window.document;assert(d.querySelector(`a[href="${c.source}"]`));assert.equal(d.querySelectorAll('.task-grid article').length,3);assert(d.querySelector('.review-date'));assert(d.body.textContent.includes('When staying makes sense'));}
 });
}

test('all 126 features have a distinct substantial walkthrough and assessment',()=>{
 const examples=new Set();assert.equal(Object.keys(deepDives).length,126);
 for(const p of products)for(const category of categories[p.id])for(const f of category.features){
  const deep=deepDives[p.id+'/'+f.slug];assert(deep);assert(deep.walkthrough.split(/\s+/).length>=45);assert(deep.assessment.split(/\s+/).length>=20);assert(!examples.has(deep.walkthrough));examples.add(deep.walkthrough);
  const document=new JSDOM(html(p.base+'/'+f.slug)).window.document;assert(document.querySelector('#example').textContent.includes(deep.walkthrough));assert(document.querySelector('#example').textContent.includes(deep.assessment));
 }
});

test('the final sitemap rebuild restores all libraries after POS-only regeneration',()=>{
 execFileSync(process.execPath,['scripts/write-pos-features.mjs'],{stdio:'pipe'});
 execFileSync(process.execPath,['scripts/write-product-guides.mjs'],{stdio:'pipe'});
 const first=read('dist/sitemap.xml');
 const document=new JSDOM(first,{contentType:'application/xml'}).window.document;
 const urls=[...document.querySelectorAll('loc')].map(element=>element.textContent);
 assert.equal(urls.length,new Set(urls).size);
 for(const page of manifest)assert(urls.includes('https://bloomsuite.app'+page.url),page.url);
 assert(urls.includes('https://bloomsuite.app/pos/features'));
 assert(urls.includes('https://bloomsuite.app/pos/compare/clover'));
 execFileSync(process.execPath,['scripts/write-product-guides.mjs'],{stdio:'pipe'});
 assert.equal(read('dist/sitemap.xml'),first,'Sitemap assembly must be idempotent');
});

test('AI searches match the acronym rather than letters inside email or campaign',()=>{
 for(const [product,expected] of [['crm',['Bloom AI assistant','AI campaign drafting']],['website',['AI page drafting']],['ecomm',[]]]){
  const d=dom('/'+product+'/features');d.window.eval(script);const document=d.window.document;
  const input=document.querySelector('#feature-search');input.value='AI';input.dispatchEvent(new d.window.Event('input'));
  const titles=[...document.querySelectorAll('[data-feature]:not([hidden]) h3')].map(node=>node.textContent);
  assert.deepEqual(titles,expected);
 }
});

test('every category link shows the actual guide count and no generated page exposes template code',()=>{
 for(const p of products)for(const category of categories[p.id]){
  const document=new JSDOM(html(p.base+'/category/'+category.id)).window.document;
  assert.equal(document.querySelector('.category-intro a').textContent.trim(),`Browse all ${categories[p.id].flatMap(c=>c.features).length} guides`);
 }
 for(const page of manifest)assert(!/\$\{[^}]*\}/.test(read('dist/'+page.filename)),page.url);
});
