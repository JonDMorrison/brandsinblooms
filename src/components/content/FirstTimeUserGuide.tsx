
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, ArrowRight, Sparkles, Target, CheckCircle } from "lucide-react";

interface FirstTimeUserGuideProps {
  onDismiss: () => void;
  onStartTour?: () => void;
}

export const FirstTimeUserGuide = ({ onDismiss, onStartTour }: FirstTimeUserGuideProps) => {
  const [currentStep, setCurrentStep] = useState(0);

  const guideSteps = [
    {
      title: "Welcome to Your Marketing Assistant! 🎉",
      content: "We'll help you create professional marketing content for your garden center with AI-powered weekly themes.",
      action: "Get Started"
    },
    {
      title: "How Weekly Themes Work 📅",
      content: "Choose themes like 'Spring Planting' or 'Holiday Decorations' and we'll generate 5 pieces of content: Instagram, Facebook, Blog, Newsletter, and Video script.",
      action: "Next"
    },
    {
      title: "Review & Approve Process ✅",
      content: "All generated content goes to your Review Queue first. You can edit, approve, or regenerate any piece before it appears in 'Ready to Post'.",
      action: "Next"
    },
    {
      title: "Content Marketing Strategy 🎯",
      content: "This systematic approach builds audience engagement, drives website traffic, and establishes your expertise in the gardening community.",
      action: "Start Creating"
    }
  ];

  const currentStepData = guideSteps[currentStep];

  const handleNext = () => {
    if (currentStep < guideSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      if (onStartTour) onStartTour();
      onDismiss();
    }
  };

  return (
    <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <CardTitle className="text-lg text-purple-900">Quick Start Guide</CardTitle>
            <Badge variant="outline" className="text-purple-700 border-purple-300">
              {currentStep + 1} of {guideSteps.length}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="text-purple-600 hover:bg-purple-100"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress Dots */}
        <div className="flex gap-2 justify-center">
          {guideSteps.map((_, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full transition-colors ${
                index <= currentStep ? 'bg-purple-600' : 'bg-purple-200'
              }`}
            />
          ))}
        </div>

        {/* Current Step Content */}
        <div className="text-center space-y-3">
          <h3 className="text-xl font-semibold text-purple-900">
            {currentStepData.title}
          </h3>
          <p className="text-purple-700 leading-relaxed">
            {currentStepData.content}
          </p>
        </div>

        {/* Quick Tips for Current Step */}
        {currentStep === 1 && (
          <div className="bg-white p-3 rounded-lg border border-purple-200">
            <p className="text-sm text-purple-600 font-medium mb-2">💡 Theme Examples:</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded">Spring Planting</span>
              <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded">Holiday Décor</span>
              <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded">Plant Care</span>
              <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded">Seasonal Tips</span>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="bg-white p-3 rounded-lg border border-purple-200">
            <div className="flex items-center gap-2 text-sm text-purple-600 font-medium mb-2">
              <CheckCircle className="w-4 h-4" />
              Your Control:
            </div>
            <ul className="text-xs text-purple-700 space-y-1">
              <li>• Edit any content to match your voice</li>
              <li>• Regenerate content you don't like</li>
              <li>• Only approved content appears in Ready to Post</li>
            </ul>
          </div>
        )}

        {/* Action Button */}
        <div className="flex justify-center pt-2">
          <Button
            onClick={handleNext}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6"
          >
            {currentStepData.action}
            {currentStep < guideSteps.length - 1 && <ArrowRight className="w-4 h-4 ml-2" />}
            {currentStep === guideSteps.length - 1 && <Target className="w-4 h-4 ml-2" />}
          </Button>
        </div>

        {/* Skip Option */}
        <div className="text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="text-purple-600 hover:bg-purple-100 text-xs"
          >
            Skip guide - I'll figure it out
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
