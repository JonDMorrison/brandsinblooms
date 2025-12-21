import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { 
  ArrowLeft, 
  Mail, 
  Phone, 
  MessageSquare, 
  Plus, 
  Download,
  Calendar,
  TrendingUp,
  MessageCircle,
  MailCheck,
  Zap,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { CustomerTimeline } from '@/components/crm/customer360/CustomerTimeline';
import { CustomerInsights } from '@/components/crm/customer360/CustomerInsights';
import { CustomerActivity } from '@/components/crm/customer360/CustomerActivity';
import { SendSMSDialog } from '@/components/crm/customer360/SendSMSDialog';
import { AddToSegmentDialog } from '@/components/crm/customer360/AddToSegmentDialog';
import { useCustomerCrossChannelMetrics } from '@/hooks/useCrossChannelMetrics';

interface Customer360Data {
  id: string;
  tenant_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
  
  // Identity metrics
  first_seen_at: string;
  last_seen_at: string;
  signup_source: string | null;
  signup_campaign: string | null;
  preferred_channel: string | null;
  city: string | null;
  state_region: string | null;
  postal_code: string | null;
  country_code: string | null;
  timezone: string | null;
  store_id: string | null;
  store_name: string | null;
  
  // Email metrics
  email_total_sent: number;
  email_total_delivered: number;
  email_total_opened: number;
  email_total_clicked: number;
  email_total_bounced: number;
  email_total_unsubscribes: number;
  email_open_rate: number;
  email_click_rate: number;
  email_bounce_rate: number;
  email_last_sent_at: string | null;
  email_last_opened_at: string | null;
  email_last_clicked_at: string | null;
  
  // SMS metrics
  sms_total_sent: number;
  sms_total_delivered: number;
  sms_total_clicked: number;
  sms_total_failed: number;
  sms_total_replied: number;
  sms_total_opt_outs: number;
  sms_delivery_rate: number;
  sms_click_rate: number;
  sms_reply_rate: number;
  sms_opt_out_rate: number;
  sms_avg_response_time_minutes: number;
  sms_engagement_score: number;
  sms_last_sent_at: string | null;
  sms_last_delivered_at: string | null;
  sms_last_clicked_at: string | null;
  sms_last_replied_at: string | null;
  sms_last_opt_out_at: string | null;
  
  // Engagement summary
  engagement_overall_score: number;
  engagement_email_score: number;
  engagement_sms_score: number;
  engagement_purchase_score: number;
  engagement_tier: string | null;
  engagement_last_calculated_at: string | null;
}

const Customer360Page = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showSendSMS, setShowSendSMS] = useState(false);
  const [showAddToSegment, setShowAddToSegment] = useState(false);

  // Fetch cross-channel metrics
  const { data: crossChannelMetrics } = useCustomerCrossChannelMetrics(id);

  // Fetch customer 360 data
  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer-360', id],
    queryFn: async () => {
      if (!id) throw new Error('Customer ID required');
      
      const { data, error } = await supabase
        .from('customer_360_enriched')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as Customer360Data;
    },
    enabled: !!id,
  });

  const getInitials = (firstName: string | null, lastName: string | null, email: string) => {
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    if (firstName) {
      return firstName.substring(0, 2).toUpperCase();
    }
    return email.substring(0, 2).toUpperCase();
  };

  const getFullName = (firstName: string | null, lastName: string | null) => {
    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    }
    if (firstName) {
      return firstName;
    }
    return 'Unknown Name';
  };

  const getEngagementTierColor = (tier: string | null) => {
    switch (tier) {
      case 'high':
        return 'bg-gradient-to-r from-emerald-500 to-green-500 text-white';
      case 'medium':
        return 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white';
      case 'low':
        return 'bg-gradient-to-r from-yellow-500 to-amber-500 text-white';
      case 'inactive':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const handleExportCustomer = async () => {
    if (!customer) return;
    
    const csvData = [
      ['Field', 'Value'],
      ['Name', getFullName(customer.first_name, customer.last_name)],
      ['Email', customer.email],
      ['Phone', customer.phone || ''],
      ['First Seen', customer.first_seen_at ? format(new Date(customer.first_seen_at), 'MMM dd, yyyy') : ''],
      ['Last Seen', customer.last_seen_at ? format(new Date(customer.last_seen_at), 'MMM dd, yyyy') : ''],
      ['Engagement Score', customer.engagement_overall_score.toString()],
      ['Engagement Tier', customer.engagement_tier || ''],
      ['Email Score', customer.engagement_email_score.toString()],
      ['SMS Score', customer.engagement_sms_score.toString()],
      ['SMS Sent', customer.sms_total_sent.toString()],
      ['SMS Delivered', customer.sms_total_delivered.toString()],
      ['SMS Delivery Rate', `${customer.sms_delivery_rate.toFixed(1)}%`],
      ['SMS Reply Rate', `${customer.sms_reply_rate.toFixed(1)}%`],
      ['Email Open Rate', `${customer.email_open_rate.toFixed(1)}%`],
      ['Email Click Rate', `${customer.email_click_rate.toFixed(1)}%`],
    ];

    const csv = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customer-${customer.email.replace('@', '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="container max-w-7xl mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-1/4" />
          <div className="h-32 bg-muted rounded" />
          <div className="h-96 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="container max-w-7xl mx-auto p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-4">Customer Not Found</h2>
          <p className="text-muted-foreground mb-6">
            The customer you're looking for doesn't exist or you don't have permission to view it.
          </p>
          <Button onClick={() => navigate('/crm/customers')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Customers
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/crm/customers')}
          className="h-8 w-8 p-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold">Customer Profile</h1>
      </div>

      {/* Customer Summary Card */}
      <Card className="mb-6">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-lg font-semibold">
                  {getInitials(customer.first_name, customer.last_name, customer.email)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-2xl font-bold">
                  {getFullName(customer.first_name, customer.last_name)}
                </h2>
                <div className="flex items-center gap-4 text-muted-foreground mt-1">
                  <div className="flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    <span className="text-sm">{customer.email}</span>
                  </div>
                  {customer.phone && (
                    <div className="flex items-center gap-1">
                      <Phone className="h-4 w-4" />
                      <span className="text-sm">{customer.phone}</span>
                    </div>
                  )}
                </div>
                {customer.first_seen_at && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Customer since {formatDistanceToNow(new Date(customer.first_seen_at), { addSuffix: true })}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {customer.phone && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSendSMS(true)}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Send SMS
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddToSegment(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add to Segment
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCustomer}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Engagement Score</p>
              <p className="text-2xl font-bold text-primary">
                {customer.engagement_overall_score.toFixed(0)}
              </p>
            </div>
            
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">SMS Sent</p>
              <p className="text-2xl font-bold">{customer.sms_total_sent}</p>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Engagement Tier</p>
              <Badge className={getEngagementTierColor(customer.engagement_tier)}>
                {customer.engagement_tier || 'Unknown'}
              </Badge>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">SMS Delivery Rate</p>
              <p className="text-2xl font-bold text-emerald-600">
                {customer.sms_delivery_rate.toFixed(1)}%
              </p>
            </div>
          </div>

          {customer.store_name && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="capitalize">
                  {customer.store_name}
                </Badge>
                <span className="text-sm text-muted-foreground">Store</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="engagement" className="space-y-6">
        <TabsList>
          <TabsTrigger value="engagement" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Engagement Metrics
          </TabsTrigger>
          <TabsTrigger value="timeline" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Timeline
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Messages & Automations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="engagement">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Cross-Channel Engagement Card */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Cross-Channel Engagement
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {/* Multi-Channel Score */}
                  <div className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg border border-primary/20">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      <p className="text-sm text-muted-foreground">Multi-Channel Score</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-2xl font-bold">
                        {crossChannelMetrics?.multi_channel_score?.toFixed(0) || 0}
                      </p>
                      <Progress 
                        value={Number(crossChannelMetrics?.multi_channel_score) || 0} 
                        className="h-2 flex-1"
                      />
                    </div>
                  </div>

                  {/* Preferred Channel */}
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      {crossChannelMetrics?.preferred_channel === 'email' ? (
                        <Mail className="h-4 w-4 text-blue-500" />
                      ) : crossChannelMetrics?.preferred_channel === 'sms' ? (
                        <MessageCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <Zap className="h-4 w-4 text-muted-foreground" />
                      )}
                      <p className="text-sm text-muted-foreground">Preferred Channel</p>
                    </div>
                    <p className="text-xl font-bold capitalize">
                      {crossChannelMetrics?.preferred_channel || 'Unknown'}
                    </p>
                  </div>

                  {/* Fatigue Status */}
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className={`h-4 w-4 ${
                        crossChannelMetrics?.fatigue_status === 'critical' ? 'text-red-500' :
                        crossChannelMetrics?.fatigue_status === 'high' ? 'text-orange-500' :
                        crossChannelMetrics?.fatigue_status === 'moderate' ? 'text-yellow-500' :
                        'text-green-500'
                      }`} />
                      <p className="text-sm text-muted-foreground">Fatigue Status</p>
                    </div>
                    <Badge variant={
                      crossChannelMetrics?.fatigue_status === 'critical' ? 'destructive' :
                      crossChannelMetrics?.fatigue_status === 'high' ? 'destructive' :
                      crossChannelMetrics?.fatigue_status === 'moderate' ? 'secondary' :
                      'outline'
                    } className="capitalize">
                      {crossChannelMetrics?.fatigue_status || 'None'}
                    </Badge>
                  </div>

                  {/* Last Engaged Channel */}
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Last Engaged</p>
                    </div>
                    <p className="text-xl font-bold capitalize">
                      {crossChannelMetrics?.last_engaged_channel || '-'}
                    </p>
                    {crossChannelMetrics?.last_engagement_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(crossChannelMetrics.last_engagement_at), { addSuffix: true })}
                      </p>
                    )}
                  </div>

                  {/* Days Since Last Engagement */}
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Days Inactive</p>
                    </div>
                    <p className="text-2xl font-bold">
                      {crossChannelMetrics?.days_since_last_engagement ?? '-'}
                    </p>
                  </div>
                </div>

                {/* Fatigue Details */}
                {(crossChannelMetrics?.email_fatigue_score ?? 0) > 0 || (crossChannelMetrics?.sms_fatigue_score ?? 0) > 0 ? (
                  <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-muted-foreground">Email Fatigue</span>
                        <span className="text-sm font-medium">{crossChannelMetrics?.email_fatigue_score ?? 0}%</span>
                      </div>
                      <Progress value={crossChannelMetrics?.email_fatigue_score ?? 0} className="h-2" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-muted-foreground">SMS Fatigue</span>
                        <span className="text-sm font-medium">{crossChannelMetrics?.sms_fatigue_score ?? 0}%</span>
                      </div>
                      <Progress value={crossChannelMetrics?.sms_fatigue_score ?? 0} className="h-2" />
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {/* SMS Engagement Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  SMS Engagement
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Sent</p>
                    <p className="text-xl font-bold">{customer.sms_total_sent}</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Delivered</p>
                    <p className="text-xl font-bold">{customer.sms_total_delivered}</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Clicked</p>
                    <p className="text-xl font-bold">{customer.sms_total_clicked}</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Replied</p>
                    <p className="text-xl font-bold">{customer.sms_total_replied}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    <p className="text-sm text-emerald-700 dark:text-emerald-300">Delivery Rate</p>
                    <p className="text-xl font-bold text-emerald-800 dark:text-emerald-200">{customer.sms_delivery_rate.toFixed(1)}%</p>
                  </div>
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-700 dark:text-blue-300">Reply Rate</p>
                    <p className="text-xl font-bold text-blue-800 dark:text-blue-200">{customer.sms_reply_rate.toFixed(1)}%</p>
                  </div>
                  <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
                    <p className="text-sm text-purple-700 dark:text-purple-300">Click Rate</p>
                    <p className="text-xl font-bold text-purple-800 dark:text-purple-200">{customer.sms_click_rate.toFixed(1)}%</p>
                  </div>
                  <div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg border border-orange-200 dark:border-orange-800">
                    <p className="text-sm text-orange-700 dark:text-orange-300">Avg Response</p>
                    <p className="text-xl font-bold text-orange-800 dark:text-orange-200">
                      {customer.sms_avg_response_time_minutes > 0 
                        ? `${customer.sms_avg_response_time_minutes.toFixed(0)} min` 
                        : '-'}
                    </p>
                  </div>
                </div>
                {customer.sms_total_opt_outs > 0 && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-700 dark:text-red-300">Opt-Out Rate</p>
                    <p className="text-xl font-bold text-red-800 dark:text-red-200">{customer.sms_opt_out_rate.toFixed(1)}%</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Email Engagement Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MailCheck className="h-5 w-5" />
                  Email Engagement
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Sent</p>
                    <p className="text-xl font-bold">{customer.email_total_sent}</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Opened</p>
                    <p className="text-xl font-bold">{customer.email_total_opened}</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Clicked</p>
                    <p className="text-xl font-bold">{customer.email_total_clicked}</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Bounced</p>
                    <p className="text-xl font-bold">{customer.email_total_bounced}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    <p className="text-sm text-emerald-700 dark:text-emerald-300">Open Rate</p>
                    <p className="text-xl font-bold text-emerald-800 dark:text-emerald-200">{customer.email_open_rate.toFixed(1)}%</p>
                  </div>
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-700 dark:text-blue-300">Click Rate</p>
                    <p className="text-xl font-bold text-blue-800 dark:text-blue-200">{customer.email_click_rate.toFixed(1)}%</p>
                  </div>
                </div>
                {customer.email_total_unsubscribes > 0 && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-700 dark:text-red-300">Unsubscribes</p>
                    <p className="text-xl font-bold text-red-800 dark:text-red-200">{customer.email_total_unsubscribes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="timeline">
          <CustomerTimeline customerId={customer.id} />
        </TabsContent>

        <TabsContent value="activity">
          <CustomerActivity customerId={customer.id} />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {showSendSMS && (
        <SendSMSDialog
          customer={customer}
          open={showSendSMS}
          onClose={() => setShowSendSMS(false)}
        />
      )}

      {showAddToSegment && (
        <AddToSegmentDialog
          customer={customer}
          open={showAddToSegment}
          onClose={() => setShowAddToSegment(false)}
        />
      )}
    </div>
  );
};

export default Customer360Page;
