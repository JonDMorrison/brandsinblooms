import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MessageSquare, Eye, MousePointer, TrendingUp, Users, DollarSign } from "lucide-react";

interface SMSCampaign {
  id: string;
  name: string;
  message: string;
  image_url: string | null;
  status: string;
  scheduled_at: string | null;
  sent_at: string | null;
  metrics: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    unsubscribed: number;
    revenue: number;
  };
  created_at: string;
}

const SMSCampaignDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: campaign, isLoading } = useQuery({
    queryKey: ['sms-campaign', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_sms_campaigns')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return {
        ...data,
        metrics: data.metrics as any || {
          sent: 0,
          delivered: 0,
          opened: 0,
          clicked: 0,
          bounced: 0,
          unsubscribed: 0,
          revenue: 0,
        }
      } as SMSCampaign;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  if (!campaign) {
    return <div className="text-center">SMS Campaign not found</div>;
  }

  const metrics = campaign.metrics || {
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    unsubscribed: 0,
    revenue: 0,
  };

  const deliveryRate = metrics.sent > 0 ? (metrics.delivered / metrics.sent * 100).toFixed(1) : '0.0';
  const clickRate = metrics.delivered > 0 ? (metrics.clicked / metrics.delivered * 100).toFixed(1) : '0.0';

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/crm/sms-campaigns')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to SMS Campaigns
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{campaign.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={campaign.status === 'sent' ? 'default' : 'secondary'}>
                {campaign.status}
              </Badge>
              {campaign.sent_at && (
                <span className="text-sm text-muted-foreground">
                  Sent {new Date(campaign.sent_at).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Campaign Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>SMS Campaign Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Message</label>
              <div className="mt-1 p-3 bg-muted rounded-md">
                <p className="whitespace-pre-wrap">{campaign.message}</p>
              </div>
            </div>
            {campaign.image_url && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Attached Image</label>
                <div className="mt-1">
                  <img 
                    src={campaign.image_url} 
                    alt="Campaign attachment" 
                    className="max-w-full h-32 object-cover rounded-md border"
                  />
                </div>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-muted-foreground">Created</label>
              <p className="mt-1">{new Date(campaign.created_at).toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        {/* Key Metrics Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Key Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-primary">{deliveryRate}%</div>
                <div className="text-sm text-muted-foreground">Delivery Rate</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-secondary">{clickRate}%</div>
                <div className="text-sm text-muted-foreground">Click Rate</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-green-600">${metrics.revenue.toFixed(2)}</div>
                <div className="text-sm text-muted-foreground">Revenue</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold">{metrics.sent}</div>
                <div className="text-sm text-muted-foreground">Total Sent</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Messages Sent</p>
                <p className="text-2xl font-bold">{metrics.sent}</p>
              </div>
              <MessageSquare className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Delivered</p>
                <p className="text-2xl font-bold">{metrics.delivered}</p>
              </div>
              <Users className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Clicked</p>
                <p className="text-2xl font-bold">{metrics.clicked}</p>
              </div>
              <MousePointer className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Opt-outs</p>
                <p className="text-2xl font-bold">{metrics.unsubscribed}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold">{metrics.bounced}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Revenue</p>
                <p className="text-2xl font-bold">${metrics.revenue.toFixed(2)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SMSCampaignDetails;