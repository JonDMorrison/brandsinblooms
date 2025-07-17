import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Target, Heart, Mail, ChevronRight, Import, Rocket } from 'lucide-react';
import { Link } from 'react-router-dom';

interface QuickStartStepperProps {
  customerCount: number;
  segmentCount: number;
  campaignCount: number;
  onStepComplete: () => void;
}

interface StepItemProps {
  icon: React.ElementType;
  title: string;
  description: string;
  action: 'import' | 'chevron' | 'optional';
  href?: string;
  isComplete?: boolean;
}

const StepItem: React.FC<StepItemProps> = ({ icon: Icon, title, description, action, href, isComplete }) => (
  <div className="flex items-center justify-between py-4 group hover:bg-muted/30 rounded-lg px-2 -mx-2 transition-colors">
    <div className="flex items-center gap-4">
      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h3 className="font-medium text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
    
    <div className="flex items-center">
      {action === 'import' && href && (
        <Button variant="outline" size="sm" asChild>
          <Link to={href}>
            <Import className="h-4 w-4 mr-1" />
            Import Now
          </Link>
        </Button>
      )}
      {action === 'chevron' && href && (
        <Link to={href} className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronRight className="h-5 w-5" />
        </Link>
      )}
      {action === 'optional' && (
        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
          Optional
        </span>
      )}
    </div>
  </div>
);

export const QuickStartStepper: React.FC<QuickStartStepperProps> = ({
  customerCount,
  segmentCount,
  campaignCount
}) => {
  const steps = [
    {
      icon: Users,
      title: "Import Your Contacts",
      description: "Connect your POS or upload a CSV file",
      action: 'import' as const,
      href: "/crm/customers",
      isComplete: customerCount > 0
    },
    {
      icon: Target,
      title: "Create a Segment",
      description: "Group customers by behavior or preferences",
      action: 'chevron' as const,
      href: "/crm/segments",
      isComplete: segmentCount > 0
    },
    {
      icon: Heart,
      title: "Choose a Persona",
      description: "Define your ideal customer types",
      action: 'optional' as const,
      href: "/crm/personas"
    },
    {
      icon: Mail,
      title: "Send Your First Campaign",
      description: "Create and send targeted messages",
      action: 'chevron' as const,
      href: "/crm/campaigns/new",
      isComplete: campaignCount > 0
    }
  ];

  return (
    <Card className="bg-background">
      <CardContent className="p-6 space-y-6 bg-white">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3 mb-1">
            <Rocket className="h-8 w-8" />
            Quick Start Guide
          </h1>
          <p className="text-sm text-muted-foreground">Get your CRM up and running in 4 simple steps</p>
        </div>
        
        <div className="space-y-1">
          {steps.map((step, index) => (
            <StepItem
              key={index}
              icon={step.icon}
              title={step.title}
              description={step.description}
              action={step.action}
              href={step.href}
              isComplete={step.isComplete}
            />
          ))}
        </div>
        
        <div className="bg-muted/30 rounded-lg p-6 text-center space-y-3">
          <h3 className="font-medium text-foreground">You're Ready to Grow!</h3>
          <p className="text-sm text-muted-foreground">
            With your CRM set up, you can start building meaningful customer relationships
          </p>
          <Button asChild>
            <Link to="/crm/campaigns/new">
              Let's Get Started
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};