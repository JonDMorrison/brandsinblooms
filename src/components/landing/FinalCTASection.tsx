
import { Button } from "@/components/ui/button";
import { LandingPageIcon } from "./LandingPageIcon";
import { ArrowRight, Sparkles } from "lucide-react";

interface FinalCTASectionProps {
  onGetStarted: () => void;
}

export const FinalCTASection = ({ onGetStarted }: FinalCTASectionProps) => {
  return (
    <section className="final-cta-section py-16 md:py-24 px-6 bg-gradient-to-br from-garden-green to-garden-green-dark text-black relative overflow-hidden">
      {/* Simplified background decoration */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/10 via-transparent to-black/10" />
      
      <div className="max-w-4xl mx-auto text-center relative z-10">
        {/* Central icon */}
        <div className="flex justify-center mb-8">
          <LandingPageIcon 
            icon={Sparkles} 
            variant="hero" 
            theme="neutral"
            containerClassName="bg-white/90 border-gray-300 text-black shadow-xl"
            animated={true}
          />
        </div>
        
        <h2 className="text-3xl md:text-5xl font-bold mb-6 leading-tight text-black">
          Ready to Save Hours Every Week?
        </h2>
        
        <p className="text-lg md:text-xl mb-10 max-w-2xl mx-auto leading-relaxed text-black opacity-90">
          Join garden centers who've transformed their marketing and are growing their business effortlessly. Try it free and watch your marketing take care of itself.
        </p>
        
        {/* Clean button design with black text */}
        <div className="mb-6">
          <Button 
            onClick={onGetStarted}
            size="lg"
            className="final-cta-button bg-white text-black border-2 border-black hover:bg-gray-100 hover:text-black font-semibold"
          >
            Start Your Free Trial
            <ArrowRight className="ml-2 h-5 w-5 text-black" />
          </Button>
        </div>
        
        <p className="text-sm text-black opacity-80">
          No credit card required • No technical skills needed • Ready in 60 seconds
        </p>
      </div>
    </section>
  );
};
