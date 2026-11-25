import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { LandingPageHeader } from "@/components/landing/LandingPageHeader";
import { PricingOverview, SuiteConfigurator } from "@/components/pricing/SuiteConfigurator";
import LegacyPricingPage from "./LegacyPricingPage";
import "@/components/homepage-three/homepageTokens.css";

const faq=[
 ["What does $99 include?","The proposed entry price is $99 USD per month for one product and standard setup. BloomSites includes the website and online selling capability; commerce readiness, payment processing and implementation are reviewed separately. POS includes one location and one register. CRM includes 20,000 marketing emails."],
 ["Can I combine just two products?","Yes. Two products are $198 per month in this proposal. All three are $250 per month, a $47 monthly saving."],
 ["How are email and text messages priced?","The estimate includes 20,000 monthly emails with CRM, then $3 per additional 1,000, prorated. SMS is estimated at 4.5 cents per standard segment. Carrier, destination, sender and message format costs must be confirmed."],
 ["Will my existing subscription change?","No. Existing agreements and current billing remain unchanged. Talk to us before changing your plan."],
 ["What costs are not included?","Hardware, payment processing, taxes, custom integration work, migration, training and managed services are separate. The calculator includes an illustrative online commerce fee, not a confirmed universal rate."],
 ["What about larger garden centres and Canadian pricing?","Multi-location, high-volume messaging, unusually large data sets and regional pricing require a tailored review. We will confirm costs and applicable terms before you commit."]
];
export default function PricingPage(){
 const navigate=useNavigate(),[params]=useSearchParams();
 const existing=params.get("existing")==="1"||params.has("checkout")||params.has("tier")||params.has("interval")||params.has("currency");
 if(existing)return <LegacyPricingPage/>;
 return <div className="hp-token-scope suite-builder-page"><Helmet><title>Garden Centre Software Pricing | BloomSuite</title><meta name="description" content="Explore proposed BloomSuite pricing: $99 per product or $250 for the complete garden centre software suite. Build a personalized USD estimate."/><link rel="canonical" href="https://bloomsuite.app/pricing"/></Helmet><LandingPageHeader onLogin={()=>navigate("/auth")} showUserMenu={true}/><main className="sc-container"><header className="sc-intro"><span className="sc-proposal">New pricing preview · USD</span><h1>Simple pricing. Room to grow.</h1><p>Three products, one straightforward starting price. Choose what you need today and estimate the costs as your garden centre grows.</p></header><PricingOverview/><section aria-label="Interactive pricing calculator"><h2 style={{fontSize:"clamp(1.8rem,3vw,2.6rem)",fontWeight:750,letterSpacing:"-.04em",marginBottom:"20px"}}>Build your BloomSuite</h2><SuiteConfigurator/></section><section className="sc-faq"><h2>Pricing questions, answered.</h2>{faq.map(([question,answer])=><details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</section></main><footer className="sc-container sc-footer"><span>BloomSuite · Built for independent garden centres.</span><Link to="/pricing?existing=1">Existing subscription plans</Link><Link to="/contact">Talk to us</Link><Link to="/privacy">Privacy</Link></footer></div>
}
