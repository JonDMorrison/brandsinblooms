import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, Leaf, Gift, Sprout, Flower, Bug } from 'lucide-react';
import { PLAN_THEMES, PlanTheme } from '../constants';
import { usePlanWizard } from '../PlanWizardContext';

const themeIcons = {
  'fall-planting': Leaf,
  'houseplant-month': Sprout,
  'pollinator-week': Bug,
  'holiday-gifting': Gift,
  'vegetable-starts': Sprout,
  'perennial-spotlight': Flower
};

interface PlanStepThemeProps {
  onNext: () => void;
}

export const PlanStepTheme: React.FC<PlanStepThemeProps> = ({ onNext }) => {
  const { state, setMonth, setTheme } = usePlanWizard();

  // Default to next month
  React.useEffect(() => {
    if (!state.month) {
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(1);
      const monthString = nextMonth.toISOString().slice(0, 7); // YYYY-MM format
      setMonth(monthString);
    }
  }, [state.month, setMonth]);

  const handleThemeSelect = (theme: PlanTheme) => {
    setTheme(theme);
  };

  const canProceed = state.month && state.theme;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2">
          <Calendar className="h-8 w-8 text-primary" />
          <h2 className="text-3xl font-bold">Plan Your Marketing Focus</h2>
        </div>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Choose your marketing theme and target month. We'll create a complete content plan tailored to your garden center.
        </p>
      </div>

      {/* Month Selection */}
      <Card className="bg-gradient-to-br from-background to-muted/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Target Month
          </CardTitle>
          <CardDescription>
            Select the month you want to plan your marketing content for
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-md">
            <Label htmlFor="month">Month</Label>
            <Input
              id="month"
              type="month"
              value={state.month}
              onChange={(e) => setMonth(e.target.value)}
              className="mt-2"
            />
          </div>
        </CardContent>
      </Card>

      {/* Theme Selection */}
      <div className="space-y-4">
        <div className="text-center">
          <h3 className="text-xl font-semibold mb-2">Choose Your Marketing Theme</h3>
          <p className="text-muted-foreground">
            Pick a seasonal theme that matches your marketing goals
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {PLAN_THEMES.map((theme) => {
            const IconComponent = themeIcons[theme.id as keyof typeof themeIcons] || Leaf;
            const isSelected = state.theme?.id === theme.id;

            return (
              <Card 
                key={theme.id}
                className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                  isSelected 
                    ? 'ring-2 ring-primary bg-primary/5' 
                    : 'hover:border-primary/50'
                }`}
                onClick={() => handleThemeSelect(theme)}
              >
                <CardHeader className="text-center">
                  <div className="mx-auto mb-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    }`}>
                      <IconComponent className="h-6 w-6" />
                    </div>
                  </div>
                  <CardTitle className="text-lg">{theme.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-center text-sm">
                    {theme.description}
                  </CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Next Button */}
      <div className="flex justify-center pt-8">
        <Button 
          onClick={onNext}
          disabled={!canProceed}
          size="lg"
          className="px-8"
        >
          Continue to Calendar Draft
        </Button>
      </div>
    </div>
  );
};