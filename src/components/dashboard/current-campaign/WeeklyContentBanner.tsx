
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Sparkles, ArrowRight } from 'lucide-react';

interface WeeklyContentBannerProps {
  currentTheme: string;
  weekNumber: number;
  onReviewApprove: () => void;
  showCallout?: boolean;
}

export const WeeklyContentBanner: React.FC<WeeklyContentBannerProps> = ({
  currentTheme,
  weekNumber,
  onReviewApprove,
  showCallout = false
}) => {
  return (
    <Card className={`border-2 ${showCallout ? 'border-garden-green bg-gradient-to-r from-garden-sage/50 to-garden-background animate-pulse-subtle' : 'border-garden-green/30 bg-garden-sage/20'} mb-6`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-garden-green/20 rounded-full flex items-center justify-center">
              <Calendar className="w-6 h-6 text-garden-green" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-1">
                This week's theme: {currentTheme}
              </h3>
              <p className="text-gray-600 flex items-center gap-2">
                <span>Week {weekNumber}</span>
                {showCallout && (
                  <>
                    <span>•</span>
                    <span className="text-garden-green font-medium">
                      Ready for your review
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>
          
          <Button
            onClick={onReviewApprove}
            className={`flex items-center gap-2 ${
              showCallout 
                ? 'bg-garden-green hover:bg-garden-green-dark text-white animate-pulse' 
                : 'bg-garden-green hover:bg-garden-green-dark text-white'
            }`}
            size="lg"
          >
            <Sparkles className="w-4 h-4" />
            Review & Approve
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
        
        {showCallout && (
          <div className="mt-4 p-3 bg-garden-green/10 rounded-lg">
            <p className="text-sm text-garden-green font-medium">
              💡 Your AI has generated fresh content for this week. Review and approve any piece to start posting!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
