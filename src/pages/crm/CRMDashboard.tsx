import React, { useState, useEffect } from 'react';
import { SubscriptionGate } from '@/components/SubscriptionGate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Users, Mail, Target, TrendingUp, MessageSquare, AlertCircle, BarChart3, Eye, MousePointerClick, UserMinus, Smartphone, CheckCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSubscription } from '@/hooks/useSubscription';
import { Link } from 'react-router-dom';

const CRMDashboard = () => {
  const { subscription } = useSubscription();
  const [customerStats, setCustomerStats] = useState({
    total: 0,
    smsOptedIn: 0,
    smsOptInRate: 0
  });

  const [campaignStats, setCampaignStats] = useState({
    email: {
      totalSent: 0,
      campaignCount: 0,
      avgOpenRate: 0,
      avgClickRate: 0,
      totalUnsubscribes: 0
    },
    sms: {
      totalSent: 0,
      campaignCount: 0,
      deliveryRate: 0,
      clickRate: 0,
      totalOptOuts: 0
    }
  });

  useEffect(() => {
    fetchCustomerStats();
    fetchCampaignStats();
  }, []);

  const fetchCustomerStats = async () => {
    try {
      const { data: customers, error } = await supabase
        .from('crm_customers')
        .select('sms_opt_in');

      if (error) throw error;

      const total = customers?.length || 0;
      const smsOptedIn = customers?.filter(c => c.sms_opt_in).length || 0;
      const smsOptInRate = total > 0 ? (smsOptedIn / total) * 100 : 0;

      setCustomerStats({
        total,
        smsOptedIn,
        smsOptInRate
      });
    } catch (error) {
      console.error('Error fetching customer stats:', error);
    }
  };

  const fetchCampaignStats = async () => {
    try {
      // Get 30 days ago
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoString = thirtyDaysAgo.toISOString();

      // Fetch email campaigns
      const { data: emailCampaigns, error: emailError } = await supabase
        .from('crm_campaigns')
        .select('metrics')
        .not('sent_at', 'is', null)
        .gte('sent_at', thirtyDaysAgoString);

      if (emailError) throw emailError;

      // Fetch SMS campaigns
      const { data: smsCampaigns, error: smsError } = await supabase
        .from('crm_sms_campaigns')
        .select('metrics')
        .not('sent_at', 'is', null)
        .gte('sent_at', thirtyDaysAgoString);

      if (smsError) throw smsError;

      // Calculate email stats
      let emailTotalSent = 0;
      let emailTotalOpens = 0;
      let emailTotalClicks = 0;
      let emailTotalUnsubscribes = 0;

      emailCampaigns?.forEach(campaign => {
        if (campaign.metrics && typeof campaign.metrics === 'object') {
          const metrics = campaign.metrics as any;
          emailTotalSent += metrics.sent || 0;
          emailTotalOpens += metrics.opens || 0;
          emailTotalClicks += metrics.clicks || 0;
          emailTotalUnsubscribes += metrics.unsubscribes || 0;
        }
      });

      const emailAvgOpenRate = emailTotalSent > 0 ? (emailTotalOpens / emailTotalSent) * 100 : 0;
      const emailAvgClickRate = emailTotalSent > 0 ? (emailTotalClicks / emailTotalSent) * 100 : 0;

      // Calculate SMS stats
      let smsTotalSent = 0;
      let smsTotalDelivered = 0;
      let smsTotalClicks = 0;
      let smsTotalOptOuts = 0;

      smsCampaigns?.forEach(campaign => {
        if (campaign.metrics && typeof campaign.metrics === 'object') {
          const metrics = campaign.metrics as any;
          smsTotalSent += metrics.messages_sent || 0;
          smsTotalDelivered += metrics.delivered || 0;
          smsTotalClicks += metrics.clicks || 0;
          smsTotalOptOuts += metrics.opt_outs || 0;
        }
      });

      const smsDeliveryRate = smsTotalSent > 0 ? (smsTotalDelivered / smsTotalSent) * 100 : 0;
      const smsClickRate = smsTotalSent > 0 ? (smsTotalClicks / smsTotalSent) * 100 : 0;

      setCampaignStats({
        email: {
          totalSent: emailTotalSent,
          campaignCount: emailCampaigns?.length || 0,
          avgOpenRate: emailAvgOpenRate,
          avgClickRate: emailAvgClickRate,
          totalUnsubscribes: emailTotalUnsubscribes
        },
        sms: {
          totalSent: smsTotalSent,
          campaignCount: smsCampaigns?.length || 0,
          deliveryRate: smsDeliveryRate,
          clickRate: smsClickRate,
          totalOptOuts: smsTotalOptOuts
        }
      });
    } catch (error) {
      console.error('Error fetching campaign stats:', error);
    }
  };

  const showSMSNudge = customerStats.total > 0 && customerStats.smsOptInRate < 25;

  return (
    <SubscriptionGate 
      requiredPlan="bloom" 
      feature="CRM Dashboard"
    >
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">CRM Dashboard</h1>
            <p className="text-muted-foreground">
              Manage your garden center customers with targeted campaigns and segmentation
            </p>
          </div>
        </div>

        {/* SMS Opt-in Nudge */}
        {showSMSNudge && (
          <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
            <CardContent className="p-6">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-6 w-6 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-orange-900 dark:text-orange-100">
                    🧑‍🌾 {Math.round(100 - customerStats.smsOptInRate)}% of your customers aren't opted in for SMS
                  </h3>
                  <p className="text-orange-700 dark:text-orange-200 mt-1">
                    Send a signup message or add opt-in prompts to your forms to grow your SMS list.
                  </p>
                  <div className="mt-3 flex items-center space-x-3">
                    <Button asChild size="sm">
                      <Link to="/crm/sms-campaigns/new?template=invite">
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Create SMS Invite Campaign
                      </Link>
                    </Button>
                    <span className="text-sm text-orange-600 dark:text-orange-300">
                      {customerStats.smsOptedIn} of {customerStats.total} customers opted in
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{customerStats.total}</div>
              <p className="text-xs text-muted-foreground">
                Active in your database
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">SMS Opt-ins</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{customerStats.smsOptedIn}</div>
              <p className="text-xs text-muted-foreground">
                {customerStats.smsOptInRate.toFixed(1)}% opt-in rate
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Segments</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">
                Create your first segment
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Email Campaigns</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{campaignStats.email.campaignCount}</div>
              <p className="text-xs text-muted-foreground">
                {campaignStats.email.campaignCount > 0 ? `${campaignStats.email.totalSent} emails sent` : 'Send your first campaign'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {campaignStats.email.totalSent > 0 ? `${campaignStats.email.avgOpenRate.toFixed(1)}%` : '0%'}
              </div>
              <p className="text-xs text-muted-foreground">
                {campaignStats.email.totalSent > 0 ? 'Average across campaigns' : 'No campaigns sent yet'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Usage Tracking */}
        {(subscription?.crm_enabled || subscription?.sms_enabled) && (
          <Card>
            <CardHeader>
              <CardTitle>Monthly Usage</CardTitle>
              <p className="text-sm text-muted-foreground">
                Track your email and SMS quota usage this month
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {subscription?.crm_enabled && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Mail className="h-4 w-4 text-blue-600" />
                        <span className="font-medium">Emails Used</span>
                      </div>
                      <span className="text-sm font-medium">
                        {subscription.email_usage || 0} / {subscription.email_quota || 1000}
                      </span>
                    </div>
                     <Progress 
                      value={((subscription.email_usage || 0) / (subscription.email_quota || 1000)) * 100} 
                      className="h-3"
                      indicatorClassName={
                        ((subscription.email_usage || 0) / (subscription.email_quota || 1000)) * 100 >= 90
                          ? "bg-red-500" 
                          : ((subscription.email_usage || 0) / (subscription.email_quota || 1000)) * 100 >= 70
                          ? "bg-yellow-500"
                          : "bg-green-500"
                      }
                    />
                     {((subscription.email_usage || 0) / (subscription.email_quota || 1000)) * 100 >= 90 && (
                      <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                        <div className="flex items-center space-x-2 text-red-700 mb-3">
                          <AlertTriangle className="h-5 w-5" />
                          <span className="font-medium">
                            {(subscription.email_usage || 0) >= (subscription.email_quota || 1000) 
                              ? "You've reached your monthly email limit" 
                              : "You're close to your monthly email limit"}
                          </span>
                        </div>
                        <p className="text-red-600 text-sm mb-3">
                          {(subscription.email_usage || 0) >= (subscription.email_quota || 1000)
                            ? "Please upgrade to continue sending emails."
                            : "You've connected with hundreds of gardeners this month! Upgrade your quota or pause sending."}
                        </p>
                        <div className="flex space-x-3">
                          <Button size="sm" asChild>
                            <Link to="/settings/billing">Upgrade Plan</Link>
                          </Button>
                          <Button variant="outline" size="sm">Contact Support</Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {subscription?.sms_enabled && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <MessageSquare className="h-4 w-4 text-green-600" />
                        <span className="font-medium">SMS Sent</span>
                      </div>
                      <span className="text-sm font-medium">
                        {subscription.sms_usage || 0} / {subscription.sms_quota || 250}
                      </span>
                    </div>
                     <Progress 
                      value={((subscription.sms_usage || 0) / (subscription.sms_quota || 250)) * 100} 
                      className="h-3"
                      indicatorClassName={
                        ((subscription.sms_usage || 0) / (subscription.sms_quota || 250)) * 100 >= 90
                          ? "bg-red-500" 
                          : ((subscription.sms_usage || 0) / (subscription.sms_quota || 250)) * 100 >= 70
                          ? "bg-yellow-500"
                          : "bg-green-500"
                      }
                    />
                     {((subscription.sms_usage || 0) / (subscription.sms_quota || 250)) * 100 >= 90 && (
                      <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                        <div className="flex items-center space-x-2 text-red-700 mb-3">
                          <AlertTriangle className="h-5 w-5" />
                          <span className="font-medium">
                            {(subscription.sms_usage || 0) >= (subscription.sms_quota || 250) 
                              ? "You've reached your monthly SMS limit" 
                              : "You're close to your monthly SMS limit"}
                          </span>
                        </div>
                        <p className="text-red-600 text-sm mb-3">
                          {(subscription.sms_usage || 0) >= (subscription.sms_quota || 250)
                            ? "Please upgrade to continue sending SMS messages."
                            : "You've reached out to so many customers this month! Upgrade your quota or pause sending."}
                        </p>
                        <div className="flex space-x-3">
                          <Button size="sm" asChild>
                            <Link to="/settings/billing">Upgrade Plan</Link>
                          </Button>
                          <Button variant="outline" size="sm">Contact Support</Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Performance Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              Performance Summary (Last 30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Email Campaign Performance */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold flex items-center">
                    <Mail className="h-5 w-5 mr-2 text-blue-600" />
                    Email Campaigns
                  </h3>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/crm/campaigns">View Details</Link>
                  </Button>
                </div>
                
                {campaignStats.email.campaignCount > 0 ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-muted/50 p-4 rounded-lg text-center">
                      <div className="text-2xl font-bold text-primary">
                        {campaignStats.email.totalSent}
                      </div>
                      <div className="text-sm text-muted-foreground">Emails Sent</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {campaignStats.email.campaignCount} campaigns
                      </div>
                    </div>
                    <div className="bg-muted/50 p-4 rounded-lg text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {campaignStats.email.avgOpenRate.toFixed(1)}%
                      </div>
                      <div className="text-sm text-muted-foreground">Avg Open Rate</div>
                    </div>
                    <div className="bg-muted/50 p-4 rounded-lg text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {campaignStats.email.avgClickRate.toFixed(1)}%
                      </div>
                      <div className="text-sm text-muted-foreground">Avg Click Rate</div>
                    </div>
                    <div className="bg-muted/50 p-4 rounded-lg text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {campaignStats.email.totalUnsubscribes}
                      </div>
                      <div className="text-sm text-muted-foreground">Unsubscribes</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2">📈 No email campaigns sent yet</p>
                    <p className="mb-4">Create your first campaign to see performance metrics</p>
                    <Button asChild>
                      <Link to="/crm/campaigns/new">
                        <Mail className="h-4 w-4 mr-2" />
                        Create Email Campaign
                      </Link>
                    </Button>
                  </div>
                )}
              </div>

              {/* SMS Campaign Performance */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold flex items-center">
                    <Smartphone className="h-5 w-5 mr-2 text-green-600" />
                    SMS Campaigns
                  </h3>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/crm/sms-campaigns">View Details</Link>
                  </Button>
                </div>
                
                {campaignStats.sms.campaignCount > 0 ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-muted/50 p-4 rounded-lg text-center">
                      <div className="text-2xl font-bold text-primary">
                        {campaignStats.sms.totalSent}
                      </div>
                      <div className="text-sm text-muted-foreground">SMS Sent</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {campaignStats.sms.campaignCount} campaigns
                      </div>
                    </div>
                    <div className="bg-muted/50 p-4 rounded-lg text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {campaignStats.sms.deliveryRate.toFixed(1)}%
                      </div>
                      <div className="text-sm text-muted-foreground">Delivery Rate</div>
                    </div>
                    <div className="bg-muted/50 p-4 rounded-lg text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {campaignStats.sms.clickRate.toFixed(1)}%
                      </div>
                      <div className="text-sm text-muted-foreground">Click Rate</div>
                    </div>
                    <div className="bg-muted/50 p-4 rounded-lg text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {campaignStats.sms.totalOptOuts}
                      </div>
                      <div className="text-sm text-muted-foreground">Opt-outs</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2">💬 SMS delivery success rate: Ready to start</p>
                    <p className="mb-4">Send your first SMS campaign to track delivery metrics</p>
                    <Button asChild>
                      <Link to="/crm/sms-campaigns/new">
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Create SMS Campaign
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Getting Started Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Start Guide</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium">1. Import Your Customers</h4>
                <p className="text-sm text-muted-foreground">
                  Upload your customer list or add customers manually to get started
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">2. Create Customer Segments</h4>
                <p className="text-sm text-muted-foreground">
                  Group customers by persona: Newbie, Struggler, Regular, or Expert
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">3. Send Your First Campaign</h4>
                <p className="text-sm text-muted-foreground">
                  Use our garden center templates to create targeted emails
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Garden Center CRM Features</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium">Customer Personas</h4>
                <p className="text-sm text-muted-foreground">
                  Pre-built segments for different gardening skill levels
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Seasonal Campaigns</h4>
                <p className="text-sm text-muted-foreground">
                  Templates for spring prep, summer care, and fall cleanup
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Plant Care Automation</h4>
                <p className="text-sm text-muted-foreground">
                  Triggered emails based on purchase history and plant care needs
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </SubscriptionGate>
  );
};

export default CRMDashboard;