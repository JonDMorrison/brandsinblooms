
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface FinalCTASectionProps {
  onGetStarted: () => void;
}

export const FinalCTASection = ({ onGetStarted }: FinalCTASectionProps) => {
  return (
    <section className="py-12 px-6 bg-gradient-to-r from-garden-green to-garden-green-dark text-white">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-2xl font-semibold mb-6">
          Ready to Save Hours Every Week?
        </h2>
        
        <p className="text-xl mb-10 opacity-90">
          Try it free and watch your marketing take care of itself.
        </p>
        
        <Button 
          onClick={onGetStarted}
          className="bg-white hover:bg-gray-100 text-garden-green px-12 py-4 text-xl rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 group mb-6"
        >
          Get Started In Less Than A Minute
          <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
        </Button>
        
        <p className="text-sm opacity-75">
          No credit card required. No tech skills needed.
        </p>
      </div>
    </section>
  );
};
