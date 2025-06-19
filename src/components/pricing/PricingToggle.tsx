
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

interface PricingToggleProps {
  isAnnual: boolean;
  onToggle: (checked: boolean) => void;
}

export const PricingToggle = ({ isAnnual, onToggle }: PricingToggleProps) => {
  const handleAnnualToggle = (checked: boolean) => {
    console.log('Annual toggle clicked:', { from: isAnnual, to: checked });
    onToggle(checked);
    console.log('Annual state updated to:', checked);
  };

  return (
    <div className="flex items-center justify-center gap-4 mb-12">
      <span className={`text-lg transition-all duration-200 ${!isAnnual ? 'text-garden-green-dark font-semibold' : 'text-gray-600'}`}>
        Monthly
      </span>
      <div className="relative">
        <Switch 
          checked={isAnnual} 
          onCheckedChange={handleAnnualToggle}
          className="data-[state=checked]:bg-garden-green pointer-events-auto cursor-pointer relative z-10"
          style={{ pointerEvents: 'auto' }}
          onClick={() => console.log('Switch clicked directly')}
        />
        {/* Debug indicator */}
        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 text-xs text-gray-500">
          {isAnnual ? 'Annual' : 'Monthly'}
        </div>
      </div>
      <span className={`text-lg transition-all duration-200 ${isAnnual ? 'text-garden-green-dark font-semibold' : 'text-gray-600'}`}>
        Annual
      </span>
      {isAnnual && (
        <Badge className="bg-garden-green text-white ml-2 animate-in slide-in-from-left duration-200">
          Save 17%
        </Badge>
      )}
    </div>
  );
};
