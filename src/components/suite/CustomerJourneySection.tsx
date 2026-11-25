import { useId } from "react";
import { ArrowUpRight, Globe2, Search, ScanLine, Mail, UsersRound, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";
import "./customerJourney.css";

// Public BloomSites case study assets, verified POS demonstration and the
// existing public CRM dashboard screenshot. Never use fabricated UI.
const stages = [
  { title: "Discover", outcome: "Attract", description: "Find your garden centre online and discover what’s in season.", product: "BloomSites", href: "https://bloomsites.app/", Icon: Globe2, image: "/customer-journey/horsford-home.webp", alt: "Horsford Gardens & Nursery website built with BloomSites", caption: "Horsford Gardens & Nursery", width: 1200, height: 875 },
  { title: "Research", outcome: "Guide", description: "Explore plants and growing information before buying.", product: "BloomSites", href: "/plant-intelligence", Icon: Search, image: "/customer-journey/horsford-shop.webp", alt: "Horsford online shop showing the real plant catalogue", caption: "Horsford online shop", width: 1440, height: 1100 },
  { title: "Purchase", outcome: "Sell", description: "Shop online or enjoy a smooth checkout in store.", product: "BloomSites + BloomSuite POS", href: "/#suite-products", Icon: ScanLine, image: "/pos/features-assets/register.webp", alt: "BloomSuite POS register showing plant products and a demonstration basket", caption: "BloomSuite POS · demonstration", width: 1920, height: 1154 },
  { title: "Follow up", outcome: "Retain", description: "Share helpful advice and relevant offers with customers who opt in.", product: "BloomSuite CRM", href: "/crm/features", Icon: Mail, image: "/homepage/section-1.png", alt: "BloomSuite CRM dashboard with customer management and campaign tools", caption: "BloomSuite CRM dashboard", width: 1440, height: 900 },
] as const;

export function CustomerJourneySection() {
  const arrowId = useId().replace(/:/g, "");
  return (
    <section className="hp-journey" id="customer-journey" aria-labelledby="customer-journey-title">
      <div className="hp-journey__inner">
        <header className="hp-journey__heading">
          <p className="hp-journey__eyebrow">Three products. One customer journey.</p>
          <h2 id="customer-journey-title">Turn first visits into <em>lasting customers.</em></h2>
          <p>Quality plants bring customers in. Strong relationships bring them back.</p>
        </header>
        <div className="hp-journey__cycle">
          <div className="hp-journey__customer">
            <div className="hp-journey__customer-circle">
              <UsersRound size={32} strokeWidth={1.6} aria-hidden="true" />
              <strong>Your customer</strong>
              <span>At the centre.</span>
            </div>
          </div>
          <svg className="hp-journey__arrows" viewBox="0 0 1000 600" preserveAspectRatio="none" fill="none" aria-hidden="true" focusable="false">
            <defs><marker id={arrowId} markerWidth="8" markerHeight="8" refX="6.5" refY="4" orient="auto"><path d="M1 1L6.5 4L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></marker></defs>
            {["M420 135 Q500 90 580 135", "M962 254 Q990 300 962 346", "M580 465 Q500 510 420 465", "M38 346 Q10 300 38 254"].map(d => <path key={d} d={d} stroke="currentColor" strokeWidth="1.8" vectorEffect="non-scaling-stroke" markerEnd={`url(#${arrowId})`}/>)}
          </svg>
          <ol className="hp-journey__stages">
            {stages.map(({ title, outcome, description, product, href, Icon, image, alt, caption, width, height }, index) => (
              <li key={title} className={`hp-journey__stage hp-journey__stage--${index + 1}`}>
                <article className="hp-journey__card">
                  <div className="hp-journey__card-copy">
                    <div className="hp-journey__card-top"><span className="hp-journey__number">0{index + 1}</span><span>{outcome}</span><Icon size={17} aria-hidden="true"/></div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                    {href.startsWith("https:") ? <a className="hp-journey__product" href={href}>{product}<ArrowUpRight size={16} aria-hidden="true"/></a> : <Link className="hp-journey__product" to={href}>{product}<ArrowUpRight size={16} aria-hidden="true"/></Link>}
                  </div>
                  <figure className="hp-journey__visual">
                    <div className="hp-journey__frame"><div className="hp-journey__windowbar" aria-hidden="true"><i/><i/><i/></div><img src={image} alt={alt} width={width} height={height} loading="lazy" decoding="async"/></div>
                    <figcaption>{caption}</figcaption>
                  </figure>
                </article>
              </li>
            ))}
          </ol>
        </div>
        <p className="hp-journey__repeat"><RotateCcw size={19} aria-hidden="true"/> Every visit can lead to the next.</p>
        <p className="hp-journey__note">Real customer websites and product screenshots. Connected features depend on your store setup and supported integrations.</p>
        <a className="hp-journey__cta" href="#suite-products">Explore the BloomSuite family <ArrowUpRight size={18} aria-hidden="true"/></a>
      </div>
    </section>
  );
}
