import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Play, Calendar, Sparkles, ChevronDown, ChevronUp, Eye, ChevronLeft, ChevronRight, Clock, Sprout } from "lucide-react";
import { useState } from "react";
import { Campaign } from "@/types/content";
import { getCurrentWeekNumber, getDateForWeek } from "@/utils/dateUtils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useContentGeneration } from "@/contexts/ContentGenerationContext";
import { ContentViewer } from "@/components/content/ContentViewer";
import { useWeeklyThemes, WeeklyTheme } from "@/hooks/useWeeklyThemes";
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
  const [reviewingCampaignId, setReviewingCampaignId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(2); // Start with current week (middle)
  const [generatingTheme, setGeneratingTheme] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const { generateContent, isGeneratingForCampaign } = useContentGeneration();
  const { themes, loading: themesLoading } = useWeeklyThemes();

  const currentWeek = getCurrentWeekNumber();
  const campaignTasks = tasks.filter(task => task.campaign_id === currentCampaign?.id);
  const isGenerating = currentCampaign ? isGeneratingForCampaign(currentCampaign.id) : false;
  
  // Use the 5 weekly themes directly (no complex merging)
  const allThemes = themes;
  const currentTheme = allThemes[currentIndex];
  
  // Check if there are tasks with content for the current theme being viewed
  const getThemeContentTasks = (theme?: WeeklyTheme) => {
    if (!theme) return [];
    
    // If it's the current week theme and we have a current campaign, check those tasks
    if (theme.isCurrentWeek && currentCampaign) {
      const campaignTasks = tasks.filter(task => 
        task.campaign_id === currentCampaign.id && 
        task.ai_output && 
        task.ai_output.trim().length > 0
      );
      
      console.log('🔍 getThemeContentTasks for current week:', {
        themeId: theme.id,
        currentCampaignId: currentCampaign.id,
        totalTasks: tasks.length,
        campaignTasksFound: campaignTasks.length,
        campaignTasksWithContent: campaignTasks.map(t => ({
          id: t.id,
          type: t.post_type,
          hasContent: !!t.ai_output,
          contentLength: t.ai_output?.length || 0,
          status: t.status
        }))
      });
      
      return campaignTasks;
    }
    
    // For other themes, find tasks with content that match the theme's week
    return tasks.filter(task => {
      const hasContent = task.ai_output && task.ai_output.trim().length > 0;
      // This is simplified - ideally we'd match by campaign theme/title
      return hasContent;
    });
  };
  
  const currentThemeContentTasks = getThemeContentTasks(currentTheme);
  
  console.log('📊 Button state debug:', {
    currentWeek,
    tasksTotal: tasks.length,
    campaignTasksCount: campaignTasks.length,
    currentThemeContentTasksCount: currentThemeContentTasks.length,
    currentThemeIsCurrentWeek: currentTheme?.isCurrentWeek,
    currentThemeId: currentTheme?.id
  });

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : 4)); // Always 5 themes (0-4)
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < 4 ? prev + 1 : 0)); // Always 5 themes (0-4)
  };

  const createCampaignFromTheme = async (theme: WeeklyTheme) => {
    console.log('🏗️ Creating campaign from theme:', theme);
    
    const weekNumber = theme.weekNumber || currentWeek;
    const weekStartDate = getDateForWeek(weekNumber);
    
    const campaignData = {
      title: theme.title,
      theme: theme.title,
      description: theme.description,
      user_id: user?.id,
      tenant_id: tenant?.id,
      week_number: weekNumber,
      start_date: weekStartDate.toISOString().split('T')[0],
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

  const handleGenerateContent = async (theme?: WeeklyTheme) => {
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
      
      // Check if this theme's week matches the current campaign
      if (currentCampaign && targetTheme.weekNumber === currentCampaign.week_number) {
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
        
        // Move to next theme if available and this wasn't current week theme
        if (!targetTheme.isCurrentWeek && currentIndex < 4) {
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
    console.log('Review button clicked - Current theme:', currentTheme);
    console.log('Current campaign:', currentCampaign);
    console.log('All tasks:', tasks);
    
    // Find tasks that match the current theme being viewed
    let themeTasks = [];
    
    if (currentTheme?.isCurrentWeek && currentCampaign) {
      // If viewing current week theme and we have a current campaign, use those tasks
      themeTasks = tasks.filter(task => 
        task.campaign_id === currentCampaign.id && 
        task.ai_output && 
        task.ai_output.trim().length > 0
      );
    } else if (currentTheme) {
      // For other themes, find tasks with content (simplified for now)
      // We'll need to enhance this logic once we have campaign data available
      themeTasks = tasks.filter(task => {
        const hasContent = task.ai_output && task.ai_output.trim().length > 0;
        return hasContent;
      });
      
      // If we have multiple campaigns worth of tasks, prefer the most recent ones
      // This is a fallback until we have better campaign matching
      if (themeTasks.length > 5) {
        themeTasks = themeTasks.slice(-5); // Take the 5 most recent tasks
      }
    }
    
    if (themeTasks.length === 0) {
      console.error('No tasks with content available for current theme:', currentTheme?.title);
      toast.error('No content available to review for this theme');
      return;
    }
    
    // Use the campaign from the theme-specific tasks or current campaign
    const campaignId = themeTasks[0].campaign_id;
    
    console.log('Opening content viewer for theme:', currentTheme?.title, 'with campaignId:', campaignId);
    setReviewingCampaignId(campaignId);
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
      plant_care: 'tag-plant-care',
      decor: 'tag-decor', 
      sale: 'tag-sale',
      holidays: 'tag-holidays'
    };
    return colors[category as keyof typeof colors] || 'bg-gray-200 text-gray-900';
  };

  const getTimingColor = (label: string | undefined) => {
    if (label === 'Past') return 'tag-timing opacity-60';
    if (label === 'Current') return 'tag-category';
    if (label === 'Future') return 'tag-timing';
    return 'bg-gray-200 text-gray-900';
  };

  return (
    <>
      <Card className="premium-gradient border-0 shadow-custom hover:shadow-lg hover:shadow-black/10 transition-all duration-300 accordion-slide">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-white/30 transition-all duration-200 rounded-t-lg px-6 py-5 md:py-7">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-semibold tracking-wide text-slate-900 dark:text-slate-100 flex items-center gap-3 mb-2">
                      Your Weekly Content Themes
                    </h2>
                    <div className="p-2 rounded-lg hover:bg-white/50 dark:hover:bg-gray-800/50 transition-colors">
                      {isOpen ? (
                        <ChevronUp className="w-6 h-6 text-slate-600 dark:text-slate-400" />
                      ) : (
                        <ChevronDown className="w-6 h-6 text-slate-600 dark:text-slate-400" />
                      )}
                    </div>
                  </div>
                  <div className="max-w-md">
                    <p className="text-slate-600 dark:text-slate-400 text-base leading-relaxed hidden md:block">
                      Pick a seasonal theme or keep your current campaign.
                    </p>
                    <button 
                      className="md:hidden text-slate-600 dark:text-slate-400 text-sm flex items-center gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDetails(!showDetails);
                      }}
                    >
                      {showDetails ? 'Hide details' : 'Show details'}
                      <ChevronDown className={`w-4 h-4 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
                    </button>
                    {showDetails && (
                      <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mt-2 md:hidden">
                        Pick a seasonal theme or keep your current campaign.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="accordion-slide">
            <CardContent className="pt-0 px-6 pb-6">
              {themesLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="text-center">
                    <div className="relative w-12 h-12 mx-auto mb-6">
                      <div className="glass-coin w-12 h-12 flex items-center justify-center">
                        <Sprout className="w-6 h-6 text-teal-600 dark:text-teal-400" />
                      </div>
                      <svg className="absolute inset-0 w-12 h-12 progress-ring">
                        <circle
                          cx="24"
                          cy="24"
                          r="18"
                          stroke="currentColor"
                          strokeWidth="2"
                          fill="none"
                          className="text-teal-200 dark:text-teal-800"
                        />
                        <circle
                          cx="24"
                          cy="24"
                          r="18"
                          stroke="currentColor"
                          strokeWidth="2"
                          fill="none"
                          strokeDasharray="113"
                          strokeDashoffset="113"
                          className="text-teal-500 dark:text-teal-400 animate-spin"
                          style={{ animationDuration: '2s' }}
                        />
                      </svg>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 font-medium">Loading your seasonal themes...</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Theme Carousel */}
                  <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Navigation Buttons */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute left-4 top-1/2 -translate-y-1/2 z-20 h-9 w-9 p-0 border-2 border-teal-300 text-teal-600 hover:bg-mint-100 hover:border-teal-400 rounded-full backdrop-blur-sm lg:left-2 focus-visible:ring-4 focus-visible:ring-teal-200"
                      onClick={handlePrevious}
                      aria-label="Previous theme"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-4 top-1/2 -translate-y-1/2 z-20 h-9 w-9 p-0 border-2 border-teal-300 text-teal-600 hover:bg-mint-100 hover:border-teal-400 rounded-full backdrop-blur-sm lg:right-2 focus-visible:ring-4 focus-visible:ring-teal-200"
                      onClick={handleNext}
                      aria-label="Next theme"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>

                    {/* Current Theme Card */}
                    <div className="mx-4 lg:mx-8 lg:col-span-2">
                      {currentTheme && (
                        <div className="flex flex-col items-center text-center">
                          {/* Premium Glass Icon Medallion */}
                          <div className="relative w-20 h-20 mx-auto mb-6">
                            <div className="glass-coin-enhanced w-20 h-20 flex items-center justify-center group cursor-pointer animate-float">
                              {(() => {
                                const iconMap = getFocusThemeIcon(currentTheme.category);
                                const IconComponent = (iconMap && typeof iconMap === 'object' && 'icon' in iconMap) ? iconMap.icon : Sprout;
                                return <IconComponent className="w-10 h-10 text-white drop-shadow-xl group-hover:scale-125 transition-all duration-300" />;
                              })()}
                              <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-white/10 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300" />
                              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-transparent via-white/5 to-transparent opacity-60" />
                            </div>
                            
                            {/* Progress Ring for Generation State */}
                            {(generatingTheme === currentTheme.id || (currentTheme.isCurrentWeek && isGenerating)) && (
                              <svg className="absolute inset-0 w-20 h-20 progress-ring" aria-hidden="true">
                                <circle
                                  cx="40"
                                  cy="40"
                                  r="35"
                                  stroke="currentColor"
                                  strokeWidth="3"
                                  fill="none"
                                  className="text-teal-200 dark:text-teal-800"
                                />
                                <circle
                                  cx="40"
                                  cy="40"
                                  r="35"
                                  stroke="currentColor"
                                  strokeWidth="3"
                                  fill="none"
                                  strokeDasharray="220"
                                  strokeDashoffset="220"
                                  className="text-teal-500 dark:text-teal-400"
                                  style={{ 
                                    animation: 'progress-fill 2s ease-in-out infinite',
                                  }}
                                />
                              </svg>
                            )}
                            <span className="sr-only">
                              {generatingTheme === currentTheme.id ? 'Generating content...' : 'Theme icon'}
                            </span>
                          </div>

                          {/* Premium Tag Pills */}

                          {/* Theme Title */}
                          <h3 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-3 max-w-lg">
                            {currentTheme.title}
                          </h3>
                          
                          {/* Theme Description */}
                          <p className="text-base text-slate-600 dark:text-slate-400 mb-8 leading-relaxed max-w-lg">
                            {currentTheme.description}
                          </p>

                          {/* Premium CTA Button */}
                          <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md justify-center items-center">
                            {(generatingTheme === currentTheme.id || (currentTheme.isCurrentWeek && isGenerating)) ? (
                              <div className="premium-gradient border border-indigo-200 dark:border-indigo-800 rounded-2xl px-6 py-4 w-full">
                                <div className="flex items-center justify-center gap-3 text-indigo-700 dark:text-indigo-300">
                                  <div className="relative w-5 h-5">
                                    <div className="absolute inset-0 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin"></div>
                                  </div>
                                  <span className="font-semibold">Crafting your content...</span>
                                </div>
                              </div>
                            ) : (
                              <>
                                {/* Main CTA Button - Changes based on content state */}
                                {currentTheme.isCurrentWeek && currentThemeContentTasks.length > 0 ? (
                                  <Button 
                                    onClick={handleViewContent}
                                    className="cta-button group bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 w-full sm:w-auto focus-visible:ring-4 focus-visible:ring-emerald-200"
                                  >
                                    <Eye className="w-4 h-4 mr-2" />
                                    Review Content
                                    <ChevronRight className="w-4 h-4 ml-2 cta-chevron" />
                                  </Button>
                                ) : (
                                  <Button 
                                    onClick={() => handleGenerateContent(currentTheme)}
                                    className="cta-button group bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white font-semibold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 w-full sm:w-auto focus-visible:ring-4 focus-visible:ring-teal-200"
                                  >
                                    <Play className="w-4 h-4 mr-2" />
                                    Create This Week's Posts
                                    <ChevronRight className="w-4 h-4 ml-2 cta-chevron" />
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                  </div>

                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {showContentViewer && (
        <ContentViewer
          campaignId={reviewingCampaignId || currentCampaign?.id || ''}
          campaignTitle={currentTheme?.title || currentCampaign?.theme || currentCampaign?.title || 'Generated Content'}
          isOpen={showContentViewer}
          onClose={() => {
            setShowContentViewer(false);
            setReviewingCampaignId(null);
          }}
          onTaskUpdate={handleContentUpdate}
        />
      )}
    </>
  );
};
