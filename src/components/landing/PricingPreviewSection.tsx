
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface PricingPreviewSectionProps {
  onSeePricing: () => void;
}

export const PricingPreviewSection = ({ onSeePricing }: PricingPreviewSectionProps) => {
  return (
    <section className="py-12 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-2xl font-semibold mb-4 text-garden-green-dark">
          Simple Pricing. Big Value.
        </h2>
        
        <p className="text-base text-gray-600 mb-10">
          Tools like this usually cost thousands. We made it affordable for every garden center.
        </p>
        
        <Button 
          onClick={onSeePricing}
          className="bg-garden-green hover:bg-garden-green-dark text-white px-12 py-4 text-xl rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 group"
        >
          See Pricing Plans
          <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
        </Button>
      </div>
    </section>
  );
};
