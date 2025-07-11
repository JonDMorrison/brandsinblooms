import React, { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface AgeAndTermsVerificationProps {
  isChecked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
}

export const AgeAndTermsVerification: React.FC<AgeAndTermsVerificationProps> = ({
  isChecked,
  onCheckedChange,
  className = ""
}) => {
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-start space-x-3 p-4 bg-background/50 backdrop-blur-sm rounded-lg">
        <Checkbox
          id="age-terms-verification"
          checked={isChecked}
          onCheckedChange={onCheckedChange}
          className="mt-0.5"
          aria-describedby="verification-text"
        />
        <div className="space-y-2 flex-1">
          <Label 
            htmlFor="age-terms-verification" 
            className="text-sm leading-relaxed cursor-pointer"
            id="verification-text"
          >
            I confirm that I am 13 years of age or older and agree to the{' '}
            <a 
              href="https://brandsinblooms.com/pages/bloomsuite-privacy" 
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 underline font-medium transition-colors duration-200"
            >
              Privacy Policy
            </a>{' '}
            and{' '}
            <a 
              href="https://brandsinblooms.com/pages/terms-of-service" 
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 underline font-medium transition-colors duration-200"
            >
              Terms of Service
            </a>.
          </Label>
          <p className="text-xs text-muted-foreground">
            This verification is required for COPPA compliance and to ensure you understand our terms.
          </p>
        </div>
      </div>
    </div>
  );
};