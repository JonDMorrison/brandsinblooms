import React, { useState } from 'react';
import { SubscriptionGate } from '@/components/SubscriptionGate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  Mail, 
  Send,
  Calendar,
  Eye,
  MousePointerClick,
  UserMinus,
  Sparkles,
  Clock
} from 'lucide-react';

const CRMCampaigns = () => {
  const [activeTab, setActiveTab] = useState('all');

  const campaignTemplates = [
    {
      name: "Spring Garden Prep",
      description: "Help customers prepare their gardens for the growing season",
      subject: "🌱 Get Your Garden Spring-Ready!",
      openRate: "24%",
      category: "Seasonal"
    },
    {
      name: "New Customer Welcome",
      description: "Welcome new gardeners with essential tips and product recommendations",
      subject: "Welcome to [Garden Center Name] - Your Gardening Journey Starts Here!",
      openRate: "32%",
      category: "Welcome Series"
    },
    {
      name: "Plant Care Reminders",
      description: "Automated care tips based on previous purchases",
      subject: "Time to Care for Your [Plant Name]",
      openRate: "28%",
      category: "Care Tips"
    },
    {
      name: "Summer Watering Guide",
      description: "Essential watering tips for hot weather",
      subject: "Keep Your Plants Happy This Summer ☀️",
      openRate: "26%",
      category: "Seasonal"
    }
  ];

  return (
    <SubscriptionGate 
      requiredPlan="bloom" 
      feature="Email Campaigns"
    >
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Email Campaigns</h1>
            <p className="text-muted-foreground">
              Send targeted emails to nurture your garden center customers
            </p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Campaign
          </Button>
        </div>

        {/* Campaign Performance Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Sent</p>
                  <p className="text-2xl font-bold">0</p>
                </div>
                <Send className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Open Rate</p>
                  <p className="text-2xl font-bold">0%</p>
                </div>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Click Rate</p>
                  <p className="text-2xl font-bold">0%</p>
                </div>
                <MousePointerClick className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Unsubscribes</p>
                  <p className="text-2xl font-bold">0</p>
                </div>
                <UserMinus className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Campaign Templates */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Garden Center Email Templates
              </CardTitle>
              <Badge variant="outline">Industry Optimized</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {campaignTemplates.map((template, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h3 className="font-semibold text-foreground">{template.name}</h3>
                      <p className="text-sm text-muted-foreground">{template.description}</p>
                      <p className="text-xs text-muted-foreground font-medium">
                        Subject: "{template.subject}"
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <Badge variant="secondary">{template.category}</Badge>
                        <div className="text-xs text-muted-foreground mt-1">
                          {template.openRate} avg open rate
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        Use Template
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Campaign List */}
        <Card>
          <CardHeader>
            <CardTitle>Your Campaigns</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="all">All Campaigns</TabsTrigger>
                <TabsTrigger value="draft">Draft</TabsTrigger>
                <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
                <TabsTrigger value="sent">Sent</TabsTrigger>
              </TabsList>
              
              <TabsContent value={activeTab} className="mt-6">
                {/* Empty State */}
                <div className="text-center py-12">
                  <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No campaigns yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first email campaign using our garden center templates
                  </p>
                  <div className="flex justify-center gap-2">
                    <Button variant="outline">
                      <Sparkles className="h-4 w-4 mr-2" />
                      Browse Templates
                    </Button>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Campaign
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Campaign Best Practices */}
        <Card>
          <CardHeader>
            <CardTitle>Email Marketing for Garden Centers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  <h4 className="font-medium">Seasonal Timing</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Send spring prep emails in February, summer care in June
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <h4 className="font-medium">Perfect Timing</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Tuesday-Thursday mornings work best for garden center emails
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary" />
                  <h4 className="font-medium">Visual Content</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Include plant photos and before/after garden transformations
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </SubscriptionGate>
  );
};

export default CRMCampaigns;