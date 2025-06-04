
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, ArrowRight, Bell, Plus, Upload, FileText, BarChart3, Instagram, Facebook, Mail, Copy, Edit, CheckCircle, XCircle } from "lucide-react";

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
    if (month >= 3 && month <= 5) return "🌸 Spring is here!";
    if (month >= 6 && month <= 8) return "☀️ Summer vibes!";
    if (month >= 9 && month <= 11) return "🍂 Fall beauty!";
    return "❄️ Winter magic!";
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Welcome Section */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-green-800 mb-2">
            Welcome back! {getSeasonalGreeting()}
          </h1>
          <p className="text-xl text-green-600">
            Here's what's happening this week at your garden center
          </p>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* This Week's Campaign - Spans 2 columns on large screens */}
          <div className="lg:col-span-2">
            <Card className="shadow-xl border-green-200">
              <CardHeader className="bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-t-lg">
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Calendar className="w-6 h-6" />
                  This Week's Campaign
                </CardTitle>
                <CardDescription className="text-green-100">
                  {currentCampaign ? currentCampaign.title : "No active campaign"}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                {currentCampaign ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Week {currentCampaign.week_number}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {new Date(currentCampaign.start_date).toLocaleDateString()}
                      </span>
                    </div>
                    
                    {campaignTasks.length > 0 ? (
                      <div className="space-y-3">
                        {campaignTasks.map((task) => (
                          <div key={task.id} className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer" onClick={() => onTaskClick(task)}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {getPostTypeIcon(task.post_type)}
                                <span className="font-medium capitalize">{task.post_type}</span>
                                <Badge className={getStatusColor(task.status)}>
                                  {task.status}
                                </Badge>
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline">
                                  <Edit className="w-3 h-3 mr-1" />
                                  Edit
                                </Button>
                                <Button size="sm" variant="outline">
                                  <Copy className="w-3 h-3 mr-1" />
                                  Copy
                                </Button>
                              </div>
                            </div>
                            {task.ai_output && (
                              <p className="text-sm text-gray-700 line-clamp-2">{task.ai_output}</p>
                            )}
                            {task.scheduled_date && (
                              <p className="text-xs text-gray-500 mt-2">
                                Scheduled: {new Date(task.scheduled_date).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No content tasks for this campaign yet</p>
                        <Button className="mt-4 bg-green-600 hover:bg-green-700">
                          <Plus className="w-4 h-4 mr-2" />
                          Create First Task
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No active campaigns found</p>
                    <Button className="mt-4 bg-green-600 hover:bg-green-700">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Campaign
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="space-y-6">
            {/* Notifications */}
            {overdueTasks.length > 0 && (
              <Card className="shadow-lg border-orange-200">
                <CardHeader className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-t-lg">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Bell className="w-5 h-5" />
                    Action Required
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    {overdueTasks.slice(0, 3).map((task) => (
                      <div key={task.id} className="text-sm">
                        <p className="font-medium text-orange-700">
                          {task.campaigns?.title} - {task.post_type}
                        </p>
                        <p className="text-orange-600">
                          Due: {new Date(task.scheduled_date).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                    {overdueTasks.length > 3 && (
                      <p className="text-xs text-orange-600">
                        +{overdueTasks.length - 3} more overdue
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Add Panel */}
            <Card className="shadow-lg border-green-200">
              <CardHeader>
                <CardTitle className="text-lg text-green-800">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <Button className="w-full bg-green-600 hover:bg-green-700 justify-start">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Custom Campaign
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Photos
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="w-4 h-4 mr-2" />
                  Submit New Event
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Workflow Preview */}
        <Card className="shadow-xl border-green-200">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-2xl text-green-800 flex items-center gap-2">
                  <BarChart3 className="w-6 h-6" />
                  Content Workflow
                </CardTitle>
                <CardDescription>Your content pipeline at a glance</CardDescription>
              </div>
              <Button onClick={onNavigateToKanban} className="bg-green-600 hover:bg-green-700">
                Go to Full Board
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {['generating', 'review', 'scheduled'].map((status) => {
                const statusTasks = getTasksByStatus(status);
                return (
                  <div key={status} className="space-y-3">
                    <h3 className="font-semibold text-gray-700 capitalize flex items-center gap-2">
                      {status === 'generating' && <div className="w-3 h-3 rounded-full bg-blue-500"></div>}
                      {status === 'review' && <div className="w-3 h-3 rounded-full bg-yellow-500"></div>}
                      {status === 'scheduled' && <div className="w-3 h-3 rounded-full bg-green-500"></div>}
                      {status} ({statusTasks.length})
                    </h3>
                    <div className="space-y-2">
                      {statusTasks.map((task) => (
                        <div
                          key={task.id}
                          className="p-3 bg-white border rounded-lg hover:shadow-md cursor-pointer transition-shadow"
                          onClick={() => onTaskClick(task)}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            {getPostTypeIcon(task.post_type)}
                            <span className="text-sm font-medium">{task.campaigns?.title}</span>
                          </div>
                          <p className="text-xs text-gray-600 capitalize">{task.post_type}</p>
                          {task.scheduled_date && (
                            <p className="text-xs text-gray-500">
                              {new Date(task.scheduled_date).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      ))}
                      {statusTasks.length === 0 && (
                        <div className="p-3 border-2 border-dashed border-gray-200 rounded-lg text-center">
                          <p className="text-sm text-gray-400">No tasks</p>
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
        <Card className="shadow-lg border-green-200">
          <CardHeader>
            <CardTitle className="text-xl text-green-800">Analytics Snapshot</CardTitle>
            <CardDescription>Coming soon - track your marketing performance</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-400">--</p>
                <p className="text-sm text-gray-600">Top Performing Post</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-400">--</p>
                <p className="text-sm text-gray-600">Most Used Hashtags</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-400">--</p>
                <p className="text-sm text-gray-600">Campaign Success Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
