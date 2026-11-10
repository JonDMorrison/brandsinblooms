import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import { LandingPageHeader } from "@/components/landing/LandingPageHeader";
import { SuiteConfigurator } from "@/components/pricing/SuiteConfigurator";
import "@/components/homepage-three/homepageTokens.css";

export function SuiteBuilderPage() {
  const navigate = useNavigate();
  return <div className="hp-token-scope suite-builder-page">
    <Helmet><title>Build your BloomSuite — Explore your setup</title><meta name="description" content="Choose your website, marketing and checkout goals. Explore a transparent draft BloomSuite estimate for your garden centre." /><meta name="robots" content="noindex, follow" /><link rel="canonical" href="https://bloomsuite.app/build-your-suite" /></Helmet>
    <LandingPageHeader onLogin={() => navigate("/auth")} />
    <main className="sc-container"><header className="sc-intro"><span className="sc-proposal">Suite pricing preview · USD · Not a live quote</span><h1>The right setup for your next stage of growth.</h1><p>Tell us what you want to improve. We’ll help you explore the website, marketing and checkout combination that fits—with every cost in view.</p></header><SuiteConfigurator /></main>
    <footer className="sc-container sc-footer"><span>BloomSuite · Built around your garden centre.</span><Link to="/pricing">Current CRM plans</Link><Link to="/contact">Talk to us</Link><Link to="/privacy">Privacy</Link></footer>
  </div>;
}
