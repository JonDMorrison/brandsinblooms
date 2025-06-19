
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle, Clock } from "lucide-react";

interface GenerationProgressProps {
  isGenerating: boolean;
  currentStep?: string;
  totalSteps?: number;
  completedSteps?: number;
  estimatedTimeRemaining?: number;
}

export const GenerationProgress = ({ 
  isGenerating, 
  currentStep = "Generating content...",
  totalSteps = 5,
  completedSteps = 0,
  estimatedTimeRemaining = 30
}: GenerationProgressProps) => {
  
  if (!isGenerating) return null;

  const progressPercentage = (completedSteps / totalSteps) * 100;
  
  const steps = [
    "Creating Instagram post...",
    "Writing Facebook content...",
    "Drafting blog article...",
    "Composing newsletter...",
    "Preparing video script..."
  ];

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
            <div>
              <h4 className="font-semibold text-blue-900">Generating Your Content Pack</h4>
              <p className="text-sm text-blue-700">
                Creating professional marketing content for your theme...
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-blue-800 font-medium">{currentStep}</span>
              <span className="text-blue-600">{completedSteps}/{totalSteps} complete</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>

          {/* Steps List */}
          <div className="space-y-2">
            {steps.map((step, index) => {
              const isCompleted = index < completedSteps;
              const isCurrent = index === completedSteps;
              const isPending = index > completedSteps;

              return (
                <div key={index} className="flex items-center gap-2 text-sm">
                  {isCompleted && (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  )}
                  {isCurrent && (
                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                  )}
                  {isPending && (
                    <Clock className="w-4 h-4 text-gray-400" />
                  )}
                  <span className={`
                    ${isCompleted ? 'text-green-700 line-through' : ''}
                    ${isCurrent ? 'text-blue-700 font-medium' : ''}
                    ${isPending ? 'text-gray-500' : ''}
                  `}>
                    {step}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Time Estimate */}
          <div className="flex items-center gap-2 text-xs text-blue-600 bg-white p-2 rounded border border-blue-200">
            <Clock className="w-3 h-3" />
            <span>Estimated time remaining: ~{estimatedTimeRemaining} seconds</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
