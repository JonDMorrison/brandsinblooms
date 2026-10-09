import { Helmet } from "react-helmet-async";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { LayoutDashboard, ScanLine } from "lucide-react";
import { LandingPageHeader } from "@/components/landing/LandingPageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { POS_LOGIN_HREF, POS_MANAGER_HREF, POS_REGISTER_HREF } from "@/components/suite/products";
import "@/components/suite/suiteMarketing.css";
import "@/components/suite/posExperience.css";

export function SuitePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const posOnly = params.get("product") === "pos";

  return (
    <div className="suite-marketing suite-launcher">
      <Helmet><title>{posOnly ? "Open your BloomSuite POS workspace" : "Your BloomSuite products"}</title><meta name="robots" content="noindex, follow" /></Helmet>
      <LandingPageHeader onLogin={() => navigate("/auth")} />
      <main className="pos-section"><div className="suite-container">
        <div className="suite-section-heading">
          <p className="suite-eyebrow">{posOnly ? "Welcome to BloomSuite POS" : "Welcome to BloomSuite"}</p>
          <h1>{posOnly ? "Where are you working today?" : "Choose where you want to work."}</h1>
          <p>{posOnly ? "Choose the manager workspace for store operations, or the register for serving customers. Sign in with your existing POS account." : "Open your product and sign in to your existing account. Your business and permissions determine the workspace you can access."}</p>
        </div>
        {posOnly ? (
          <>
            <div className="pos-workspace-grid">
              <article><LayoutDashboard size={32} aria-hidden="true" /><h2>Manager workspace</h2><p>Work on products and photos, receive deliveries, review stock, manage customers, and see reports.</p><a className="suite-button suite-button--primary" href={POS_MANAGER_HREF}>Open manager</a></article>
              <article><ScanLine size={32} aria-hidden="true" /><h2>Register</h2><p>Find items, serve customers, complete sales and returns, and count the till at the end of the day.</p><a className="suite-button suite-button--primary" href={POS_REGISTER_HREF}>Open register</a></article>
            </div>
            <p className="pos-login-help">Setting up a register for the first time? A manager pairs it with your store before staff sign in with their PIN. Use one browser or device per register.</p>
            <p className="pos-login-help">Using a demo? Its sales, stock, and balances are for practice. <Link to="/contact?product=pos">Get help with your POS account</Link> or <Link to="/suite">open another BloomSuite product</Link>.</p>
          </>
        ) : (
          <>
            <div className="pos-connect-grid">
              <article><h2>BloomSuite CRM</h2><p>Customer relationships, email, SMS, and marketing.</p><Link className="suite-button suite-button--primary" to={user ? "/dashboard" : "/auth"}>{user ? "Open CRM" : "Sign in to CRM"}</Link></article>
              <article><h2>BloomSuite POS</h2><p>Choose your manager workspace or register, then sign in to your store.</p><Link className="suite-button suite-button--primary" to={POS_LOGIN_HREF}>Open POS</Link><Link className="suite-text-link" to="/pos">Explore POS</Link></article>
              <article><h2>BloomSites</h2><p>Your website, content, and online store.</p><a className="suite-button suite-button--primary" href="https://bloomsites.app/login">Sign in to BloomSites</a></article>
            </div>
            <p className="pos-connect-note">Need help finding your account? <Link className="suite-text-link" to="/contact">Get in touch</Link>.</p>
          </>
        )}
      </div></main>
    </div>
  );
}
