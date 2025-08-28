
import { Button } from "@/components/ui/button";
import { ArrowRight, Leaf } from "lucide-react";

interface PricingPreviewSectionProps {
  onSeePricing: () => void;
}

export const PricingPreviewSection = ({ onSeePricing }: PricingPreviewSectionProps) => {
  return (
    <section className="py-12 px-6 bg-white">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-4xl font-bold mb-6 text-gray-900">
          Stop Paying $200+ Per Month for Scattered Tools
        </h2>
        
        <p className="text-xl text-[#6B7280] mb-10">
          Get everything you need for less than what you're probably paying for just social media scheduling. AI content creation, CRM, automation, analytics, email marketing, and more — all for one low price.
        </p>
        
        <Button 
          onClick={onSeePricing}
          className="bg-[#47B881] hover:bg-[#3A9B6C] text-white px-12 py-4 text-xl rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 group border-0 animate-pulse-hover"
          style={{
            boxShadow: '0 8px 16px rgba(71, 184, 129, 0.2)'
          }}
        >
          <Leaf className="mr-2 h-5 w-5 text-white" />
          See Pricing Plans
          <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform text-white" />
        </Button>
      </div>
    </section>
  );
};
