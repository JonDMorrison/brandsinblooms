import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import "./suiteConfigurator.css";

export function SuiteBuilderEntry() {
  return <div className="hp-token-scope sc-entry"><div><h2>Not sure which products you need?</h2><p>Explore your website, marketing and checkout setup with a transparent draft estimate. Existing CRM plans stay unchanged.</p></div><Link to="/build-your-suite">Find my setup <ArrowRight size={18} aria-hidden="true" /></Link></div>;
}
