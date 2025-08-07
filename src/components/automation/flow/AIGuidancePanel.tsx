import React from 'react';
import { Button } from '@/components/ui/button';
import { Lightbulb, Users, Zap, Mail, MessageSquare, CheckCircle, ArrowRight } from 'lucide-react';
import { Node } from '@xyflow/react';

interface AIGuidancePanelProps {
  nodes: Node[];
  hasValidFlow: boolean;
  hasAudience: boolean;
  isReadyToLaunch: boolean;
  onAddNode: (type: string) => void;
  onOpenAudienceSelector: () => void;
}

export const AIGuidancePanel: React.FC<AIGuidancePanelProps> = ({
  nodes,
  hasValidFlow,
  hasAudience,
  isReadyToLaunch,
  onAddNode,
  onOpenAudienceSelector
}) => {
  if (isReadyToLaunch) return null;

  const hasTrigger = nodes.some(n => n.type === 'trigger');
  const hasActions = nodes.some(n => n.type === 'email' || n.type === 'sms' || n.type === 'delay');
  
  const steps = [
    {
      id: 'trigger',
      title: 'Add a Trigger',
      description: 'Choose when this automation should start (e.g., when someone joins a segment)',
      completed: hasTrigger,
      action: () => onAddNode('trigger'),
      actionLabel: 'Add Trigger',
      icon: Zap
    },
    {
      id: 'actions',
      title: 'Add Actions',
      description: 'Define what happens (send email, SMS, or add delays)',
      completed: hasActions,
      action: () => onAddNode('email'),
      actionLabel: 'Add Email Action',
      icon: Mail
    },
    {
      id: 'audience',
      title: 'Select Audience',
      description: 'Choose which contacts this automation applies to',
      completed: hasAudience,
      action: onOpenAudienceSelector,
      actionLabel: 'Select Audience',
      icon: Users
    }
  ];

  const currentStep = steps.find(step => !step.completed);
  const completedSteps = steps.filter(step => step.completed).length;

  return (
    <div className="w-full max-w-md mx-auto border-l-4 border-l-brand-teal bg-gradient-to-r from-blue-50 to-teal-50 rounded-lg border shadow-sm">
      <div className="p-4 pb-3 border-b">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-brand-teal" />
          <h3 className="text-lg font-semibold">AI Assistant</h3>
          <span className="ml-auto bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs font-medium">
            {completedSteps}/{steps.length} Complete
          </span>
        </div>
      </div>
      <div className="p-4 space-y-3">
        <div className="text-sm text-muted-foreground mb-4">
          Let me guide you through setting up your automation:
        </div>
        
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isCurrentStep = step === currentStep;
          
          return (
            <div
              key={step.id}
              className={`flex items-start gap-3 p-3 rounded-lg transition-all ${
                step.completed 
                  ? 'bg-green-50 border border-green-200' 
                  : isCurrentStep 
                    ? 'bg-blue-50 border border-blue-200 ring-2 ring-blue-100' 
                    : 'bg-gray-50 border border-gray-200'
              }`}
            >
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                step.completed 
                  ? 'bg-green-500 text-white' 
                  : isCurrentStep 
                    ? 'bg-brand-teal text-white' 
                    : 'bg-gray-300 text-gray-600'
              }`}>
                {step.completed ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className={`font-medium text-sm ${
                    step.completed ? 'text-green-700' : isCurrentStep ? 'text-brand-navy' : 'text-gray-600'
                  }`}>
                    {step.title}
                  </h4>
                  {isCurrentStep && (
                    <ArrowRight className="w-4 h-4 text-brand-teal animate-pulse" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {step.description}
                </p>
                
                {isCurrentStep && (
                  <Button
                    size="sm"
                    onClick={step.action}
                    className="mt-2 h-7 text-xs"
                  >
                    {step.actionLabel}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
        
        {isReadyToLaunch && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Ready to launch! 🎉</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};