import { ArrowRight, ArrowUpRight, Check, Globe2, Heart, Leaf, Mail, RotateCcw, ScanLine, Search, ShoppingBag, Sprout, Sun, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import "./customerJourney.css";

const stages = [
  { title: "Discover", outcome: "Get discovered", description: "Find your garden centre online and see what’s in season.", product: "BloomSites", href: "https://bloomsites.app/", Icon: Globe2 },
  { title: "Research", outcome: "Build confidence", description: "Find the right plants and explore useful growing advice.", product: "BloomSites", href: "/plant-intelligence", Icon: Search },
  { title: "Purchase", outcome: "Make the sale", description: "Shop online or enjoy a smooth checkout in store.", product: "BloomSites + BloomSuite POS", href: "/#suite-products", Icon: ScanLine },
  { title: "Follow up", outcome: "Bring them back", description: "Share helpful advice and relevant offers with customers who opt in.", product: "BloomSuite CRM", href: "/crm/features", Icon: Mail },
] as const;

// Purpose-built miniature illustrations, not representations of live screens.
function JourneyVisual({ stage }: { stage: number }) {
  return <div className={`hp-journey__visual hp-journey__visual--${stage}`} aria-hidden="true">
    {stage === 0 && <div className="hp-journey__window">
      <div className="hp-journey__windowbar"><i/><i/><i/><span>Garden centre website</span></div>
      <div className="hp-journey__site"><div><small>IN SEASON</small><b>Find your<br/>next favourite.</b><span className="hp-journey__tiny-button">Explore plants <ArrowRight size={10}/></span></div><div className="hp-journey__botanical"><Sprout size={56} strokeWidth={1.25}/><Leaf size={24} strokeWidth={1.2}/></div></div>
      <div className="hp-journey__site-bottom"><span/><span/><span/></div>
    </div>}
    {stage === 1 && <div className="hp-journey__plant"><div className="hp-journey__plant-art"><Leaf size={40} strokeWidth={1.3}/><Sprout size={65} strokeWidth={1.25}/></div><div className="hp-journey__plant-info"><small>PLANT FINDER</small><b>Find your fit</b><span><Sun size={13}/> Light needs</span><span><Leaf size={13}/> Growing advice</span><span><Check size={13}/> Right for your space</span></div><div className="hp-journey__float-icon"><Search size={19}/></div></div>}
    {stage === 2 && <div className="hp-journey__checkout"><div className="hp-journey__receipt"><div><ShoppingBag size={18}/><b>Your basket</b></div><div className="hp-journey__receipt-line"><Leaf size={15}/><span>Plants</span><i/></div><div className="hp-journey__receipt-line"><Sprout size={15}/><span>Garden supplies</span><i/></div><div className="hp-journey__checkout-button"><Check size={12}/> Checkout</div></div><div className="hp-journey__float-icon hp-journey__float-icon--check"><Check size={21}/></div></div>}
    {stage === 3 && <div className="hp-journey__email"><div className="hp-journey__email-top"><Mail size={17}/><span>From your garden centre</span></div><div className="hp-journey__email-body"><div className="hp-journey__email-art"><Sprout size={30}/></div><div><small>A LITTLE GROWING ADVICE</small><b>Keep growing.</b><i/><i/></div></div><div className="hp-journey__email-footer"><Heart size={13}/> See you again soon.</div><div className="hp-journey__float-icon"><Heart size={20}/></div></div>}
  </div>;
}

export function CustomerJourneySection() {
  return (
    <section className="hp-journey" id="customer-journey" aria-labelledby="customer-journey-title">
      <div className="hp-journey__inner">
        <header className="hp-journey__heading">
          <p className="hp-journey__eyebrow"><Sprout size={17} aria-hidden="true"/> Three products. One customer journey.</p>
          <h2 id="customer-journey-title">Turn first visits into<br className="hp-journey__break" /> <em>lasting customers.</em></h2>
          <p>Quality plants bring customers in. Strong relationships bring them back.</p>
        </header>
        <div className="hp-journey__panel">
          <div className="hp-journey__panel-top">
            <div className="hp-journey__customer"><span><UsersRound size={23} aria-hidden="true"/></span><div><strong>Your customer</strong><p>One relationship. Every step matters.</p></div></div>
            <p className="hp-journey__panel-label">The connected BloomSuite experience</p>
          </div>
          <ol className="hp-journey__stages">
            {stages.map(({ title, outcome, description, product, href, Icon }, index) => (
              <li key={title} className={`hp-journey__stage hp-journey__stage--${index + 1}`}>
                <article className="hp-journey__card">
                  <div className="hp-journey__card-top"><span className="hp-journey__number">0{index + 1}</span><span className="hp-journey__outcome">{outcome}</span><Icon size={18} aria-hidden="true"/></div>
                  <JourneyVisual stage={index}/>
                  <div className="hp-journey__card-copy">
                    <h3>{title}</h3><p>{description}</p>
                    {href.startsWith("https:") ? <a className="hp-journey__product" href={href}>{product}<ArrowUpRight size={16} aria-hidden="true"/></a> : <Link className="hp-journey__product" to={href}>{product}<ArrowUpRight size={16} aria-hidden="true"/></Link>}
                  </div>
                </article>
                {index < stages.length - 1 && <span className="hp-journey__connector" aria-hidden="true"><ArrowRight size={17}/></span>}
              </li>
            ))}
          </ol>
          <div className="hp-journey__return"><span className="hp-journey__return-icon"><RotateCcw size={23} aria-hidden="true"/></span><div><strong>Every visit can lead to the next.</strong><p>Keep customers growing with you.</p></div><span className="hp-journey__return-line" aria-hidden="true"/><ArrowRight className="hp-journey__return-arrow" size={22} aria-hidden="true"/></div>
          <p className="hp-journey__note">Illustrative customer journey. Connections depend on your store setup and supported integrations.</p>
        </div>
        <a className="hp-journey__cta" href="#suite-products">Explore the BloomSuite family <ArrowUpRight size={18} aria-hidden="true" /></a>
      </div>
    </section>
  );
}
