
import { Button } from "@/components/ui/button";
import { LandingPageIcon } from "./LandingPageIcon";
import { ArrowRight, Calendar, Leaf } from "lucide-react";

interface FinalCTASectionProps {
  onGetStarted: () => void;
}

export const FinalCTASection = ({ onGetStarted }: FinalCTASectionProps) => {
  return (
    <section className="final-cta-section py-16 md:py-24 px-6 bg-gradient-to-br from-[#47B881] to-[#3A9B6C] text-black relative overflow-hidden">
      {/* Garden-themed illustration background */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-1/4 left-1/4 transform -translate-x-1/2 -translate-y-1/2">
          <Calendar className="w-32 h-32 text-black" />
        </div>
        <div className="absolute top-1/2 right-1/4 transform translate-x-1/2 -translate-y-1/2">
          <Leaf className="w-24 h-24 text-black" />
        </div>
        <div className="absolute bottom-1/4 left-1/2 transform -translate-x-1/2 translate-y-1/2">
          <div className="w-16 h-16 bg-black/20 rounded-full flex items-center justify-center">
            <div className="w-8 h-8 bg-black/40 rounded-full"></div>
          </div>
        </div>
      </div>
      
      {/* Subtle overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/5 via-transparent to-black/5" />
      
      <div className="max-w-4xl mx-auto text-center relative z-10">
        {/* Central icon with enhanced styling */}
        <div className="flex justify-center mb-8">
          <LandingPageIcon 
            icon={Calendar}
            variant="hero" 
            theme="neutral"
            containerClassName="bg-white/95 border-white/30 text-[#47B881] shadow-2xl"
            animated={true}
          />
        </div>
        
        <h2 className="text-3xl md:text-5xl font-bold mb-6 leading-tight text-black">
          Ready to Save Hours Every Week?
        </h2>
        
        <p className="text-lg md:text-xl mb-10 max-w-2xl mx-auto leading-relaxed text-black opacity-90">
          Join garden centers who've transformed their marketing and are growing their business effortlessly. Try it free and watch your marketing take care of itself.
        </p>
        
        {/* Enhanced button with nature-inspired styling */}
        <div className="mb-6">
          <Button 
            onClick={onGetStarted}
            size="lg"
            className="final-cta-button bg-white text-black border-2 border-black hover:bg-white/95 hover:text-black font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
            style={{
              boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)'
            }}
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
