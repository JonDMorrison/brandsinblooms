import { Globe2, Search, ScanLine, Mail, UsersRound, ArrowUpRight, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";
import "./customerJourney.css";

const stages = [
  { title: "Discover", product: "BloomSites", description: "Find your garden centre online.", href: "https://bloomsites.app/", Icon: Globe2 },
  { title: "Research", product: "BloomSites", description: "Explore your products and plan a visit.", href: "https://bloomsites.app/", Icon: Search },
  { title: "Purchase", product: "BloomSuite POS", description: "Make checkout a smooth part of the visit.", href: "/pos", Icon: ScanLine },
  { title: "Follow up", product: "BloomSuite CRM", description: "Stay connected with helpful email and SMS.", href: "/features", Icon: Mail },
];

export function CustomerJourneySection() {
  return (
    <section className="hp-journey" id="customer-journey" aria-labelledby="customer-journey-title">
      <div className="hp-journey__inner">
        <header className="hp-journey__heading">
          <p className="hp-journey__eyebrow">Three products. One customer journey.</p>
          <h2 id="customer-journey-title">Turn first visits into<br className="hp-journey__break" /> lasting customers.</h2>
          <p>Be there when customers find you, choose you, shop with you, and come back for more.</p>
        </header>
        <div className="hp-journey__cycle">
          <svg className="hp-journey__arrows" viewBox="0 0 1000 600" fill="none" aria-hidden="true" focusable="false">
            <defs><marker id="customer-journey-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M1 1L6 4L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></marker></defs>
            {["M425 115 Q500 75 575 115", "M930 230 Q990 300 930 370", "M575 485 Q500 525 425 485", "M70 370 Q10 300 70 230"].map((d) => <path key={d} d={d} stroke="currentColor" strokeWidth="2" markerEnd="url(#customer-journey-arrow)" />)}
          </svg>
          <div className="hp-journey__customer"><span><UsersRound size={30} aria-hidden="true" /></span><strong>Your customer</strong><p>At the centre.</p></div>
          <ol className="hp-journey__stages">
            {stages.map(({ title, product, description, href, Icon }, index) => {
              const content = <><div className="hp-journey__card-top"><span className="hp-journey__icon"><Icon size={26} aria-hidden="true" /></span><span className="hp-journey__number">0{index + 1}</span></div><h3>{title}</h3><p>{description}</p><span className="hp-journey__product">{product}<ArrowUpRight size={17} aria-hidden="true" /></span></>;
              return <li key={title} className={`hp-journey__stage hp-journey__stage--${index + 1}`}>
                {href.startsWith("https:") ? <a className="hp-journey__card" href={href}>{content}</a> : <Link className="hp-journey__card" to={href}>{content}</Link>}
              </li>;
            })}
          </ol>
        </div>
        <p className="hp-journey__repeat"><RotateCcw size={18} aria-hidden="true" /> Inspire the next visit. Start the journey again.</p>
        <a className="hp-journey__cta" href="#suite-products">Explore the BloomSuite family <ArrowUpRight size={18} aria-hidden="true" /></a>
      </div>
    </section>
  );
}
