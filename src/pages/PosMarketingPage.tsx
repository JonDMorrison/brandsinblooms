import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import { Camera, Check, ClipboardCheck, Globe2, PackageCheck, ScanLine, Sparkles, UsersRound } from "lucide-react";
import { LandingPageHeader } from "@/components/landing/LandingPageHeader";
import { CustomerJourneySection } from "@/components/suite/CustomerJourneySection";
import { POS_DEMO_HREF, POS_LOGIN_HREF } from "@/components/suite/products";
import "@/components/suite/suiteMarketing.css";
import "@/components/suite/posExperience.css";

const features = [
  [ScanLine, "Keep the line moving", "Find plants and products, scan barcodes, and work through a sale from a register designed for the counter."],
  [PackageCheck, "Give every product its place", "Keep sizes, prices, photos, and recorded stock together in a manager workspace away from the checkout line."],
  [Camera, "Make receiving less work", "Start with a photo or uploaded packing slip. Let the receiving assistant suggest the details, then check the delivery before confirming stock."],
  [UsersRound, "Serve people, not just transactions", "Keep customer lookup, trade accounts, returns, and store credit close to the everyday work of helping customers."],
  [Sparkles, "Ask Bloom where to start", "Ask about recorded stock and store activity. Get a useful starting point for the decisions that still belong to your team."],
  [ClipboardCheck, "Finish the day with clarity", "Review register sessions, cash counts, and reports so your team can see what needs attention before closing."],
] as const;

export function PosMarketingPage() {
  const navigate = useNavigate();
  return (
    <div className="suite-marketing pos-marketing">
      <Helmet>
        <title>BloomSuite POS — Point of Sale for Garden Centres</title>
        <meta name="description" content="Checkout, plant catalogues, photo-assisted receiving, and store management for independent garden centres. Explore BloomSuite POS and find your setup." />
        <link rel="canonical" href="https://bloomsuite.app/pos" />
        <meta property="og:title" content="BloomSuite POS — Built for the way your garden centre works" />
        <meta property="og:description" content="Keep the counter moving and the store organized. Explore your website, checkout, and customer follow-up together." />
        <meta property="og:url" content="https://bloomsuite.app/pos" />
        <meta property="og:type" content="website" />
      </Helmet>
      <LandingPageHeader onLogin={() => navigate("/suite")} />
      <main id="pos-main">
        <section className="pos-hero">
          <div className="suite-container">
            <div className="pos-hero-grid">
              <div>
                <p className="suite-eyebrow">BloomSuite POS · Independent garden centres</p>
                <h1>Built for the way your garden centre works.</h1>
                <p className="pos-lead">A busy counter. A changing catalogue. A team with plants to care for and people to help. Bring checkout and store operations together—and plan the connection to your website and customer marketing.</p>
                <div className="suite-actions">
                  <Link className="suite-button suite-button--primary" to={POS_DEMO_HREF}>Book a POS demo</Link>
                  <Link className="suite-button" to="/build-your-suite">Find my setup</Link>
                </div>
                <p className="pos-demo-caption">Already have an account? <Link className="pos-inline-link" to={POS_LOGIN_HREF}>Log in to POS</Link></p>
              </div>
              <div className="pos-screen-frame"><figure>
                <img src="/pos/manager-workspace.webp" alt="BloomSuite POS manager workspace showing the store’s operational tools" width="1440" height="1000" fetchPriority="high" />
                <figcaption>The manager workspace, shown with demonstration data.</figcaption>
              </figure></div>
            </div>
            <div className="pos-proof-strip">
              <div><strong>At the counter</strong><p>A focused register for staff.</p></div>
              <div><strong>Behind the scenes</strong><p>A clear workspace for running the store.</p></div>
              <div><strong>Across the customer journey</strong><p>Website, checkout, and follow-up in one family.</p></div>
            </div>
          </div>
        </section>
        <CustomerJourneySection />
        <section className="pos-section" id="pos-capabilities">
          <div className="suite-container">
            <div className="suite-section-heading"><p className="suite-eyebrow">Make the everyday work easier</p><h2>From the first delivery to the last sale.</h2><p>Give staff a clear place to work and owners a clear view of the details.</p></div>
            <div className="pos-feature-grid">{features.map(([Icon, title, description]) => (
              <article className="pos-feature" key={title}><Icon size={28} aria-hidden="true" /><h3>{title}</h3><p>{description}</p></article>
            ))}</div>
          </div>
        </section>
        <section className="pos-section pos-catalogue-section">
          <div className="suite-container pos-split">
            <div className="pos-screen-frame"><figure>
              <img src="/pos/catalogue-workspace.webp" alt="BloomSuite POS catalogue with visual product and pricing controls" width="1440" height="1000" loading="lazy" />
              <figcaption>The product catalogue, shown with demonstration data.</figcaption>
            </figure></div>
            <div>
              <p className="suite-eyebrow">Plants, products, and the details that matter</p>
              <h2>Choose a better photo. Keep a clearer catalogue.</h2>
              <p>Help your team recognize the right plant, pot, or product without turning every catalogue update into a project.</p>
              <ul className="pos-checklist">{[
                "Change the main photo without filling the gallery with duplicates.",
                "Review selling options, sizes, and prices in one place.",
                "See whether a photo is POS-only, waiting to share, or confirmed on the website.",
              ].map(text => <li key={text}><Check size={20} aria-hidden="true" /><span>{text}</span></li>)}</ul>
              <p className="pos-detail-note">Photo sharing requires a configured BloomSites connection and a matched product. The website reuses the uploaded photo rather than storing a second image file.</p>
            </div>
          </div>
        </section>
        <section className="pos-section" id="switching">
          <div className="suite-container pos-split">
            <div><p className="suite-eyebrow">Switch with a clear plan</p><h2>Start with your store. Keep what works.</h2><p>Moving to a new POS deserves care. We’ll review your current system, data, and hardware before recommending a transition.</p><p>Scanners, printers, drawers, scales, and payment devices need individual compatibility checks. We’ll tell you what can stay and what needs setup or replacement.</p><div className="suite-actions"><Link className="suite-button suite-button--primary" to={POS_DEMO_HREF}>Talk through your switch</Link></div></div>
            <div className="pos-process">
              <article><h3>Show us how you work</h3><p>Walk through your checkout, catalogue, locations, and reporting needs.</p></article>
              <article><h3>Review the fit</h3><p>Check the records available from your existing system and confirm equipment compatibility.</p></article>
              <article><h3>Try it with your team</h3><p>Practise receiving, sales, returns, and day-end close before planning a cutover.</p></article>
            </div>
          </div>
        </section>
        <section className="pos-section pos-connect" id="suite-products">
          <div className="suite-container">
            <div className="suite-section-heading"><p className="suite-eyebrow">One family of products</p><h2>The counter is part of a bigger picture.</h2><p>Start with the tools you need. Build a clearer journey from finding your store to visiting again.</p></div>
            <div className="pos-connect-grid">
              <article><ScanLine size={26} aria-hidden="true" /><h3>BloomSuite POS</h3><p>Keep checkout, receiving, catalogue work, and day-end tasks close together.</p><Link className="suite-text-link" to={POS_LOGIN_HREF}>Open your POS workspace</Link></article>
              <article><UsersRound size={26} aria-hidden="true" /><h3>BloomSuite CRM</h3><p>Create useful campaigns, organize your audience, and follow up with customers who have agreed to hear from you.</p><Link className="suite-text-link" to="/features">Explore the CRM</Link></article>
              <article><Globe2 size={26} aria-hidden="true" /><h3>BloomSites</h3><p>Help customers explore your plants, discover events, shop online, and plan a visit.</p><a className="suite-text-link" href="https://bloomsites.app/">Explore BloomSites</a></article>
            </div>
            <p className="pos-connect-note">Connections are configured for each business. In your demo, we’ll show the data that can move between your products, what is already connected, and what still needs setup. A purchase never automatically becomes permission to send marketing.</p>
          </div>
        </section>
        <section className="pos-section">
          <div className="suite-container pos-faq">
            <h2>A few things you might be wondering.</h2>
            <details><summary>Can I see the POS before committing?</summary><p>Yes. Book a guided demonstration of the register and manager workspace, then practise the workflows that matter to your store with demonstration data.</p></details>
            <details><summary>Do I have to replace all my hardware?</summary><p>We start with a compatibility review. Some hardware may be reusable; payment terminals and specialized devices need their own checks. We’ll confirm the options for your equipment.</p></details>
            <details><summary>Can I keep my current POS and still use BloomSuite?</summary><p>Yes—you can explore BloomSites and CRM without replacing your till. We’ll review the supported connection or report-import options for your current system before promising what will sync.</p></details>
            <details><summary>Will the receiving assistant change my stock automatically?</summary><p>No. A photo or document helps prepare the receiving details. Your team checks quantities, damage, and product matches before confirming the receipt.</p></details>
            <details><summary>How much does it cost?</summary><p><Link className="pos-inline-link" to="/build-your-suite">Explore your setup and draft budget</Link>, then review it with our team. The calculator is a USD pricing preview, not a live quote. Payment processing, equipment, messaging usage, and setup need their own review; existing subscriptions do not change.</p></details>
          </div>
        </section>
        <section className="pos-section pos-final">
          <div className="suite-container"><div className="suite-section-heading"><p className="suite-eyebrow">Let’s see it in action</p><h2>Bring your questions. We’ll bring the POS.</h2><p>See how BloomSuite POS could fit the way your garden centre works.</p></div><div className="suite-actions"><Link className="suite-button suite-button--primary" to={POS_DEMO_HREF}>Book a POS demo</Link><Link className="suite-button" to="/build-your-suite">Find my setup</Link></div></div>
        </section>
      </main>
      <footer className="suite-footer"><div className="suite-container"><strong>BloomSuite POS</strong><nav className="suite-footer-links" aria-label="POS footer"><Link to="/">BloomSuite</Link><Link to={POS_LOGIN_HREF}>POS login</Link><a href="https://bloomsites.app/">BloomSites</a><Link to="/contact?product=pos">Contact</Link><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link></nav></div></footer>
    </div>
  );
}
