import { Helmet } from "react-helmet-async";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { LandingPageHeader } from "@/components/landing/LandingPageHeader";
import { SuiteConfigurator } from "@/components/pricing/SuiteConfigurator";
import "@/components/homepage-three/homepageTokens.css";
export function SuiteBuilderPage(){
 const navigate=useNavigate(),[params]=useSearchParams();
 return <div className="hp-token-scope suite-builder-page"><Helmet><title>BloomSuite Pricing Calculator | Build Your BloomSuite</title><meta name="description" content="Estimate garden centre website, POS and CRM software costs, email and SMS usage, and additional locations. Proposed USD pricing."/><meta name="robots" content="noindex, follow"/><link rel="canonical" href="https://bloomsuite.app/build-your-suite"/></Helmet><LandingPageHeader onLogin={()=>navigate("/auth")}/><main className="sc-container"><header className="sc-intro"><span className="sc-proposal">New pricing preview · USD</span><h1>Build your BloomSuite.</h1><p>One product for $99 a month. All three for $250. Customize your setup and see your monthly estimate instantly.</p></header><SuiteConfigurator initialProduct={params.get("product")||undefined}/></main><footer className="sc-container sc-footer"><span>BloomSuite · Built for independent garden centres.</span><Link to="/pricing">Explore pricing</Link><Link to="/contact">Talk to us</Link><Link to="/privacy">Privacy</Link></footer></div>
}
