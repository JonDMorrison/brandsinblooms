import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Copy, Users, Calendar, Send, MessageSquare, Image } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface SMSCampaignDetail {
  id: string;
  name: string;
  message: string;
  image_url: string | null;
  status: string;
  created_at: string;
  scheduled_at: string | null;
  sent_at: string | null;
  segment_id: string | null;
  metrics: any;
  crm_segments?: {
    name: string;
    customer_count: number;
  };
}

export default function CRMSMSCampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<SMSCampaignDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (id) {
      fetchCampaign();
    }
  }, [id]);

  const fetchCampaign = async () => {
    try {
      const { data, error } = await supabase
        .from("crm_sms_campaigns")
        .select(`
          *,
          crm_segments (
            name,
            customer_count
          )
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      setCampaign(data);
    } catch (error) {
      console.error("Error fetching SMS campaign:", error);
      toast({
        title: "Error",
        description: "Failed to load SMS campaign",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "outline",
      scheduled: "secondary",
      sent: "default",
      failed: "destructive",
    };

    return (
      <Badge variant={variants[status] || "outline"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getDeliveryRate = (metrics: any) => {
    if (!metrics || !metrics.messages_sent) return "0%";
    const delivered = metrics.delivered || 0;
    const sent = metrics.messages_sent || 0;
    return `${Math.round((delivered / sent) * 100)}%`;
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-32 bg-muted rounded"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="text-center py-12">
            <MessageSquare className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Campaign Not Found</h3>
            <p className="text-muted-foreground mb-4">
              The SMS campaign you're looking for doesn't exist or you don't have permission to view it.
            </p>
            <Button asChild>
              <Link to="/crm/sms-campaigns">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to SMS Campaigns
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" asChild>
            <Link to="/crm/sms-campaigns">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">{campaign.name}</h1>
            <p className="text-muted-foreground mt-1">SMS Campaign Details</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {getStatusBadge(campaign.status)}
          <Button variant="outline" asChild>
            <Link to={`/crm/sms-campaigns/new?duplicate=${campaign.id}`}>
              <Copy className="h-4 w-4 mr-2" />
              Duplicate Campaign
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Campaign Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <MessageSquare className="h-5 w-5 mr-2" />
              Campaign Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Message Content</label>
              <div className="mt-1 p-4 bg-muted rounded-lg">
                <p className="text-sm whitespace-pre-wrap">{campaign.message}</p>
              </div>
            </div>

            {campaign.image_url && (
              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center">
                  <Image className="h-4 w-4 mr-1" />
                  Attached Image
                </label>
                <div className="mt-1">
                  <img 
                    src={campaign.image_url} 
                    alt="Campaign image" 
                    className="max-w-full h-auto rounded-lg border"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <label className="font-medium text-muted-foreground">Created</label>
                <p>{format(new Date(campaign.created_at), "MMM d, yyyy 'at' h:mm a")}</p>
              </div>
              {campaign.scheduled_at && (
                <div>
                  <label className="font-medium text-muted-foreground">Scheduled</label>
                  <p>{format(new Date(campaign.scheduled_at), "MMM d, yyyy 'at' h:mm a")}</p>
                </div>
              )}
              {campaign.sent_at && (
                <div>
                  <label className="font-medium text-muted-foreground">Sent</label>
                  <p>{format(new Date(campaign.sent_at), "MMM d, yyyy 'at' h:mm a")}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Segment & Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Segment & Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Target Segment</label>
              <p className="mt-1">{campaign.crm_segments?.name || "No segment selected"}</p>
              {campaign.crm_segments?.customer_count && (
                <p className="text-sm text-muted-foreground">
                  {campaign.crm_segments.customer_count} customers in segment
                </p>
              )}
            </div>

            {campaign.metrics && (
              <div className="space-y-3">
                <label className="text-sm font-medium text-muted-foreground">Delivery Metrics</label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-primary">
                      {campaign.metrics.messages_sent || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Messages Sent</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {getDeliveryRate(campaign.metrics)}
                    </div>
                    <div className="text-sm text-muted-foreground">Delivery Rate</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {campaign.metrics.delivered || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Delivered</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-red-600">
                      {campaign.metrics.failed || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Failed</div>
                  </div>
                </div>
                
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {campaign.metrics.opt_outs || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Opt-outs</div>
                </div>
              </div>
            )}

            {!campaign.metrics && campaign.status === "draft" && (
              <div className="text-center p-4 text-muted-foreground">
                <Send className="h-8 w-8 mx-auto mb-2" />
                <p>Metrics will be available after the campaign is sent</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}