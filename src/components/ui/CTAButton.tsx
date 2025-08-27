import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getCTAText, getCTAUrl, hasValidCTA } from '@/utils/ctaNormalization';
import { ContentBlock } from '@/types/emailBuilder';

interface CTAButtonProps {
  block: Partial<ContentBlock>;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary';
  size?: 'sm' | 'default' | 'lg';
}

/**
 * Reusable CTA button component with consistent rendering logic
 */
export const CTAButton: React.FC<CTAButtonProps> = ({ 
  block, 
  className,
  variant = 'default',
  size = 'default'
}) => {
  // Don't render if no CTA content
  if (!hasValidCTA(block)) {
    return null;
  }

  const ctaText = getCTAText(block);
  const ctaUrl = getCTAUrl(block);
  
  // Apply alignment classes
  const alignmentClasses = cn(
    block.textAlign === 'center' && "justify-center",
    block.textAlign === 'right' && "justify-end",
    block.textAlign === 'left' && "justify-start"
  );

  return (
    <div className={cn("mt-4 flex", alignmentClasses, className)}>
      <Button
        asChild={!!ctaUrl}
        variant={variant}
        size={size}
        className="inline-flex items-center px-6 py-3"
      >
        {ctaUrl ? (
          <a 
            href={ctaUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="no-underline"
          >
            {ctaText}
          </a>
        ) : (
          <span>{ctaText}</span>
        )}
      </Button>
    </div>
  );
};