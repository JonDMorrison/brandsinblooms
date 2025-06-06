
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface NextStepBannerProps {
  campaignsCount: number;
  tasksCount: number;
  completedTasksCount: number;
  onCampaignCreated: () => void;
}

export const NextStepBanner = ({ campaignsCount, tasksCount, completedTasksCount, onCampaignCreated }: NextStepBannerProps) => {
  // Determine the next step based on current state
  const getNextStep = () => {
    if (campaignsCount === 0) {
      return {
        title: "Create Your First Campaign",
        description: "Start generating marketing content for your garden center",
        action: "Create Campaign",
        icon: "🚀",
        bgColor: "bg-green-100",
        borderColor: "border-green-300"
      };
    }
    
    if (completedTasksCount === 0) {
      return {
        title: "Review Your Content",
        description: "Check and approve your generated marketing content",
        action: "Review Content",
        icon: "📝",
        bgColor: "bg-blue-100",
        borderColor: "border-blue-300"
      };
    }
    
    return {
      title: "Great Progress!",
      description: "Keep up the momentum with your marketing efforts",
      action: "Create More",
      icon: "✨",
      bgColor: "bg-yellow-100",
      borderColor: "border-yellow-300"
    };
  };

  const nextStep = getNextStep();

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
            onClick={onCampaignCreated}
          >
            {nextStep.action}
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
