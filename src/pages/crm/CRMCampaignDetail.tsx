import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { sanitizeHtml } from "@/utils/htmlSanitizer";
import { Button } from "@/components/ui-legacy/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-legacy/card";
import { Badge } from "@/components/ui-legacy/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui-legacy/alert-dialog";
import {
  ArrowLeft,
  Copy,
  Users,
  Calendar,
  Send,
  Mail,
  TrendingUp,
  AlertTriangle,
  Pause,
  Play,
  Square,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { CampaignDerivedMetrics } from "@/components/analytics/CampaignDerivedMetrics";

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
  failure_reason?: string | null;
  crm_segments?: {
    name: string;
    customer_count: number;
  };
}

export default function CRMCampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<EmailCampaignDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<
    null | "pause" | "resume" | "stop"
  >(null);
  const [showStopDialog, setShowStopDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (id) {
      void fetchCampaign();
    }
  }, [id]);

  const fetchCampaign = async () => {
    try {
      const { data, error } = await supabase
        .from("crm_campaigns")
        .select(
          `
          *,
          crm_segments (
            name,
            customer_count
          )
        `,
        )
        .eq("id", id)
        .single();

      if (error) throw error;
      setCampaign(data);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error fetching email campaign:", error);
      }
      toast({
        title: "Error",
        description: "Failed to load email campaign",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const pauseCampaign = async () => {
    if (!campaign?.id) return;
    setBusyAction("pause");

    const { data, error } = await supabase.rpc("pause_email_campaign_sending", {
      p_campaign_id: campaign.id,
    });

    setBusyAction(null);

    if (error) {
      toast({
        title: "Pause failed",
        description: error.message || "Action failed",
        variant: "destructive",
      });
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    toast({
      title: "Campaign paused",
      description: `Paused ${row?.messages_paused ?? 0} messages and ${row?.jobs_paused ?? 0} jobs.`,
    });
    await fetchCampaign();
  };

  const resumeCampaign = async () => {
    if (!campaign?.id) return;
    setBusyAction("resume");

    const { data, error } = await supabase.rpc(
      "resume_email_campaign_sending",
      {
        p_campaign_id: campaign.id,
      },
    );

    setBusyAction(null);

    if (error) {
      toast({
        title: "Resume failed",
        description: error.message || "Action failed",
        variant: "destructive",
      });
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    toast({
      title: "Campaign resumed",
      description: `Resumed ${row?.messages_resumed ?? 0} messages and ${row?.jobs_resumed ?? 0} jobs.`,
    });
    await fetchCampaign();
  };

  const stopCampaign = async () => {
    if (!campaign?.id) return;
    setBusyAction("stop");
    setShowStopDialog(false);

    const { data, error } = await supabase.rpc(
      "stop_email_campaign_sending" as never,
      {
        p_campaign_id: campaign.id,
        p_reason: "stopped_by_user",
      } as never,
    );

    setBusyAction(null);

    if (error) {
      toast({
        title: "Stop failed",
        description: error.message || "Action failed",
        variant: "destructive",
      });
      return;
    }

    const row = (Array.isArray(data as any) ? (data as any)[0] : data) as any;
    toast({
      title: "Campaign stopped",
      description: `Stopped ${row?.messages_stopped ?? 0} messages and ${row?.jobs_stopped ?? 0} jobs.`,
    });
    await fetchCampaign();
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<
      string,
      "default" | "secondary" | "destructive" | "outline"
    > = {
      draft: "outline",
      scheduled: "secondary",
      queued: "secondary",
      partially_queued: "secondary",
      sending: "secondary",
      paused: "outline",
      sent: "default",
      sent_with_errors: "default",
      failed: "destructive",
    };

    return (
      <Badge variant={variants[status] || "outline"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
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
              The email campaign you're looking for doesn't exist or you don't
              have permission to view it.
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
            <h1 className="text-3xl font-bold text-foreground">
              {campaign.name}
            </h1>
            <p className="text-muted-foreground mt-1">
              Email Campaign Analytics
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {getStatusBadge(campaign.status)}

          {(campaign.status === "scheduled" ||
            campaign.status === "queued" ||
            campaign.status === "partially_queued" ||
            campaign.status === "sending") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void pauseCampaign()}
              disabled={busyAction !== null}
              className="gap-2"
            >
              {busyAction === "pause" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Pause className="h-4 w-4" />
              )}
              Pause
            </Button>
          )}

          {campaign.status === "paused" && (
            <Button
              variant="default"
              size="sm"
              onClick={() => void resumeCampaign()}
              disabled={busyAction !== null}
              className="gap-2"
            >
              {busyAction === "resume" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Resume
            </Button>
          )}

          {(campaign.status === "scheduled" ||
            campaign.status === "queued" ||
            campaign.status === "partially_queued" ||
            campaign.status === "sending" ||
            campaign.status === "paused") && (
            <>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowStopDialog(true)}
                disabled={busyAction !== null}
                className="gap-2"
              >
                {busyAction === "stop" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
                Stop
              </Button>

              <AlertDialog
                open={showStopDialog}
                onOpenChange={setShowStopDialog}
              >
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Stop campaign?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will stop sending and mark the campaign as failed.
                      You can’t resume after stopping.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={busyAction !== null}>
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => void stopCampaign()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={busyAction !== null}
                    >
                      Stop
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}

          {(campaign.status === "sent" ||
            campaign.status === "sent_with_errors") && (
            <Button variant="default" size="sm" asChild className="ml-4">
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
        {campaign.status === "sent" ||
        campaign.status === "sent_with_errors" ? (
          <CampaignDerivedMetrics campaignId={campaign.id} />
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
                  <p className="text-lg font-medium mb-2">
                    Analytics will be available after sending
                  </p>
                  <p>
                    Send your campaign to see reach, interaction, and supporting
                    engagement diagnostics.
                  </p>
                </div>
              ) : campaign.status === "scheduled" ? (
                <div className="text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4" />
                  <p className="text-lg font-medium mb-2">
                    Campaign is scheduled
                  </p>
                  <p>
                    Performance data will appear here once the campaign is sent.
                  </p>
                </div>
              ) : (
                <div className="text-muted-foreground">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
                  <p className="text-lg font-medium mb-2">
                    Waiting on delivery results...
                  </p>
                  <p>
                    Performance metrics are being collected and will appear
                    shortly.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Mail className="h-5 w-5 mr-2" />
                Campaign Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Subject Line
                </label>
                <div className="mt-1 p-3 bg-muted rounded-lg">
                  <p className="font-medium">{campaign.subject_line}</p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Email Content
                </label>
                <div className="mt-1 p-4 bg-muted rounded-lg max-h-48 overflow-y-auto">
                  <div
                    className="prose prose-sm max-w-none"
                    // SECURITY: X5 - Sanitize HTML to prevent XSS
                    dangerouslySetInnerHTML={{
                      __html: sanitizeHtml(campaign.content || "No content available"),
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 text-sm">
                <div>
                  <label className="font-medium text-muted-foreground">
                    Created
                  </label>
                  <p>
                    {format(
                      new Date(campaign.created_at),
                      "MMM d, yyyy 'at' h:mm a",
                    )}
                  </p>
                </div>
                {campaign.scheduled_at && (
                  <div>
                    <label className="font-medium text-muted-foreground">
                      Scheduled
                    </label>
                    <p>
                      {format(
                        new Date(campaign.scheduled_at),
                        "MMM d, yyyy 'at' h:mm a",
                      )}
                    </p>
                  </div>
                )}
                {campaign.sent_at && (
                  <div>
                    <label className="font-medium text-muted-foreground">
                      Sent
                    </label>
                    <p>
                      {format(
                        new Date(campaign.sent_at),
                        "MMM d, yyyy 'at' h:mm a",
                      )}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="h-5 w-5 mr-2" />
                Target Audience
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Target Segment
                </label>
                <p className="mt-1 text-lg">
                  {campaign.crm_segments?.name || "All customers"}
                </p>
                {campaign.crm_segments?.customer_count && (
                  <p className="text-sm text-muted-foreground">
                    {campaign.crm_segments.customer_count} customers in segment
                  </p>
                )}
              </div>

              {campaign.failure_reason && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4">
                  <div className="text-sm font-medium text-destructive">
                    Failure Reason
                  </div>
                  <p className="mt-1 text-sm text-destructive">
                    {campaign.failure_reason}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
