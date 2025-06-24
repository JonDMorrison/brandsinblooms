
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, ArrowDown } from 'lucide-react';

interface FirstTimeConnectionCalloutProps {
  isVisible: boolean;
}

export const FirstTimeConnectionCallout: React.FC<FirstTimeConnectionCalloutProps> = ({
  isVisible
}) => {
  if (!isVisible) return null;

  return (
    <Card className="border-2 border-garden-green bg-gradient-to-r from-garden-sage/50 to-garden-background animate-pulse-subtle mb-4">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-garden-green/20 rounded-full flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-garden-green" />
            </div>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-garden-green mb-1">
              🎉 Your first Garden Tip is live!
            </h3>
            <p className="text-sm text-gray-700">
              Your content is ready to post. Choose your platform and publish with one click.
            </p>
          </div>
          <div className="flex-shrink-0">
            <ArrowDown className="w-5 h-5 text-garden-green animate-bounce" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
