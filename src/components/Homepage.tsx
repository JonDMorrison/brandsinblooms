import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, ArrowRight, Bell, Plus, Upload, FileText, BarChart3, Instagram, Facebook, Mail, Copy, Edit, CheckCircle, XCircle, Camera, Palette, Leaf, Sun } from "lucide-react";
import { TaskChecklist } from "@/components/TaskChecklist";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface HomepageProps {
  onboardingData: any;
  onNavigateToKanban: () => void;
  onTaskClick: (task: any) => void;
  campaigns: any[];
  tasks: any[];
}

export const Homepage = ({ onboardingData, onNavigateToKanban, onTaskClick, campaigns, tasks }: HomepageProps) => {
  const [isGeneratingTasks, setIsGeneratingTasks] = useState(false);

  const getSeasonalGreeting = () => {
    const month = new Date().getMonth() + 1;
    if (month >= 3 && month <= 5) return { emoji: "🌸", text: "Spring is here!" };
    if (month >= 6 && month <= 8) return { emoji: "☀️", text: "Summer vibes!" };
    if (month >= 9 && month <= 11) return { emoji: "🍂", text: "Fall beauty!" };
    return { emoji: "❄️", text: "Winter magic!" };
  };

  const getSeasonalContent = () => {
    const month = new Date().getMonth() + 1;
    
    if (month >= 3 && month <= 5) {
      // Spring content
      return {
        posts: [
          {
            type: 'instagram',
            content: `🌸 Spring has sprung at Green Thumb! Our greenhouse is bursting with fresh seedlings, vibrant annuals, and everything you need for your spring garden. What's first on your planting list? #SpringGardening #FreshStart #GreenThumb`,
            hashtags: '#SpringGardening #FreshStart #GreenThumb #PlantLovers #SpringSale',
            imageIdea: 'Colorful spring flowers display in greenhouse'
          },
          {
            type: 'facebook',
            content: `🌱 Spring Gardening Workshop this Saturday! Join our experts as we share tips for preparing your garden beds, choosing the right plants for your space, and getting the most out of your spring planting. Register now - limited spots available!`,
            hashtags: '#SpringWorkshop #GardeningTips #CommunityEvent',
            imageIdea: 'Workshop setup with gardening tools and soil'
          },
          {
            type: 'email',
            content: `Subject: Your Spring Garden Awaits! 🌻\n\nDear Garden Enthusiasts,\n\nSpring is the perfect time to transform your outdoor space! This week we're featuring our premium soil amendments, organic fertilizers, and a stunning selection of spring perennials. Plus, don't miss our Spring Plant Sale happening all month long.`,
            hashtags: '#SpringNewsletter #PlantSale #GardeningTips',
            imageIdea: 'Newsletter header with spring garden scene'
          },
          {
            type: 'instagram',
            content: `🌿 Behind the scenes: Our team starts each morning caring for thousands of plants! From watering seedlings to arranging displays, every detail matters in creating your perfect garden center experience. Thank you for supporting local! #BehindTheScenes #LocalBusiness #PlantCare`,
            hashtags: '#BehindTheScenes #LocalBusiness #PlantCare #TeamWork',
            imageIdea: 'Staff watering plants in early morning light'
          }
        ]
      };
    } else if (month >= 6 && month <= 8) {
      // Summer content
      return {
        posts: [
          {
            type: 'instagram',
            content: `☀️ Beat the summer heat with our drought-resistant beauties! These hardy perennials and succulents will keep your garden thriving even in the hottest weather. Stop by for expert advice on summer gardening! #SummerGardening #DroughtResistant #HeatTolerant`,
            hashtags: '#SummerGardening #DroughtResistant #HeatTolerant #WaterWise',
            imageIdea: 'Display of drought-resistant plants and succulents'
          },
          {
            type: 'facebook',
            content: `🌻 Summer Herb Workshop Series continues this week! Learn how to grow, harvest, and preserve herbs from your garden. This week we're focusing on basil, oregano, and summer savory. Perfect timing for your summer cooking!`,
            hashtags: '#HerbWorkshop #SummerHerbs #CookingWithHerbs',
            imageIdea: 'Fresh herbs arranged for cooking demonstration'
          },
          {
            type: 'email',
            content: `Subject: Summer Garden Care Made Easy! 🌞\n\nHello Green Thumbs!\n\nSummer gardening doesn't have to be a struggle! Our latest newsletter features water-saving tips, pest management strategies, and the best plants for summer containers. Keep your garden beautiful all season long.`,
            hashtags: '#SummerCare #WaterSaving #ContainerGardening',
            imageIdea: 'Summer container garden arrangements'
          },
          {
            type: 'instagram',
            content: `🦋 Our pollinator garden is buzzing with activity! These bee-friendly plants not only support our local ecosystem but add incredible beauty and fragrance to any space. Which pollinator plants are you growing this year? #PollinatorGarden #BeesFriendly #EcoGardening`,
            hashtags: '#PollinatorGarden #BeesFriendly #EcoGardening #Biodiversity',
            imageIdea: 'Bees and butterflies on flowering plants'
          }
        ]
      };
    } else if (month >= 9 && month <= 11) {
      // Fall content
      return {
        posts: [
          {
            type: 'instagram',
            content: `🍂 Fall is nature's grand finale! Our mums, asters, and ornamental kales are putting on quite the show. Plus, it's the perfect time to plant trees and shrubs before winter. What fall colors are calling to you? #FallColors #Mums #TreePlanting`,
            hashtags: '#FallColors #Mums #TreePlanting #AutumnGarden',
            imageIdea: 'Colorful fall mums and ornamental plants display'
          },
          {
            type: 'facebook',
            content: `🌰 Fall Garden Prep Workshop this weekend! Learn the secrets of preparing your garden for winter, proper mulching techniques, and which plants to divide now for next year's garden. Your future self will thank you!`,
            hashtags: '#FallPrep #WinterReady #GardeningWorkshop',
            imageIdea: 'Garden tools and mulch for fall preparation'
          },
          {
            type: 'email',
            content: `Subject: Fall Into Gardening Success! 🍁\n\nDear Gardening Friends,\n\nFall is the secret season for gardeners! While others are winding down, smart gardeners are planting bulbs for spring, dividing perennials, and preparing for next year's garden. Don't miss our fall bulb sale!`,
            hashtags: '#FallBulbs #GardenPrep #SpringPlanning',
            imageIdea: 'Variety of spring bulbs for fall planting'
          },
          {
            type: 'instagram',
            content: `🎃 From garden to table! Our seasonal vegetables are perfect for your fall harvest cooking. Fresh squash, pumpkins, and late-season tomatoes - there's nothing quite like homegrown flavor. What's growing in your fall garden? #HarvestSeason #VegetableGarden #FreshProduce`,
            hashtags: '#HarvestSeason #VegetableGarden #FreshProduce #FallHarvest',
            imageIdea: 'Basket of fresh fall vegetables and pumpkins'
          }
        ]
      };
    } else {
      // Winter content
      return {
        posts: [
          {
            type: 'instagram',
            content: `❄️ Winter doesn't mean your garden has to sleep! Our evergreens, winter berries, and cold-hardy plants keep the beauty alive all season long. Plus, it's the perfect time to plan next year's garden! #WinterGarden #Evergreens #GardenPlanning`,
            hashtags: '#WinterGarden #Evergreens #GardenPlanning #WinterBeauty',
            imageIdea: 'Evergreen plants and winter berry displays'
          },
          {
            type: 'facebook',
            content: `🌲 Holiday Wreath Workshop this Saturday! Create beautiful, natural decorations using fresh evergreen boughs, berries, and pinecones from local sources. All materials provided - just bring your creativity!`,
            hashtags: '#HolidayWorkshop #WreathMaking #NaturalDecor',
            imageIdea: 'Workshop table with wreath-making materials'
          },
          {
            type: 'email',
            content: `Subject: Winter Garden Magic Awaits! ⛄\n\nWarm Greetings!\n\nWinter is the perfect time for garden planning and indoor plant care. Our houseplant collection is thriving, and we're here to help you bring green life into your home during the colder months.`,
            hashtags: '#WinterNewsletter #Houseplants #IndoorGardening',
            imageIdea: 'Cozy indoor plant display for winter'
          },
          {
            type: 'instagram',
            content: `🪴 Houseplant love in the winter months! These green beauties not only purify your air but bring life and color to your home when the outdoor garden sleeps. Which houseplants are brightening your winter days? #Houseplants #IndoorGardening #WinterGreen`,
            hashtags: '#Houseplants #IndoorGardening #WinterGreen #PlantParent',
            imageIdea: 'Variety of healthy houseplants in winter setting'
          }
        ]
      };
    }
  };

  const getCurrentWeekCampaign = () => {
    if (campaigns.length === 0) return null;
    
    const today = new Date();
    
    // First, try to find a campaign within the current week
    const currentWeekCampaign = campaigns.find(campaign => {
      const campaignDate = new Date(campaign.start_date);
      const daysDiff = Math.abs((campaignDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
      return daysDiff <= 7; // Within a week
    });
    
    if (currentWeekCampaign) return currentWeekCampaign;
    
    // If no current week campaign, return the most recent one
    const sortedCampaigns = [...campaigns].sort((a, b) => 
      new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
    );
    
    return sortedCampaigns[0];
  };

  const generateSampleTasks = async (campaignId: string) => {
    setIsGeneratingTasks(true);
    
    try {
      const campaign = campaigns.find(c => c.id === campaignId);
      if (!campaign) return;

      const today = new Date();
      const seasonalContent = getSeasonalContent();
      
      // Generate 4 tasks spread throughout the current week
      const sampleTasks = seasonalContent.posts.map((post, index) => {
        // Spread posts across the week: today, +2 days, +4 days, +6 days
        const scheduledDate = new Date(today);
        scheduledDate.setDate(today.getDate() + (index * 2));
        
        return {
          campaign_id: campaignId,
          post_type: post.type,
          status: index === 0 ? 'review' : index === 1 ? 'generating' : 'planned',
          scheduled_date: scheduledDate.toISOString().split('T')[0],
          ai_output: index === 0 ? post.content : null, // Only first post has content ready
          hashtags: post.hashtags,
          image_idea: post.imageIdea
        };
      });

      // Insert tasks into the database
      for (const task of sampleTasks) {
        const { error } = await supabase
          .from('content_tasks')
          .insert(task);
        
        if (error) {
          console.error('Error creating task:', error);
        }
      }

      // Refresh the page to show new tasks
      window.location.reload();
      
    } catch (error) {
      console.error('Error generating tasks:', error);
    } finally {
      setIsGeneratingTasks(false);
    }
  };

  const getNextStepGuidance = () => {
    if (campaigns.length === 0) {
      return {
        icon: "🌱",
        title: "Next Step: Create your first campaign",
        description: "Start growing your garden center's online presence",
        action: "Start Now",
        bgColor: "bg-green-50",
        borderColor: "border-green-200"
      };
    }

    const currentCampaign = getCurrentWeekCampaign();
    const campaignTasks = currentCampaign ? getTasksForCampaign(currentCampaign.id) : [];
    
    if (campaignTasks.length === 0) {
      return {
        icon: "📝",
        title: "Next Step: Generate content for your campaign",
        description: "Create posts and content for your active campaign",
        action: "Generate Content",
        bgColor: "bg-blue-50",
        borderColor: "border-blue-200"
      };
    }

    const draftCampaigns = campaigns.filter(c => c.status === 'draft');
    if (draftCampaigns.length > 0) {
      return {
        icon: "📝",
        title: "Next Step: Finish your draft campaign",
        description: "Complete your campaign setup to start creating content",
        action: "Continue Draft",
        bgColor: "bg-yellow-50",
        borderColor: "border-yellow-200"
      };
    }

    const scheduledCampaigns = campaigns.filter(c => c.status === 'scheduled');
    if (scheduledCampaigns.length > 0) {
      return {
        icon: "👀",
        title: "Next Step: Preview what's going out",
        description: "Review your scheduled content before it goes live",
        action: "Preview Content",
        bgColor: "bg-blue-50",
        borderColor: "border-blue-200"
      };
    }

    return {
      icon: "🌻",
      title: "Next Step: Create your next campaign",
      description: "Keep the momentum going with fresh content",
      action: "Start Campaign",
      bgColor: "bg-green-50",
      borderColor: "border-green-200"
    };
  };

  const getSetupProgress = () => {
    const totalSteps = 5;
    const completedSteps = [
      onboardingData?.aboutBusiness, // Has business info
      true, // Assumed connected social
      campaigns.length > 0, // Has campaigns
      tasks.some(t => t.ai_output), // Has generated content
      tasks.some(t => t.status === 'posted') // Has posted content
    ].filter(Boolean).length;

    return {
      percentage: Math.round((completedSteps / totalSteps) * 100),
      completed: completedSteps,
      total: totalSteps,
      steps: [
        { label: "Added business info", completed: !!onboardingData?.aboutBusiness },
        { label: "Connected social accounts", completed: true },
        { label: "Created first campaign", completed: campaigns.length > 0 },
        { label: "Generated content", completed: tasks.some(t => t.ai_output) },
        { label: "Published content", completed: tasks.some(t => t.status === 'posted') }
      ]
    };
  };

  const getUpcomingContent = () => {
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
    
    return tasks
      .filter(task => {
        if (!task.scheduled_date) return false;
        const scheduledDate = new Date(task.scheduled_date);
        return scheduledDate >= today && scheduledDate <= nextMonth;
      })
      .slice(0, 3)
      .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime());
  };

  const getTasksForCampaign = (campaignId: string) => {
    return tasks.filter(task => task.campaign_id === campaignId);
  };

  const getTasksByStatus = (status: string) => {
    return tasks.filter(task => task.status === status).slice(0, 2);
  };

  const getOverdueTasks = () => {
    const today = new Date();
    return tasks.filter(task => {
      if (!task.scheduled_date) return false;
      const scheduledDate = new Date(task.scheduled_date);
      return scheduledDate < today && task.status !== 'posted' && task.status !== 'skipped';
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planned': return 'bg-gray-100 text-gray-800';
      case 'generating': return 'bg-blue-100 text-blue-800';
      case 'review': return 'bg-yellow-100 text-yellow-800';
      case 'scheduled': return 'bg-green-100 text-green-800';
      case 'posted': return 'bg-emerald-100 text-emerald-800';
      case 'skipped': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPostTypeIcon = (postType: string) => {
    switch (postType) {
      case 'instagram': return <Instagram className="w-4 h-4" />;
      case 'facebook': return <Facebook className="w-4 h-4" />;
      case 'email': return <Mail className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const currentCampaign = getCurrentWeekCampaign();
  const campaignTasks = currentCampaign ? getTasksForCampaign(currentCampaign.id) : [];
  const overdueTasks = getOverdueTasks();
  const seasonal = getSeasonalGreeting();
  const nextStep = getNextStepGuidance();
  const setupProgress = getSetupProgress();
  const upcomingContent = getUpcomingContent();

  return (
    <div className="min-h-screen bg-garden-background p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Welcome Section */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="seasonal-emoji">{seasonal.emoji}</span>
            <h1 className="text-4xl font-bold text-black">
              Welcome back! {seasonal.text}
            </h1>
          </div>
          <p className="text-xl text-black font-medium mb-2">
            Here's what's happening this week at your garden center
          </p>
          <p className="text-black font-light">
            Let's grow this week's campaign together.
          </p>
        </div>

        {/* Next Step Banner */}
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
                onClick={() => {
                  if (nextStep.action === "Generate Content" && currentCampaign) {
                    generateSampleTasks(currentCampaign.id);
                  }
                }}
                disabled={isGeneratingTasks}
              >
                {isGeneratingTasks ? "Generating..." : nextStep.action}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* This Week's Campaign - Spans 2 columns */}
          <div className="lg:col-span-2">
            <Card className="shadow-xl border-green-200 rounded-xl overflow-hidden campaign-card-active">
              <CardHeader className="bg-gradient-to-r from-primary to-primary-600 text-white">
                <CardTitle className="text-2xl font-bold flex items-center gap-3">
                  <Calendar className="w-6 h-6" />
                  This Week's Campaign
                </CardTitle>
                <CardDescription className="text-green-100 font-medium">
                  {currentCampaign ? currentCampaign.title : "No active campaign"}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                {currentCampaign ? (
                  <div className="space-y-6">
                    <div className="flex items-center gap-4 text-sm text-gray-600 font-medium">
                      <span className="flex items-center gap-2 bg-green-100 px-3 py-1 rounded-full">
                        <Calendar className="w-4 h-4" />
                        Week {currentCampaign.week_number}
                      </span>
                      <span className="flex items-center gap-2 bg-blue-100 px-3 py-1 rounded-full">
                        <Clock className="w-4 h-4" />
                        {new Date(currentCampaign.start_date).toLocaleDateString()}
                      </span>
                    </div>
                    
                    {campaignTasks.length > 0 ? (
                      <div className="space-y-4">
                        {campaignTasks.map((task) => (
                          <div key={task.id} className="border border-green-200 rounded-xl p-5 hover:bg-green-50 cursor-pointer transition-all duration-200 hover:shadow-md" onClick={() => onTaskClick(task)}>
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                {getPostTypeIcon(task.post_type)}
                                <span className="font-semibold capitalize text-black">{task.post_type}</span>
                                <Badge className={`${getStatusColor(task.status)} font-medium`}>
                                  {task.status}
                                </Badge>
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" className="border-green-300 text-black hover:bg-green-100">
                                  <Edit className="w-3 h-3 mr-1" />
                                  Edit
                                </Button>
                                <Button size="sm" variant="outline" className="border-blue-300 text-blue-600 hover:bg-blue-100">
                                  <Copy className="w-3 h-3 mr-1" />
                                  Copy
                                </Button>
                              </div>
                            </div>
                            {task.ai_output && (
                              <p className="text-sm text-gray-700 line-clamp-2 font-medium leading-relaxed">{task.ai_output}</p>
                            )}
                            {task.scheduled_date && (
                              <p className="text-xs text-gray-500 mt-3 font-medium">
                                Scheduled: {new Date(task.scheduled_date).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-gray-500">
                        <FileText className="w-16 h-16 mx-auto mb-4 opacity-40" />
                        <p className="font-medium mb-4">No content tasks for this campaign yet</p>
                        <Button 
                          className="bg-primary hover:bg-primary-600 text-white shadow-md"
                          onClick={() => generateSampleTasks(currentCampaign.id)}
                          disabled={isGeneratingTasks}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          {isGeneratingTasks ? "Generating Tasks..." : "Create Content Tasks"}
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <Calendar className="w-16 h-16 mx-auto mb-4 opacity-40" />
                    <p className="font-medium mb-4">No active campaigns found</p>
                    <Button className="bg-primary hover:bg-primary-600 text-white shadow-md">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Campaign
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Setup Progress Card */}
            <Card className="shadow-lg border-green-200 rounded-xl bg-gradient-to-br from-green-50 to-blue-50">
              <CardHeader>
                <CardTitle className="text-lg text-black font-bold flex items-center gap-2">
                  <span className="text-2xl">🌼</span>
                  You're {setupProgress.percentage}% set up!
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {setupProgress.steps.map((step, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <span className="text-lg">
                        {step.completed ? "✅" : "⬜️"}
                      </span>
                      <span className={`text-sm font-medium ${step.completed ? 'text-green-700' : 'text-gray-600'}`}>
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
                {setupProgress.percentage < 100 && (
                  <Button className="w-full bg-primary hover:bg-primary-600 text-white shadow-md">
                    Complete Setup
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Campaign Tasks (formerly Action Required) */}
            {overdueTasks.length > 0 && (
              <Card className="shadow-lg border-amber-200 rounded-xl bg-amber-50">
                <CardHeader>
                  <CardTitle className="text-lg font-bold flex items-center gap-2 text-amber-800">
                    <span className="text-xl">📋</span>
                    Campaign Tasks
                  </CardTitle>
                  <CardDescription className="text-amber-700 font-medium">
                    Things to finish before this week's campaign goes live
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {overdueTasks.slice(0, 3).map((task) => (
                    <div key={task.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-amber-200">
                      <span className="text-lg">⏳</span>
                      <div className="flex-1">
                        <p className="font-semibold text-amber-800 text-sm">
                          {task.campaigns?.title} - {task.post_type}
                        </p>
                        <p className="text-amber-600 text-xs font-medium">
                          Due: {new Date(task.scheduled_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* What's Coming Preview */}
            {upcomingContent.length > 0 && (
              <Card className="shadow-lg border-blue-200 rounded-xl bg-blue-50">
                <CardHeader>
                  <CardTitle className="text-lg font-bold flex items-center gap-2 text-blue-800">
                    <Calendar className="w-5 h-5" />
                    Coming Up This Month
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {upcomingContent.map((task) => (
                    <div key={task.id} className="flex items-center gap-3">
                      <span className="text-sm">📅</span>
                      <div>
                        <p className="text-sm font-semibold text-blue-800">
                          {task.campaigns?.title} - {task.post_type}
                        </p>
                        <p className="text-xs text-blue-600">
                          {new Date(task.scheduled_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" className="w-full border-blue-300 text-blue-700 hover:bg-blue-100">
                    <Calendar className="w-4 h-4 mr-2" />
                    View Calendar
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Improved Quick Actions */}
        <Card className="shadow-lg border-green-200 rounded-xl">
          <CardHeader className="bg-gradient-to-r from-green-50 to-blue-50 rounded-t-xl">
            <CardTitle className="text-xl text-black font-bold">Quick Actions</CardTitle>
            <CardDescription className="font-medium">Everything you need to grow your presence</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="group cursor-pointer">
                <Card className="h-full border-2 border-green-200 hover:border-green-400 hover:shadow-lg transition-all duration-200 bg-gradient-to-br from-green-50 to-green-100">
                  <CardContent className="p-6 text-center">
                    <span className="text-4xl mb-4 block group-hover:scale-110 transition-transform duration-200">🌻</span>
                    <h3 className="font-bold text-black mb-2">Create a Campaign</h3>
                    <p className="text-sm text-black">Start from a template or blank canvas</p>
                  </CardContent>
                </Card>
              </div>
              
              <div className="group cursor-pointer">
                <Card className="h-full border-2 border-blue-200 hover:border-blue-400 hover:shadow-lg transition-all duration-200 bg-gradient-to-br from-blue-50 to-blue-100">
                  <CardContent className="p-6 text-center">
                    <span className="text-4xl mb-4 block group-hover:scale-110 transition-transform duration-200">📷</span>
                    <h3 className="font-bold text-blue-800 mb-2">Upload Photos</h3>
                    <p className="text-sm text-blue-600">Add your beautiful garden visuals</p>
                  </CardContent>
                </Card>
              </div>
              
              <div className="group cursor-pointer">
                <Card className="h-full border-2 border-yellow-200 hover:border-yellow-400 hover:shadow-lg transition-all duration-200 bg-gradient-to-br from-yellow-50 to-yellow-100">
                  <CardContent className="p-6 text-center">
                    <span className="text-4xl mb-4 block group-hover:scale-110 transition-transform duration-200">🗓️</span>
                    <h3 className="font-bold text-yellow-800 mb-2">Submit New Event</h3>
                    <p className="text-sm text-yellow-600">Tell us what's happening at your center</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Task Checklist and Workflow Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <TaskChecklist 
              campaignTitle={currentCampaign?.title}
              weekNumber={currentCampaign?.week_number}
            />
          </div>
          
          <div>
            <Card className="shadow-lg border-green-200 rounded-xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-green-50 to-blue-50">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-xl text-black font-bold flex items-center gap-2">
                      <BarChart3 className="w-5 h-5" />
                      Content Pipeline
                    </CardTitle>
                    <CardDescription className="font-medium text-black">Quick overview</CardDescription>
                  </div>
                  <Button onClick={onNavigateToKanban} size="sm" className="bg-primary hover:bg-primary-600 text-white shadow-md font-semibold">
                    View All
                    <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {['generating', 'review', 'scheduled'].map((status) => {
                    const statusTasks = getTasksByStatus(status);
                    return (
                      <div key={status} className="space-y-2">
                        <h4 className="font-semibold text-gray-700 capitalize flex items-center gap-2 text-sm">
                          {status === 'generating' && <div className="w-3 h-3 rounded-full bg-blue-500"></div>}
                          {status === 'review' && <div className="w-3 h-3 rounded-full bg-yellow-500"></div>}
                          {status === 'scheduled' && <div className="w-3 h-3 rounded-full bg-green-500"></div>}
                          {status} ({statusTasks.length})
                        </h4>
                        <div className="space-y-2">
                          {statusTasks.slice(0, 2).map((task) => (
                            <div
                              key={task.id}
                              className="p-3 bg-white border border-gray-200 rounded-lg hover:shadow-sm cursor-pointer transition-all duration-200 hover:border-green-300"
                              onClick={() => onTaskClick(task)}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                {getPostTypeIcon(task.post_type)}
                                <span className="text-xs font-medium text-black">{task.campaigns?.title}</span>
                              </div>
                              <p className="text-xs text-gray-600 capitalize">{task.post_type}</p>
                            </div>
                          ))}
                          {statusTasks.length === 0 && (
                            <div className="p-3 border-2 border-dashed border-gray-300 rounded-lg text-center bg-gray-50">
                              <p className="text-xs text-gray-400">No tasks</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Analytics Snapshot */}
        <Card className="shadow-lg border-green-200 rounded-xl">
          <CardHeader className="bg-gradient-to-r from-green-50 to-blue-50 rounded-t-xl">
            <CardTitle className="text-xl text-black font-bold">Analytics Snapshot</CardTitle>
            <CardDescription className="font-medium">Coming soon - track your marketing performance</CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200">
                <p className="text-3xl font-bold text-gray-400 mb-2">--</p>
                <p className="text-sm text-gray-600 font-semibold">Top Performing Post</p>
              </div>
              <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                <p className="text-3xl font-bold text-gray-400 mb-2">--</p>
                <p className="text-sm text-gray-600 font-semibold">Most Used Hashtags</p>
              </div>
              <div className="text-center p-6 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl border border-yellow-200">
                <p className="text-3xl font-bold text-gray-400 mb-2">--</p>
                <p className="text-sm text-gray-600 font-semibold">Campaign Success Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
