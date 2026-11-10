import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Bot,
  Check,
  CheckCircle2,
  Clock3,
  DatabaseZap,
  Leaf,
  Mail,
  MessageSquareText,
  PackageSearch,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Users,
  Zap,
} from "lucide-react";

import { LandingPageHeader } from "@/components/landing/LandingPageHeader";
import bloomsuiteLogo from "@/assets/bloomsuite-logo-correct.png";
import lightspeedLogo from "@/assets/logos/lightspeed-x-series.svg";
import heroArtwork from "@/assets/lightspeed/hero.webp";
import smartCrmArtwork from "@/assets/lightspeed/smart-crm.webp";
import campaignArtwork from "@/assets/lightspeed/campaign-builder.webp";
import analyticsArtwork from "@/assets/lightspeed/analytics-dashboard.webp";
import "./LightspeedLandingPage.css";

const SIGNUP_PATH = "/auth#signup";
const DOCUMENTATION_PATH = "/docs/integrations/lightspeed";

const syncedData = [
  {
    icon: Users,
    title: "Customers",
    description:
      "Bring customer records and contact details into one marketing-ready view.",
  },
  {
    icon: ShoppingBag,
    title: "Completed sales",
    description:
      "Understand what each customer bought, when they bought it, and how often they return.",
  },
  {
    icon: PackageSearch,
    title: "Products",
    description:
      "Use your product catalogue and categories to make campaigns more relevant.",
  },
  {
    icon: RefreshCw,
    title: "Inventory",
    description:
      "Keep product context current without exporting and rebuilding spreadsheets.",
  },
];

const steps = [
  {
    number: "01",
    title: "Connect your Lightspeed store",
    description:
      "Sign in to BloomSuite, enter your X-Series store prefix, and approve the secure OAuth connection.",
  },
  {
    number: "02",
    title: "Let BloomSuite organize the data",
    description:
      "BloomSuite imports customers, completed sales, products, and inventory, then keeps them current with webhooks and background syncs.",
  },
  {
    number: "03",
    title: "Start bringing customers back",
    description:
      "Build purchase-based segments, launch email and SMS campaigns, and turn on automations that run in the background.",
  },
];

const segmentExamples = [
  "Rose buyers who have not returned this spring",
  "Houseplant customers who shop every 60–90 days",
  "Top spenders from last year's holiday season",
  "Customers who bought annuals but not soil or fertilizer",
  "New customers ready for a helpful welcome series",
  "Lapsed shoppers who have not visited in twelve months",
];

const automationExamples = [
  {
    icon: Sparkles,
    title: "Welcome new customers",
    description:
      "Introduce your garden centre and give first-time buyers a reason to return.",
  },
  {
    icon: Clock3,
    title: "Win back lapsed shoppers",
    description:
      "Reach customers after a quiet period with a timely, relevant reason to visit.",
  },
  {
    icon: Leaf,
    title: "Follow the garden calendar",
    description:
      "Prepare campaigns for spring openings, fall bulbs, holiday greenery, and the seasons between.",
  },
  {
    icon: Zap,
    title: "Respond to real behaviour",
    description:
      "Use purchase activity and segment membership to start the right follow-up automatically.",
  },
];

const faqs = [
  {
    question: "Does BloomSuite change my Lightspeed checkout or payments?",
    answer:
      "No. BloomSuite does not replace your point of sale, change payment processing, or interrupt checkout. It uses completed sales, customer, product, and inventory data to power your marketing.",
  },
  {
    question: "Which version of Lightspeed does this integration support?",
    answer:
      "This connection is for Lightspeed Retail X-Series. Your store uses a store-specific Lightspeed domain, which BloomSuite asks for during setup.",
  },
  {
    question: "What information does BloomSuite request?",
    answer:
      "BloomSuite requests read access to customers, products, completed sales, inventory, and retailer information, plus permission to register webhooks that keep the connection current.",
  },
  {
    question: "Do I need to export CSV files?",
    answer:
      "No. After you connect, BloomSuite handles the initial import and ongoing updates. You do not need to maintain a second customer spreadsheet.",
  },
  {
    question: "How current is the data?",
    answer:
      "BloomSuite combines real-time webhook events with background synchronization. That gives you fast updates for supported events plus reliable bulk imports, inventory coverage, and recovery paths.",
  },
  {
    question: "What do I need before connecting?",
    answer:
      "You need a BloomSuite account, admin access to your Lightspeed X-Series store, and customer records with email addresses. Phone numbers are helpful when you plan to use SMS.",
  },
  {
    question: "Can I disconnect the integration?",
    answer:
      "Yes. The connection can be managed from BloomSuite's integrations area. BloomSuite also includes connection diagnostics so your team can understand the health of the sync.",
  },
  {
    question: "Where can my technical team learn more?",
    answer:
      "BloomSuite publishes a detailed Lightspeed X-Series integration guide covering setup, permissions, webhook behaviour, sync settings, diagnostics, and troubleshooting.",
  },
];

const structuredData = [
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "BloomSuite for Lightspeed X-Series",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: "https://bloomsuite.app/lightspeed",
    description:
      "BloomSuite connects Lightspeed Retail X-Series data to email, SMS, customer segmentation, and garden-centre marketing automations.",
    brand: {
      "@type": "Brand",
      name: "BloomSuite",
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  },
];

const FreeTrialLink = ({ className = "" }: { className?: string }) => (
  <Link className={`ls-cta ${className}`.trim()} to={SIGNUP_PATH}>
    Start a free trial
    <ArrowRight aria-hidden="true" size={18} />
  </Link>
);

const ProductVisual = ({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) => (
  <div className="ls-browser-frame">
    <div className="ls-browser-bar" aria-hidden="true">
      <span />
      <span />
      <span />
      <div />
    </div>
    <img src={src} alt={alt} loading="lazy" />
  </div>
);

export const LightspeedLandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="ls-page">
      <Helmet>
        <title>BloomSuite for Lightspeed X-Series | Garden Centre Marketing</title>
        <meta
          name="description"
          content="Connect Lightspeed Retail X-Series to BloomSuite and turn sales data into customer segments, email, SMS, and garden-centre marketing automations."
        />
        <link rel="canonical" href="https://bloomsuite.app/lightspeed" />
        <meta property="og:site_name" content="BloomSuite" />
        <meta
          property="og:title"
          content="Turn your Lightspeed data into customers who come back"
        />
        <meta
          property="og:description"
          content="BloomSuite turns Lightspeed sales data into automated email and SMS marketing built for garden centres."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://bloomsuite.app/lightspeed" />
        <meta property="og:image" content="https://bloomsuite.app/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>

      <LandingPageHeader
        onLogin={() => navigate("/auth")}
        showUserMenu={false}
      />

      <main>
        <section className="ls-hero" aria-labelledby="lightspeed-hero-title">
          <div className="ls-hero-glow ls-hero-glow--one" />
          <div className="ls-hero-glow ls-hero-glow--two" />
          <div className="ls-container ls-hero-grid">
            <div className="ls-hero-copy">
              <div className="ls-eyebrow">POS + MARKETING</div>
              <div className="ls-partner-lockup" aria-label="BloomSuite and Lightspeed X-Series">
                <span className="ls-logo-tile ls-logo-tile--bloom">
                  <img src={bloomsuiteLogo} alt="" />
                  BloomSuite
                </span>
                <span aria-hidden="true">+</span>
                <span className="ls-logo-tile ls-logo-tile--lightspeed">
                  <img src={lightspeedLogo} alt="Lightspeed X-Series" />
                </span>
              </div>
              <h1 id="lightspeed-hero-title">
                Turn your Lightspeed data into customers who come back
              </h1>
              <p className="ls-hero-lede">
                BloomSuite turns your Lightspeed sales data into automated email
                and SMS marketing built for garden centres—customer segments,
                seasonal campaigns, and AI-assisted content that keep shoppers
                returning.
              </p>
              <div className="ls-hero-actions">
                <FreeTrialLink />
                <a className="ls-text-link ls-text-link--light" href="#how-it-works">
                  See how it works
                  <ArrowRight aria-hidden="true" size={17} />
                </a>
              </div>
              <p className="ls-cta-note">
                7-day free trial <span aria-hidden="true">•</span> No credit card
                required <span aria-hidden="true">•</span> No checkout changes
              </p>
            </div>

            <div className="ls-hero-visual" aria-label="BloomSuite marketing platform preview">
              <img
                src={heroArtwork}
                alt="Garden centre team member using BloomSuite marketing tools in a greenhouse"
              />
              <div className="ls-floating-card ls-floating-card--sync">
                <span className="ls-status-dot" />
                <div>
                  <strong>Lightspeed connected</strong>
                  <span>Customer data is syncing</span>
                </div>
                <CheckCircle2 aria-hidden="true" size={20} />
              </div>
              <div className="ls-floating-card ls-floating-card--campaign">
                <Mail aria-hidden="true" size={20} />
                <div>
                  <strong>Spring campaign ready</strong>
                  <span>Audience: Annuals buyers</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="ls-proof-strip" aria-label="Integration summary">
          <div className="ls-container ls-proof-grid">
            <div>
              <DatabaseZap aria-hidden="true" />
              <span><strong>Automatic sync</strong>—no spreadsheet upkeep</span>
            </div>
            <div>
              <ShieldCheck aria-hidden="true" />
              <span><strong>Secure OAuth</strong> connection to X-Series</span>
            </div>
            <div>
              <Store aria-hidden="true" />
              <span><strong>Built for</strong> garden centres and nurseries</span>
            </div>
          </div>
        </section>

        <section className="ls-section ls-problem" aria-labelledby="lightspeed-problem-title">
          <div className="ls-container ls-narrow">
            <div className="ls-section-label">YOUR DATA IS ALREADY THERE</div>
            <h2 id="lightspeed-problem-title">
              Lightspeed knows what happened at the register. BloomSuite helps
              you decide what to do next.
            </h2>
            <p>
              Your POS already holds the story of your customers: what they
              bought, the categories they love, when they last visited, and how
              often they return. BloomSuite turns that history into useful
              audiences and timely marketing—without asking your team to export,
              clean, and re-upload lists.
            </p>
          </div>
        </section>

        <section className="ls-section ls-section--soft" aria-labelledby="synced-data-title">
          <div className="ls-container">
            <div className="ls-section-heading">
              <div>
                <div className="ls-section-label">WHAT BLOOMSUITE SYNCS</div>
                <h2 id="synced-data-title">One connection. Four useful data sets.</h2>
              </div>
              <p>
                The integration keeps the essentials together so every segment,
                campaign, and report starts with the same current information.
              </p>
            </div>
            <div className="ls-data-grid">
              {syncedData.map((item) => (
                <article key={item.title}>
                  <span className="ls-icon-box"><item.icon aria-hidden="true" /></span>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          className="ls-section"
          id="how-it-works"
          aria-labelledby="how-it-works-title"
        >
          <div className="ls-container">
            <div className="ls-section-heading ls-section-heading--center">
              <div>
                <div className="ls-section-label">SIMPLE FROM THE START</div>
                <h2 id="how-it-works-title">From POS connection to first campaign</h2>
              </div>
              <p>
                You keep selling in Lightspeed. BloomSuite quietly gives your
                marketing team a better starting point.
              </p>
            </div>
            <div className="ls-steps">
              {steps.map((step) => (
                <article key={step.number}>
                  <span>{step.number}</span>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </article>
              ))}
            </div>
            <div className="ls-centered-action">
              <FreeTrialLink />
            </div>
          </div>
        </section>

        <section className="ls-section ls-product-story" aria-labelledby="crm-story-title">
          <div className="ls-container ls-story-grid">
            <ProductVisual
              src={smartCrmArtwork}
              alt="Illustration of customer profiles organized in BloomSuite CRM"
            />
            <div className="ls-story-copy">
              <div className="ls-section-label">PURCHASE-BASED CRM</div>
              <h2 id="crm-story-title">Know more than a name and an email address</h2>
              <p>
                BloomSuite connects customer profiles to real purchase behaviour.
                Instead of treating everyone like the same shopper, you can see
                the categories, timing, frequency, and value behind each
                relationship.
              </p>
              <ul className="ls-check-list">
                <li><Check aria-hidden="true" /> See recent purchases and category interests</li>
                <li><Check aria-hidden="true" /> Identify loyal, new, and at-risk customers</li>
                <li><Check aria-hidden="true" /> Build audiences from behaviour instead of guesswork</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="ls-section ls-section--soft ls-product-story" aria-labelledby="campaign-story-title">
          <div className="ls-container ls-story-grid ls-story-grid--reverse">
            <div className="ls-story-copy">
              <div className="ls-section-label">EMAIL + SMS</div>
              <h2 id="campaign-story-title">Send a useful message while the moment still matters</h2>
              <p>
                Create targeted email and SMS campaigns from the data already in
                Lightspeed. BloomSuite helps draft the message, shape the
                audience, and organize the timing around the garden calendar.
              </p>
              <ul className="ls-check-list">
                <li><Check aria-hidden="true" /> AI-assisted copy tuned to garden retail</li>
                <li><Check aria-hidden="true" /> Seasonal campaign ideas tied to your catalogue</li>
                <li><Check aria-hidden="true" /> Email and SMS in one customer-marketing workspace</li>
              </ul>
            </div>
            <ProductVisual
              src={campaignArtwork}
              alt="Illustration of a BloomSuite campaign prepared for email and mobile messaging"
            />
          </div>
        </section>

        <section className="ls-section ls-product-story" aria-labelledby="analytics-story-title">
          <div className="ls-container ls-story-grid">
            <ProductVisual
              src={analyticsArtwork}
              alt="Illustration of BloomSuite customer and campaign analytics"
            />
            <div className="ls-story-copy">
              <div className="ls-section-label">CLEARER CUSTOMER INSIGHT</div>
              <h2 id="analytics-story-title">See who comes back—and who needs a reason</h2>
              <p>
                Understand spending, visit frequency, recent activity, and
                favourite categories at a glance. Use those insights to plan the
                next campaign instead of relying on a broad monthly email.
              </p>
              <ul className="ls-check-list">
                <li><Check aria-hidden="true" /> Spot repeat-purchase patterns</li>
                <li><Check aria-hidden="true" /> Recognize your most valuable customers</li>
                <li><Check aria-hidden="true" /> Find practical opportunities to re-engage</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="ls-section ls-segments" aria-labelledby="segments-title">
          <div className="ls-container ls-segment-layout">
            <div className="ls-segment-copy">
              <div className="ls-section-label ls-section-label--light">SMARTER SEGMENTS</div>
              <h2 id="segments-title">Talk to the right gardeners—not the whole database</h2>
              <p>
                The most useful marketing starts with a specific customer and a
                specific reason to care. BloomSuite lets you turn Lightspeed
                purchase history into focused audiences like these.
              </p>
              <FreeTrialLink className="ls-cta--cream" />
            </div>
            <div className="ls-segment-list" aria-label="Example customer segments">
              {segmentExamples.map((segment) => (
                <div key={segment}>
                  <TargetIcon />
                  <span>{segment}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="ls-section" aria-labelledby="automations-title">
          <div className="ls-container">
            <div className="ls-section-heading">
              <div>
                <div className="ls-section-label">MARKETING THAT KEEPS MOVING</div>
                <h2 id="automations-title">Let the routine follow-up happen automatically</h2>
              </div>
              <p>
                Set the audience, message, and trigger once. BloomSuite watches
                the customer data and runs the follow-up in the background.
              </p>
            </div>
            <div className="ls-automation-grid">
              {automationExamples.map((item) => (
                <article key={item.title}>
                  <item.icon aria-hidden="true" />
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="ls-section ls-ai-panel" aria-labelledby="ai-title">
          <div className="ls-container ls-ai-grid">
            <div className="ls-ai-icon" aria-hidden="true">
              <Bot />
            </div>
            <div>
              <div className="ls-section-label">AI THAT STARTS WITH YOUR BUSINESS</div>
              <h2 id="ai-title">Less blank-page anxiety. More ready-to-edit campaigns.</h2>
              <p>
                BloomSuite helps turn a seasonal idea into a campaign draft using
                the language of garden retail. Your team stays in control: review
                the audience, refine the message, and send when it is right for
                your store.
              </p>
            </div>
            <div className="ls-ai-example">
              <span>CAMPAIGN IDEA</span>
              <strong>First warm weekend: bring spring colour home</strong>
              <p>Audience: customers who bought annuals last spring</p>
              <div><Sparkles aria-hidden="true" /> Draft ready to review</div>
            </div>
          </div>
        </section>

        <section className="ls-section ls-section--soft" aria-labelledby="safe-title">
          <div className="ls-container ls-safe-grid">
            <div>
              <div className="ls-section-label">BUILT TO WORK BESIDE LIGHTSPEED</div>
              <h2 id="safe-title">No new checkout. No payment change. No duplicate data routine.</h2>
              <p>
                Lightspeed continues to run the store. BloomSuite uses the retail
                data you authorize for customer marketing, reporting, and
                automation. Your point-of-sale workflow stays where it is.
              </p>
              <Link className="ls-text-link" to={DOCUMENTATION_PATH}>
                Read the technical integration guide
                <ArrowRight aria-hidden="true" size={17} />
              </Link>
            </div>
            <div className="ls-safe-card">
              <ShieldCheck aria-hidden="true" />
              <h3>The connection requests only what BloomSuite needs</h3>
              <ul>
                <li><Check aria-hidden="true" /> Read customers, products, sales, inventory, and retailer details</li>
                <li><Check aria-hidden="true" /> Register webhooks for ongoing updates</li>
                <li><Check aria-hidden="true" /> No control over Lightspeed payments or checkout</li>
                <li><Check aria-hidden="true" /> Disconnect and diagnostics available in BloomSuite</li>
              </ul>
              <div className="ls-scope-list">
                <span>customers:read</span>
                <span>products:read</span>
                <span>sales:read</span>
                <span>inventory:read</span>
                <span>retailer:read</span>
                <span>webhooks</span>
              </div>
            </div>
          </div>
        </section>

        <section className="ls-section" aria-labelledby="fit-title">
          <div className="ls-container ls-fit-grid">
            <div className="ls-fit-intro">
              <div className="ls-section-label">A PRACTICAL FIT</div>
              <h2 id="fit-title">BloomSuite is built for the realities of independent garden retail</h2>
              <p>
                You do not need a dedicated data team or a full-time marketing
                department. You need current customer information, a clear next
                step, and tools that respect how seasonal your business is.
              </p>
            </div>
            <div className="ls-fit-cards">
              <article>
                <Store aria-hidden="true" />
                <h3>For garden centres, greenhouses, and nurseries</h3>
                <p>Vertical tools, examples, and campaign ideas made for the industry.</p>
              </article>
              <article>
                <MessageSquareText aria-hidden="true" />
                <h3>For teams that need marketing to be manageable</h3>
                <p>Turn a good idea into an organized campaign without starting from zero.</p>
              </article>
              <article>
                <BarChart3 aria-hidden="true" />
                <h3>For owners who want repeat business</h3>
                <p>Use real buying patterns to keep customer relationships growing.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="ls-section ls-faq" aria-labelledby="faq-title">
          <div className="ls-container ls-faq-grid">
            <div className="ls-faq-heading">
              <div className="ls-section-label">QUESTIONS, ANSWERED</div>
              <h2 id="faq-title">What to know before you connect</h2>
              <p>
                The integration is designed to be straightforward for store
                owners and transparent for technical teams.
              </p>
              <Link className="ls-text-link" to={DOCUMENTATION_PATH}>
                View full documentation
                <ArrowRight aria-hidden="true" size={17} />
              </Link>
            </div>
            <div className="ls-faq-list">
              {faqs.map((faq) => (
                <details key={faq.question}>
                  <summary>{faq.question}</summary>
                  <p>{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="ls-final-cta" aria-labelledby="final-cta-title">
          <div className="ls-final-cta-glow" />
          <div className="ls-container ls-final-cta-content">
            <div className="ls-partner-lockup ls-partner-lockup--center" aria-hidden="true">
              <span className="ls-logo-tile ls-logo-tile--bloom">
                <img src={bloomsuiteLogo} alt="" />
                BloomSuite
              </span>
              <span>+</span>
              <span className="ls-logo-tile ls-logo-tile--lightspeed">
                <img src={lightspeedLogo} alt="" />
              </span>
            </div>
            <h2 id="final-cta-title">Your Lightspeed data can do more than close the sale</h2>
            <p>
              Put it to work building the next visit, the next purchase, and a
              stronger relationship with every customer.
            </p>
            <FreeTrialLink />
            <span className="ls-final-note">Start with a 7-day free trial. No credit card required.</span>
          </div>
        </section>
      </main>

      <footer className="ls-footer">
        <div className="ls-container ls-footer-content">
          <Link to="/" className="ls-footer-brand">
            <img src={bloomsuiteLogo} alt="" />
            BloomSuite
          </Link>
          <p>Marketing and customer relationships, built for green businesses.</p>
          <nav aria-label="Lightspeed landing page footer">
            <Link to="/pricing">Pricing</Link>
            <Link to={DOCUMENTATION_PATH}>Lightspeed documentation</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
};

const TargetIcon = () => (
  <span className="ls-target-icon" aria-hidden="true">
    <span />
  </span>
);

export default LightspeedLandingPage;
