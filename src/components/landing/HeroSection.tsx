
import { Button } from "@/components/ui/button";
import { LandingPageIcon } from "./LandingPageIcon";
import { Sparkles, Leaf, Calendar, TrendingUp } from "lucide-react";

interface HeroSectionProps {
  onGetStarted: () => void;
}

export const HeroSection = ({ onGetStarted }: HeroSectionProps) => {
  return (
    <section className="py-24 px-6 text-center relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 bg-gradient-to-br from-garden-background via-white to-garden-sage opacity-60" />
      
      <div className="max-w-4xl mx-auto relative z-10">
        {/* Hero Icon */}
        <div className="flex justify-center mb-8">
          <LandingPageIcon 
            icon={Sparkles} 
            variant="hero" 
            theme="spring" 
            animated={true}
            containerClassName="animate-pulse"
          />
        </div>
        
        <h1 className="text-5xl md:text-6xl font-bold text-black mb-6 leading-tight">
          Effortless Marketing for Garden Centers
        </h1>
        
        <p className="text-xl md:text-2xl text-gray-600 mb-10 max-w-3xl mx-auto leading-relaxed">
          In less than a minute, get personalized weekly content for social media, newsletters, blogs, video scripts, and email marketing — all tailored to your brand's unique voice.
        </p>
        
        {/* Feature highlights with icons */}
        <div className="flex justify-center gap-8 mb-10">
          <div className="flex flex-col items-center gap-2">
            <LandingPageIcon icon={Leaf} variant="feature" theme="spring" />
            <span className="text-sm text-gray-600 font-medium">Plant Care Focus</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <LandingPageIcon icon={Calendar} variant="feature" theme="summer" />
            <span className="text-sm text-gray-600 font-medium">Seasonal Content</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <LandingPageIcon icon={TrendingUp} variant="feature" theme="autumn" />
            <span className="text-sm text-gray-600 font-medium">Growth Focused</span>
          </div>
        </div>
        
        <Button 
          onClick={onGetStarted}
          className="bg-garden-green hover:bg-garden-green-dark text-white px-12 py-4 text-xl rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 group mb-4 mx-auto"
        >
          Get Started In Less Than A Minute
        </Button>
        
        <p className="text-sm text-gray-600">
          No credit card required. No tech skills needed.
        </p>
      </div>
    </section>
  );
};
