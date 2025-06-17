
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface HeroSectionProps {
  onGetStarted: () => void;
}

export const HeroSection = ({ onGetStarted }: HeroSectionProps) => {
  return (
    <section className="py-24 px-6 text-center">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl md:text-6xl font-bold text-black mb-6 leading-tight">
          Effortless Marketing for Garden Centers
        </h1>
        
        <p className="text-xl md:text-2xl text-gray-600 mb-10 max-w-3xl mx-auto leading-relaxed">
          In less than a minute, get personalized weekly content for social media, newsletters, blogs, video scripts, and email marketing — all tailored to your voice.
        </p>
        
        <Button 
          onClick={onGetStarted}
          className="bg-garden-green hover:bg-garden-green-dark text-white px-12 py-4 text-xl rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 group mb-4 flex items-center gap-2 mx-auto"
        >
          Get Started In Less Than A Minute
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </Button>
        
        <p className="text-sm text-gray-600">
          No credit card required. No tech skills needed.
        </p>
      </div>
    </section>
  );
};
