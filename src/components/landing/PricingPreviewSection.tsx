import { Button } from "@/components/ui/button";
import { ArrowRight, Leaf } from "lucide-react";
interface PricingPreviewSectionProps {
  onSeePricing: () => void;
}
export const PricingPreviewSection = ({
  onSeePricing
}: PricingPreviewSectionProps) => {
  return <section className="py-12 px-6 bg-offwhite">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-4xl font-bold mb-6 text-accent">Stop Paying Thousands Every Month for Disconnected Marketing Tools</h2>
        
        <p className="text-xl text-muted-foreground mb-10">
          Get everything you need for $2,999/year. AI content creation, CRM, automation, analytics, email marketing, and more — all for one simple annual price that saves you thousands.
        </p>
        
        <Button 
          onClick={onSeePricing} 
          variant="cta"
          size="cta"
          className="group"
        >
          <Leaf className="mr-2 h-5 w-5 text-white" />
          See Our Simple Pricing
          <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform text-white" />
        </Button>
      </div>
    </section>;
};