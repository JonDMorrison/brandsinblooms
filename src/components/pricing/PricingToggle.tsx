
import { Badge } from "@/components/ui/badge";
import { ChevronDown } from "lucide-react";

interface PricingToggleProps {
  isAnnual: boolean;
  onToggle: (checked: boolean) => void;
}

export const PricingToggle = ({ isAnnual, onToggle }: PricingToggleProps) => {
  const handleMonthlyClick = () => {
    onToggle(false);
  };

  const handleAnnualClick = () => {
    onToggle(true);
  };

  const scrollToPlans = () => {
    const plansSection = document.getElementById('pricing-plans');
    if (plansSection) {
      plansSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 mb-12">
      {/* Main toggle container */}
      <div className="relative flex items-center bg-white/80 backdrop-blur-sm rounded-full p-1 shadow-lg border border-white/50">
        {/* Monthly option */}
        <button
          onClick={handleMonthlyClick}
          className={`relative px-8 py-3 rounded-full text-lg font-semibold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary/50 ${
            !isAnnual 
              ? 'bg-primary text-white shadow-md' 
              : 'text-text-secondary hover:text-text-primary hover:bg-white/50'
          }`}
          aria-pressed={!isAnnual}
          aria-label="Switch to monthly billing"
        >
          Monthly
        </button>
        
        {/* Annual option with integrated savings */}
        <button
          onClick={handleAnnualClick}
          className={`relative px-8 py-3 rounded-full text-lg font-semibold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary/50 ${
            isAnnual 
              ? 'bg-primary text-white shadow-md' 
              : 'text-text-secondary hover:text-text-primary hover:bg-white/50'
          }`}
          aria-pressed={isAnnual}
          aria-label="Switch to annual billing"
        >
          <span className="flex items-center gap-2">
            Annual
            <span className={`text-sm font-medium ${
              isAnnual ? 'text-white/90' : 'text-primary'
            }`}>
              (Save 17%)
            </span>
          </span>
        </button>
      </div>
      
      {/* Compare Plans Anchor */}
      <button
        onClick={scrollToPlans}
        className="flex items-center gap-1 text-text-secondary hover:text-primary transition-colors duration-200 text-sm font-medium"
      >
        Compare Plans 
        <ChevronDown className="h-4 w-4" />
      </button>
    </div>
  );
};
