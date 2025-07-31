import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Mail, 
  Megaphone, 
  Calendar, 
  BarChart3, 
  Share2,
  ChevronLeft,
  ChevronRight,
  X
} from "lucide-react";

interface QuickStartTourProps {
  isOpen: boolean;
  onClose: () => void;
}

const tourSteps = [
  {
    id: 'newsletter',
    title: 'Send Your First Newsletter',
    description: 'Create a beautiful email campaign in just 3 minutes',
    icon: <Mail className="w-8 h-8 text-blue-600" />,
    action: 'Create Newsletter',
    route: '/crm/campaigns/new?type=newsletter',
    tips: [
      'Choose from pre-made templates',
      'AI helps write your content',
      'Send immediately or schedule for later'
    ]
  },
  {
    id: 'campaign',
    title: 'Automate Customer Welcomes',
    description: 'Set up automated welcome messages for new customers',
    icon: <Megaphone className="w-8 h-8 text-green-600" />,
    action: 'Build Automation',
    route: '/crm/automations/new?mode=quick',
    tips: [
      'Welcome new customers automatically',
      'Send SMS or email sequences',
      'Increase customer retention'
    ]
  },
  {
    id: 'calendar',
    title: 'Plan Holiday Content',
    description: 'Schedule seasonal campaigns and promotions',
    icon: <Calendar className="w-8 h-8 text-orange-600" />,
    action: 'Open Calendar',
    route: '/calendar',
    tips: [
      'See all upcoming holidays',
      'Plan seasonal campaigns',
      'Never miss important dates'
    ]
  },
  {
    id: 'social',
    title: 'Post with One Click',
    description: 'Share beautiful content across all your social platforms',
    icon: <Share2 className="w-8 h-8 text-pink-600" />,
    action: 'Create Post',
    route: '/publish',
    tips: [
      'AI generates post content',
      'Beautiful images from Unsplash',
      'Schedule across all platforms'
    ]
  },
  {
    id: 'analytics',
    title: 'Track Your Results',
    description: 'See how your campaigns are performing',
    icon: <BarChart3 className="w-8 h-8 text-purple-600" />,
    action: 'View Analytics',
    route: '/analytics',
    tips: [
      'Track email open rates',
      'Monitor social engagement',
      'Understand your customers better'
    ]
  }
];

export const QuickStartTour = ({ isOpen, onClose }: QuickStartTourProps) => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleTakeAction = () => {
    const step = tourSteps[currentStep];
    localStorage.setItem('dashboardTourDone', 'true');
    navigate(step.route);
    onClose();
  };

  const handleFinishTour = () => {
    localStorage.setItem('dashboardTourDone', 'true');
    console.log('Tour finished - localStorage set');
    onClose();
  };

  const handleClose = () => {
    localStorage.setItem('dashboardTourDone', 'true');
    console.log('Tour closed - localStorage set');
    onClose();
  };

  const progress = ((currentStep + 1) / tourSteps.length) * 100;
  const currentStepData = tourSteps[currentStep];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">Quick Start Tour</DialogTitle>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {currentStep + 1} of {tourSteps.length}
              </span>
              <Button variant="ghost" size="sm" onClick={handleClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <Progress value={progress} className="w-full" />
        </DialogHeader>

        <div className="py-6">
          <Card className="border-2 border-dashed">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-gray-50">
                  {currentStepData.icon}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2">
                    {currentStepData.title}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {currentStepData.description}
                  </p>
                  
                  <div className="space-y-2 mb-4">
                    {currentStepData.tips.map((tip, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        <span className="text-sm">{tip}</span>
                      </div>
                    ))}
                  </div>

                  <Button onClick={handleTakeAction} className="w-full">
                    {currentStepData.action}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center justify-between">
          <Button 
            variant="outline" 
            onClick={handlePrevious}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>

          <div className="flex gap-1">
            {tourSteps.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full ${
                  index === currentStep 
                    ? 'bg-primary' 
                    : index < currentStep 
                      ? 'bg-primary/50' 
                      : 'bg-gray-200'
                }`}
              />
            ))}
          </div>

          {currentStep === tourSteps.length - 1 ? (
            <Button onClick={handleFinishTour}>
              Finish Tour
            </Button>
          ) : (
            <Button onClick={handleNext}>
              Next
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};