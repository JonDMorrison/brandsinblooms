
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

interface PricingToggleProps {
  isAnnual: boolean;
  onToggle: (checked: boolean) => void;
}

export const PricingToggle = ({ isAnnual, onToggle }: PricingToggleProps) => {
  const handleAnnualToggle = (checked: boolean) => {
    onToggle(checked);
  };

  const handleMonthlyClick = () => {
    if (isAnnual) {
      onToggle(false);
    }
  };

  const handleAnnualClick = () => {
    if (!isAnnual) {
      onToggle(true);
    }
  };

  return (
    <div className="flex items-center justify-center gap-4 mb-12">
      <span 
        className={`text-lg transition-all duration-200 cursor-pointer select-none ${!isAnnual ? 'text-brand-steel-blue font-semibold' : 'text-text-tertiary hover:text-text-secondary'}`}
        onClick={handleMonthlyClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleMonthlyClick();
          }
        }}
      >
        Monthly
      </span>
      <div className="relative">
        <Switch 
          checked={isAnnual} 
          onCheckedChange={handleAnnualToggle}
          className="data-[state=checked]:bg-brand-teal-mint"
        />
      </div>
      <span 
        className={`text-lg transition-all duration-200 cursor-pointer select-none ${isAnnual ? 'text-brand-steel-blue font-semibold' : 'text-text-tertiary hover:text-text-secondary'}`}
        onClick={handleAnnualClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleAnnualClick();
          }
        }}
      >
        Annual
      </span>
      <Badge 
        className={`ml-2 transition-all duration-200 ${
          isAnnual 
            ? 'bg-brand-teal-mint text-white animate-in slide-in-from-left' 
            : 'bg-muted text-text-tertiary opacity-60'
        }`}
      >
        Save 17%
      </Badge>
    </div>
  );
};
