
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

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

  return (
    <div className="flex items-center justify-center gap-6 mb-12">
      {/* Main toggle container */}
      <div className="relative flex items-center bg-white/80 backdrop-blur-sm rounded-full p-2 shadow-lg border border-white/50">
        {/* Monthly option */}
        <button
          onClick={handleMonthlyClick}
          className={`relative px-6 py-3 rounded-full text-lg font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary/50 ${
            !isAnnual 
              ? 'bg-primary text-white shadow-md' 
              : 'text-text-secondary hover:text-text-primary hover:bg-white/50'
          }`}
          aria-pressed={!isAnnual}
          aria-label="Switch to monthly billing"
        >
          Monthly
        </button>
        
        {/* Annual option */}
        <button
          onClick={handleAnnualClick}
          className={`relative px-6 py-3 rounded-full text-lg font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary/50 ${
            isAnnual 
              ? 'bg-primary text-white shadow-md' 
              : 'text-text-secondary hover:text-text-primary hover:bg-white/50'
          }`}
          aria-pressed={isAnnual}
          aria-label="Switch to annual billing"
        >
          Annual
        </button>
      </div>
      
      {/* Savings badge */}
      <Badge 
        className={`transition-all duration-300 ${
          isAnnual 
            ? 'bg-gradient-to-r from-primary to-brand-teal-mint text-white shadow-md scale-110 animate-pulse' 
            : 'bg-muted/60 text-text-tertiary scale-100'
        }`}
      >
        💰 Save 17%
      </Badge>
    </div>
  );
};
