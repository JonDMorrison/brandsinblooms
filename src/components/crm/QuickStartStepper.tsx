
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Target, Heart, Mail, ChevronRight, Import, CheckCircle } from 'lucide-react';
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
  stepNumber: number;
}

const StepItem: React.FC<StepItemProps> = ({ 
  icon: Icon, 
  title, 
  description, 
  action, 
  href, 
  isComplete, 
  stepNumber 
}) => (
  <div className="flex items-center gap-4 py-4 px-4 rounded-lg hover:bg-gray-50 transition-colors">
    <div className="flex items-center gap-4">
      <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
        isComplete 
          ? 'bg-green-100 text-green-700' 
          : 'bg-gray-100 text-gray-600'
      }`}>
        {isComplete ? <CheckCircle className="h-4 w-4" /> : stepNumber}
      </div>
      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-50">
        <Icon className="h-5 w-5 text-gray-600" />
      </div>
      <div className="flex-1">
        <h3 className="font-medium text-gray-900">{title}</h3>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
    </div>
    
    <div className="flex items-center">
      {action === 'import' && href && (
        <Button variant="outline" size="sm" asChild>
          <Link to={href}>
            <Import className="h-4 w-4 mr-1" />
            Import
          </Link>
        </Button>
      )}
      {action === 'chevron' && href && (
        <Button variant="outline" size="sm" asChild>
          <Link to={href}>
            Get Started
            <ChevronRight className="h-4 w-4 ml-1" />
          </Link>
        </Button>
      )}
      {action === 'optional' && (
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
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
      title: "Import Contacts",
      description: "Upload your customer database to get started",
      action: 'import' as const,
      href: "/crm/customers",
      isComplete: customerCount > 0,
      stepNumber: 1
    },
    {
      icon: Target,
      title: "Create Segments",
      description: "Group customers by behavior and preferences",
      action: 'chevron' as const,
      href: "/crm/segments",
      isComplete: segmentCount > 0,
      stepNumber: 2
    },
    {
      icon: Heart,
      title: "Define Personas",
      description: "Create customer profiles for better targeting",
      action: 'optional' as const,
      href: "/crm/personas",
      stepNumber: 3
    },
    {
      icon: Mail,
      title: "Launch Campaign",
      description: "Send your first targeted message",
      action: 'chevron' as const,
      href: "/crm/campaigns/new",
      isComplete: campaignCount > 0,
      stepNumber: 4
    }
  ];

  const completedSteps = steps.filter(step => step.isComplete).length;
  const progressPercentage = (completedSteps / steps.length) * 100;

  return (
    <Card className="border border-gray-200">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-semibold text-gray-900">
              Quick Start Guide
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Complete these steps to set up your marketing campaigns
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium text-gray-900">
              {completedSteps} of {steps.length} completed
            </div>
            <div className="w-24 bg-gray-200 rounded-full h-2 mt-1">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="space-y-2">
          {steps.map((step, index) => (
            <StepItem
              key={index}
              icon={step.icon}
              title={step.title}
              description={step.description}
              action={step.action}
              href={step.href}
              isComplete={step.isComplete}
              stepNumber={step.stepNumber}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
