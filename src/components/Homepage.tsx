
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, 
  Plus, 
  Edit, 
  Instagram, 
  Facebook, 
  Mail, 
  ArrowRight,
  Bell,
  Upload,
  BarChart3
} from "lucide-react";

interface HomepageProps {
  onboardingData: any;
  onNavigateToKanban: () => void;
  onTaskClick: (task: any) => void;
}

export const Homepage = ({ onboardingData, onNavigateToKanban, onTaskClick }: HomepageProps) => {
  // Mock data - in real app this would come from Supabase
  const currentUser = "Marketing Team";
  const currentWeek = 24;
  
  const thisWeeksCampaign = {
    id: 1,
    week_number: currentWeek,
    title: "Summer Herb Workshop",
    scheduled_date: "2024-06-10",
    ai_output: "🌿 Join us this Saturday for our Summer Herb Workshop! Learn to grow basil, rosemary, and thyme in your own garden. Perfect for beginners and seasoned gardeners alike. Workshop includes starter plants and take-home guide. #HerbGardening #SummerWorkshop #GardenLife"
  };

  const workflowPreview = {
    generating: [
      { id: 1, title: "Father's Day Plant Sale", type: "instagram" },
      { id: 2, title: "Watering Tips Blog", type: "email" }
    ],
    review: [
      { id: 3, title: "Summer Care Guide", type: "facebook" },
      { id: 4, title: "New Arrivals Post", type: "instagram" }
    ],
    scheduled: [
      { id: 5, title: "Weekly Newsletter", type: "email" },
      { id: 6, title: "Weekend Hours Update", type: "facebook" }
    ]
  };

  const notifications = [
    "Week 23's Instagram post needs approval",
    "Summer plant inventory photos ready for upload"
  ];

  const getSeasonalGreeting = () => {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return "🌸 Spring is in full bloom!";
    if (month >= 5 && month <= 7) return "☀️ Summer growing season is here!";
    if (month >= 8 && month <= 10) return "🍂 Fall planting time!";
    return "❄️ Winter planning season!";
  };

  const copyToClipboard = (text: string, platform: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* Welcome Section */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-green-800">
          Welcome back, {currentUser} 👋
        </h1>
        <p className="text-lg text-green-600">
          Here's what's happening this week at your garden center.
        </p>
        <p className="text-green-500 font-medium">{getSeasonalGreeting()}</p>
      </div>

      {/* This Week's Campaign Card */}
      <Card className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-800">
            <Calendar className="w-6 h-6" />
            This Week's Campaign - Week {currentWeek}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              {thisWeeksCampaign.title}
            </h3>
            <Badge variant="outline" className="text-green-700 border-green-300 mb-3">
              Scheduled for {new Date(thisWeeksCampaign.scheduled_date).toLocaleDateString()}
            </Badge>
            <p className="text-gray-700 bg-white p-4 rounded-lg border border-green-100">
              {thisWeeksCampaign.ai_output}
            </p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <Button 
              variant="outline" 
              onClick={() => onTaskClick(thisWeeksCampaign)}
              className="flex items-center gap-2"
            >
              <Edit className="w-4 h-4" />
              Edit Content
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => copyToClipboard(thisWeeksCampaign.ai_output, "Instagram")}
            >
              <Instagram className="w-4 h-4 mr-1" />
              Copy for Instagram
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => copyToClipboard(thisWeeksCampaign.ai_output, "Facebook")}
            >
              <Facebook className="w-4 h-4 mr-1" />
              Copy for Facebook
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => copyToClipboard(thisWeeksCampaign.ai_output, "Email")}
            >
              <Mail className="w-4 h-4 mr-1" />
              Copy for Email
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Workflow Board Preview */}
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-blue-800">
              <span className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Your Content Workflow
              </span>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={onNavigateToKanban}
                className="text-blue-600 hover:text-blue-800"
              >
                Go to Full Board <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium text-blue-600 text-sm">Generating</h4>
                {workflowPreview.generating.slice(0, 2).map((item) => (
                  <div key={item.id} className="p-2 bg-blue-50 rounded border border-blue-200">
                    <p className="text-xs font-medium text-gray-800">{item.title}</p>
                    <Badge variant="secondary" className="text-xs mt-1">
                      {item.type}
                    </Badge>
                  </div>
                ))}
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium text-yellow-600 text-sm">Review</h4>
                {workflowPreview.review.slice(0, 2).map((item) => (
                  <div key={item.id} className="p-2 bg-yellow-50 rounded border border-yellow-200">
                    <p className="text-xs font-medium text-gray-800">{item.title}</p>
                    <Badge variant="secondary" className="text-xs mt-1">
                      {item.type}
                    </Badge>
                  </div>
                ))}
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium text-green-600 text-sm">Scheduled</h4>
                {workflowPreview.scheduled.slice(0, 2).map((item) => (
                  <div key={item.id} className="p-2 bg-green-50 rounded border border-green-200">
                    <p className="text-xs font-medium text-gray-800">{item.title}</p>
                    <Badge variant="secondary" className="text-xs mt-1">
                      {item.type}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications & Actions */}
        <div className="space-y-4">
          {/* Notifications */}
          <Card className="border-orange-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-800">
                <Bell className="w-5 h-5" />
                Action Reminders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {notifications.map((notification, index) => (
                  <div key={index} className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <p className="text-sm text-orange-800">{notification}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="border-purple-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-800">
                <Plus className="w-5 h-5" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button className="w-full justify-start bg-purple-600 hover:bg-purple-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Create a Custom Campaign
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Photos or Tone Samples
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Calendar className="w-4 h-4 mr-2" />
                  Submit a New Event
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Analytics Snapshot - Future Phase */}
      <Card className="border-gray-200 bg-gray-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-600">
            <BarChart3 className="w-5 h-5" />
            Analytics Snapshot
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">Coming Soon: Performance insights and analytics</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-400">
              <div className="p-4 bg-white rounded border border-gray-200">
                <p className="font-medium">Top Performing Post</p>
                <p>Track your best content</p>
              </div>
              <div className="p-4 bg-white rounded border border-gray-200">
                <p className="font-medium">Most Used Hashtags</p>
                <p>Optimize your reach</p>
              </div>
              <div className="p-4 bg-white rounded border border-gray-200">
                <p className="font-medium">Engagement Trends</p>
                <p>Monitor performance</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
