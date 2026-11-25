import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import { LandingPageHeader } from "@/components/landing/LandingPageHeader";
import "@/components/suite/suiteMarketing.css";

const content = {
  plants: {
    eyebrow: "BloomSuite • Plant intelligence",
    title: "Help customers choose the right plants.",
    description: "Turn reliable plant information into confident purchases, useful staff guidance and stronger customer relationships.",
    intro: "Garden retail has thousands of varieties, changing inventory and customers who need practical advice. BloomSuite brings supported plant information into the tools your team uses every day.",
    heading: "From catalogue to customer confidence",
    features: [
      ["Master plant catalogue", "Reduce repeated entry with reusable plant identities and reviewed information. Retailer products retain their own prices, stock and presentation."],
      ["Supported plant data integrations", "Enrich matched products with available botanical details, imagery and care information from supported sources. Review identity, source rights and coverage before publishing."],
      ["Plant finder and Shop by Project", "Help shoppers discover plants that suit their conditions and explore useful combinations for their garden."],
      ["Supplier-connected assortment", "Showcase more eligible plants without physically stocking every variety. Purchasing and receiving depend on approved supplier programs, current availability and your store setup."],
    ],
    steps: [
      ["Prepare the catalogue", "Match products to reliable plant identities and review the information you want to use."],
      ["Help customers choose", "Show appropriate plant details online and make them available to staff through supported product workflows."],
      ["Support the next visit", "Offer helpful reviewed care advice where enabled, then use consented marketing to maintain the relationship."],
    ],
    note: "A plant may be browsable without being available to purchase. Inventory, pricing, supported sources and fulfillment options vary by retailer. We help you identify what is ready for your store.",
    relatedHref: "/care-guides",
    relatedText: "Explore Care Guides",
    canonical: "/plant-intelligence",
  },
  care: {
    eyebrow: "BloomSuite • Care Guides",
    title: "Help your customers succeed after the sale.",
    description: "Beautiful, store-branded plant care emails can turn a purchase into a helpful relationship.",
    intro: "Customers often leave a garden centre with good advice and forget some of it by the time they get home. Give them a way to revisit reviewed guidance for the exact plants they bought.",
    heading: "One idea, three connected experiences",
    features: [
      ["BloomSuite POS", "After an eligible purchase, staff can offer a requested care guide where the feature is enabled. A delivery issue does not undo the completed sale."],
      ["BloomSites", "Give online customers the option to request care information for eligible purchased plants. Product identity and reviewed guidance determine what can be included."],
      ["BloomSuite CRM", "Care Guide Studio is designed to let a retailer customize the brand, imagery and introduction. Preview and test before publishing a design."],
      ["Helpful follow-up", "Use eligible purchase information to prepare a reviewed follow-up campaign for customers with valid marketing permission. A care request is not marketing consent."],
    ],
    steps: [
      ["Review the plant", "Check the exact plant identity, source and care essentials before guidance is published."],
      ["Make it yours", "Customize the message and preview the design for desktop and phone in Care Guide Studio where enabled."],
      ["Give customers a reason to return", "Offer requested guidance and, separately, relevant consent-based follow-up."],
    ],
    note: "Care Guides are being rolled out through a controlled pilot. Availability depends on eligible reviewed plants, enabled features and supported store connections. Ask us to demonstrate the workflow and confirm what is ready for your store.",
    relatedHref: "/plant-intelligence",
    relatedText: "Explore Plant Intelligence",
    canonical: "/care-guides",
  },
} as const;

function PlatformPage({ kind }: { kind: keyof typeof content }) {
  const navigate = useNavigate();
  const p = content[kind];
  return <>
    <Helmet>
      <title>{kind === "plants" ? "Plant Intelligence for Garden Centres | BloomSuite" : "Plant Care Guides for Garden Centres | BloomSuite"}</title>
      <meta name="description" content={p.description} />
      <link rel="canonical" href={`https://bloomsuite.app${p.canonical}`} />
    </Helmet>
    <LandingPageHeader onLogin={() => navigate("/auth")} />
    <main className="suite-marketing pos-marketing">
      <section className="pos-hero">
        <div className="suite-container">
          <p className="suite-eyebrow">{p.eyebrow}</p>
          <h1>{p.title}</h1>
          <p className="pos-lead">{p.description}</p>
          <div className="suite-actions">
            <Link className="suite-button suite-button--primary" to="/contact">Book a guided demo</Link>
            <Link className="suite-button" to={p.relatedHref}>{p.relatedText}</Link>
          </div>
          <p className="pos-demo-caption">{p.note}</p>
        </div>
      </section>
      <section className="pos-section">
        <div className="suite-container">
          <div className="suite-section-heading"><p className="suite-eyebrow">Built for garden retail</p><h2>{p.heading}</h2><p>{p.intro}</p></div>
          <div className="pos-feature-grid">{p.features.map(([title, description]) => <article className="pos-feature" key={title}><h3>{title}</h3><p>{description}</p></article>)}</div>
        </div>
      </section>
      <section className="pos-section pos-connect">
        <div className="suite-container">
          <div className="suite-section-heading"><p className="suite-eyebrow">The connected customer journey</p><h2>Quality plants bring customers in. Strong relationships bring them back.</h2><p>Start with the capabilities your store needs today and grow as the connections are ready.</p></div>
          <div className="pos-connect-grid">{p.steps.map(([title, description]) => <article key={title}><h3>{title}</h3><p>{description}</p></article>)}</div>
        </div>
      </section>
      <section className="pos-section pos-final"><div className="suite-container"><div className="suite-section-heading"><h2>See what works for your garden centre.</h2><p>Explore the three products and discuss your current catalogue, till and marketing setup with our team.</p></div><div className="suite-actions"><Link className="suite-button suite-button--primary" to="/contact">Book a demo</Link><Link className="suite-button" to="/build-your-suite">Build your suite</Link><Link className="suite-button" to="/">Explore BloomSuite</Link></div></div></section>
    </main>
    <footer className="suite-marketing suite-footer"><div className="suite-container"><span>BloomSuite by Brands in Blooms</span><nav className="suite-footer-links" aria-label="Product links"><a href="https://bloomsites.app/">BloomSites</a><Link to="/pos">BloomSuite POS</Link><a href="/crm/features">BloomSuite CRM</a></nav></div></footer>
  </>;
}
export function PlantIntelligencePage() { return <PlatformPage kind="plants" />; }
export function CareGuidesMarketingPage() { return <PlatformPage kind="care" />; }
