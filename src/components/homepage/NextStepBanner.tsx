
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle, Sparkles } from "lucide-react";
import { useState } from "react";
import { NewCampaignDialog } from "./NewCampaignDialog";
import { ContentReviewDialog } from "./ContentReviewDialog";
import { toast } from "sonner";

interface NextStepBannerProps {
  campaignsCount: number;
  tasksCount: number;
  completedTasksCount: number;
  onCampaignCreated: () => void;
}

export const NextStepBanner = ({ campaignsCount, tasksCount, completedTasksCount, onCampaignCreated }: NextStepBannerProps) => {
  const [showNewCampaignDialog, setShowNewCampaignDialog] = useState(false);
  const [showContentReviewDialog, setShowContentReviewDialog] = useState(false);

  const getNextStep = () => {
    if (campaignsCount === 0) {
      return {
        title: "🚀 Let's Create Your First Campaign!",
        description: "Create a marketing theme and we'll generate 5+ ready-to-use content pieces for you in seconds.",
        action: "Create Your First Campaign",
        icon: "✨",
        bgColor: "bg-gradient-to-r from-primary/10 to-primary/5",
        borderColor: "border-primary/30",
        actionType: "create-campaign",
        highlight: "Get instant content: Instagram posts, Facebook updates, email newsletters, and more!"
      };
    }
    
    if (tasksCount === 0) {
      return {
        title: "✨ Ready to Generate Amazing Content?",
        description: "Your campaign is set up! Now let's create personalized content that speaks to your customers.",
        action: "Generate Content Now",
        icon: "🎯",
        bgColor: "bg-gradient-to-r from-blue-50 to-blue-25",
        borderColor: "border-blue-200",
        actionType: "generate-content",
        highlight: "This takes just 30 seconds and creates a week's worth of marketing materials."
      };
    }
    
    if (completedTasksCount === 0) {
      return {
        title: "📝 Your Content is Ready to Review!",
        description: "We've generated personalized marketing content for you. Take a look and customize it to your liking.",
        action: "Review Your Content",
        icon: "👀",
        bgColor: "bg-gradient-to-r from-green-50 to-green-25",
        borderColor: "border-green-200",
        actionType: "review-content",
        highlight: "Edit, approve, or regenerate any piece until it's perfect for your brand."
      };
    }
    
    return {
      title: "🎉 Fantastic Progress!",
      description: "You're doing great! Your marketing content is ready to help grow your garden center.",
      action: "Create Another Campaign",
      icon: "🌟",
      bgColor: "bg-gradient-to-r from-purple-50 to-purple-25",
      borderColor: "border-purple-200",
      actionType: "create-more",
      highlight: "Keep the momentum going with fresh content themes and ideas."
    };
  };

  const nextStep = getNextStep();

  const handleAction = () => {
    switch (nextStep.actionType) {
      case "create-campaign":
      case "create-more":
        setShowNewCampaignDialog(true);
        break;
      case "generate-content":
        toast.info("💡 Go to your campaigns below and click 'Generate Content' to create your marketing materials!", {
          duration: 4000
        });
        break;
      case "review-content":
        setShowContentReviewDialog(true);
        break;
      default:
        onCampaignCreated();
    }
  };

  const handleCampaignCreate = (newCampaign: any) => {
    setShowNewCampaignDialog(false);
    onCampaignCreated();
    toast.success("🎉 Campaign created! Ready to generate amazing content.", { duration: 3000 });
  };

  return (
    <>
      <Card className={`shadow-md ${nextStep.bgColor} ${nextStep.borderColor} border-2 rounded-xl overflow-hidden`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-4">
              <div className="bg-white/80 backdrop-blur p-3 rounded-full shadow-sm">
                <span className="text-2xl">{nextStep.icon}</span>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-foreground mb-2">
                  {nextStep.title}
                </h3>
                <p className="text-gray-700 text-sm mb-3">
                  {nextStep.description}
                </p>
                {nextStep.highlight && (
                  <div className="flex items-center gap-2 text-sm font-medium text-current opacity-90">
                    <CheckCircle className="w-4 h-4" />
                    <span>{nextStep.highlight}</span>
                  </div>
                )}
              </div>
            </div>
            <Button 
              className="bg-white hover:bg-gray-50 text-gray-900 shadow-md px-6 py-3 font-semibold border hover:scale-105 transition-all duration-200"
              onClick={handleAction}
            >
              {nextStep.action}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <NewCampaignDialog 
        open={showNewCampaignDialog} 
        onOpenChange={setShowNewCampaignDialog} 
        onCreate={handleCampaignCreate} 
      />
      
      <ContentReviewDialog 
        open={showContentReviewDialog}
        onOpenChange={setShowContentReviewDialog}
      />
    </>
  );
};
