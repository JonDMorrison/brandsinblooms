import { Badge } from "@/components/ui-legacy/badge";
import { BrandFoliage } from "@/components/brand";
import { Leaf } from "lucide-react";

export const PricingHeroNew = () => {
  return (
    <section className="relative overflow-hidden px-6 pt-16 pb-12 md:pt-24 md:pb-16">
      <div className="pricing-soft-tint" aria-hidden="true" />
      <BrandFoliage
        className="pricing-foliage pricing-foliage--bottom-right"
        aria-hidden="true"
      />

      <div className="relative z-[1] max-w-4xl mx-auto text-center">
        <p className="pricing-hero-eyebrow mb-5">
          For Independent Garden Centres
        </p>

        <h1 className="pricing-hero-headline mb-5">
          Stop paying for tools that don&apos;t talk to each other.
        </h1>

        <p className="pricing-hero-subhead max-w-2xl mx-auto mb-7">
          BloomSuite replaces your marketing tools with one platform built
          for garden centres. Pricing scales with how many customers you
          have, not how many features you want.
        </p>

        <Badge
          variant="outline"
          className="px-4 py-2 text-sm font-medium border-[#3E7C77]/30 text-[#1F4341] bg-[#E1FFFE]"
        >
          <Leaf className="w-4 h-4 mr-2" />
          Early Adopter pricing — locked in for life when you join now
        </Badge>
      </div>
    </section>
  );
};
