import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, ArrowRight, Bell, Plus, Upload, FileText, BarChart3, Instagram, Facebook, Mail, Copy, Edit, CheckCircle, XCircle, Camera, Palette } from "lucide-react";

interface HomepageProps {
  onboardingData: any;
  onNavigateToKanban: () => void;
  onTaskClick: (task: any) => void;
  campaigns: any[];
  tasks: any[];
}

export const Homepage = ({ onboardingData, onNavigateToKanban, onTaskClick, campaigns, tasks }: HomepageProps) => {
  const getSeasonalGreeting = () => {
    const month = new Date().getMonth() + 1;
    if (month >= 3 && month <= 5) return { emoji: "🌸", text: "Spring is here!" };
    if (month >= 6 && month <= 8) return { emoji: "☀️", text: "Summer vibes!" };
    if (month >= 9 && month <= 11) return { emoji: "🍂", text: "Fall beauty!" };
    return { emoji: "❄️", text: "Winter magic!" };
  };

  const getCurrentWeekCampaign = () => {
    const today = new Date();
    const currentWeek = Math.ceil((today.getDate() + new Date(today.getFullYear(), today.getMonth(), 1).getDay()) / 7);
    
    // Find campaign for current or next week
    return campaigns.find(campaign => {
      const campaignDate = new Date(campaign.start_date);
      const weeksDiff = Math.ceil((campaignDate.getTime() - today.getTime()) / (7 * 24 * 60 * 60 * 1000));
      return weeksDiff >= 0 && weeksDiff <= 1;
    }) || campaigns[0];
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

  return (
    <div className="min-h-screen bg-garden-background p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Welcome Section */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="seasonal-emoji">{seasonal.emoji}</span>
            <h1 className="text-4xl font-bold text-garden-green-dark">
              Welcome back! {seasonal.text}
            </h1>
          </div>
          <p className="text-xl text-garden-green font-medium mb-2">
            Here's what's happening this week at your garden center
          </p>
          <p className="text-garden-green-dark font-light">
            Let's grow this week's campaign together.
          </p>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* This Week's Campaign - Spans 2 columns on large screens */}
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
                                <span className="font-semibold capitalize text-garden-green-dark">{task.post_type}</span>
                                <Badge className={`${getStatusColor(task.status)} font-medium`}>
                                  {task.status}
                                </Badge>
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" className="border-green-300 text-garden-green hover:bg-green-100">
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
                        <Button className="bg-primary hover:bg-primary-600 text-white shadow-md">
                          <Plus className="w-4 h-4 mr-2" />
                          Create First Task
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

          {/* Quick Actions */}
          <div className="space-y-8">
            {/* Notifications */}
            {overdueTasks.length > 0 && (
              <Card className="shadow-lg border-orange-200 rounded-xl campaign-card-attention">
                <CardHeader className="bg-gradient-to-r from-warning-500 to-orange-400 text-white rounded-t-xl">
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Bell className="w-5 h-5" />
                    ⚠️ Needs Your Attention
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5">
                  <div className="space-y-3">
                    {overdueTasks.slice(0, 3).map((task) => (
                      <div key={task.id} className="text-sm bg-orange-50 p-3 rounded-lg border border-orange-200">
                        <p className="font-semibold text-orange-800">
                          {task.campaigns?.title} - {task.post_type}
                        </p>
                        <p className="text-orange-600 font-medium">
                          Due: {new Date(task.scheduled_date).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                    {overdueTasks.length > 3 && (
                      <p className="text-xs text-orange-600 font-medium text-center">
                        +{overdueTasks.length - 3} more overdue
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Add Panel */}
            <Card className="shadow-lg border-green-200 rounded-xl">
              <CardHeader className="bg-gradient-to-r from-green-50 to-green-100 rounded-t-xl">
                <CardTitle className="text-lg text-garden-green-dark font-bold">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <div className="grid grid-cols-1 gap-3">
                  <Button className="bg-primary hover:bg-primary-600 text-white justify-start font-semibold shadow-md transition-all duration-200 hover:shadow-lg">
                    <Plus className="w-4 h-4 mr-3" />
                    Create Custom Campaign
                  </Button>
                  <Button variant="outline" className="justify-start border-2 border-accent-blue text-blue-600 hover:bg-blue-50 font-semibold">
                    <Upload className="w-4 h-4 mr-3" />
                    Upload Photos
                  </Button>
                  <Button variant="outline" className="justify-start border-2 border-warning-500 text-orange-600 hover:bg-orange-50 font-semibold">
                    <FileText className="w-4 h-4 mr-3" />
                    Submit New Event
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Workflow Preview */}
        <Card className="shadow-xl border-green-200 rounded-xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-green-50 to-blue-50">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-2xl text-garden-green-dark font-bold flex items-center gap-3">
                  <BarChart3 className="w-6 h-6" />
                  Content Workflow
                </CardTitle>
                <CardDescription className="font-medium text-garden-green">Your content pipeline at a glance</CardDescription>
              </div>
              <Button onClick={onNavigateToKanban} className="bg-primary hover:bg-primary-600 text-white shadow-md font-semibold">
                Go to Full Board
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {['generating', 'review', 'scheduled'].map((status) => {
                const statusTasks = getTasksByStatus(status);
                return (
                  <div key={status} className="space-y-4">
                    <h3 className="font-bold text-gray-700 capitalize flex items-center gap-3 text-lg">
                      {status === 'generating' && <div className="w-4 h-4 rounded-full bg-blue-500 shadow-md"></div>}
                      {status === 'review' && <div className="w-4 h-4 rounded-full bg-yellow-500 shadow-md"></div>}
                      {status === 'scheduled' && <div className="w-4 h-4 rounded-full bg-green-500 shadow-md"></div>}
                      {status} ({statusTasks.length})
                    </h3>
                    <div className="space-y-3">
                      {statusTasks.map((task) => (
                        <div
                          key={task.id}
                          className="p-4 bg-white border-2 border-gray-200 rounded-xl hover:shadow-md cursor-pointer transition-all duration-200 hover:border-green-300"
                          onClick={() => onTaskClick(task)}
                        >
                          <div className="flex items-center gap-3 mb-2">
                            {getPostTypeIcon(task.post_type)}
                            <span className="text-sm font-semibold text-garden-green-dark">{task.campaigns?.title}</span>
                          </div>
                          <p className="text-xs text-gray-600 capitalize font-medium">{task.post_type}</p>
                          {task.scheduled_date && (
                            <p className="text-xs text-gray-500 mt-1 font-medium">
                              {new Date(task.scheduled_date).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      ))}
                      {statusTasks.length === 0 && (
                        <div className="p-4 border-2 border-dashed border-gray-300 rounded-xl text-center bg-gray-50">
                          <p className="text-sm text-gray-400 font-medium">No tasks</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Analytics Snapshot */}
        <Card className="shadow-lg border-green-200 rounded-xl">
          <CardHeader className="bg-gradient-to-r from-green-50 to-blue-50 rounded-t-xl">
            <CardTitle className="text-xl text-garden-green-dark font-bold">Analytics Snapshot</CardTitle>
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
