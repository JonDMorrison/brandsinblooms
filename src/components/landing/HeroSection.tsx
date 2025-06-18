
import { Button } from "@/components/ui/button";
import { LandingPageIcon } from "./LandingPageIcon";
import { Sparkles, Leaf, Calendar, TrendingUp } from "lucide-react";

interface HeroSectionProps {
  onGetStarted: () => void;
}

export const HeroSection = ({ onGetStarted }: HeroSectionProps) => {
  return (
    <section className="py-32 px-6 text-center relative overflow-hidden">
      {/* Enhanced background with Apple-style gradients */}
      <div className="absolute inset-0 bg-gradient-to-br from-garden-background via-white to-garden-sage/30 opacity-80" />
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-garden-green/5 to-transparent" />
      
      <div className="max-w-5xl mx-auto relative z-10 apple-section-spacing">
        {/* Hero Icon with enhanced animation */}
        <div className="flex justify-center mb-12">
          <LandingPageIcon 
            icon={Sparkles} 
            variant="hero" 
            theme="spring" 
            animated={true}
            containerClassName="apple-fade-in-stagger garden-breathing shadow-2xl"
          />
        </div>
        
        {/* Enhanced Typography */}
        <h1 className="text-6xl md:text-7xl font-bold text-black mb-8 leading-tight tracking-tight apple-fade-in-stagger">
          Effortless Marketing for
          <span className="block text-garden-green mt-2">Garden Centers</span>
        </h1>
        
        <p className="text-xl md:text-2xl text-gray-600 mb-14 max-w-4xl mx-auto leading-relaxed apple-body-enhanced">
          Transform your marketing in under a minute. Get personalized weekly content for social media, newsletters, blogs, and email campaigns — all perfectly tailored to your garden center's unique voice and seasonal needs.
        </p>
        
        {/* Enhanced feature highlights with better spacing */}
        <div className="flex justify-center gap-12 mb-16">
          <div className="flex flex-col items-center gap-3 apple-fade-in-stagger" style={{animationDelay: '0.1s'}}>
            <LandingPageIcon 
              icon={Leaf} 
              variant="feature" 
              theme="spring" 
              animated={true}
              containerClassName="apple-icon-container"
            />
            <span className="text-base text-gray-700 font-medium apple-caption-enhanced">Plant Care Focus</span>
          </div>
          <div className="flex flex-col items-center gap-3 apple-fade-in-stagger" style={{animationDelay: '0.2s'}}>
            <LandingPageIcon 
              icon={Calendar} 
              variant="feature" 
              theme="summer" 
              animated={true}
              containerClassName="apple-icon-container"
            />
            <span className="text-base text-gray-700 font-medium apple-caption-enhanced">Seasonal Content</span>
          </div>
          <div className="flex flex-col items-center gap-3 apple-fade-in-stagger" style={{animationDelay: '0.3s'}}>
            <LandingPageIcon 
              icon={TrendingUp} 
              variant="feature" 
              theme="autumn" 
              animated={true}
              containerClassName="apple-icon-container"
            />
            <span className="text-base text-gray-700 font-medium apple-caption-enhanced">Growth Focused</span>
          </div>
        </div>
        
        {/* Enhanced CTA with Apple-style button */}
        <div className="apple-fade-in-stagger" style={{animationDelay: '0.4s'}}>
          <Button 
            onClick={onGetStarted}
            className="apple-button-premium apple-ripple-effect apple-spring-bounce px-16 py-6 text-xl rounded-2xl font-semibold text-white mb-6 shadow-lg hover:shadow-2xl transition-all duration-300"
          >
            Get Started In Less Than A Minute
          </Button>
          
          <p className="text-sm text-gray-500 apple-caption-enhanced">
            No credit card required • No technical skills needed • Ready in 60 seconds
          </p>
        </div>
      </div>
    </section>
  );
};
