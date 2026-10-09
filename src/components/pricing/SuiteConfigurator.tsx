import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Check, Globe2, UsersRound, ScanLine, ArrowRight, Copy, Printer } from "lucide-react";
import { Button } from "@/components/ui-legacy/button";
import { calculateSuiteEstimate, DEFAULT_SUITE_CONFIGURATION, SUITE_PRICE_BOOK, suiteEstimateSummary, usd, type SuiteConfiguration } from "./suiteEstimate";
import "./suiteConfigurator.css";

type NumericKey = {[K in keyof SuiteConfiguration]: SuiteConfiguration[K] extends number ? K : never}[keyof SuiteConfiguration];
function NumberField({label, value, onChange, min = 0, max = 1000000, step = 1, help}: {label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; help?: string}) {
  return <label className="sc-field"><span>{label}</span><input type="number" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} />{help && <small>{help}</small>}</label>;
}
function Step({number, title, children}: {number: string; title: string; children: ReactNode}) {
  return <section className="sc-step" aria-labelledby={`suite-step-${number}`}><div className="sc-step-heading"><span aria-hidden="true">{number}</span><h2 id={`suite-step-${number}`}>{title}</h2></div>{children}</section>;
}

export function SuiteConfigurator() {
  const [config, setConfig] = useState<SuiteConfiguration>(DEFAULT_SUITE_CONFIGURATION);
  const [copyStatus, setCopyStatus] = useState("");
  const estimate = calculateSuiteEstimate(config);
  const update = <K extends keyof SuiteConfiguration>(key: K, value: SuiteConfiguration[K]) => {
    setCopyStatus("");
    setConfig(c => ({...c, [key]: value, ...(key === "commerce" && value ? {site: true} : {}), ...(key === "site" && !value ? {commerce: false} : {})}));
  };
  const numeric = (key: NumericKey) => (value: number) => update(key, value);
  const choose = (kind: "website" | "growth" | "complete") => {
    setCopyStatus("");
    setConfig(c => ({...c, site: true, crm: kind !== "website", pos: kind === "complete" ? "replace" : c.pos === "replace" ? "keep" : c.pos}));
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(suiteEstimateSummary(config)); setCopyStatus("Estimate copied. You can paste it into a message."); }
    catch { setCopyStatus("Copy is unavailable here. Use Print estimate or Ask us to review this setup."); }
  };
  const formError = Object.entries(config).some(([key, value]) => {
    if (key === "websites" && !config.site) return false;
    if (["locations", "registers"].includes(key) && config.pos !== "replace") return false;
    if (["contacts", "emails", "sms", "segments"].includes(key) && !config.crm) return false;
    return typeof value === "number" && value !== estimate.c[key as NumericKey];
  });
  const contactLink = `/contact?product=suite&suiteEstimate=${encodeURIComponent(suiteEstimateSummary(config))}`;
  const review = config.pos === "replace" ? "POS fit, hardware and migration need a review before activation." : config.pos === "keep" ? `${config.provider} stays in your setup. Compatibility, data direction and integration fees need review.` : config.pos === "unsure" ? "POS replacement is excluded until we assess your needs." : "No in-store POS subscription is included.";
  return <div className="suite-configurator">
    <div className="sc-starts" aria-label="Quick starting points">
      <span>Start with a pathway, then make it yours.</span><div>
        <button type="button" onClick={() => choose("website")}>Website <span>from $79</span></button>
        <button type="button" onClick={() => choose("growth")}>Growth <span>from $249</span></button>
        <button type="button" onClick={() => choose("complete")}>Complete <span>from $399</span></button>
      </div>
    </div>
    <div className="sc-mobile-estimate" aria-live="polite"><span>{estimate.name} · {usd(estimate.bloom)}/month{estimate.quoteRequired ? " floor" : ""}</span><a href="#suite-estimate-result">View breakdown</a></div>
    <div className="sc-layout">
      <div className="sc-builder">
        <Step number="01" title="What would you like to improve?">
          <div className="sc-goals">
            <label className={`sc-goal ${config.site ? "is-selected" : ""}`}><input type="checkbox" checked={config.site} onChange={e => update("site", e.target.checked)} /><Globe2 aria-hidden="true" /><span><strong>Get discovered</strong><span>A website customers can explore before they visit.</span></span><Check className="sc-choice-check" aria-hidden="true" /></label>
            <label className={`sc-goal ${config.crm ? "is-selected" : ""}`}><input type="checkbox" checked={config.crm} onChange={e => update("crm", e.target.checked)} /><UsersRound aria-hidden="true" /><span><strong>Bring customers back</strong><span>Customer relationships, email and SMS campaigns.</span></span><Check className="sc-choice-check" aria-hidden="true" /></label>
            <label className={`sc-goal ${config.commerce ? "is-selected" : ""}`}><input type="checkbox" checked={config.commerce} onChange={e => update("commerce", e.target.checked)} /><ScanLine aria-hidden="true" /><span><strong>Sell online</strong><span>Explore checkout, paid events and fundraising requirements.</span></span><Check className="sc-choice-check" aria-hidden="true" /></label>
          </div>
          <div className="sc-fields">
            <label className="sc-field"><span>Your in-store checkout</span><select value={config.pos} onChange={e => update("pos", e.target.value as SuiteConfiguration["pos"])}><option value="keep">Keep our existing POS</option><option value="replace">Explore BloomSuite POS</option><option value="none">We don’t need an in-store POS</option><option value="unsure">Help us decide</option></select></label>
            {config.pos === "keep" && <label className="sc-field"><span>Our existing system</span><select value={config.provider} onChange={e => update("provider", e.target.value)}>{["CounterPoint", "Lightspeed", "Square", "Shopify", "VMX", "Other"].map(p => <option key={p}>{p}</option>)}</select></label>}
          </div>
          <p className="sc-note">{review}</p>
        </Step>
        <Step number="02" title="How big is your setup?">
          <div className="sc-fields">
            {config.site && <NumberField label="Websites" value={config.websites} onChange={numeric("websites")} min={1} max={20} />}
            {config.crm && <NumberField label="Marketable contacts" value={config.contacts} onChange={numeric("contacts")} help="One audience across your business. More than 25,000 needs a quote." />}
            {config.pos === "replace" && <><NumberField label="Store locations" value={config.locations} onChange={numeric("locations")} min={1} max={100} /><NumberField label="Registers per location" value={config.registers} onChange={numeric("registers")} min={1} max={20} help="Two included per location; proposed $29 per extra register." /></>}
          </div>
          <p className="sc-note">No charge per seasonal staff member in this proposal. Contact tiers apply once, not again at every store.</p>
        </Step>
        {config.crm && <Step number="03" title="How often will you reach customers?">
          <div className="sc-fields">
            <NumberField label="Email sends per month" value={config.emails} onChange={numeric("emails")} max={10000000} help={`${estimate.allowance.toLocaleString()} included in the selected tier; proposed $0.002 per extra email.`} />
            <NumberField label="SMS recipients × campaigns per month" value={config.sms} onChange={numeric("sms")} max={10000000} help="Example: 500 recipients × 2 campaigns = 1,000 messages." />
            <label className="sc-field"><span>Average segments per SMS</span><select value={config.segments} onChange={e => update("segments", Number(e.target.value))}><option value={1}>1 segment</option><option value={2}>2 segments</option><option value={3}>3 segments</option></select><small>Longer messages or special characters can use more segments.</small></label>
          </div>
          <p className="sc-note">SMS uses a proposed $0.03/segment planning rate, not a universal offer. Destination, carrier and sender costs must be confirmed. Messaging is never “unlimited.”</p>
        </Step>}
        <Step number="04" title="Choose your billing rhythm">
          <div className="sc-billing" role="group" aria-label="Software billing interval"><button type="button" aria-pressed={!config.annual} onClick={() => update("annual", false)}>Monthly</button><button type="button" aria-pressed={config.annual} onClick={() => update("annual", true)}>Annual <span>Draft 15% software saving</span></button></div>
          <p className="sc-note">Annual software is prepaid. Usage, hardware, setup and payment fees are not discounted. All estimates here are USD; Canadian pricing needs a regional quote.</p>
        </Step>
        <details className="sc-details"><summary>Compare the whole bill</summary><div className="sc-fields">
          <NumberField label="Tools you will keep / month (USD)" value={config.retained} onChange={numeric("retained")} step={0.01} help="Include your existing POS subscription if keeping it." />
          <NumberField label="All current tools + messaging / month (USD)" value={config.current} onChange={numeric("current")} step={0.01} help="Your total current software spend, including retained tools." />
          <NumberField label="Card sales / month (USD)" value={config.cardVolume} onChange={numeric("cardVolume")} max={100000000} step={0.01} help="Exclude cash. Enter an invoice-based blended rate below." />
          <NumberField label="Card transactions / month" value={config.transactions} onChange={numeric("transactions")} max={10000000} />
          <NumberField label="Current processing rate (%)" value={config.oldRate} onChange={numeric("oldRate")} max={20} step={0.01} />
          <NumberField label="Proposed processing rate (%)" value={config.newRate} onChange={numeric("newRate")} max={20} step={0.01} />
          <NumberField label="Current fee per transaction (USD)" value={config.oldFixed} onChange={numeric("oldFixed")} max={10} step={0.01} />
          <NumberField label="Proposed fee per transaction (USD)" value={config.newFixed} onChange={numeric("newFixed")} max={10} step={0.01} />
          <NumberField label="Sales subject to an extra platform fee / month (USD)" value={config.platformVolume} onChange={numeric("platformVolume")} max={100000000} step={0.01} />
          <NumberField label="Current extra platform fee (%)" value={config.oldPlatform} onChange={numeric("oldPlatform")} max={20} step={0.01} />
          <NumberField label="Proposed extra platform fee (%)" value={config.newPlatform} onChange={numeric("newPlatform")} max={20} step={0.01} help="Separate from processing. Zero here is a proposal, not a change to your contract." />
        </div><p className="sc-note">Payment rates are editable scenarios, not BloomSuite offers. Credit, debit, online and regional rates differ. Current spend already includes retained tools; we carry them into the proposal rather than claim a false saving.</p>
          {config.current > 0 && <p className="sc-comparison">{estimate.difference > 0 ? `${usd(estimate.difference)} higher per month than your entered current bill.` : estimate.difference < 0 ? `${usd(-estimate.difference)} lower per month than your entered current bill.` : "Same monthly cost as your entered current bill."}</p>}
          {config.retained > config.current && config.current > 0 && <p role="alert" className="sc-error">Retained spend exceeds your current total. Check those inputs.</p>}
          {config.cardVolume > 0 && config.transactions === 0 && <p role="alert" className="sc-error">Enter a card transaction count to include fixed transaction fees.</p>}
        </details>
        <details className="sc-details"><summary>Plan setup and break-even</summary><div className="sc-fields">
          <NumberField label="Implementation budget, one-time (USD)" value={config.setup} onChange={numeric("setup")} help="A scoped quote is required. Zero means not budgeted, not free." />
          <NumberField label="Hardware budget, one-time (USD)" value={config.hardware} onChange={numeric("hardware")} />
          <NumberField label="Average additional order (USD)" value={config.orderValue} onChange={numeric("orderValue")} step={0.01} />
          <NumberField label="Gross margin on those orders (%)" value={config.grossMargin} onChange={numeric("grossMargin")} max={100} step={0.1} />
        </div><p className="sc-note">{config.current <= 0 ? "Enter your current spend above to compare break-even." : estimate.recurringOrders === null ? "Enter a positive order value and margin." : `${estimate.recurringOrders} extra orders/month cover the recurring increase; ${estimate.firstYearOrders} cover the first-year increase with entered setup and hardware.`} This uses gross profit, not revenue, and does not predict sales.</p></details>
      </div>
      <aside id="suite-estimate-result" className="sc-result" aria-labelledby="suite-recommendation">
        <div className="sc-result-top"><span className="sc-eyebrow">Your recommended starting point</span><h2 id="suite-recommendation">{estimate.name}</h2><p>{[config.site ? "BloomSites" : "", config.crm ? "CRM" : "", config.pos === "replace" ? "BloomSuite POS" : ""].filter(Boolean).join(" + ") || "Choose a goal to begin."}</p></div>
        <div className="sc-price" aria-live="polite" aria-atomic="true"><span>{estimate.quoteRequired ? "Budget floor · quote required" : "Draft software + messaging"}</span><strong data-testid="suite-total">{usd(estimate.bloom)}<small>/month{config.annual ? " equivalent" : ""}</small></strong>{config.annual && <p>{usd(estimate.annualPrepayment)} software prepaid yearly. Messaging billed separately.</p>}</div>
        <table className="sc-lines"><caption className="sr-only">Proposed monthly software and messaging breakdown in US dollars</caption><tbody>{estimate.rows.map(row => <tr key={row.label}><th scope="row">{row.label}</th><td>{usd(row.cents)}</td></tr>)}</tbody></table>
        <div className="sc-budget"><div><span>Retained tools</span><strong>{usd(estimate.c.retained * 100)}</strong></div><div><span>Entered payment + platform fees</span><strong>{usd(estimate.payments)}</strong></div><div><span>Total monthly budget{estimate.quoteRequired ? " floor" : ""}</span><strong data-testid="suite-budget">{usd(estimate.total)}</strong></div><div><span>First year + entered setup/hardware</span><strong>{usd(estimate.firstYear)}</strong></div></div>
        <p className="sc-disclaimer">Exploration only, not a binding quote. {estimate.quoteRequired && "Contact pricing above 25,000 is excluded; the 25,000-contact tier is shown as a floor. "}Taxes, sender fees, MMS, special integrations, managed services and unentered implementation costs are excluded. Commerce and POS capabilities need a fit review. Existing subscriptions and founder commitments stay unchanged.</p>
        {formError && <p role="alert" className="sc-error">Check your inputs. Counts must be whole numbers within the displayed limits; costs and usage cannot be negative. The preview uses those limits until corrected.</p>}
        <Button asChild disabled={!estimate.hasProducts || formError} className="sc-review"><Link to={contactLink} aria-disabled={!estimate.hasProducts || formError} onClick={e => {if (!estimate.hasProducts || formError) e.preventDefault();}}>Ask us to review this setup <ArrowRight size={17} aria-hidden="true" /></Link></Button>
        <div className="sc-result-actions"><button type="button" onClick={copy} disabled={!estimate.hasProducts || formError}><Copy size={16} aria-hidden="true" />Copy estimate</button><button type="button" onClick={() => window.print()}><Printer size={16} aria-hidden="true" />Print estimate</button></div>
        <p role="status" className="sc-note">{copyStatus}</p><Link className="sc-existing" to="/pricing">Looking for the current CRM plans?</Link><small className="sc-version">Price book {SUITE_PRICE_BOOK.version} · No checkout or data submission here.</small>
      </aside>
    </div>
  </div>;
}
