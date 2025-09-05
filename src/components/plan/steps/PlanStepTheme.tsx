import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Calendar, Leaf, Gift, Sprout, Flower, Bug, Plus, X } from 'lucide-react';
import { PlanTheme } from '../constants';
import { usePlanWizard } from '../PlanWizardContext';
import { getSeasonalThemesForMonth } from '@/services/seasonalPlanGenerator';
import { MonthPicker } from '../MonthPicker';

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
  const { state, setMonth, addTheme, removeTheme } = usePlanWizard();
  const [availableThemes, setAvailableThemes] = React.useState<PlanTheme[]>([]);
  const [loadingThemes, setLoadingThemes] = React.useState(false);
  const [customThemeName, setCustomThemeName] = React.useState('');
  const [showCustomTheme, setShowCustomTheme] = React.useState(false);
  const [hasMoreThemes, setHasMoreThemes] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);

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

  // Load seasonal themes when month changes
  React.useEffect(() => {
    if (state.month) {
      setLoadingThemes(true);
      getSeasonalThemesForMonth(state.month, 0, 6)
        .then(result => {
          setAvailableThemes(result.themes);
          setHasMoreThemes(result.hasMore);
        })
        .catch(error => {
          console.error('Error loading seasonal themes:', error);
          // Keep existing themes as fallback
        })
        .finally(() => {
          setLoadingThemes(false);
        });
    }
  }, [state.month]);

  // Load more themes
  const handleLoadMore = async () => {
    if (!state.month || loadingMore || !hasMoreThemes) return;
    
    setLoadingMore(true);
    try {
      const result = await getSeasonalThemesForMonth(state.month, availableThemes.length, 6);
      setAvailableThemes(prev => [...prev, ...result.themes]);
      setHasMoreThemes(result.hasMore);
    } catch (error) {
      console.error('Error loading more themes:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleThemeToggle = (theme: PlanTheme, checked: boolean) => {
    if (checked) {
      addTheme(theme);
    } else {
      removeTheme(theme.id);
    }
  };

  const handleCustomThemeAdd = () => {
    if (customThemeName.trim()) {
      const customTheme: PlanTheme = {
        id: `custom-${Date.now()}`,
        label: customThemeName.trim(),
        description: 'Custom theme - content will be generated based on your specifications'
      };
      addTheme(customTheme);
      setCustomThemeName('');
      setShowCustomTheme(false);
    }
  };

  const isThemeSelected = (themeId: string) => {
    return state.themes.some(t => t.id === themeId);
  };

  const canProceed = state.month && state.themes.length > 0;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2">
          <Calendar className="h-8 w-8 text-primary" />
          <h2 className="text-3xl font-bold">Plan Your Marketing Focus</h2>
        </div>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Choose your marketing themes and target month. Select multiple themes to combine seasonal content with holidays and special events.
        </p>
      </div>

      {/* Month Selection */}
      <Card>
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
          <MonthPicker
            value={state.month}
            onChange={setMonth}
          />
        </CardContent>
      </Card>

      {/* Selected Themes Display */}
      {state.themes.length > 0 && (
        <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg">Selected Themes ({state.themes.length})</CardTitle>
            <CardDescription>
              Your content will combine these themes. Primary theme (first) fills all 4 weeks, others overlay specific weeks.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {state.themes.map((theme, index) => (
                <Badge key={theme.id} variant={index === 0 ? "default" : "secondary"} className="gap-2 py-1 px-3">
                  {index === 0 && <span className="text-xs font-medium">PRIMARY</span>}
                  {theme.label}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      console.log('Removing theme:', theme.id);
                      removeTheme(theme.id);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Theme Selection */}
      <div className="space-y-4">
        <div className="text-center">
          <h3 className="text-xl font-semibold mb-2">Choose Your Marketing Themes</h3>
          <p className="text-muted-foreground">
            Select multiple themes to create rich, layered content that combines seasonal focus with special events
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loadingThemes ? (
            // Loading skeleton
            Array.from({ length: 6 }).map((_, index) => (
              <Card key={index} className="animate-pulse">
                <CardHeader className="text-center">
                  <div className="mx-auto mb-3">
                    <div className="w-12 h-12 rounded-full bg-muted"></div>
                  </div>
                  <div className="h-4 bg-muted rounded w-3/4 mx-auto"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-12 bg-muted rounded"></div>
                </CardContent>
              </Card>
            ))
          ) : (
            availableThemes.map((theme) => {
              const IconComponent = themeIcons[theme.id as keyof typeof themeIcons] || Leaf;
              const isSelected = isThemeSelected(theme.id);

              return (
                <Card 
                  key={theme.id}
                  className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                    isSelected 
                      ? 'ring-2 ring-primary bg-primary/5' 
                      : 'hover:border-primary/50'
                  }`}
                  onClick={() => handleThemeToggle(theme, !isSelected)}
                >
                  <CardHeader className="text-center">
                    <div className="mx-auto mb-3 flex items-center justify-between">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      }`}>
                        <IconComponent className="h-6 w-6" />
                      </div>
                      <Checkbox 
                        checked={isSelected}
                        onChange={() => {}} // Handled by card click
                        className="ml-2"
                      />
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
            })
          )}

          {/* Custom Theme Card */}
          <Card className="border-dashed border-2 border-muted-foreground/30 hover:border-primary/50 cursor-pointer transition-colors">
            <CardHeader className="text-center">
              <div className="mx-auto mb-3">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <Plus className="h-6 w-6" />
                </div>
              </div>
              <CardTitle className="text-lg">Custom Theme</CardTitle>
            </CardHeader>
            <CardContent>
              {showCustomTheme ? (
                <div className="space-y-3">
                  <Input
                    placeholder="Theme name (e.g., 'Black Friday')"
                    value={customThemeName}
                    onChange={(e) => setCustomThemeName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleCustomThemeAdd()}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleCustomThemeAdd} disabled={!customThemeName.trim()}>
                      Add
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowCustomTheme(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div onClick={() => setShowCustomTheme(true)}>
                  <CardDescription className="text-center text-sm">
                    Add your own theme for specialized campaigns
                  </CardDescription>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Load More Button */}
        {hasMoreThemes && (
          <div className="flex justify-center mt-6">
            <Button
              variant="outline"
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="px-8"
            >
              {loadingMore ? 'Loading...' : 'Load More Themes'}
            </Button>
          </div>
        )}
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
