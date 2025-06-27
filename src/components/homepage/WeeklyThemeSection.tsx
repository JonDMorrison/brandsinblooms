
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Calendar, Sparkles, ChevronDown, ChevronUp, Eye } from "lucide-react";
import { useState } from "react";
import { Campaign } from "@/types/content";
import { getCurrentWeekNumber } from "@/utils/dateUtils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useContentGeneration } from "@/contexts/ContentGenerationContext";
import { ContentViewer } from "@/components/content/ContentViewer";

interface WeeklyThemeSectionProps {
  currentCampaign: Campaign | undefined;
  tasks: any[];
  onTaskUpdate: () => void;
  onCampaignCreated: () => void;
}

export const WeeklyThemeSection = ({ 
  currentCampaign, 
  tasks, 
  onTaskUpdate, 
  onCampaignCreated 
}: WeeklyThemeSectionProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const [showContentViewer, setShowContentViewer] = useState(false);
  const { generateContent, isGeneratingForCampaign } = useContentGeneration();

  const currentWeek = getCurrentWeekNumber();
  const campaignTasks = tasks.filter(task => task.campaign_id === currentCampaign?.id);
  const isGenerating = currentCampaign ? isGeneratingForCampaign(currentCampaign.id) : false;

  const handleGenerateContent = async () => {
    if (!currentCampaign) return;
    
    const success = await generateContent(
      currentCampaign.id,
      currentCampaign.theme || currentCampaign.title,
      currentCampaign.description || '',
      currentCampaign.week_number
    );
    
    if (success) {
      setTimeout(onTaskUpdate, 1000);
    }
  };

  const handleViewContent = () => {
    setShowContentViewer(true);
  };

  const handleContentUpdate = () => {
    onTaskUpdate();
  };

  return (
    <>
      <Card className="border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-green-100/50 transition-colors rounded-t-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div>
                    <CardTitle className="text-lg text-green-800 flex items-center gap-2">
                      <Calendar className="w-5 h-5" />
                      Weekly Content Theme
                      <Badge className="bg-green-100 text-green-800 border-green-300">
                        Week {currentWeek}
                      </Badge>
                    </CardTitle>
                    <p className="text-green-700 text-sm mt-1">
                      {currentCampaign 
                        ? `This week: ${currentCampaign.theme || currentCampaign.title}` 
                        : 'No theme set for this week'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {campaignTasks.length > 0 && (
                    <Badge variant="outline" className="text-green-700 border-green-300">
                      {campaignTasks.length}/5 ready
                    </Badge>
                  )}
                  {isOpen ? (
                    <ChevronUp className="w-5 h-5 text-green-600" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-green-600" />
                  )}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <CardContent className="pt-0">
              {currentCampaign ? (
                <div className="space-y-4">
                  <div className="bg-white/70 rounded-lg p-4 border border-green-200">
                    <div className="flex items-start gap-3 mb-3">
                      <Sparkles className="w-5 h-5 text-green-600 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-green-900 mb-1">
                          {currentCampaign.theme || currentCampaign.title}
                        </h4>
                        {currentCampaign.description && (
                          <p className="text-sm text-green-700 mb-2">
                            {currentCampaign.description}
                          </p>
                        )}
                        <p className="text-xs text-green-600">
                          We'll create 5 pieces of marketing content around this theme
                        </p>
                      </div>
                    </div>

                    {isGenerating ? (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-blue-800 mb-2">
                          <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                          <span className="text-sm font-medium">Generating your marketing content...</span>
                        </div>
                        <p className="text-blue-600 text-xs">
                          This usually takes 30-60 seconds. Creating 5 pieces for your review.
                        </p>
                      </div>
                    ) : campaignTasks.length === 0 ? (
                      <div className="py-4">
                        <Button 
                          onClick={handleGenerateContent}
                          disabled={isGenerating}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <Play className="w-4 h-4 mr-2" />
                          Generate Content
                        </Button>
                      </div>
                    ) : (
                      <div className="bg-green-100 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2 text-green-800 mb-1">
                              <Sparkles className="w-4 h-4" />
                              <span className="text-sm font-medium">Content Ready!</span>
                            </div>
                            <p className="text-green-700 text-xs">
                              {campaignTasks.length} pieces of content are ready for review
                            </p>
                          </div>
                          <Button 
                            onClick={handleViewContent}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View Content
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-8 bg-white/50 rounded-lg border border-green-200">
                  <Calendar className="w-12 h-12 mb-3 text-green-400" />
                  <p className="text-green-700 font-medium mb-2">No Weekly Theme Set</p>
                  <p className="text-green-600 text-sm mb-4">
                    Create a campaign to set this week's content theme
                  </p>
                  <Button 
                    variant="outline" 
                    className="border-green-300 text-green-700 hover:bg-green-50"
                    onClick={onCampaignCreated}
                  >
                    Create Campaign
                  </Button>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {currentCampaign && (
        <ContentViewer
          campaignId={currentCampaign.id}
          campaignTitle={currentCampaign.theme || currentCampaign.title}
          isOpen={showContentViewer}
          onClose={() => setShowContentViewer(false)}
          onTaskUpdate={handleContentUpdate}
        />
      )}
    </>
  );
};
