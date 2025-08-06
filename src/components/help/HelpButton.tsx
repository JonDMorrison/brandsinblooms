import React from 'react';
import { HelpCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface HelpButtonProps {
  topic: string;
  className?: string;
}

// Documentation links mapping
const DOCS_LINKS: Record<string, string> = {
  dashboard: 'https://docs.example.com/dashboard',
  customers: 'https://docs.example.com/customers',
  campaigns: 'https://docs.example.com/campaigns',
  automation: 'https://docs.example.com/automation',
  pos: 'https://docs.example.com/pos-integration',
  analytics: 'https://docs.example.com/analytics',
  settings: 'https://docs.example.com/settings',
  billing: 'https://docs.example.com/billing',
  integrations: 'https://docs.example.com/integrations',
  composer: 'https://docs.example.com/content-composer',
  segments: 'https://docs.example.com/customer-segments',
  workflows: 'https://docs.example.com/automation-workflows',
};

// Help topics with user-friendly names
const HELP_TOPICS: Record<string, string> = {
  dashboard: 'Dashboard Guide',
  customers: 'Customer Management',
  campaigns: 'Email Campaigns',
  automation: 'Marketing Automation',
  pos: 'POS Integration',
  analytics: 'Analytics & Reports',
  settings: 'Account Settings',
  billing: 'Billing & Plans',
  integrations: 'Integrations',
  composer: 'Content Composer',
  segments: 'Customer Segments',
  workflows: 'Automation Workflows',
};

export function HelpButton({ topic, className }: HelpButtonProps) {
  const helpUrl = DOCS_LINKS[topic];
  const helpTitle = HELP_TOPICS[topic] || 'Help Documentation';

  if (!helpUrl) {
    return null;
  }

  const handleHelpClick = () => {
    window.open(helpUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleHelpClick}
            className={className}
            aria-label={`Get help with ${helpTitle}`}
          >
            <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="flex items-center gap-1">
          <span>{helpTitle}</span>
          <ExternalLink className="h-3 w-3" />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}