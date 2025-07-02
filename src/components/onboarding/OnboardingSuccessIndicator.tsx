import React from 'react';
import { CheckCircle, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OnboardingSuccessIndicatorProps {
  isCompleting: boolean;
  onContinue: () => void;
  step?: 'saving' | 'generating' | 'finalizing' | 'complete';
}

export const OnboardingSuccessIndicator = ({ 
  isCompleting, 
  onContinue, 
  step = 'saving' 
}: OnboardingSuccessIndicatorProps) => {
  const getStepContent = () => {
    switch (step) {
      case 'saving':
        return {
          icon: <div className="animate-spin w-6 h-6 border-2 border-garden-green border-t-transparent rounded-full" />,
          title: 'Saving your information...',
          description: 'Setting up your profile'
        };
      case 'generating':
        return {
          icon: <Sparkles className="w-6 h-6 text-garden-green animate-pulse" />,
          title: 'Creating your content...',
          description: 'AI is generating your first week of posts'
        };
      case 'finalizing':
        return {
          icon: <div className="animate-spin w-6 h-6 border-2 border-garden-green border-t-transparent rounded-full" />,
          title: 'Finishing setup...',
          description: 'Almost ready!'
        };
      case 'complete':
        return {
          icon: <CheckCircle className="w-6 h-6 text-garden-green" />,
          title: 'Setup Complete! 🎉',
          description: 'Your content is ready to review'
        };
    }
  };

  const content = getStepContent();

  if (!isCompleting && step !== 'complete') {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 max-w-md mx-4 text-center">
        <div className="w-16 h-16 bg-garden-sage rounded-full flex items-center justify-center mx-auto mb-4">
          {content.icon}
        </div>
        
        <h3 className="text-xl font-semibold text-garden-green-dark mb-2">
          {content.title}
        </h3>
        
        <p className="text-gray-600 mb-6">
          {content.description}
        </p>

        {step === 'complete' && (
          <Button 
            onClick={onContinue}
            className="w-full bg-garden-green hover:bg-garden-green-dark text-white"
          >
            View Your Content
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
};