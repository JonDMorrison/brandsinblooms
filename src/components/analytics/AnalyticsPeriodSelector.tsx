import { Button } from "@/components/ui/button";

interface AnalyticsPeriodSelectorProps {
  selectedPeriod: number;
  onPeriodChange: (days: number) => void;
}

export const AnalyticsPeriodSelector = ({ selectedPeriod, onPeriodChange }: AnalyticsPeriodSelectorProps) => {
  const periods = [
    { label: '7 Days', value: 7 },
    { label: '30 Days', value: 30 },
    { label: '90 Days', value: 90 },
  ];

  return (
    <div className="flex gap-2">
      {periods.map(period => (
        <Button
          key={period.value}
          variant={selectedPeriod === period.value ? "default" : "outline"}
          size="sm"
          onClick={() => onPeriodChange(period.value)}
          className="text-sm"
        >
          {period.label}
        </Button>
      ))}
    </div>
  );
};