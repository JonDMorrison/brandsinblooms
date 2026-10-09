import { Link } from "react-router-dom";
import { Globe2, ScanLine, UsersRound } from "lucide-react";
import { SuiteBuilderEntry } from "@/components/pricing/SuiteBuilderEntry";
import { SUITE_PRODUCTS } from "./products";
import "./suiteMarketing.css";

const icons = [UsersRound, ScanLine, Globe2];

export function SuiteProductsSection() {
  return <section className="suite-marketing suite-products" id="suite-products" aria-labelledby="suite-products-title">
    <div className="suite-container">
      <div className="suite-section-heading"><p className="suite-eyebrow">One family. Built for your business.</p><h2 id="suite-products-title">The right tools for every part of your garden centre.</h2><p>Start with what you need today. Explore the rest as your business grows.</p></div>
      <div className="suite-product-grid">{SUITE_PRODUCTS.map((product, index) => {
        const Icon = icons[index];
        const content = <><div className="suite-product-top"><span className="suite-product-icon"><Icon aria-hidden="true" size={25} /></span><span>{product.category}</span></div><p className="suite-product-name">{product.name}</p><h3>{product.headline}</h3><p className="suite-product-description">{product.description}</p><span className="suite-text-link">{product.action}</span></>;
        return product.href.startsWith("https:") ? <a className={`suite-product-card suite-product-card--${product.id}`} key={product.id} href={product.href}>{content}</a> : <Link className={`suite-product-card suite-product-card--${product.id}`} key={product.id} to={product.href}>{content}</Link>;
      })}</div>
      <SuiteBuilderEntry />
      <p className="suite-product-note">Each product has its own purpose. We’ll help you choose the setup that fits your store.</p>
    </div>
  </section>;
}

