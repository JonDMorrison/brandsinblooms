import React from 'react';
import { useTypingEffect } from '@/hooks/useTypingEffect';
import { DisplayMedium } from '@/components/ui/typography';

const BlinkingCursor = ({ show }: { show: boolean }) => (
  <span className={`inline-block w-0.5 h-5 bg-current ml-1 ${show ? 'animate-pulse' : ''}`}>
    |
  </span>
);

export const NewsletterEmptyState = () => {
  const inspirationalText = "Writing should never feel like a struggle. That's why we created an AI assistant designed to capture your raw ideas and refine them into something impactful.";
  
  const { displayedText, isComplete, hasStarted } = useTypingEffect({
    text: inspirationalText,
    delay: 1500,
    speed: 30
  });

  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] px-8 text-center space-y-8">
      {/* Main Heading */}
      <div className="space-y-2">
        <DisplayMedium className="text-brand-teal leading-tight">
          Great ideas
        </DisplayMedium>
        <DisplayMedium className="text-foreground leading-tight">
          few lines away
        </DisplayMedium>
      </div>
      
      {/* Typing Animation */}
      <div className="max-w-2xl">
        <p className="text-lg font-mono text-muted-foreground leading-relaxed">
          {hasStarted && (
            <>
              {displayedText}
              <BlinkingCursor show={!isComplete || displayedText.length > 0} />
            </>
          )}
        </p>
      </div>
    </div>
  );
};