
import { Button } from "@/components/ui/button";
import { LandingPageIcon } from "./LandingPageIcon";
import { Sparkles, Leaf, Calendar, TrendingUp } from "lucide-react";

interface HeroSectionProps {
  onGetStarted: () => void;
}

export const HeroSection = ({ onGetStarted }: HeroSectionProps) => {
  return (
    <section className="w-full py-32 text-center relative overflow-hidden hero-section">
      {/* Enhanced background with nature-inspired gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-offwhite via-offwhite to-offwhite opacity-90" />
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-secondary/5 to-transparent" />
      
      {/* Botanical watermark behind content */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5">
        <Leaf className="w-96 h-96 text-secondary" />
      </div>
      
      <div className="max-w-5xl mx-auto px-6 relative z-10 apple-section-spacing">
        {/* Hero Icon with enhanced styling */}
        <div className="flex justify-center mb-12">
          <LandingPageIcon 
            logo="/lovable-uploads/e0b56fe5-9a69-4ed9-a69a-53664e6e4c5d.png"
            variant="hero" 
            theme="spring" 
            animated={true}
            containerClassName="apple-fade-in-stagger garden-breathing shadow-2xl bg-white border-2 border-secondary/20"
          />
        </div>
        
        {/* Enhanced Typography */}
        <h1 className="text-6xl md:text-7xl font-bold text-gray-900 mb-8 leading-tight tracking-tight apple-fade-in-stagger">
          The Most Powerful Marketing Tool Ever Built for <span className="text-secondary">Garden Centers</span>
        </h1>
        
        <p className="text-xl md:text-2xl text-muted-foreground mb-14 max-w-4xl mx-auto leading-relaxed apple-body-enhanced">
          Stop struggling with scattered marketing tools that don't understand your business. BloomSuite gives you everything you need to attract more customers, increase sales, and grow your garden center — all in one powerful platform.
        </p>
        
        {/* Enhanced feature highlights with new color palette */}
        <div className="flex justify-center gap-12 mb-16">
          <div className="flex flex-col items-center gap-3 apple-fade-in-stagger" style={{animationDelay: '0.1s'}}>
            <LandingPageIcon 
              icon={Leaf} 
              variant="feature" 
              theme="spring" 
              animated={true}
              containerClassName="apple-icon-container bg-secondary/10 border-secondary/30 text-secondary"
            />
            <span className="text-base text-muted-foreground font-medium apple-caption-enhanced">AI Content Creation</span>
          </div>
          <div className="flex flex-col items-center gap-3 apple-fade-in-stagger" style={{animationDelay: '0.2s'}}>
            <LandingPageIcon 
              icon={Calendar} 
              variant="feature" 
              theme="neutral" 
              animated={true}
              containerClassName="apple-icon-container bg-secondary/10 border-secondary/30 text-secondary"
            />
            <span className="text-base text-muted-foreground font-medium apple-caption-enhanced">Smart Automation</span>
          </div>
          <div className="flex flex-col items-center gap-3 apple-fade-in-stagger" style={{animationDelay: '0.3s'}}>
            <LandingPageIcon 
              icon={TrendingUp} 
              variant="feature" 
              theme="neutral" 
              animated={true}
              containerClassName="apple-icon-container bg-secondary/10 border-secondary/30 text-secondary"
            />
            <span className="text-base text-muted-foreground font-medium apple-caption-enhanced">Complete Analytics</span>
          </div>
        </div>
        
        {/* Enhanced CTA with nature-inspired styling and fixed text centering */}
        <div className="apple-fade-in-stagger mx-auto px-4" style={{animationDelay: '0.4s'}}>
          <Button 
            onClick={onGetStarted}
            className="bg-cta hover:bg-cta/90 text-white font-semibold rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 mx-auto block border-0 text-center cursor-pointer"
            style={{
              padding: '16px 20px',
              fontSize: '15px',
              maxWidth: 'calc(100vw - 32px)',
              width: 'auto',
              whiteSpace: 'normal',
              lineHeight: '1.2',
              boxShadow: '0 8px 16px rgba(230, 126, 72, 0.2)',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'auto'
            }}
          >
            Get Started In Less Than A Minute
          </Button>
          
          <p className="text-sm text-muted-foreground apple-caption-enhanced mt-6">
            No credit card required • No technical skills needed • Ready in 60 seconds
          </p>
        </div>
      </div>
    </section>
  );
};
