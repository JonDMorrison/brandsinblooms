import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Play, Calendar, Sparkles, ChevronDown, ChevronUp, Eye, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { useState } from "react";
import { Campaign } from "@/types/content";
import { getCurrentWeekNumber } from "@/utils/dateUtils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useContentGeneration } from "@/contexts/ContentGenerationContext";
import { ContentViewer } from "@/components/content/ContentViewer";
import { useFocusThemes, FocusTheme } from "@/hooks/useFocusThemes";
import { getFocusThemeIcon } from "@/components/focus/iconMappings";
import { generateCampaignContent } from "@/components/homepage/ContentGenerationServices";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface WeeklyThemeCarouselProps {
  currentCampaign: Campaign | undefined;
  tasks: any[];
  onTaskUpdate: () => void;
  onCampaignCreated: () => void;
}

export const WeeklyThemeCarousel = ({ 
  currentCampaign, 
  tasks, 
  onTaskUpdate, 
  onCampaignCreated 
}: WeeklyThemeCarouselProps) => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [isOpen, setIsOpen] = useState(true);
  const [showContentViewer, setShowContentViewer] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [generatingTheme, setGeneratingTheme] = useState<string | null>(null);
  const { generateContent, isGeneratingForCampaign } = useContentGeneration();
  const { themes, loading: themesLoading } = useFocusThemes();

  const currentWeek = getCurrentWeekNumber();
  const campaignTasks = tasks.filter(task => task.campaign_id === currentCampaign?.id);
  const isGenerating = currentCampaign ? isGeneratingForCampaign(currentCampaign.id) : false;

  // If we have a current campaign, create a theme object for it
  const currentCampaignTheme: FocusTheme | null = currentCampaign ? {
    id: `campaign-${currentCampaign.id}`,
    title: currentCampaign.theme || currentCampaign.title,
    description: currentCampaign.description || 'Your current weekly content theme',
    teaser: 'Generate content for your current campaign',
    category: 'plant_care' as const,
    tags: ['current'],
    difficulty: 'intermediate' as const,
    timeToComplete: '1 hour',
    weekNumber: currentCampaign.week_number,
    seasonalScore: 100,
    label: 'Current Season' as const,
    isSeasonallyAppropriate: true,
    themeSeason: 'neutral' as const
  } : null;

  // Combine current campaign theme with available themes
  const allThemes = currentCampaignTheme 
    ? [currentCampaignTheme, ...themes.filter(theme => theme.id !== `campaign-${currentCampaign?.id}`)]
    : themes;

  const currentTheme = allThemes[currentIndex];

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : allThemes.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < allThemes.length - 1 ? prev + 1 : 0));
  };

  const createCampaignFromTheme = async (theme: FocusTheme) => {
    console.log('🏗️ Creating campaign from theme:', theme);
    
    const campaignData = {
      title: theme.title,
      theme: theme.title,
      description: theme.description,
      user_id: user?.id,
      tenant_id: tenant?.id,
      week_number: theme.weekNumber || currentWeek,
      start_date: new Date().toISOString().split('T')[0],
      source: 'focus_theme'
    };

    const { data: campaign, error } = await supabase
      .from('campaigns')
      .insert(campaignData)
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating campaign:', error);
      throw new Error(`Failed to create campaign: ${error.message}`);
    }

    console.log('✅ Created campaign:', campaign);
    return campaign;
  };

  const handleGenerateContent = async (theme?: FocusTheme) => {
    if (!user) {
      toast.error('Please log in to generate content');
      return;
    }

    const targetTheme = theme || currentTheme;
    if (!targetTheme) return;

    console.log('🎯 Starting content generation for theme:', targetTheme.id);
    setGeneratingTheme(targetTheme.id);
    
    try {
      let campaignId: string;
      
      // If this is the current campaign theme, use existing campaign
      if (targetTheme.id.startsWith('campaign-') && currentCampaign) {
        campaignId = currentCampaign.id;
        
        // Use existing generate content function
        const success = await generateContent(
          currentCampaign.id,
          currentCampaign.theme || currentCampaign.title,
          currentCampaign.description || '',
          currentCampaign.week_number
        );
        
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
        return;
      }
      
      // Otherwise, create a new campaign from the selected theme
      console.log('📝 Creating new campaign from theme');
      const campaign = await createCampaignFromTheme(targetTheme);
      campaignId = campaign.id;

      console.log('🤖 Generating content for new campaign:', campaignId);
      const result = await generateCampaignContent(
        campaignId,
        targetTheme.title,
        targetTheme.description,
        user.id,
        targetTheme.weekNumber || currentWeek,
        tenant?.id
      );

      if (result.success) {
        console.log('✅ Content generation successful:', result);
        
        const taskCount = result.tasks?.length || 5;
        toast.success(`Generated ${taskCount} pieces of content!`, {
          duration: 5000,
          action: {
            label: 'View Content',
            onClick: () => {
              onTaskUpdate();
            }
          }
        });

        // Refresh data
        onTaskUpdate();
        onCampaignCreated();
        
        // Move to next theme if available and this wasn't current campaign
        if (!targetTheme.id.startsWith('campaign-') && currentIndex < allThemes.length - 1) {
          setCurrentIndex(currentIndex + 1);
        }
      } else {
        console.error('❌ Content generation failed:', result);
        toast.error(`Failed to generate content: ${result.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('❌ Error in handleGenerateContent:', error);
      toast.error(`Failed to generate content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setGeneratingTheme(null);
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

  const getCategoryLabel = (category: string) => {
    const labels = {
      plant_care: 'Plant Care',
      decor: 'Garden Decor',
      sale: 'Promotions',
      holidays: 'Seasonal'
    };
    return labels[category as keyof typeof labels] || category;
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      plant_care: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      decor: 'bg-purple-100 text-purple-700 border-purple-200',
      sale: 'bg-orange-100 text-orange-700 border-orange-200',
      holidays: 'bg-blue-100 text-blue-700 border-blue-200'
    };
    return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  return (
    <>
      <Card className="bg-white border-l-4 border-l-brand-teal border-gray-200 card-interactive shadow-sm">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-gray-50/50 transition-colors duration-150 rounded-t-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div>
                    <CardTitle className="text-lg text-brand-navy font-semibold tracking-tight flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-brand-teal" />
                      Weekly Content Themes
                      <Badge className="bg-brand-teal/10 text-brand-teal border-brand-teal/20">
                        Week {currentWeek}
                      </Badge>
                    </CardTitle>
                    <p className="text-gray-600 text-sm mt-1 leading-relaxed">
                      Choose from seasonal themes or stick with your current campaign
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {campaignTasks.length > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="bg-emerald-100 px-3 py-1 rounded-full">
                        <span className="text-emerald-700 text-sm font-medium">
                          {campaignTasks.length}/5 ready
                        </span>
                      </div>
                      <div className="w-16 bg-gray-200 rounded-full h-1.5">
                        <div 
                          className="bg-emerald-600 h-1.5 rounded-full transition-all duration-300" 
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
              {themesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="animate-spin w-8 h-8 border-2 border-brand-teal border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading themes...</p>
                  </div>
                </div>
              ) : allThemes.length === 0 ? (
                <div className="py-8 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex flex-col items-center text-center">
                    <Calendar className="w-12 h-12 mb-3 text-brand-teal" />
                    <p className="text-brand-navy font-semibold mb-2 tracking-tight">No Themes Available</p>
                    <p className="text-gray-600 text-sm mb-4 leading-relaxed">
                      Create a campaign to get started with content themes
                    </p>
                    <Button 
                      variant="outline" 
                      onClick={onCampaignCreated}
                    >
                      Create Campaign
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Theme Carousel */}
                  <div className="relative">
                    {/* Navigation Buttons */}
                    {allThemes.length > 1 && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 p-0 bg-white/90 hover:bg-white shadow-sm border border-gray-200"
                          onClick={handlePrevious}
                          aria-label="Previous theme"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 p-0 bg-white/90 hover:bg-white shadow-sm border border-gray-200"
                          onClick={handleNext}
                          aria-label="Next theme"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </>
                    )}

                    {/* Theme Card */}
                    <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-6 border border-gray-200 mx-8">
                      {currentTheme && (
                        <div className="flex flex-col items-center text-center">
                          {/* Enhanced Theme Icon */}
                          <div className="relative w-16 h-16 mx-auto mb-4">
                            <div 
                              className="w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 shadow-lg"
                              style={{ backgroundColor: '#68BEB9' }}
                            >
                              {(() => {
                                const { icon: DynamicIcon } = getFocusThemeIcon(currentTheme);
                                return <DynamicIcon className="w-8 h-8 text-white drop-shadow-sm" />;
                              })()}
                            </div>
                            
                            {/* Subtle glow effect */}
                            <div 
                              className="absolute inset-0 rounded-full opacity-20 blur-md -z-10"
                              style={{ backgroundColor: '#68BEB9' }}
                            />
                          </div>

                          {/* Theme Badges */}
                          <div className="flex items-center gap-2 mb-3 flex-wrap justify-center">
                            <Badge className={`${getCategoryColor(currentTheme.category)} border text-xs`}>
                              {getCategoryLabel(currentTheme.category)}
                            </Badge>
                            
                            {currentTheme.label === 'Planning Ahead' && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge className="bg-amber-100 text-amber-700 border-amber-200 border flex items-center gap-1 text-xs">
                                      <Calendar className="w-3 h-3" />
                                      Planning Ahead
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-sm max-w-xs">Perfect for planning your content calendar!</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            
                            {currentTheme.label === 'Current Season' && (
                              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 border flex items-center gap-1 text-xs">
                                <Clock className="w-3 h-3" />
                                Perfect Timing
                              </Badge>
                            )}
                          </div>

                          {/* Theme Title */}
                          <h3 className="text-lg font-semibold text-brand-navy mb-2">
                            {currentTheme.title}
                          </h3>
                          
                          {/* Theme Description */}
                          <p className="text-sm text-gray-600 mb-4 leading-relaxed max-w-md">
                            {currentTheme.description}
                          </p>

                          {/* Action Buttons */}
                          <div className="flex gap-3">
                            {(generatingTheme === currentTheme.id || (currentTheme.id.startsWith('campaign-') && isGenerating)) ? (
                              <div className="bg-brand-blue/10 border border-brand-blue/20 rounded-lg px-4 py-2">
                                <div className="flex items-center gap-2 text-brand-blue">
                                  <div className="animate-spin h-4 w-4 border-2 border-brand-blue border-t-transparent rounded-full"></div>
                                  <span className="text-sm font-medium">Generating content...</span>
                                </div>
                              </div>
                            ) : (
                              <>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button 
                                        onClick={() => handleGenerateContent(currentTheme)}
                                        className="bg-brand-teal hover:bg-brand-teal/90 text-white"
                                      >
                                        <Play className="w-4 h-4 mr-2" />
                                        Generate Content
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="text-sm max-w-xs">{currentTheme.teaser}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>

                                {currentTheme.id.startsWith('campaign-') && campaignTasks.length > 0 && (
                                  <Button 
                                    onClick={handleViewContent}
                                    variant="outline"
                                  >
                                    <Eye className="w-4 h-4 mr-2" />
                                    Review Content
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Pagination */}
                    {allThemes.length > 1 && (
                      <div className="flex items-center justify-center gap-4 mt-4">
                        {/* Dots */}
                        <div className="flex items-center gap-1">
                          {allThemes.map((_, index) => (
                            <button
                              key={index}
                              className={`w-2 h-2 rounded-full transition-colors duration-200 ${
                                index === currentIndex ? 'bg-brand-teal' : 'bg-gray-300'
                              }`}
                              onClick={() => setCurrentIndex(index)}
                              aria-label={`Theme ${index + 1} of ${allThemes.length}`}
                            />
                          ))}
                        </div>
                        
                        {/* Counter */}
                        <span className="text-xs text-gray-500">
                          {currentIndex + 1} / {allThemes.length} themes
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Current Campaign Status */}
                  {currentCampaign && campaignTasks.length > 0 && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 text-emerald-700 mb-1">
                            <Sparkles className="w-4 h-4" />
                            <span className="text-sm font-semibold">Content Ready!</span>
                          </div>
                          <p className="text-emerald-600 text-xs leading-relaxed">
                            {campaignTasks.length} pieces of content ready for your current campaign
                          </p>
                        </div>
                        <Button 
                          onClick={() => window.location.href = '/publish'}
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <Sparkles className="w-4 h-4 mr-2" />
                          Publish
                        </Button>
                      </div>
                    </div>
                  )}
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
