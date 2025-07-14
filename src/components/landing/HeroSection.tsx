
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
      <div className="absolute inset-0 bg-gradient-to-br from-[#E9F5EC] via-white to-[#E9F5EC] opacity-90" />
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#47B881]/5 to-transparent" />
      
      {/* Botanical watermark behind content */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5">
        <Leaf className="w-96 h-96 text-[#47B881]" />
      </div>
      
      <div className="max-w-5xl mx-auto px-6 relative z-10 apple-section-spacing">
        {/* Hero Icon with enhanced styling */}
        <div className="flex justify-center mb-12">
          <LandingPageIcon 
            icon={Sparkles} 
            variant="hero" 
            theme="spring" 
            animated={true}
            containerClassName="apple-fade-in-stagger garden-breathing shadow-2xl bg-white border-2 border-[#47B881]/20 text-[#47B881]"
          />
        </div>
        
        {/* Enhanced Typography */}
        <h1 className="text-6xl md:text-7xl font-bold text-gray-900 mb-8 leading-tight tracking-tight apple-fade-in-stagger">
          Effortless Marketing for
          <span className="block text-[#47B881] mt-2">Garden Centers</span>
        </h1>
        
        <p className="text-xl md:text-2xl text-[#6B7280] mb-14 max-w-4xl mx-auto leading-relaxed apple-body-enhanced">
          Transform your marketing in under a minute. Get personalized weekly content for social media, newsletters, blogs, and email campaigns — all perfectly tailored to your garden center's unique voice and seasonal needs.
        </p>
        
        {/* Enhanced feature highlights with new color palette */}
        <div className="flex justify-center gap-12 mb-16">
          <div className="flex flex-col items-center gap-3 apple-fade-in-stagger" style={{animationDelay: '0.1s'}}>
            <LandingPageIcon 
              icon={Leaf} 
              variant="feature" 
              theme="spring" 
              animated={true}
              containerClassName="apple-icon-container bg-[#E9F5EC] border-[#47B881]/30 text-[#47B881]"
            />
            <span className="text-base text-[#6B7280] font-medium apple-caption-enhanced">Plant Care Focus</span>
          </div>
          <div className="flex flex-col items-center gap-3 apple-fade-in-stagger" style={{animationDelay: '0.2s'}}>
            <LandingPageIcon 
              icon={Calendar} 
              variant="feature" 
              theme="neutral" 
              animated={true}
              containerClassName="apple-icon-container bg-[#FEF3C7] border-[#F4C430]/30 text-[#D97706]"
            />
            <span className="text-base text-[#6B7280] font-medium apple-caption-enhanced">Seasonal Content</span>
          </div>
          <div className="flex flex-col items-center gap-3 apple-fade-in-stagger" style={{animationDelay: '0.3s'}}>
            <LandingPageIcon 
              icon={TrendingUp} 
              variant="feature" 
              theme="neutral" 
              animated={true}
              containerClassName="apple-icon-container bg-[#FDF2F2] border-[#F28C8C]/30 text-[#DC2626]"
            />
            <span className="text-base text-[#6B7280] font-medium apple-caption-enhanced">Growth Focused</span>
          </div>
        </div>
        
        {/* Enhanced CTA with nature-inspired styling and fixed text centering */}
        <div className="apple-fade-in-stagger mx-auto px-4" style={{animationDelay: '0.4s'}}>
          <Button 
            onClick={onGetStarted}
            className="bg-[#47B881] hover:bg-[#3A9B6C] text-white font-semibold rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 mx-auto block border-0 text-center"
            style={{
              padding: '16px 20px',
              fontSize: '15px',
              maxWidth: 'calc(100vw - 32px)',
              width: 'auto',
              whiteSpace: 'normal',
              lineHeight: '1.2',
              boxShadow: '0 8px 16px rgba(71, 184, 129, 0.2)',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            Get Started In Less Than A Minute
          </Button>
          
          <p className="text-sm text-[#6B7280] apple-caption-enhanced mt-6">
            No credit card required • No technical skills needed • Ready in 60 seconds
          </p>
        </div>
      </div>
    </section>
  );
};
