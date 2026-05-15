import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { supabase } from "@/integrations/supabase/client";

import { LandingPageHeader } from "@/components/landing/LandingPageHeader";
import { PricingHeroNew } from "@/components/pricing/PricingHeroNew";
import { CostComparison } from "@/components/pricing/CostComparison";
import { EveryPlanBanner } from "@/components/pricing/EveryPlanBanner";
import { PricingCardsGrid } from "@/components/pricing/PricingCardsGrid";
import type {
  BillingInterval,
  Currency,
} from "@/components/pricing/PricingControls";
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

const readInitialBillingInterval = (): BillingInterval => {
  if (typeof window === "undefined") return "monthly";
  const value = new URLSearchParams(window.location.search).get("interval");
  return value === "annual" ? "annual" : "monthly";
};

const readInitialCurrency = (): Currency => {
  if (typeof window === "undefined") return "usd";
  const value = new URLSearchParams(window.location.search)
    .get("currency")
    ?.toLowerCase();
  return value === "cad" ? "cad" : "usd";
};

const PricingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refreshSubscription } = useSubscription();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>(
    readInitialBillingInterval,
  );
  const [currency, setCurrency] = useState<Currency>(readInitialCurrency);

  // Pricing-card CTA. Authenticated users go straight to Stripe
  // Checkout via the create-checkout edge function (which resolves
  // the right price by lookup_key, so test/live work without env
  // vars). Unauthenticated users land on /auth with the tier and
  // interval preserved in the query string so the post-auth flow
  // can resume the selection.
  const handleSelectPlan = useCallback(
    async (
      tier: string,
      selectedInterval: BillingInterval = "monthly",
      selectedCurrency: Currency = "usd",
    ) => {
      const interval = selectedInterval;
      const billingCurrency = selectedCurrency;
      if (!user) {
        navigate(
          `/auth?tier=${tier}&interval=${interval}&currency=${billingCurrency}`,
        );
        return;
      }
      setCheckoutLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke(
          "create-checkout",
          {
            body: {
              plan: tier,
              billingInterval: interval,
              currency: billingCurrency,
            },
          },
        );
        if (error) {
          console.error("Checkout error:", error);
          return;
        }
        if (data?.url) {
          try {
            if (window.top) {
              window.top.location.href = data.url;
            } else {
              window.location.href = data.url;
            }
          } catch {
            window.open(data.url, "_blank", "noopener,noreferrer");
          }
        } else {
          console.error("No checkout URL received");
        }
      } catch (err) {
        console.error("Unexpected error during checkout:", err);
      } finally {
        setCheckoutLoading(false);
      }
    },
    [navigate, user],
  );

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
        <PricingCardsGrid
          onSelectPlan={handleSelectPlan}
          isCheckoutLoading={checkoutLoading}
          billingInterval={billingInterval}
          onBillingIntervalChange={setBillingInterval}
          currency={currency}
          onCurrencyChange={setCurrency}
        />
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
