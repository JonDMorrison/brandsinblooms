/**
 * BloomSuite public showroom bar.
 *
 * One shared header for every public demo surface (POS back office, POS register,
 * BloomSites editor, CRM). Identical copies live in the CMS and CRM repositories;
 * keep this file framework-free (React + plain CSS) so the copies stay in step.
 * Canonical source: Brands-In-Blooms/bloomtill packages/ui/src/showroom.
 */
import { useEffect, useId, useRef, useState } from "react";
import "./showroom.css";

export type ShowroomProductId = "pos-backoffice" | "pos-register" | "websites" | "crm";

export interface ShowroomProduct {
  id: ShowroomProductId;
  group: "BloomSuite POS" | "BloomSites Website Builder" | "BloomSuite CRM";
  name: string;
  description: string;
  href: string;
  /** False until that showroom is publicly deployed. Shown honestly as "Coming soon". */
  available: boolean;
}

export const SHOWROOM_HOME = "https://bloomsuite.app";
export const SHOWROOM_BOOK_DEMO = "https://bloomsuite.app/contact";

export const SHOWROOM_PRODUCTS: readonly ShowroomProduct[] = [
  { id: "pos-backoffice", group: "BloomSuite POS", name: "Back office", description: "Products, stock, customers, loyalty and reports.", href: "https://demo.bloomsuite.app/", available: true },
  { id: "pos-register", group: "BloomSuite POS", name: "Register", description: "Ring up plants, add a loyalty member and take a practice payment.", href: "https://bloomtill-till-demo.vercel.app/", available: true },
  { id: "websites", group: "BloomSites Website Builder", name: "Website editor", description: "Click any headline or photo on a garden centre homepage and change it.", href: "https://demo.bloomsuite.app/websites/", available: false },
  { id: "crm", group: "BloomSuite CRM", name: "Customers & marketing", description: "Contacts, segments, newsletters, forms and automations.", href: "https://demo.bloomsuite.app/crm/", available: false },
];

export interface ShowroomBarProps {
  current: ShowroomProductId;
  /** Restores the pristine sample data for this visitor only. */
  onReset: () => void;
  /** Short "things to try" list for the current screen. */
  tips?: readonly string[];
  /** Overrides availability, e.g. from a build flag, without editing the shared list. */
  products?: readonly ShowroomProduct[];
  /** Square BloomSuite mark served by the host app. */
  logoSrc?: string;
}

export function ShowroomBar({ current, onReset, tips = [], products = SHOWROOM_PRODUCTS, logoSrc }: ShowroomBarProps) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const helpRef = useRef<HTMLDetailsElement>(null);
  const [confirming, setConfirming] = useState(false);
  const helpId = useId();
  const active = products.find(product => product.id === current);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      for (const ref of [menuRef, helpRef]) if (ref.current?.open && !ref.current.contains(event.target as Node)) ref.current.open = false;
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const escape = (event: React.KeyboardEvent<HTMLDetailsElement>) => {
    if (event.key === "Escape") { event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); }
  };
  const groups = Array.from(new Set(products.map(product => product.group)));

  return <header className="bss-bar" role="banner" aria-label="BloomSuite demo">
    <a className="bss-brand" href={SHOWROOM_HOME} aria-label="BloomSuite home">
      {logoSrc ? <img className="bss-logo" src={logoSrc} alt="" width="28" height="28" /> : <span className="bss-logo" aria-hidden="true">B</span>}
      <span className="bss-brand-name">BloomSuite</span>
    </a>
    <span className="bss-pill" title="Sample garden centre. Made-up data. Nothing you do here is real or saved.">Demo</span>

    <details className="bss-menu" ref={menuRef} onKeyDown={escape}>
      <summary aria-label={`Products. Now viewing ${active ? `${active.group} ${active.name}` : "demo"}`}>
        <span className="bss-menu-label">Products</span>
        <span className="bss-menu-current">{active ? `${active.group.replace("BloomSuite ", "").replace(" Website Builder", "")} · ${active.name}` : ""}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </summary>
      <div className="bss-menu-panel">
        {groups.map(group => <section key={group} aria-label={group}>
          <p className="bss-menu-group">{group}</p>
          {products.filter(product => product.group === group).map(product => product.available
            ? <a key={product.id} href={product.href} aria-current={product.id === current ? "page" : undefined}>
                <strong>{product.name}{product.id === current && <em> You are here</em>}</strong><span>{product.description}</span>
              </a>
            : <div key={product.id} className="bss-menu-soon" aria-disabled="true">
                <strong>{product.name} <em>Coming soon</em></strong><span>{product.description}</span>
              </div>)}
        </section>)}
      </div>
    </details>

    <div className="bss-actions">
      {tips.length > 0 && <details className="bss-help" ref={helpRef} onKeyDown={escape}>
        <summary aria-controls={helpId}><span className="bss-long">Things to try</span><span className="bss-short">Tips</span></summary>
        <div className="bss-help-panel" id={helpId}>
          <p>Things to try here</p>
          <ol>{tips.map(tip => <li key={tip}>{tip}</li>)}</ol>
          <small>Everything here is sample data. Payments, emails and texts are simulated.</small>
        </div>
      </details>}
      {confirming
        ? <span className="bss-confirm" role="group" aria-label="Reset demo">
            <span>Start over with fresh sample data?</span>
            <button type="button" className="bss-button bss-button-quiet" onClick={() => setConfirming(false)}>Cancel</button>
            <button type="button" className="bss-button" onClick={() => { setConfirming(false); onReset(); }}>Reset</button>
          </span>
        : <button type="button" className="bss-button bss-button-quiet" onClick={() => setConfirming(true)}><span className="bss-long">Reset demo</span><span className="bss-short">Reset</span></button>}
      <a className="bss-button bss-button-primary" href={SHOWROOM_BOOK_DEMO}><span className="bss-long">Book a personal demo</span><span className="bss-short">Book a demo</span></a>
    </div>
  </header>;
}

/**
 * Clears everything this demo origin keeps in the browser, then reloads.
 * Only call on a dedicated public demo origin: it wipes the whole origin.
 */
export async function resetShowroomOrigin(): Promise<void> {
  try { window.localStorage.clear(); } catch { /* storage may be blocked */ }
  try { window.sessionStorage.clear(); } catch { /* storage may be blocked */ }
  try {
    const list = (indexedDB as IDBFactory & { databases?: () => Promise<{ name?: string }[]> }).databases;
    const names = list ? (await list.call(indexedDB)).map(db => db.name).filter((name): name is string => Boolean(name)) : [];
    await Promise.all(names.map(name => new Promise<void>(resolve => { const request = indexedDB.deleteDatabase(name); request.onsuccess = request.onerror = request.onblocked = () => resolve(); })));
  } catch { /* nothing persisted */ }
  window.location.replace(window.location.pathname);
}
