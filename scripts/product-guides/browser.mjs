import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { categories } from '../../content/product-libraries/catalog.mjs';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
const manifest=JSON.parse(readFileSync('dist/product-guides-manifest.json','utf8'));
const config=JSON.parse(readFileSync('vercel.json','utf8'));
const notFound=(await import('data:text/javascript;base64,'+Buffer.from(readFileSync('api/product-guide-not-found.ts','utf8')).toString('base64'))).default;
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp','.ico':'image/x-icon','.xml':'application/xml'};
const server=createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const exact=config.rewrites.find(r=>r.source===pathname);
 if(exact?.destination==='/api/product-guide-not-found'||(!exact&&/^\/(crm|website|ecomm)\/(features|compare)\//.test(pathname)))return notFound(req,res);
 const file=resolve('dist','.'+(exact?.destination||pathname));
 if(!file.startsWith(resolve('dist')+'/')||!existsSync(file)||extname(file)===''){res.writeHead(404);res.end('Not found');return;}
 res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});res.end(readFileSync(file));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
let checks=0;
const screenshotDir=process.env.GUIDE_SCREENSHOTS||'/tmp/product-guide-screenshots';mkdirSync(screenshotDir,{recursive:true});
try{
 const context=await browser.newContext();const page=await context.newPage();const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 for(const width of [360,1440]){
  await page.setViewportSize({width,height:1000});
  for(const item of manifest){
   const response=await page.goto(origin+item.url,{waitUntil:'load'});assert.equal(response.status(),200,item.url);
   const metrics=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,h1:document.querySelector('h1')?.textContent}));
   if(metrics.scroll>metrics.width)console.error(await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+2).slice(0,12).map(e=>({tag:e.tagName,cls:e.className,right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width}))));
   assert(metrics.scroll<=metrics.width,`${item.url} overflows ${metrics.scroll}/${metrics.width} at ${width}`);assert(metrics.h1,item.url);checks++;
  }
 }
 for(const product of ['crm','website','ecomm']){
  for(const width of [390,768,1440]){
   await page.setViewportSize({width,height:1000});await page.goto(origin+`/${product}/features`);
   const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
   assert.deepEqual(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[],`${product} accessibility at ${width}`);
   if(width!==768)await page.screenshot({path:`${screenshotDir}/${product}-${width}.png`,fullPage:true});
  }
  const input=page.getByRole('searchbox');await input.fill('NO RESULT EXPECTED');await page.getByRole('button',{name:'Clear search and filters'}).click();
  assert.equal(await page.locator('[data-feature]:visible').count(),categories[product].flatMap(c=>c.features).length);
  await page.locator('[data-shortlist]').first().click();assert.equal(await page.locator('[data-shortlist-list] li').count(),1);
  const target=await page.locator('[data-shortlist-link]').getAttribute('href');assert(target.includes('topics='));
  await page.reload();assert.equal(await page.locator('[data-shortlist-list] li').count(),1);
  for(const suffix of ['features/no-such-feature','compare/no-such-vendor']){const response=await page.goto(origin+`/${product}/${suffix}`);assert.equal(response.status(),404);assert.equal(response.headers()['x-robots-tag'],'noindex, follow');}
  const feature=manifest.find(p=>p.product===product&&p.url.split('/').length===4&&p.url.includes('/features/'));
  await page.goto(origin+feature.url);await page.screenshot({path:`${screenshotDir}/${product}-detail.png`,fullPage:true});
  const detailAxe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.equal(detailAxe.violations.length,0,JSON.stringify(detailAxe.violations));
 }
 assert.deepEqual(errors,[]);
 const noJS=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});const noPage=await noJS.newPage();
 await noPage.goto(origin+'/crm/features');assert.equal(await noPage.locator('[data-feature]').count(),categories.crm.flatMap(c=>c.features).length);await noJS.close();
 console.log(`Browser verification passed: ${checks} page/viewport combinations, 12 accessibility scans, search, shortlist/reload, real 404 handler and no-JavaScript content.`);
}finally{await browser.close();server.close();}
