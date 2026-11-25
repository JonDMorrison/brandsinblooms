import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Globe2, ScanLine, UsersRound, Mail, MessageSquare, SlidersHorizontal, Copy, Sparkles, Layers3 } from "lucide-react";
import { calculateSuiteEstimate, DEFAULT_SUITE_CONFIGURATION, PRODUCTS, SUITE_PRICE_BOOK as p, suiteEstimateSummary, usd, type SuiteConfiguration } from "./suiteEstimate";
import "./suiteConfigurator.css";

const icons={site:Globe2,pos:ScanLine,crm:UsersRound};
function NumberField({label,value,min=0,max,step=1,onChange,help}:{label:string;value:number;min?:number;max:number;step?:number;onChange:(value:number)=>void;help?:string}){
 return <label className="sc-field"><span>{label}</span><input type="number" min={min} max={max} step={step} value={value} onChange={e=>onChange(e.target.valueAsNumber)} onBlur={e=>onChange(Math.max(min,Math.min(max,Number.isFinite(e.target.valueAsNumber)?e.target.valueAsNumber:min)))}/>{help&&<small>{help}</small>}</label>;
}
function Step({number,title,children}:{number:string;title:string;children:ReactNode}){
 return <section className="sc-step"><div className="sc-step-heading"><span aria-hidden="true">{number}</span><h2>{title}</h2></div>{children}</section>;
}
function Usage({label,description,value,max,step,onChange,icon:Icon}:{label:string;description:string;value:number;max:number;step:number;onChange:(v:number)=>void;icon:typeof Mail}){
 return <div className="sc-usage"><div className="sc-usage-header"><Icon aria-hidden="true"/><div><strong>{label}</strong><p>{description}</p></div></div><NumberField label={label+" per month"} value={value} max={10000000} onChange={onChange}/><input className="sc-range" type="range" aria-label={label+" volume slider"} min={0} max={max} step={step} value={Math.min(max,Number.isFinite(value)?value:0)} onChange={e=>onChange(Number(e.target.value))}/><div className="sc-range-label"><span>0</span><span>{max.toLocaleString()}+</span></div></div>;
}
export function SuiteConfigurator({initialProduct}:{initialProduct?:string}){
 const [config,setConfig]=useState<SuiteConfiguration>(()=>initialProduct==="site"||initialProduct==="pos"||initialProduct==="crm"?{...DEFAULT_SUITE_CONFIGURATION,site:initialProduct==="site",pos:initialProduct==="pos",crm:initialProduct==="crm"}:DEFAULT_SUITE_CONFIGURATION);
 const [copyStatus,setCopyStatus]=useState("");
 const e=calculateSuiteEstimate(config);
 const update=<K extends keyof SuiteConfiguration>(key:K,value:SuiteConfiguration[K])=>{setConfig(c=>({...c,[key]:value}));setCopyStatus("")};
 const numeric=(key:"websites"|"locations"|"registers"|"emails"|"sms"|"segments"|"onlineSales")=>(value:number)=>update(key,value);
 const chooseAll=()=>{setConfig(c=>({...c,site:true,pos:true,crm:true}));setCopyStatus("")};
 const copy=async()=>{try{await navigator.clipboard.writeText(suiteEstimateSummary(config));setCopyStatus("Estimate copied.")}catch{setCopyStatus("Copy unavailable. Use the review link to share your estimate.")}};
 const invalid=Object.entries(config).some(([key,v])=>typeof v==="number"&&v!==e.c[key as keyof SuiteConfiguration]&&((["emails","sms","segments"].includes(key)&&config.crm)||(["locations","registers"].includes(key)&&config.pos)||(["websites","onlineSales"].includes(key)&&config.site)));
 const contact="/contact?product=suite&suiteEstimate="+encodeURIComponent(suiteEstimateSummary(config));
 return <div className="suite-configurator">
 <div className="sc-layout"><div className="sc-builder">
 <Step number="01" title="Choose your products">
 <div className="sc-goals">{PRODUCTS.map(product=>{const Icon=icons[product.id];return <label key={product.id} className={"sc-goal "+(config[product.id]?"is-selected":"")}><input type="checkbox" checked={config[product.id]} onChange={event=>update(product.id,event.target.checked)}/><span className="sc-product-icon"><Icon aria-hidden="true"/></span><span className="sc-goal-copy"><strong>{product.name}</strong><span>{product.promise}</span><small>{product.description}</small></span><span className="sc-product-price"><strong>$99</strong><small>/mo</small></span><Check className="sc-choice-check" aria-hidden="true"/></label>})}</div>
 <button type="button" className="sc-bundle" onClick={chooseAll}><Layers3 aria-hidden="true"/><span><strong>Complete BloomSuite</strong><small>All three products. Save $47 every month.</small></span><strong>$250<small>/mo</small></strong><ArrowRight aria-hidden="true"/></button>
 </Step>
 {config.crm&&<Step number="02" title="Your marketing volume">
 <div className="sc-usage-grid"><Usage label="Emails" description="20,000 included. $3 per additional 1,000, prorated." value={config.emails} max={250000} step={5000} onChange={numeric("emails")} icon={Mail}/><Usage label="SMS messages" description="Estimated 4.5¢ per standard segment." value={config.sms} max={20000} step={500} onChange={numeric("sms")} icon={MessageSquare}/></div>
 <NumberField label="Average SMS segments per message" min={1} max={10} value={config.segments} onChange={numeric("segments")} help="Longer messages and special characters can consume multiple segments."/>
 <p className="sc-note">Email and SMS scale independently. Standard customer records are not priced by list size in this proposal. Very large data sets, high-volume messaging and regional delivery need a quote.</p>
 </Step>}
 <details className="sc-details"><summary><SlidersHorizontal aria-hidden="true"/> Customize your setup <span>Optional</span></summary>
 <div className="sc-fields">
 {config.site&&<><NumberField label="Independent websites" value={config.websites} min={1} max={20} onChange={numeric("websites")} help="$99 per additional site."/><NumberField label="Estimated eligible online sales / month (USD)" value={config.onlineSales} max={100000000} step={100} onChange={numeric("onlineSales")} help="Illustrative 0.5% platform fee; payment processing is separate."/></>}
 {config.pos&&<><NumberField label="POS locations" min={1} max={100} value={config.locations} onChange={numeric("locations")} help="$79 per additional location."/><NumberField label="Registers per location" min={1} max={20} value={config.registers} onChange={numeric("registers")} help="One included per location; $29 per additional register."/></>}
 {config.crm&&<label className="sc-ai"><input type="checkbox" checked={config.advancedAi} onChange={event=>update("advancedAi",event.target.checked)}/><Sparkles aria-hidden="true"/><span>Advanced AI allowance <strong>from $29/mo</strong></span></label>}
 </div><p className="sc-note">These expansion rates are planning assumptions. Confirm your individual quote and any migration, training or equipment costs.</p></details>
 </div>
 <aside id="suite-estimate-result" className="sc-result" aria-label="Your monthly estimate"><div className="sc-result-top"><span className="sc-eyebrow">Your monthly estimate · USD</span><h2>{e.count===3?"Complete BloomSuite":e.count===0?"Choose your products":"Your BloomSuite"}</h2><div className="sc-price" aria-live="polite" aria-atomic="true"><strong data-testid="suite-total">{usd(e.bloom)}<small>/month</small></strong></div>{e.discount>0&&<span className="sc-saving"><Check size={16} aria-hidden="true"/> $47 monthly software saving</span>}</div>
 <div className="sc-result-body"><table className="sc-lines"><caption className="sr-only">Monthly USD estimate breakdown</caption><tbody>{e.rows.map(row=><tr key={row.label}><th scope="row">{row.label}</th><td>{usd(row.cents)}</td></tr>)}</tbody></table><div className="sc-subtotal"><span>Software subtotal</span><strong>{usd(e.software)}</strong></div><div className="sc-subtotal"><span>Usage & commerce estimate</span><strong>{usd(e.email+e.sms+e.commerce)}</strong></div>
 {e.quoteRequired&&<p className="sc-note">High-volume pricing: ask us for a tailored quote.</p>}
 {invalid&&<p role="alert" className="sc-note">Check the entered quantities before requesting a quote.</p>}
 {e.hasProducts&&!invalid?<Link className="sc-primary" to={contact}>Ask us to review this setup <ArrowRight size={18} aria-hidden="true"/></Link>:<button className="sc-primary" disabled>Choose valid products and quantities</button>}
 <button className="sc-copy" type="button" onClick={copy} disabled={!e.hasProducts||invalid}><Copy size={16} aria-hidden="true"/> Copy estimate</button><p role="status" className="sc-note">{copyStatus}</p>
 <p className="sc-disclaimer">Planning estimate, not a live checkout or binding quote. Excludes payment processing, taxes, sender fees, MMS, hardware, migration, training and custom integration work. Existing agreements remain unchanged. Canadian and other regional rates require confirmation.</p></div></aside>
 </div></div>;
}
export function PricingOverview(){
 return <div className="sc-overview"><div className="sc-pricing-cards">{PRODUCTS.map(product=>{const Icon=icons[product.id];return <article className="sc-price-card" key={product.id}><span className="sc-product-icon"><Icon aria-hidden="true"/></span><h2>{product.name}</h2><p>{product.promise}</p><div className="sc-card-price"><strong>$99</strong><span>/month USD</span></div><ul>{product.features.map(f=><li key={f}><Check size={17} aria-hidden="true"/>{f}</li>)}</ul><Link to={"/build-your-suite?product="+product.id} className="sc-outline">Explore {product.name} <ArrowRight size={17} aria-hidden="true"/></Link></article>})}</div><div className="sc-complete"><div><span className="sc-eyebrow">Three products. One connected business.</span><h2>Complete BloomSuite</h2><p>Websites, online selling, checkout and marketing. Start together and grow together.</p></div><div><strong>$250<small>/month USD</small></strong><span>Save $47/mo compared with three individual subscriptions.</span><Link className="sc-primary" to="/build-your-suite">Build your BloomSuite <ArrowRight size={18} aria-hidden="true"/></Link></div></div></div>;
}
