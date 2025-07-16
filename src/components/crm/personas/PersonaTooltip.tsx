import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle, Lightbulb, Target } from 'lucide-react';

interface PersonaTooltipProps {
  children: React.ReactNode;
  type?: 'assignment' | 'benefits' | 'example';
}

export function PersonaTooltip({ children, type = 'assignment' }: PersonaTooltipProps) {
  const getTooltipContent = () => {
    switch (type) {
      case 'assignment':
        return {
          icon: <Target className="h-4 w-4" />,
          title: "What this does:",
          content: "Assigning a persona helps personalize content, trigger smarter automations, and unlock AI-generated campaigns tailored to your customers' values and habits."
        };
      case 'benefits':
        return {
          icon: <Lightbulb className="h-4 w-4" />,
          title: "Benefits:",
          content: "Personas enable targeted messaging, improve campaign performance, and help you understand customer behavior patterns for better marketing decisions."
        };
      case 'example':
        return {
          icon: <HelpCircle className="h-4 w-4" />,
          title: "Example:",
          content: "Assigning 'DIY Dana' gives you content ideas like giftable plant kits, make-and-take classes, and creative gardening projects."
        };
      default:
        return {
          icon: <HelpCircle className="h-4 w-4" />,
          title: "Personas:",
          content: "Customer personas help you segment and target your audience more effectively."
        };
    }
  };

  const { icon, title, content } = getTooltipContent();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="flex items-start gap-2">
            <div className="text-primary mt-0.5">
              {icon}
            </div>
            <div>
              <p className="font-medium text-sm mb-1">{title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {content}
              </p>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}