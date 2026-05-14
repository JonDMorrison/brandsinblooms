import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui-legacy/card";
import { Badge } from "@/components/ui-legacy/badge";
import { Button } from "@/components/ui-legacy/button";
import { Check, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { pricingTiers } from "./pricingConfig";
import { cn } from "@/lib/utils";

// Per-tier display copy that's specific to the redesigned grid —
// volume translation, included list, overages summary, and CTA
// label. Keyed off the canonical id from pricingConfig.ts so plan
// IDs (consumed by Stripe webhooks, billing edge functions, and the
// SubscriptionContext PAID_PLANS list) stay the single source of
// truth.
interface DisplayCopy {
  volumeTranslation: string;
  bestFor: string;
  included: string[];
  overages: string;
  ctaLabel: string;
}

const displayCopy: Record<string, DisplayCopy> = {
  seed: {
    bestFor:
      "Garden centres with an existing website who want CRM, messaging, and automations.",
    volumeTranslation:
      "Send weekly newsletters and seasonal SMS to your existing audience.",
    included: [
      "10,000 emails/month",
      "1,000 SMS/month",
      "Garden centre CRM with prebuilt personas",
      "All campaigns, automations, and reporting",
    ],
    overages: "Email $0.002 each · SMS $0.05 each",
    ctaLabel: "Start with Seed",
  },
  sprout: {
    bestFor: "Single-location garden centres with up to 5,000 customers.",
    volumeTranslation:
      "Run weekly newsletters and seasonal SMS to your full list.",
    included: [
      "20,000 emails/month",
      "2,000 SMS/month",
      "Website + Ecommerce storefront",
      "Garden centre CRM with prebuilt personas",
      "All campaigns, automations, and reporting",
    ],
    overages: "Email $0.002 each · SMS $0.05 each",
    ctaLabel: "Start with Sprout",
  },
  bloom: {
    bestFor: "Established garden centres with 5,000–25,000 customers.",
    volumeTranslation:
      "Run weekly campaigns plus automated seasonal flows to a growing list.",
    included: [
      "100,000 emails/month",
      "5,000 SMS/month",
      "Website + Ecommerce storefront",
      "Garden centre CRM with prebuilt personas",
      "All campaigns, automations, and reporting",
    ],
    overages: "Email $0.002 each · SMS $0.05 each",
    ctaLabel: "Start with Bloom",
  },
  thrive: {
    bestFor: "Multi-location chains and high-volume retailers.",
    volumeTranslation:
      "Unlimited campaigns across locations with priority support.",
    included: [
      "Unlimited emails (fair use)",
      "50,000 SMS/month (fair use)",
      "Website + Ecommerce storefront",
      "Garden centre CRM with prebuilt personas",
      "All campaigns, automations, and reporting",
      "Priority support + dedicated onboarding",
    ],
    overages: "Email included · SMS only for extraordinary overuse",
    ctaLabel: "Start with Thrive",
  },
};

export interface PricingCardsGridProps {
  /**
   * Optional handler invoked when a card's CTA is clicked. When
   * provided (e.g. by PricingPage), it takes precedence over the
   * default `/auth?tier=` redirect, allowing the caller to drive a
   * direct create-checkout for authenticated users or to forward
   * the tier + interval through auth for unauthenticated ones.
   *
   * No global monthly/annual toggle exists on this page yet, so
   * the grid defaults to `monthly`. Adding a toggle is a followup.
   */
  onSelectPlan?: (
    tier: string,
    billingInterval: "monthly" | "annual",
    currency: "usd" | "cad",
  ) => void | Promise<void>;
  isCheckoutLoading?: boolean;
}

export const PricingCardsGrid = ({
  onSelectPlan,
  isCheckoutLoading = false,
}: PricingCardsGridProps = {}) => {
  const navigate = useNavigate();

  const handleGetStarted = (tierId: string) => {
    if (onSelectPlan) {
      void onSelectPlan(tierId, "monthly", "usd");
      return;
    }
    navigate(`/auth?tier=${tierId}`);
  };

  // Render every tier that has display copy defined. The filter is
  // kept (rather than mapping pricingTiers directly) so a future
  // hidden-from-public tier can be excluded by omitting its
  // displayCopy entry without touching this iteration.
  const visibleTiers = pricingTiers.filter((tier) => tier.id in displayCopy);

  return (
    <section className="py-12 md:py-16 px-6 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {visibleTiers.map((tier) => {
            const IconComponent = tier.icon;
            const copy = displayCopy[tier.id];

            return (
              <Card
                key={tier.id}
                className={cn(
                  "relative flex flex-col transition-all duration-300 hover:shadow-xl pt-2",
                  tier.recommended
                    ? "pricing-card--popular border-2 border-[#3E7C77]"
                    : "border border-gray-200 hover:border-[#3E7C77]/30",
                )}
              >
                {tier.recommended && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-[#3E7C77] hover:bg-[#3E7C77] text-white px-4 py-1 text-xs font-semibold shadow-md">
                      Most Popular
                    </Badge>
                  </div>
                )}

                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center",
                        tier.recommended
                          ? "bg-[#3E7C77] text-white"
                          : "bg-[#E1FFFE] text-[#1F4341]",
                      )}
                    >
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <span className="text-lg font-semibold text-gray-900">
                      {tier.name}
                    </span>
                  </div>

                  <div className="mb-3">
                    <span className="text-5xl font-bold text-gray-900 leading-none">
                      ${tier.price}
                    </span>
                    <span className="text-gray-500 ml-1 text-base">
                      /month
                    </span>
                  </div>

                  <p className="text-sm text-gray-600 font-medium">
                    {tier.description}
                  </p>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col pt-0">
                  <div className="mb-5 p-3 bg-[#F8F9FB] rounded-lg border border-gray-100">
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold text-gray-900">
                        Best for:{" "}
                      </span>
                      {copy.bestFor}
                    </p>
                  </div>

                  <p className="text-sm italic text-[#1F4341] mb-5 leading-relaxed">
                    {copy.volumeTranslation}
                  </p>

                  <div className="space-y-3 mb-6">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Included
                    </p>
                    <ul className="space-y-2">
                      {copy.included.map((line) => (
                        <li
                          key={line}
                          className="flex items-start gap-2 text-sm text-gray-700"
                        >
                          <Check className="w-4 h-4 text-[#3E7C77] flex-shrink-0 mt-[3px]" />
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mb-6 pb-6 border-b border-gray-100">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                      Overages
                    </p>
                    <p className="text-xs text-gray-500">{copy.overages}</p>
                  </div>

                  <div className="mt-auto">
                    <Button
                      onClick={() => handleGetStarted(tier.id)}
                      disabled={isCheckoutLoading}
                      className={cn(
                        "w-full group",
                        tier.recommended
                          ? "bg-[#3E7C77] hover:bg-[#2E605C] text-white"
                          : "bg-gray-900 hover:bg-gray-800 text-white",
                      )}
                    >
                      {copy.ctaLabel}
                      <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>

                    {tier.id === "thrive" && (
                      <p className="text-xs text-gray-500 mt-3 text-center">
                        Larger operation?{" "}
                        <Link
                          to="/contact"
                          className="text-[#3E7C77] font-semibold hover:underline"
                        >
                          Talk to sales →
                        </Link>
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};
