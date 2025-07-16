import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Target, Mail, BarChart3, CheckCircle, Plus, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface QuickStartStepperProps {
  customerCount: number;
  segmentCount: number;
  campaignCount: number;
}

interface StepProps {
  icon: React.ElementType;
  title: string;
  description: string;
  isComplete: boolean;
  isActive: boolean;
  action?: {
    label: string;
    href: string;
  };
}

const Step: React.FC<StepProps> = ({ icon: Icon, title, description, isComplete, isActive, action }) => (
  <div className="flex flex-col items-center text-center space-y-3 group">
    <div className={`relative flex items-center justify-center w-16 h-16 rounded-full transition-all duration-300 ${
      isComplete 
        ? 'bg-gradient-to-br from-green-500 to-green-600 text-white' 
        : isActive 
        ? 'bg-gradient-to-br from-primary to-primary/80 text-white scale-110' 
        : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
    }`}>
      {isComplete ? (
        <CheckCircle className="h-8 w-8" />
      ) : isActive ? (
        <Plus className="h-8 w-8 animate-pulse" />
      ) : (
        <Icon className="h-8 w-8" />
      )}
      
      {/* Connector line */}
      {!isActive && (
        <div className={`absolute left-full top-1/2 transform -translate-y-1/2 h-px w-12 hidden lg:block ${
          isComplete ? 'bg-green-500' : 'bg-border'
        }`} />
      )}
    </div>
    
    <div className="space-y-1">
      <h3 className={`font-semibold ${isComplete ? 'text-green-700' : isActive ? 'text-primary' : 'text-foreground'}`}>
        {title}
      </h3>
      <p className="text-sm text-muted-foreground max-w-32">
        {description}
      </p>
      
      {action && isActive && (
        <Button size="sm" asChild className="mt-2">
          <Link to={action.href}>
            {action.label}
            <ArrowRight className="h-3 w-3 ml-1" />
          </Link>
        </Button>
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
      title: "Add Customers",
      description: "Import or add your garden center customers",
      isComplete: customerCount > 0,
      action: { label: "Add Customers", href: "/crm/customers" }
    },
    {
      icon: Target,
      title: "Create Segments",
      description: "Group customers by interests and behavior",
      isComplete: segmentCount > 0,
      action: { label: "Create Segment", href: "/crm/segments" }
    },
    {
      icon: Mail,
      title: "Launch Campaign",
      description: "Send your first email or SMS campaign",
      isComplete: campaignCount > 0,
      action: { label: "Create Campaign", href: "/crm/campaigns/new" }
    },
    {
      icon: BarChart3,
      title: "Watch Growth",
      description: "Track performance and optimize",
      isComplete: campaignCount > 2,
      action: { label: "View Analytics", href: "/crm/analytics" }
    }
  ];

  const currentStep = steps.findIndex(step => !step.isComplete);
  const activeStepIndex = currentStep === -1 ? steps.length - 1 : currentStep;

  return (
    <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
      <CardHeader>
        <CardTitle className="flex items-center text-green-800">
          🌱 Quick Start Guide
        </CardTitle>
        <p className="text-green-700">
          Get your CRM up and running in 4 simple steps
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col lg:flex-row justify-between items-center space-y-8 lg:space-y-0 lg:space-x-4">
          {steps.map((step, index) => (
            <Step
              key={index}
              icon={step.icon}
              title={step.title}
              description={step.description}
              isComplete={step.isComplete}
              isActive={index === activeStepIndex}
              action={index === activeStepIndex ? step.action : undefined}
            />
          ))}
        </div>
        
        {/* Progress indicator */}
        <div className="mt-6 flex items-center justify-center space-x-2">
          {steps.map((step, index) => (
            <div 
              key={index}
              className={`h-2 rounded-full transition-all duration-300 ${
                step.isComplete 
                  ? 'w-8 bg-green-500' 
                  : index === activeStepIndex 
                  ? 'w-6 bg-primary' 
                  : 'w-2 bg-muted'
              }`}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};