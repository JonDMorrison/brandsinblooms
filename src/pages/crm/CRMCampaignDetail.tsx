import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Copy, Users, Calendar, Send, Mail, Eye, MousePointerClick, UserMinus, TrendingUp, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface EmailCampaignDetail {
  id: string;
  name: string;
  subject_line: string;
  content: string;
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

export default function CRMCampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<EmailCampaignDetail | null>(null);
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
        .from("crm_campaigns")
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
      console.error("Error fetching email campaign:", error);
      toast({
        title: "Error",
        description: "Failed to load email campaign",
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

  const getOpenRate = (metrics: any) => {
    if (!metrics || !metrics.sent) return "0%";
    const opens = metrics.opens || 0;
    const sent = metrics.sent || 0;
    return `${Math.round((opens / sent) * 100)}%`;
  };

  const getClickRate = (metrics: any) => {
    if (!metrics || !metrics.sent) return "0%";
    const clicks = metrics.clicks || 0;
    const sent = metrics.sent || 0;
    return `${Math.round((clicks / sent) * 100)}%`;
  };

  const getDeliveryRate = (metrics: any) => {
    if (!metrics || !metrics.sent) return "0%";
    const delivered = metrics.delivered || 0;
    const sent = metrics.sent || 0;
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
            <Mail className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Campaign Not Found</h3>
            <p className="text-muted-foreground mb-4">
              The email campaign you're looking for doesn't exist or you don't have permission to view it.
            </p>
            <Button asChild>
              <Link to="/crm/campaigns">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Email Campaigns
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
            <Link to="/crm/campaigns">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">{campaign.name}</h1>
            <p className="text-muted-foreground mt-1">Email Campaign Analytics</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {getStatusBadge(campaign.status)}
        {campaign.status === 'sent' && (
          <Button 
            variant="default" 
            size="sm" 
            asChild
            className="ml-4"
          >
            <Link to={`/crm/campaigns/${campaign.id}/analytics`}>
              <TrendingUp className="h-4 w-4 mr-2" />
              View Analytics
            </Link>
          </Button>
        )}
          <Button variant="outline" asChild>
            <Link to={`/crm/campaigns/new?duplicate=${campaign.id}`}>
              <Copy className="h-4 w-4 mr-2" />
              Duplicate Campaign
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Performance Metrics */}
        {campaign.metrics && campaign.status === "sent" ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="h-5 w-5 mr-2" />
                Campaign Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-3xl font-bold text-primary">
                    {campaign.metrics.sent || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Recipients</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-3xl font-bold text-green-600">
                    {campaign.metrics.delivered || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Delivered</div>
                  <div className="text-xs text-muted-foreground">
                    {getDeliveryRate(campaign.metrics)} delivery rate
                  </div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-3xl font-bold text-blue-600">
                    {campaign.metrics.opens || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Opens</div>
                  <div className="text-xs text-muted-foreground">
                    {getOpenRate(campaign.metrics)} open rate
                  </div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-3xl font-bold text-purple-600">
                    {campaign.metrics.clicks || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Clicks</div>
                  <div className="text-xs text-muted-foreground">
                    {getClickRate(campaign.metrics)} click rate
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">
                    {campaign.metrics.bounces || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Bounces</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {campaign.metrics.unsubscribes || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Unsubscribes</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-cyan-600">
                    {Math.round(((campaign.metrics.clicks || 0) / (campaign.metrics.opens || 1)) * 100)}%
                  </div>
                  <div className="text-sm text-muted-foreground">Click-to-Open Rate</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="h-5 w-5 mr-2" />
                Campaign Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center py-8">
              {campaign.status === "draft" ? (
                <div className="text-muted-foreground">
                  <Send className="h-12 w-12 mx-auto mb-4" />
                  <p className="text-lg font-medium mb-2">Analytics will be available after sending</p>
                  <p>Send your campaign to see open rates, clicks, and engagement metrics</p>
                </div>
              ) : campaign.status === "scheduled" ? (
                <div className="text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4" />
                  <p className="text-lg font-medium mb-2">Campaign is scheduled</p>
                  <p>Performance data will appear here once the campaign is sent</p>
                </div>
              ) : (
                <div className="text-muted-foreground">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
                  <p className="text-lg font-medium mb-2">Waiting on delivery results...</p>
                  <p>Performance metrics are being collected and will appear shortly</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Campaign Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Mail className="h-5 w-5 mr-2" />
                Campaign Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Subject Line</label>
                <div className="mt-1 p-3 bg-muted rounded-lg">
                  <p className="font-medium">{campaign.subject_line}</p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Email Content</label>
                <div className="mt-1 p-4 bg-muted rounded-lg max-h-48 overflow-y-auto">
                  <div 
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: campaign.content || "No content available" }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 text-sm">
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

          {/* Segment Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="h-5 w-5 mr-2" />
                Target Audience
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Target Segment</label>
                <p className="mt-1 text-lg">{campaign.crm_segments?.name || "All customers"}</p>
                {campaign.crm_segments?.customer_count && (
                  <p className="text-sm text-muted-foreground">
                    {campaign.crm_segments.customer_count} customers in segment
                  </p>
                )}
              </div>

              {campaign.metrics && (
                <div className="space-y-3">
                  <label className="text-sm font-medium text-muted-foreground">Engagement Summary</label>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="flex items-center text-sm">
                        <Eye className="h-4 w-4 mr-2 text-blue-600" />
                        Open Rate
                      </span>
                      <span className="font-medium">{getOpenRate(campaign.metrics)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="flex items-center text-sm">
                        <MousePointerClick className="h-4 w-4 mr-2 text-purple-600" />
                        Click Rate
                      </span>
                      <span className="font-medium">{getClickRate(campaign.metrics)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="flex items-center text-sm">
                        <UserMinus className="h-4 w-4 mr-2 text-orange-600" />
                        Unsubscribes
                      </span>
                      <span className="font-medium">{campaign.metrics.unsubscribes || 0}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}