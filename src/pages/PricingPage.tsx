import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSubscription } from "@/contexts/SubscriptionContext";

import { LandingPageHeader } from "@/components/landing/LandingPageHeader";
import { PricingHeroNew } from "@/components/pricing/PricingHeroNew";
import { CostComparison } from "@/components/pricing/CostComparison";
import { EveryPlanBanner } from "@/components/pricing/EveryPlanBanner";
import { PricingCardsGrid } from "@/components/pricing/PricingCardsGrid";
import { CustomerProof } from "@/components/pricing/CustomerProof";
import { RoiPayback } from "@/components/pricing/RoiPayback";
import { FuturePricingSection } from "@/components/pricing/FuturePricingSection";
import { PricingFAQ } from "@/components/pricing/PricingFAQ";
import { FinalCTANew } from "@/components/pricing/FinalCTANew";
// Token scope import — without this the .hp-token-scope wrapper
// below has no token definitions to resolve. (The same file is
// imported by HomepagePresentation; ESM dedupes so this is free.)
import "@/components/homepage-three/homepageTokens.css";
// Pricing-specific bespoke styling (radial overlays, foliage
// positioning, comparison cards, ROI panel, final CTA backdrop).
import "@/components/pricing/pricingPage.css";

const PricingPage = () => {
  const navigate = useNavigate();
  const { refreshSubscription } = useSubscription();

  // Stripe checkout completion / cancel handler. Preserved verbatim
  // from the prior version — billing constraint says "Do NOT change
  // Stripe checkout integration." The new plan cards navigate to
  // /auth?tier=... and the actual checkout call lives in the
  // post-auth flow, so this page only needs the URL-param cleanup.
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const checkout = urlParams.get("checkout");

    if (checkout === "success") {
      refreshSubscription();
      window.history.replaceState({}, document.title, window.location.pathname);
      navigate("/");
    } else if (checkout === "cancelled") {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [navigate, refreshSubscription]);

  return (
    <div className="min-h-screen bg-white">
      <LandingPageHeader
        onLogin={() => navigate("/auth")}
        showUserMenu={true}
      />
      {/*
        .hp-token-scope mounts the canonical --hp-* token table so
        every section below resolves to the same teal/cream/text
        values used across the homepage marketing surface. Per the
        constraint "Do NOT introduce new design tokens" the wrapper
        REUSES the existing scope rather than redeclaring values.
      */}
      <div className="hp-token-scope">
        <PricingHeroNew />
        <CostComparison />
        <EveryPlanBanner />
        <PricingCardsGrid />
        <CustomerProof />
        <RoiPayback />
        <FuturePricingSection />
        <PricingFAQ />
        <FinalCTANew />
      </div>
    </div>
  );
};

export default PricingPage;
