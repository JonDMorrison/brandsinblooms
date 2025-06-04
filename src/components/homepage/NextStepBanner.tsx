
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface NextStepBannerProps {
  nextStep: any;
  isGeneratingTasks: boolean;
  onActionClick: () => void;
}

export const NextStepBanner = ({ nextStep, isGeneratingTasks, onActionClick }: NextStepBannerProps) => {
  return (
    <Card className={`shadow-lg ${nextStep.bgColor} ${nextStep.borderColor} border-2 rounded-xl sticky top-4 z-10`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-3xl">{nextStep.icon}</span>
            <div>
              <h3 className="text-xl font-bold text-black mb-1">
                {nextStep.title}
              </h3>
              <p className="text-black font-medium">
                {nextStep.description}
              </p>
            </div>
          </div>
          <Button 
            className="bg-primary hover:bg-primary-600 text-white shadow-lg text-lg px-8 py-3 h-auto"
            onClick={onActionClick}
            disabled={isGeneratingTasks}
          >
            {isGeneratingTasks ? "Generating..." : nextStep.action}
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
