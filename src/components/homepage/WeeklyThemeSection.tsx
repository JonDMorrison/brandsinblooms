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
import { useNavigate } from "react-router-dom";

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
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(true);
  const [showContentViewer, setShowContentViewer] = useState(false);
  const { generateContent, isGeneratingForCampaign } = useContentGeneration();

  const currentWeek = getCurrentWeekNumber();
  const campaignTasks = tasks.filter(task => task.campaign_id === currentCampaign?.id);
  const isGenerating = currentCampaign ? isGeneratingForCampaign(currentCampaign.id) : false;

  const handleGenerateContent = async () => {
    if (!currentCampaign) return;
    
    console.log('🎯 Starting content generation for campaign:', currentCampaign.id);
    
    const success = await generateContent(
      currentCampaign.id,
      currentCampaign.theme || currentCampaign.title,
      currentCampaign.description || '',
      currentCampaign.week_number
    );
    
    console.log('🎯 Content generation result:', success);
    
    if (success) {
      // Refresh tasks multiple times to ensure we catch the updates
      onTaskUpdate();
      setTimeout(() => {
        console.log('🔄 First task refresh after generation');
        onTaskUpdate();
      }, 1500);
      setTimeout(() => {
        console.log('🔄 Second task refresh after generation');
        onTaskUpdate();
      }, 3000);
    }
  };

  const handleViewContent = () => {
    console.log('Review button clicked - Current campaign:', currentCampaign);
    console.log('Campaign tasks:', campaignTasks);
    
    if (!currentCampaign) {
      console.error('No current campaign available');
      return;
    }
    
    if (campaignTasks.length === 0) {
      console.error('No tasks available for this campaign');
      return;
    }
    
    setShowContentViewer(true);
  };

  const handleContentUpdate = () => {
    onTaskUpdate();
  };

  return (
    <>
      <Card className="bg-white border-l-2 border-l-mint-600 border-gray-200 card-interactive">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors duration-150 rounded-t-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div>
                    <CardTitle className="text-lg text-brand-navy font-semibold tracking-tight flex items-center gap-2">
                      <Calendar className="w-5 h-5" />
                      Weekly Content Theme
                      <Badge className="bg-mint-100 text-mint-600 border-mint-600">
                        Week {currentWeek}
                      </Badge>
                    </CardTitle>
                    <p className="text-gray-700 text-sm mt-1 leading-relaxed">
                      {currentCampaign 
                        ? `This week: ${currentCampaign.theme || currentCampaign.title}` 
                        : 'No theme set for this week'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {campaignTasks.length > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="bg-mint-100 px-3 py-1 rounded-full">
                        <span className="text-mint-600 text-sm font-medium">
                          {campaignTasks.length}/5 ready
                        </span>
                      </div>
                      <div className="w-16 bg-gray-200 rounded-full h-1.5">
                        <div 
                          className="bg-mint-600 h-1.5 rounded-full transition-all duration-300" 
                          style={{ width: `${(campaignTasks.length / 5) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {isOpen ? (
                    <ChevronUp className="w-5 h-5 text-brand-navy" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-brand-navy" />
                  )}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <CardContent className="pt-0">
              {currentCampaign ? (
                <div className="space-y-4">
                  <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                    <div className="flex items-start gap-3 mb-3">
                      <Sparkles className="w-5 h-5 text-brand-teal mt-0.5" />
                      <div className="text-left">
                        <h4 className="font-semibold text-brand-navy mb-1 tracking-tight">
                          {currentCampaign.theme || currentCampaign.title}
                        </h4>
                        {currentCampaign.description && (
                          <p className="text-sm text-gray-700 mb-2 leading-relaxed">
                            {currentCampaign.description}
                          </p>
                        )}
                        <p className="text-xs text-gray-600">
                          We'll create 5 pieces of marketing content around this theme
                        </p>
                      </div>
                    </div>

                    {isGenerating ? (
                      <div className="bg-brand-blue/10 border border-brand-blue/20 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-brand-blue mb-2">
                          <div className="animate-spin h-4 w-4 border-2 border-brand-blue border-t-transparent rounded-full"></div>
                          <span className="text-sm font-medium">Generating your marketing content...</span>
                        </div>
                        <p className="text-brand-blue/80 text-xs leading-relaxed">
                          This usually takes 30-60 seconds. Creating 5 pieces for your review.
                        </p>
                      </div>
                    ) : campaignTasks.length === 0 ? (
                      <div className="py-4">
                        <Button 
                          onClick={handleGenerateContent}
                          disabled={isGenerating}
                        >
                          <Play className="w-4 h-4 mr-2" />
                          Generate Content
                        </Button>
                      </div>
                    ) : (
                      <div className="bg-mint-100 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2 text-mint-600 mb-1">
                              <Sparkles className="w-4 h-4" />
                              <span className="text-sm font-semibold">Content Ready!</span>
                            </div>
                            <p className="text-mint-600/80 text-xs leading-relaxed">
                              {campaignTasks.length} pieces of content are ready for review
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              onClick={handleViewContent}
                              size="sm"
                              variant="outline"
                              disabled={!currentCampaign || campaignTasks.length === 0}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              Review
                            </Button>
                            <Button 
                              onClick={() => navigate('/publish')}
                              size="sm"
                            >
                              <Sparkles className="w-4 h-4 mr-2" />
                              Publish
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-8 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex flex-col items-start">
                    <Calendar className="w-12 h-12 mb-3 text-brand-teal" />
                    <p className="text-brand-navy font-semibold mb-2 tracking-tight">No Weekly Theme Set</p>
                    <p className="text-gray-600 text-sm mb-4 leading-relaxed">
                      Create a campaign to set this week's content theme
                    </p>
                    <Button 
                      variant="outline" 
                      onClick={onCampaignCreated}
                    >
                      Create Campaign
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {currentCampaign && showContentViewer && (
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
