import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Mail, 
  MessageCircle, 
  Share2,
  Globe,
  Download,
  Eye,
  MousePointer,
  DollarSign
} from "lucide-react";

const AnalyticsDashboard = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [dateRange, setDateRange] = useState("last_30d");

  // Mock data for KPIs
  const kpiData = {
    revenue: { value: "$12,450", change: "+15.2%", trend: "up" },
    customers: { value: "342", change: "+8.1%", trend: "up" },
    openRate: { value: "24.8%", change: "-2.3%", trend: "down" },
    clickRate: { value: "4.2%", change: "+0.8%", trend: "up" }
  };

  const GoalProgressTile = ({ title, value, change, trend, icon: Icon }) => (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            <p className={`text-sm ${trend === 'up' ? 'text-[hsl(var(--brand-teal))]' : 'text-red-600'} flex items-center gap-1`}>
              <TrendingUp className={`w-3 h-3 ${trend === 'down' ? 'rotate-180' : ''}`} />
              {change}
            </p>
          </div>
          <div className={`p-3 rounded-full ${trend === 'up' ? 'bg-slate-50' : 'bg-slate-100'}`}>
            <Icon className={`w-6 h-6 ${trend === 'up' ? 'text-[hsl(var(--brand-teal))]' : 'text-[hsl(var(--brand-navy))]'}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const ComingSoonStrip = () => (
    <Card className="bg-gradient-to-r from-gray-50 to-gray-100 border-dashed">
      <CardContent className="p-6 text-center">
        <Globe className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <h3 className="font-semibold text-gray-600 mb-1">Website Analytics Coming Soon</h3>
        <p className="text-sm text-gray-500 mb-3">
          Track visitor behavior, conversion rates, and traffic sources
        </p>
        <Badge variant="outline" className="bg-white">
          In Development
        </Badge>
      </CardContent>
    </Card>
  );

  const EmailPerformanceTable = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="w-5 h-5" />
          Email Campaign Performance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {[
            { name: "Spring Garden Newsletter", sent: "1,250", opened: "312", clicked: "45", date: "2024-03-15" },
            { name: "Plant Care Tips", sent: "890", opened: "234", clicked: "32", date: "2024-03-12" },
            { name: "Weekly Promotion", sent: "1,100", opened: "198", clicked: "28", date: "2024-03-10" }
          ].map((campaign, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b last:border-b-0">
              <div>
                <p className="font-medium">{campaign.name}</p>
                <p className="text-sm text-muted-foreground">{campaign.date}</p>
              </div>
              <div className="flex gap-4 text-sm">
                <span>Sent: {campaign.sent}</span>
                <span>Opened: {campaign.opened}</span>
                <span>Clicked: {campaign.clicked}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  const SocialEngagementCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[
        { platform: "Facebook", posts: 12, reach: "2.4K", engagement: "8.2%" },
        { platform: "Instagram", posts: 18, reach: "3.1K", engagement: "12.5%" },
        { platform: "Twitter", posts: 24, reach: "1.2K", engagement: "6.1%" }
      ].map((social, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{social.platform}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Posts</span>
                <span className="font-medium">{social.posts}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Reach</span>
                <span className="font-medium">{social.reach}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Engagement</span>
                <span className="font-medium">{social.engagement}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-brand-navy">Business Insights</h1>
            <p className="text-gray-600">Performance across every channel in one place</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* KPI Header Bar */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <GoalProgressTile
            title="Total Revenue"
            value={kpiData.revenue.value}
            change={kpiData.revenue.change}
            trend={kpiData.revenue.trend}
            icon={DollarSign}
          />
          <GoalProgressTile
            title="New Customers"
            value={kpiData.customers.value}
            change={kpiData.customers.change}
            trend={kpiData.customers.trend}
            icon={Users}
          />
          <GoalProgressTile
            title="Email Open Rate"
            value={kpiData.openRate.value}
            change={kpiData.openRate.change}
            trend={kpiData.openRate.trend}
            icon={Eye}
          />
          <GoalProgressTile
            title="Click Through Rate"
            value={kpiData.clickRate.value}
            change={kpiData.clickRate.change}
            trend={kpiData.clickRate.trend}
            icon={MousePointer}
          />
        </div>

        {/* Channel Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="email" className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Email
            </TabsTrigger>
            <TabsTrigger value="sms" className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              SMS
            </TabsTrigger>
            <TabsTrigger value="social" className="flex items-center gap-2">
              <Share2 className="w-4 h-4" />
              Social
            </TabsTrigger>
            <TabsTrigger value="crm" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              CRM
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <EmailPerformanceTable />
              <Card>
                <CardHeader>
                  <CardTitle>Customer Growth</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[200px] flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <BarChart3 className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      <p>Customer acquisition chart coming soon</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            <ComingSoonStrip />
          </TabsContent>

          <TabsContent value="email" className="space-y-6">
            <EmailPerformanceTable />
            <Card>
              <CardHeader>
                <CardTitle>Email Engagement Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <Mail className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>Email analytics chart coming soon</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sms" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5" />
                  SMS Campaign Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <MessageCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500 mb-4">No SMS campaigns sent yet</p>
                  <Button variant="outline">Create SMS Campaign</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="social" className="space-y-6">
            <SocialEngagementCards />
          </TabsContent>

          <TabsContent value="crm" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Customer Segments</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { name: "Regular Customers", count: 156, growth: "+12%" },
                      { name: "New Customers", count: 89, growth: "+24%" },
                      { name: "VIP Customers", count: 34, growth: "+8%" }
                    ].map((segment, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="font-medium">{segment.name}</span>
                        <div className="flex items-center gap-2">
                          <span>{segment.count}</span>
                          <Badge variant="outline" className="text-green-600">
                            {segment.growth}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Revenue by Customer Type</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[200px] flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <Users className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      <p>Revenue breakdown chart coming soon</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

      </div>
    </div>
  );
};

export default AnalyticsDashboard;