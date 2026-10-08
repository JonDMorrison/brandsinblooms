import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import { LandingPageHeader } from "@/components/landing/LandingPageHeader";
import { useAuth } from "@/contexts/AuthContext";
import "@/components/suite/suiteMarketing.css";

export function SuitePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  return <div className="suite-marketing suite-launcher">
    <Helmet><title>Your BloomSuite products</title><meta name="robots" content="noindex, follow" /></Helmet>
    <LandingPageHeader onLogin={() => navigate("/auth")} />
    <main className="pos-section"><div className="suite-container">
      <div className="suite-section-heading"><p className="suite-eyebrow">Welcome to BloomSuite</p><h1>Choose where you want to work.</h1><p>Open your product and sign in to your existing account. Your business and permissions determine the workspace you can access.</p></div>
      <div className="pos-connect-grid">
        <article><h2>BloomSuite CRM</h2><p>Customer relationships, email, SMS, and marketing.</p><Link className="suite-button suite-button--primary" to={user ? "/dashboard" : "/auth"}>{user ? "Open CRM" : "Sign in to CRM"}</Link></article>
        <article><h2>BloomSuite POS</h2><p>Your register and manager workspace. Use the same permanent address whenever you return.</p><a className="suite-button suite-button--primary" href="/pos/login">Open POS</a><Link className="suite-text-link" to="/pos">Explore POS</Link></article>
        <article><h2>BloomSites</h2><p>Your website, content, and online store.</p><a className="suite-button suite-button--primary" href="https://bloomsites.app/login">Sign in to BloomSites</a></article>
      </div>
      <p className="pos-connect-note">Need help finding your account? <Link className="suite-text-link" to="/contact">Get in touch</Link>.</p>
    </div></main>
  </div>;
}
