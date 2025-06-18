
import { Button } from "@/components/ui/button";
import { LandingPageIcon } from "./LandingPageIcon";
import { ArrowRight, Sparkles } from "lucide-react";

interface FinalCTASectionProps {
  onGetStarted: () => void;
}

export const FinalCTASection = ({ onGetStarted }: FinalCTASectionProps) => {
  return (
    <section className="py-24 px-6 bg-gradient-to-br from-garden-green via-garden-green-dark to-garden-green text-white relative overflow-hidden final-cta-section">
      {/* Enhanced background decorative elements */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/10 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-garden-green/80 via-transparent to-garden-green/80" />
      
      <div className="max-w-5xl mx-auto text-center relative z-10 apple-section-spacing">
        {/* Enhanced central icon */}
        <div className="flex justify-center mb-10">
          <LandingPageIcon 
            icon={Sparkles} 
            variant="hero" 
            theme="neutral"
            containerClassName="bg-white/20 border-white/30 text-white shadow-2xl shadow-black/20 apple-fade-in-stagger garden-breathing"
            animated={true}
          />
        </div>
        
        <h2 className="text-4xl md:text-5xl font-bold mb-8 apple-headline-large text-white">
          Ready to Save Hours Every Week?
        </h2>
        
        <p className="text-2xl mb-12 opacity-90 apple-body-enhanced max-w-3xl mx-auto leading-relaxed">
          Join garden centers who've transformed their marketing and are growing their business effortlessly. Try it free and watch your marketing take care of itself.
        </p>
        
        {/* CRITICAL: Enhanced button container with explicit layering */}
        <div className="apple-fade-in-stagger mx-auto px-4 relative z-50 final-cta-button-container" style={{animationDelay: '0.2s'}}>
          <Button 
            onClick={onGetStarted}
            className="final-cta-button bg-white hover:bg-gray-100 text-garden-green font-semibold shadow-2xl hover:shadow-3xl apple-spring-bounce apple-ripple-effect transition-all duration-300 rounded-2xl mx-auto block relative z-50"
            style={{
              padding: '16px 20px',
              fontSize: '15px',
              maxWidth: 'calc(100vw - 32px)',
              width: 'auto',
              whiteSpace: 'normal',
              lineHeight: '1.2',
              position: 'relative',
              zIndex: 9999,
              backgroundColor: 'white',
              color: 'rgb(76, 175, 80)',
              borderColor: 'white'
            }}
          >
            Start Your Free Trial
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
          
          <p className="text-base opacity-80 apple-caption-enhanced mt-6 relative z-40">
            No credit card required • No technical skills needed • Ready in 60 seconds
          </p>
        </div>
      </div>
    </section>
  );
};
