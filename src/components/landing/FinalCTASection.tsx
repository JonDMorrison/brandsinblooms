
import { Button } from "@/components/ui/button";
import { LandingPageIcon } from "./LandingPageIcon";
import { ArrowRight, Sparkles } from "lucide-react";

interface FinalCTASectionProps {
  onGetStarted: () => void;
}

export const FinalCTASection = ({ onGetStarted }: FinalCTASectionProps) => {
  return (
    <section className="py-16 md:py-24 px-6 bg-gradient-to-br from-garden-green to-garden-green-dark text-white relative overflow-hidden">
      {/* Simplified background decoration */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/10 via-transparent to-black/10" />
      
      <div className="max-w-4xl mx-auto text-center relative z-10">
        {/* Central icon */}
        <div className="flex justify-center mb-8">
          <LandingPageIcon 
            icon={Sparkles} 
            variant="hero" 
            theme="neutral"
            containerClassName="bg-white/20 border-white/30 text-white shadow-xl"
            animated={true}
          />
        </div>
        
        <h2 className="text-3xl md:text-5xl font-bold mb-6 text-white leading-tight">
          Ready to Save Hours Every Week?
        </h2>
        
        <p className="text-lg md:text-xl mb-10 text-white/90 max-w-2xl mx-auto leading-relaxed">
          Join garden centers who've transformed their marketing and are growing their business effortlessly. Try it free and watch your marketing take care of itself.
        </p>
        
        {/* Clean button design */}
        <div className="mb-6">
          <Button 
            onClick={onGetStarted}
            size="lg"
            className="bg-white hover:bg-gray-100 text-garden-green font-semibold text-lg px-8 py-4 rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300 border-2 border-white hover:border-gray-100"
          >
            Start Your Free Trial
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
        
        <p className="text-sm text-white/80">
          No credit card required • No technical skills needed • Ready in 60 seconds
        </p>
      </div>
    </section>
  );
};
