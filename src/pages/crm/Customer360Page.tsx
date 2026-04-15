import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-legacy/card";
import { Button } from "@/components/ui-legacy/button";
import { Badge } from "@/components/ui-legacy/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui-legacy/tabs";
import { Avatar, AvatarFallback } from "@/components/ui-legacy/avatar";
import { Progress } from "@/components/ui-legacy/progress";
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
  AlertTriangle,
  ShoppingCart,
  DollarSign,
  Repeat,
  Tag,
  TrendingDown,
  Crown,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { CustomerTimeline } from "@/components/crm/customer360/CustomerTimeline";
import { CustomerInsights } from "@/components/crm/customer360/CustomerInsights";
import { ActivityFeedList } from "@/components/activity/ActivityFeedList";
import { useActivityFeed } from "@/hooks/useActivityFeed";
import { SendSMSDialog } from "@/components/crm/customer360/SendSMSDialog";
import { AddToSegmentDialog } from "@/components/crm/customer360/AddToSegmentDialog";
import { useCustomerCrossChannelMetrics } from "@/hooks/useCrossChannelMetrics";
import { useCustomerPurchaseMetrics } from "@/hooks/usePurchaseMetrics";
import {
  useCustomerPostPurchaseMetrics,
  useCustomerIncentiveHistory,
} from "@/hooks/usePostPurchaseMetrics";
import {
  useCustomerLoyaltyMetrics,
  useCustomerPointsHistory,
} from "@/hooks/useLoyaltyMetrics";
import {
  useCustomerLifecycleMetrics,
  useCustomerLifecycleHistory,
  getLifecycleStageConfig,
} from "@/hooks/useLifecycleMetrics";
import {
  useCustomerContentIntentMetrics,
  useCustomerInteractionHistory,
  getIntentLevelConfig,
  getContentPreferenceConfig,
  getClickTimingConfig,
} from "@/hooks/useContentIntentMetrics";
import {
  useCustomerRiskSignals,
  useCustomerNegativeEvents,
  getRiskLevelConfig,
  getRiskTrendConfig,
  getRiskFactorLabel,
  getEventTypeConfig,
} from "@/hooks/useRiskSignals";
import {
  Gift,
  Percent,
  Timer,
  Target,
  BarChart3,
  Star,
  Trophy,
  Coins,
  TrendingUp as ArrowTrendingUp,
  RefreshCw,
  Activity,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  MousePointerClick,
  BookOpen,
  Sparkles,
  Eye,
  ShieldAlert,
  Ban,
  VolumeX,
  Ticket,
  Moon,
  MailX,
} from "lucide-react";

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

  const activityFeed = useActivityFeed(
    { customerId: id ?? undefined },
    { pageSize: 50, enabled: !!id },
  );

  // Fetch cross-channel metrics
  const { data: crossChannelMetrics } = useCustomerCrossChannelMetrics(id);

  // Fetch purchase metrics
  const { data: purchaseMetrics } = useCustomerPurchaseMetrics(id);

  // Fetch post-purchase metrics
  const { data: postPurchaseMetrics } = useCustomerPostPurchaseMetrics(id);

  // Fetch incentive history
  const { data: incentiveHistory } = useCustomerIncentiveHistory(id);

  // Fetch loyalty metrics
  const { data: loyaltyMetrics } = useCustomerLoyaltyMetrics(id);

  // Fetch points history
  const { data: pointsHistory } = useCustomerPointsHistory(id);

  // Fetch lifecycle metrics
  const { data: lifecycleMetrics } = useCustomerLifecycleMetrics(id);

  // Fetch lifecycle history
  const { data: lifecycleHistory } = useCustomerLifecycleHistory(id);

  // Fetch content intent metrics
  const { data: contentIntentMetrics } = useCustomerContentIntentMetrics(id);

  // Fetch content interaction history
  const { data: interactionHistory } = useCustomerInteractionHistory(id, 10);

  // Fetch risk signals
  const { data: riskSignals } = useCustomerRiskSignals(id);

  // Fetch negative behavior events
  const { data: negativeEvents } = useCustomerNegativeEvents(id, 10);

  // Fetch customer 360 data
  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer-360", id],
    queryFn: async () => {
      if (!id) throw new Error("Customer ID required");

      const { data, error } = await supabase
        .from("customer_360_enriched")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as Customer360Data;
    },
    enabled: !!id,
  });

  const getInitials = (
    firstName: string | null,
    lastName: string | null,
    email: string,
  ) => {
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
    return "Unknown Name";
  };

  const getEngagementTierColor = (tier: string | null) => {
    switch (tier) {
      case "high":
        return "bg-gradient-to-r from-emerald-500 to-green-500 text-white";
      case "medium":
        return "bg-gradient-to-r from-blue-500 to-cyan-500 text-white";
      case "low":
        return "bg-gradient-to-r from-yellow-500 to-amber-500 text-white";
      case "inactive":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const handleExportCustomer = async () => {
    if (!customer) return;

    const csvData = [
      ["Field", "Value"],
      ["Name", getFullName(customer.first_name, customer.last_name)],
      ["Email", customer.email],
      ["Phone", customer.phone || ""],
      [
        "First Seen",
        customer.first_seen_at
          ? format(new Date(customer.first_seen_at), "MMM dd, yyyy")
          : "",
      ],
      [
        "Last Seen",
        customer.last_seen_at
          ? format(new Date(customer.last_seen_at), "MMM dd, yyyy")
          : "",
      ],
      ["Engagement Score", customer.engagement_overall_score.toString()],
      ["Engagement Tier", customer.engagement_tier || ""],
      ["Email Score", customer.engagement_email_score.toString()],
      ["SMS Score", customer.engagement_sms_score.toString()],
      ["SMS Sent", customer.sms_total_sent.toString()],
      ["SMS Delivered", customer.sms_total_delivered.toString()],
      ["SMS Delivery Rate", `${customer.sms_delivery_rate.toFixed(1)}%`],
      ["SMS Reply Rate", `${customer.sms_reply_rate.toFixed(1)}%`],
      ["Email Open Rate", `${customer.email_open_rate.toFixed(1)}%`],
      ["Email Click Rate", `${customer.email_click_rate.toFixed(1)}%`],
    ];

    const csv = csvData.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `customer-${customer.email.replace("@", "-")}.csv`;
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
            The customer you're looking for doesn't exist or you don't have
            permission to view it.
          </p>
          <Button onClick={() => navigate("/crm/customers")}>
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
          onClick={() => navigate("/crm/customers")}
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
                  {getInitials(
                    customer.first_name,
                    customer.last_name,
                    customer.email,
                  )}
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
                    Customer since{" "}
                    {formatDistanceToNow(new Date(customer.first_seen_at), {
                      addSuffix: true,
                    })}
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
              <Badge
                className={getEngagementTierColor(customer.engagement_tier)}
              >
                {customer.engagement_tier || "Unknown"}
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
                      <p className="text-sm text-muted-foreground">
                        Multi-Channel Score
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-2xl font-bold">
                        {crossChannelMetrics?.multi_channel_score?.toFixed(0) ||
                          0}
                      </p>
                      <Progress
                        value={
                          Number(crossChannelMetrics?.multi_channel_score) || 0
                        }
                        className="h-2 flex-1"
                      />
                    </div>
                  </div>

                  {/* Preferred Channel */}
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      {crossChannelMetrics?.preferred_channel === "email" ? (
                        <Mail className="h-4 w-4 text-blue-500" />
                      ) : crossChannelMetrics?.preferred_channel === "sms" ? (
                        <MessageCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <Zap className="h-4 w-4 text-muted-foreground" />
                      )}
                      <p className="text-sm text-muted-foreground">
                        Preferred Channel
                      </p>
                    </div>
                    <p className="text-xl font-bold capitalize">
                      {crossChannelMetrics?.preferred_channel || "Unknown"}
                    </p>
                  </div>

                  {/* Fatigue Status */}
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle
                        className={`h-4 w-4 ${
                          crossChannelMetrics?.fatigue_status === "critical"
                            ? "text-red-500"
                            : crossChannelMetrics?.fatigue_status === "high"
                              ? "text-orange-500"
                              : crossChannelMetrics?.fatigue_status ===
                                  "moderate"
                                ? "text-yellow-500"
                                : "text-green-500"
                        }`}
                      />
                      <p className="text-sm text-muted-foreground">
                        Fatigue Status
                      </p>
                    </div>
                    <Badge
                      variant={
                        crossChannelMetrics?.fatigue_status === "critical"
                          ? "destructive"
                          : crossChannelMetrics?.fatigue_status === "high"
                            ? "destructive"
                            : crossChannelMetrics?.fatigue_status === "moderate"
                              ? "secondary"
                              : "outline"
                      }
                      className="capitalize"
                    >
                      {crossChannelMetrics?.fatigue_status || "None"}
                    </Badge>
                  </div>

                  {/* Last Engaged Channel */}
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Last Engaged
                      </p>
                    </div>
                    <p className="text-xl font-bold capitalize">
                      {crossChannelMetrics?.last_engaged_channel || "-"}
                    </p>
                    {crossChannelMetrics?.last_engagement_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(
                          new Date(crossChannelMetrics.last_engagement_at),
                          { addSuffix: true },
                        )}
                      </p>
                    )}
                  </div>

                  {/* Days Since Last Engagement */}
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Days Inactive
                      </p>
                    </div>
                    <p className="text-2xl font-bold">
                      {crossChannelMetrics?.days_since_last_engagement ?? "-"}
                    </p>
                  </div>
                </div>

                {/* Fatigue Details */}
                {(crossChannelMetrics?.email_fatigue_score ?? 0) > 0 ||
                (crossChannelMetrics?.sms_fatigue_score ?? 0) > 0 ? (
                  <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-muted-foreground">
                          Email Fatigue
                        </span>
                        <span className="text-sm font-medium">
                          {crossChannelMetrics?.email_fatigue_score ?? 0}%
                        </span>
                      </div>
                      <Progress
                        value={crossChannelMetrics?.email_fatigue_score ?? 0}
                        className="h-2"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-muted-foreground">
                          SMS Fatigue
                        </span>
                        <span className="text-sm font-medium">
                          {crossChannelMetrics?.sms_fatigue_score ?? 0}%
                        </span>
                      </div>
                      <Progress
                        value={crossChannelMetrics?.sms_fatigue_score ?? 0}
                        className="h-2"
                      />
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {/* Purchase & Transaction Behavior Card */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Purchase & Transaction Behavior
                  {purchaseMetrics?.customer_tier && (
                    <Badge
                      className={
                        purchaseMetrics.customer_tier === "vip"
                          ? "bg-gradient-to-r from-amber-500 to-yellow-500 text-white"
                          : purchaseMetrics.customer_tier === "loyal"
                            ? "bg-gradient-to-r from-emerald-500 to-green-500 text-white"
                            : purchaseMetrics.customer_tier === "regular"
                              ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white"
                              : purchaseMetrics.customer_tier === "occasional"
                                ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                                : "bg-muted text-muted-foreground"
                      }
                    >
                      <Crown className="h-3 w-3 mr-1" />
                      {purchaseMetrics.customer_tier.toUpperCase()}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {purchaseMetrics && purchaseMetrics.total_purchases > 0 ? (
                  <>
                    {/* Core Metrics */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                      <div className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg border border-primary/20">
                        <div className="flex items-center gap-2 mb-2">
                          <ShoppingCart className="h-4 w-4 text-primary" />
                          <p className="text-sm text-muted-foreground">
                            Total Purchases
                          </p>
                        </div>
                        <p className="text-2xl font-bold">
                          {purchaseMetrics.total_purchases}
                        </p>
                      </div>

                      <div className="p-4 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 rounded-lg border border-emerald-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <DollarSign className="h-4 w-4 text-emerald-500" />
                          <p className="text-sm text-muted-foreground">
                            Lifetime Value
                          </p>
                        </div>
                        <p className="text-2xl font-bold text-emerald-600">
                          $
                          {Number(
                            purchaseMetrics.lifetime_value,
                          ).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </p>
                      </div>

                      <div className="p-4 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            Avg Order Value
                          </p>
                        </div>
                        <p className="text-2xl font-bold">
                          $
                          {Number(purchaseMetrics.average_order_value).toFixed(
                            2,
                          )}
                        </p>
                      </div>

                      <div className="p-4 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Repeat className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            Purchase Freq
                          </p>
                        </div>
                        <p className="text-2xl font-bold">
                          {Number(purchaseMetrics.purchase_frequency).toFixed(
                            1,
                          )}
                          <span className="text-sm text-muted-foreground">
                            /mo
                          </span>
                        </p>
                      </div>

                      <div className="p-4 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          {Number(purchaseMetrics.purchase_velocity) > 0 ? (
                            <TrendingUp className="h-4 w-4 text-emerald-500" />
                          ) : Number(purchaseMetrics.purchase_velocity) < 0 ? (
                            <TrendingDown className="h-4 w-4 text-red-500" />
                          ) : (
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                          )}
                          <p className="text-sm text-muted-foreground">
                            Velocity
                          </p>
                        </div>
                        <p
                          className={`text-2xl font-bold ${
                            Number(purchaseMetrics.purchase_velocity) > 0
                              ? "text-emerald-600"
                              : Number(purchaseMetrics.purchase_velocity) < 0
                                ? "text-red-600"
                                : ""
                          }`}
                        >
                          {Number(purchaseMetrics.purchase_velocity) > 0
                            ? "+"
                            : ""}
                          {Number(purchaseMetrics.purchase_velocity).toFixed(0)}
                          %
                        </p>
                      </div>
                    </div>

                    {/* Timing & Behavior */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          First Purchase
                        </p>
                        <p className="text-lg font-semibold">
                          {purchaseMetrics.first_purchase_date
                            ? format(
                                new Date(purchaseMetrics.first_purchase_date),
                                "MMM d, yyyy",
                              )
                            : "-"}
                        </p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          Last Purchase
                        </p>
                        <p className="text-lg font-semibold">
                          {purchaseMetrics.last_purchase_date
                            ? format(
                                new Date(purchaseMetrics.last_purchase_date),
                                "MMM d, yyyy",
                              )
                            : "-"}
                        </p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          Days Since Last
                        </p>
                        <p className="text-lg font-semibold">
                          {purchaseMetrics.days_since_last_purchase ?? "-"}
                        </p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          Avg Days Between
                        </p>
                        <p className="text-lg font-semibold">
                          {purchaseMetrics.avg_days_between_purchases
                            ? Number(
                                purchaseMetrics.avg_days_between_purchases,
                              ).toFixed(0)
                            : "-"}
                        </p>
                      </div>
                    </div>

                    {/* Discount Behavior & Product Affinity */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Discount Behavior */}
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <Tag className="h-4 w-4" />
                          Discount Behavior
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-sm text-muted-foreground">
                              Full Price
                            </p>
                            <p className="text-xl font-bold">
                              {purchaseMetrics.total_full_price_purchases}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">
                              Discounted
                            </p>
                            <p className="text-xl font-bold">
                              {purchaseMetrics.total_discounted_purchases}
                            </p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-sm text-muted-foreground">
                              Discount-Driven Ratio
                            </p>
                            <div className="flex items-center gap-2">
                              <Progress
                                value={Number(
                                  purchaseMetrics.discount_driven_ratio,
                                )}
                                className="h-2 flex-1"
                              />
                              <span className="text-sm font-medium">
                                {Number(
                                  purchaseMetrics.discount_driven_ratio,
                                ).toFixed(0)}
                                %
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Product Affinity */}
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <ShoppingCart className="h-4 w-4" />
                          Product Affinity
                        </h4>
                        {purchaseMetrics.top_product_categories &&
                        purchaseMetrics.top_product_categories.length > 0 ? (
                          <div className="space-y-2">
                            <div>
                              <p className="text-sm text-muted-foreground mb-1">
                                Top Categories
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {purchaseMetrics.top_product_categories.map(
                                  (cat, i) => (
                                    <Badge
                                      key={i}
                                      variant="secondary"
                                      className="text-xs"
                                    >
                                      {cat}
                                    </Badge>
                                  ),
                                )}
                              </div>
                            </div>
                            {purchaseMetrics.favorite_products &&
                              purchaseMetrics.favorite_products.length > 0 && (
                                <div>
                                  <p className="text-sm text-muted-foreground mb-1">
                                    Favorite Products
                                  </p>
                                  <div className="flex flex-wrap gap-1">
                                    {purchaseMetrics.favorite_products
                                      .slice(0, 3)
                                      .map((prod, i) => (
                                        <Badge
                                          key={i}
                                          variant="outline"
                                          className="text-xs"
                                        >
                                          {prod}
                                        </Badge>
                                      ))}
                                  </div>
                                </div>
                              )}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            No product data available
                          </p>
                        )}
                        {purchaseMetrics.peak_purchase_month && (
                          <div className="mt-3 pt-3 border-t">
                            <p className="text-sm text-muted-foreground">
                              Peak Month
                            </p>
                            <p className="font-medium">
                              {purchaseMetrics.peak_purchase_month}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No purchase data available for this customer</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Post-Purchase Behavior Card */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gift className="h-5 w-5" />
                  Post-Purchase Behavior
                  {postPurchaseMetrics &&
                    postPurchaseMetrics.post_purchase_engagement_score > 0 && (
                      <Badge variant="outline" className="ml-2">
                        Score:{" "}
                        {Number(
                          postPurchaseMetrics.post_purchase_engagement_score,
                        ).toFixed(0)}
                      </Badge>
                    )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {postPurchaseMetrics ? (
                  <>
                    {/* Post-Purchase Email Engagement */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="p-4 bg-gradient-to-br from-blue-500/10 to-blue-500/5 rounded-lg border border-blue-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <Mail className="h-4 w-4 text-blue-500" />
                          <p className="text-sm text-muted-foreground">
                            Post-Purchase Open Rate
                          </p>
                        </div>
                        <p className="text-2xl font-bold text-blue-600">
                          {Number(
                            postPurchaseMetrics.post_purchase_email_open_rate,
                          ).toFixed(1)}
                          %
                        </p>
                      </div>

                      <div className="p-4 bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 rounded-lg border border-cyan-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <Target className="h-4 w-4 text-cyan-500" />
                          <p className="text-sm text-muted-foreground">
                            Follow-Up CTR
                          </p>
                        </div>
                        <p className="text-2xl font-bold text-cyan-600">
                          {Number(
                            postPurchaseMetrics.post_purchase_follow_up_ctr,
                          ).toFixed(1)}
                          %
                        </p>
                      </div>

                      <div className="p-4 bg-gradient-to-br from-purple-500/10 to-purple-500/5 rounded-lg border border-purple-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <Timer className="h-4 w-4 text-purple-500" />
                          <p className="text-sm text-muted-foreground">
                            Avg Time to Next Purchase
                          </p>
                        </div>
                        <p className="text-2xl font-bold text-purple-600">
                          {postPurchaseMetrics.avg_time_to_next_purchase_days
                            ? `${Number(postPurchaseMetrics.avg_time_to_next_purchase_days).toFixed(0)} days`
                            : "-"}
                        </p>
                      </div>

                      <div className="p-4 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 rounded-lg border border-emerald-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <Percent className="h-4 w-4 text-emerald-500" />
                          <p className="text-sm text-muted-foreground">
                            Incentive Redemption
                          </p>
                        </div>
                        <p className="text-2xl font-bold text-emerald-600">
                          {Number(
                            postPurchaseMetrics.incentive_redemption_rate,
                          ).toFixed(1)}
                          %
                        </p>
                      </div>
                    </div>

                    {/* Incentive & Automation Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      {/* Coupon & Incentive Usage */}
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <Tag className="h-4 w-4" />
                          Coupon & Incentive Usage
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-sm text-muted-foreground">
                              Coupons Offered
                            </p>
                            <p className="text-xl font-bold">
                              {postPurchaseMetrics.total_incentives_offered}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">
                              Coupons Redeemed
                            </p>
                            <p className="text-xl font-bold text-emerald-600">
                              {postPurchaseMetrics.total_incentives_redeemed}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">
                              Usage Frequency
                            </p>
                            <p className="text-xl font-bold">
                              {Number(
                                postPurchaseMetrics.coupon_usage_frequency,
                              ).toFixed(2)}
                              <span className="text-sm text-muted-foreground">
                                /purchase
                              </span>
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">
                              Total Saved
                            </p>
                            <p className="text-xl font-bold text-emerald-600">
                              $
                              {Number(
                                postPurchaseMetrics.total_coupon_value_redeemed,
                              ).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Dependency & Attribution */}
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <BarChart3 className="h-4 w-4" />
                          Dependency & Attribution
                        </h4>
                        <div className="space-y-3">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm text-muted-foreground">
                                Incentive Dependency
                              </span>
                              <span className="text-sm font-medium">
                                {Number(
                                  postPurchaseMetrics.incentive_dependency_score,
                                ).toFixed(0)}
                                %
                              </span>
                            </div>
                            <Progress
                              value={Number(
                                postPurchaseMetrics.incentive_dependency_score,
                              )}
                              className="h-2"
                            />
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm text-muted-foreground">
                                Automation Conversion
                              </span>
                              <span className="text-sm font-medium">
                                {Number(
                                  postPurchaseMetrics.automation_conversion_rate,
                                ).toFixed(0)}
                                %
                              </span>
                            </div>
                            <Progress
                              value={Number(
                                postPurchaseMetrics.automation_conversion_rate,
                              )}
                              className="h-2"
                            />
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm text-muted-foreground">
                                Drop-off Rate
                              </span>
                              <span
                                className={`text-sm font-medium ${Number(postPurchaseMetrics.drop_off_after_incentive_rate) > 50 ? "text-red-500" : ""}`}
                              >
                                {Number(
                                  postPurchaseMetrics.drop_off_after_incentive_rate,
                                ).toFixed(0)}
                                %
                              </span>
                            </div>
                            <Progress
                              value={Number(
                                postPurchaseMetrics.drop_off_after_incentive_rate,
                              )}
                              className={`h-2 ${Number(postPurchaseMetrics.drop_off_after_incentive_rate) > 50 ? "[&>div]:bg-red-500" : ""}`}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Additional Stats Row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          Purchases w/ Incentive
                        </p>
                        <p className="text-lg font-semibold">
                          {postPurchaseMetrics.purchases_with_incentive}
                        </p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          Purchases w/o Incentive
                        </p>
                        <p className="text-lg font-semibold">
                          {postPurchaseMetrics.purchases_without_incentive}
                        </p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          Expired Unused
                        </p>
                        <p className="text-lg font-semibold text-amber-600">
                          {postPurchaseMetrics.incentives_expired_unused}
                        </p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          Purchases After Automation
                        </p>
                        <p className="text-lg font-semibold text-primary">
                          {postPurchaseMetrics.purchases_after_automation}
                        </p>
                      </div>
                    </div>

                    {/* Incentive History */}
                    {incentiveHistory && incentiveHistory.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <Gift className="h-4 w-4" />
                          Recent Incentives
                        </h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {incentiveHistory.slice(0, 5).map((incentive) => (
                            <div
                              key={incentive.id}
                              className="flex items-center justify-between p-2 bg-muted/30 rounded-lg"
                            >
                              <div className="flex items-center gap-3">
                                <Badge
                                  variant={
                                    incentive.status === "redeemed"
                                      ? "default"
                                      : incentive.status === "expired"
                                        ? "secondary"
                                        : "outline"
                                  }
                                  className={
                                    incentive.status === "redeemed"
                                      ? "bg-emerald-500"
                                      : incentive.status === "expired"
                                        ? "bg-muted text-muted-foreground"
                                        : ""
                                  }
                                >
                                  {incentive.status}
                                </Badge>
                                <div>
                                  <p className="text-sm font-medium">
                                    {incentive.code || "No code"}
                                  </p>
                                  <p className="text-xs text-muted-foreground capitalize">
                                    {incentive.incentive_type} •{" "}
                                    {incentive.source_type}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                {incentive.value && (
                                  <p className="text-sm font-medium">
                                    {incentive.value_type === "percentage"
                                      ? `${incentive.value}%`
                                      : `$${incentive.value}`}
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground">
                                  {format(
                                    new Date(incentive.sent_at),
                                    "MMM d, yyyy",
                                  )}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Gift className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No post-purchase metrics available for this customer</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Loyalty & Perks Program Card */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-amber-500" />
                  Loyalty & Perks Program
                  {loyaltyMetrics?.is_perks_member && (
                    <Badge
                      variant="outline"
                      className={`ml-2 capitalize ${
                        loyaltyMetrics.current_loyalty_tier === "platinum"
                          ? "border-purple-500 text-purple-600"
                          : loyaltyMetrics.current_loyalty_tier === "gold"
                            ? "border-amber-500 text-amber-600"
                            : loyaltyMetrics.current_loyalty_tier === "silver"
                              ? "border-slate-400 text-slate-600"
                              : "border-orange-400 text-orange-600"
                      }`}
                    >
                      <Star className="h-3 w-3 mr-1" />
                      {loyaltyMetrics.current_loyalty_tier}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loyaltyMetrics ? (
                  <>
                    {/* Membership Status */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div
                        className={`p-4 rounded-lg border ${
                          loyaltyMetrics.is_perks_member
                            ? "bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20"
                            : "bg-muted/50 border-muted"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Star
                            className={`h-4 w-4 ${loyaltyMetrics.is_perks_member ? "text-amber-500" : "text-muted-foreground"}`}
                          />
                          <p className="text-sm text-muted-foreground">
                            Member Status
                          </p>
                        </div>
                        <p
                          className={`text-xl font-bold ${loyaltyMetrics.is_perks_member ? "text-amber-600" : "text-muted-foreground"}`}
                        >
                          {loyaltyMetrics.is_perks_member
                            ? "Active Member"
                            : "Not Enrolled"}
                        </p>
                        {loyaltyMetrics.perks_enrolled_at && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Since{" "}
                            {format(
                              new Date(loyaltyMetrics.perks_enrolled_at),
                              "MMM d, yyyy",
                            )}
                          </p>
                        )}
                      </div>

                      <div className="p-4 bg-gradient-to-br from-purple-500/10 to-purple-500/5 rounded-lg border border-purple-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="h-4 w-4 text-purple-500" />
                          <p className="text-sm text-muted-foreground">
                            Time to Join
                          </p>
                        </div>
                        <p className="text-2xl font-bold text-purple-600">
                          {loyaltyMetrics.time_to_join_perks_days !== null
                            ? `${loyaltyMetrics.time_to_join_perks_days} days`
                            : "-"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          after signup
                        </p>
                      </div>

                      <div className="p-4 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 rounded-lg border border-emerald-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <Coins className="h-4 w-4 text-emerald-500" />
                          <p className="text-sm text-muted-foreground">
                            Current Balance
                          </p>
                        </div>
                        <p className="text-2xl font-bold text-emerald-600">
                          {loyaltyMetrics.current_points_balance.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">points</p>
                      </div>

                      <div className="p-4 bg-gradient-to-br from-blue-500/10 to-blue-500/5 rounded-lg border border-blue-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <ArrowTrendingUp className="h-4 w-4 text-blue-500" />
                          <p className="text-sm text-muted-foreground">
                            Engagement Score
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="text-2xl font-bold text-blue-600">
                            {Number(
                              loyaltyMetrics.loyalty_engagement_score,
                            ).toFixed(0)}
                          </p>
                          <Progress
                            value={Number(
                              loyaltyMetrics.loyalty_engagement_score,
                            )}
                            className="h-2 flex-1"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Points Activity & Redemption */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      {/* Points Activity */}
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <Coins className="h-4 w-4" />
                          Points Activity
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-sm text-muted-foreground">
                              Lifetime Earned
                            </p>
                            <p className="text-xl font-bold text-emerald-600">
                              {loyaltyMetrics.total_points_earned.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">
                              Lifetime Redeemed
                            </p>
                            <p className="text-xl font-bold text-blue-600">
                              {loyaltyMetrics.total_points_redeemed.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">
                              Non-Redeemed Ratio
                            </p>
                            <p
                              className={`text-xl font-bold ${Number(loyaltyMetrics.non_redeemed_points_ratio) > 70 ? "text-amber-600" : ""}`}
                            >
                              {Number(
                                loyaltyMetrics.non_redeemed_points_ratio,
                              ).toFixed(0)}
                              %
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">
                              Risk Score
                            </p>
                            <p
                              className={`text-xl font-bold ${
                                Number(loyaltyMetrics.loyalty_risk_score) >= 50
                                  ? "text-red-600"
                                  : Number(loyaltyMetrics.loyalty_risk_score) >=
                                      30
                                    ? "text-amber-600"
                                    : "text-emerald-600"
                              }`}
                            >
                              {Number(
                                loyaltyMetrics.loyalty_risk_score,
                              ).toFixed(0)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Redemption Behavior */}
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <Repeat className="h-4 w-4" />
                          Redemption Behavior
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-sm text-muted-foreground">
                              Total Redemptions
                            </p>
                            <p className="text-xl font-bold">
                              {loyaltyMetrics.total_redemptions}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">
                              Frequency
                            </p>
                            <p className="text-xl font-bold">
                              {Number(
                                loyaltyMetrics.redemption_frequency,
                              ).toFixed(2)}
                              <span className="text-sm text-muted-foreground">
                                /mo
                              </span>
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">
                              Avg Delay (Earn → Redeem)
                            </p>
                            <p className="text-xl font-bold">
                              {loyaltyMetrics.avg_redemption_delay_days
                                ? `${Number(loyaltyMetrics.avg_redemption_delay_days).toFixed(0)} days`
                                : "-"}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">
                              Last Redemption
                            </p>
                            <p className="text-sm font-medium">
                              {loyaltyMetrics.last_redemption_at
                                ? formatDistanceToNow(
                                    new Date(loyaltyMetrics.last_redemption_at),
                                    { addSuffix: true },
                                  )
                                : "Never"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Perks-Driven Revenue & Tier Progression */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          Perks-Driven Revenue
                        </p>
                        <p className="text-lg font-semibold text-emerald-600">
                          $
                          {Number(
                            loyaltyMetrics.total_perks_driven_revenue,
                          ).toFixed(2)}
                        </p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          Revenue %
                        </p>
                        <p className="text-lg font-semibold">
                          {Number(
                            loyaltyMetrics.perks_revenue_percentage,
                          ).toFixed(0)}
                          %
                        </p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          Tier Progression
                        </p>
                        <p className="text-lg font-semibold">
                          {loyaltyMetrics.tier_progression_speed_days
                            ? `${loyaltyMetrics.tier_progression_speed_days} days`
                            : "-"}
                        </p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          Tier Upgrades
                        </p>
                        <p className="text-lg font-semibold">
                          {loyaltyMetrics.tier_upgrade_count}
                        </p>
                      </div>
                    </div>

                    {/* Points History */}
                    {pointsHistory && pointsHistory.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <Coins className="h-4 w-4" />
                          Recent Points Activity
                        </h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {pointsHistory.slice(0, 5).map((txn) => (
                            <div
                              key={txn.id}
                              className="flex items-center justify-between p-2 bg-muted/30 rounded-lg"
                            >
                              <div className="flex items-center gap-3">
                                <Badge
                                  variant={
                                    txn.transaction_type === "earn"
                                      ? "default"
                                      : "secondary"
                                  }
                                  className={
                                    txn.transaction_type === "earn"
                                      ? "bg-emerald-500"
                                      : ""
                                  }
                                >
                                  {txn.transaction_type}
                                </Badge>
                                <div>
                                  <p className="text-sm font-medium capitalize">
                                    {txn.source_type}
                                  </p>
                                  {txn.description && (
                                    <p className="text-xs text-muted-foreground">
                                      {txn.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <p
                                  className={`text-sm font-medium ${txn.points_amount > 0 ? "text-emerald-600" : "text-blue-600"}`}
                                >
                                  {txn.points_amount > 0 ? "+" : ""}
                                  {txn.points_amount}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {format(
                                    new Date(txn.created_at),
                                    "MMM d, yyyy",
                                  )}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Trophy className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No loyalty program data available for this customer</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Time-Based & Lifecycle Metrics Card */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-indigo-500" />
                  Time-Based & Lifecycle Metrics
                  {lifecycleMetrics && (
                    <Badge
                      variant="outline"
                      className={`ml-2 capitalize ${getLifecycleStageConfig(lifecycleMetrics.lifecycle_stage).borderColor} ${getLifecycleStageConfig(lifecycleMetrics.lifecycle_stage).color}`}
                    >
                      {
                        getLifecycleStageConfig(
                          lifecycleMetrics.lifecycle_stage,
                        ).icon
                      }{" "}
                      {
                        getLifecycleStageConfig(
                          lifecycleMetrics.lifecycle_stage,
                        ).label
                      }
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {lifecycleMetrics ? (
                  <>
                    {/* Time-Based Metrics */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div
                        className={`p-4 rounded-lg border ${
                          (lifecycleMetrics.days_since_signup ?? 0) > 365
                            ? "bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20"
                            : "bg-muted/50 border-muted"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar className="h-4 w-4 text-purple-500" />
                          <p className="text-sm text-muted-foreground">
                            Days Since Signup
                          </p>
                        </div>
                        <p className="text-2xl font-bold text-purple-600">
                          {lifecycleMetrics.days_since_signup ?? "-"}
                        </p>
                        {lifecycleMetrics.customer_created_at && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(
                              new Date(lifecycleMetrics.customer_created_at),
                              "MMM d, yyyy",
                            )}
                          </p>
                        )}
                      </div>

                      <div
                        className={`p-4 rounded-lg border ${
                          (lifecycleMetrics.days_since_last_purchase ?? 0) > 45
                            ? "bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20"
                            : (lifecycleMetrics.days_since_last_purchase ?? 0) >
                                30
                              ? "bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 border-yellow-500/20"
                              : "bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <ShoppingCart
                            className={`h-4 w-4 ${
                              (lifecycleMetrics.days_since_last_purchase ?? 0) >
                              45
                                ? "text-orange-500"
                                : (lifecycleMetrics.days_since_last_purchase ??
                                      0) > 30
                                  ? "text-yellow-500"
                                  : "text-emerald-500"
                            }`}
                          />
                          <p className="text-sm text-muted-foreground">
                            Days Since Purchase
                          </p>
                        </div>
                        <p
                          className={`text-2xl font-bold ${
                            (lifecycleMetrics.days_since_last_purchase ?? 0) >
                            45
                              ? "text-orange-600"
                              : (lifecycleMetrics.days_since_last_purchase ??
                                    0) > 30
                                ? "text-yellow-600"
                                : "text-emerald-600"
                          }`}
                        >
                          {lifecycleMetrics.days_since_last_purchase ?? "-"}
                        </p>
                        {lifecycleMetrics.last_purchase_at && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(
                              new Date(lifecycleMetrics.last_purchase_at),
                              "MMM d, yyyy",
                            )}
                          </p>
                        )}
                      </div>

                      <div
                        className={`p-4 rounded-lg border ${
                          (lifecycleMetrics.days_since_last_engagement ?? 0) >
                          30
                            ? "bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20"
                            : "bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <MessageSquare
                            className={`h-4 w-4 ${
                              (lifecycleMetrics.days_since_last_engagement ??
                                0) > 30
                                ? "text-red-500"
                                : "text-blue-500"
                            }`}
                          />
                          <p className="text-sm text-muted-foreground">
                            Days Since Engagement
                          </p>
                        </div>
                        <p
                          className={`text-2xl font-bold ${
                            (lifecycleMetrics.days_since_last_engagement ?? 0) >
                            30
                              ? "text-red-600"
                              : "text-blue-600"
                          }`}
                        >
                          {lifecycleMetrics.days_since_last_engagement ?? "-"}
                        </p>
                        {lifecycleMetrics.last_any_engagement_at && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(
                              new Date(lifecycleMetrics.last_any_engagement_at),
                              "MMM d, yyyy",
                            )}
                          </p>
                        )}
                      </div>

                      <div className="p-4 bg-muted/50 rounded-lg border border-muted">
                        <div className="flex items-center gap-2 mb-2">
                          <Zap className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            Days Since Automation
                          </p>
                        </div>
                        <p className="text-2xl font-bold">
                          {lifecycleMetrics.days_since_last_automation ?? "-"}
                        </p>
                        {lifecycleMetrics.last_automation_received_at && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(
                              new Date(
                                lifecycleMetrics.last_automation_received_at,
                              ),
                              "MMM d, yyyy",
                            )}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Lifecycle Stage & Churn Risk */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      {/* Lifecycle Stage */}
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <RefreshCw className="h-4 w-4" />
                          Lifecycle Stage
                        </h4>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">
                              Current Stage
                            </span>
                            <Badge
                              className={`${getLifecycleStageConfig(lifecycleMetrics.lifecycle_stage).bgColor} ${getLifecycleStageConfig(lifecycleMetrics.lifecycle_stage).color} border-0`}
                            >
                              {
                                getLifecycleStageConfig(
                                  lifecycleMetrics.lifecycle_stage,
                                ).icon
                              }{" "}
                              {
                                getLifecycleStageConfig(
                                  lifecycleMetrics.lifecycle_stage,
                                ).label
                              }
                            </Badge>
                          </div>
                          {lifecycleMetrics.previous_lifecycle_stage && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">
                                Previous Stage
                              </span>
                              <span className="text-sm capitalize">
                                {lifecycleMetrics.previous_lifecycle_stage.replace(
                                  "_",
                                  " ",
                                )}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">
                              Days in Stage
                            </span>
                            <span className="text-sm font-medium">
                              {lifecycleMetrics.days_in_current_stage}
                            </span>
                          </div>
                          {lifecycleMetrics.lifecycle_stage_changed_at && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">
                                Stage Changed
                              </span>
                              <span className="text-sm">
                                {formatDistanceToNow(
                                  new Date(
                                    lifecycleMetrics.lifecycle_stage_changed_at,
                                  ),
                                  { addSuffix: true },
                                )}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Churn Risk */}
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <AlertTriangle
                            className={`h-4 w-4 ${
                              Number(lifecycleMetrics.churn_risk_score) >= 70
                                ? "text-red-500"
                                : Number(lifecycleMetrics.churn_risk_score) >=
                                    40
                                  ? "text-orange-500"
                                  : "text-emerald-500"
                            }`}
                          />
                          Churn Risk Analysis
                        </h4>
                        <div className="space-y-3">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm text-muted-foreground">
                                Risk Score
                              </span>
                              <span
                                className={`text-sm font-bold ${
                                  Number(lifecycleMetrics.churn_risk_score) >=
                                  70
                                    ? "text-red-600"
                                    : Number(
                                          lifecycleMetrics.churn_risk_score,
                                        ) >= 40
                                      ? "text-orange-600"
                                      : "text-emerald-600"
                                }`}
                              >
                                {Number(
                                  lifecycleMetrics.churn_risk_score,
                                ).toFixed(0)}
                                %
                              </span>
                            </div>
                            <Progress
                              value={Number(lifecycleMetrics.churn_risk_score)}
                              className={`h-2 ${
                                Number(lifecycleMetrics.churn_risk_score) >= 70
                                  ? "[&>div]:bg-red-500"
                                  : Number(lifecycleMetrics.churn_risk_score) >=
                                      40
                                    ? "[&>div]:bg-orange-500"
                                    : "[&>div]:bg-emerald-500"
                              }`}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">
                              Is Churned
                            </span>
                            <Badge
                              variant={
                                lifecycleMetrics.is_churned
                                  ? "destructive"
                                  : "outline"
                              }
                            >
                              {lifecycleMetrics.is_churned ? "Yes" : "No"}
                            </Badge>
                          </div>
                          {lifecycleMetrics.time_to_churn_days !== null && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">
                                Time to Churn
                              </span>
                              <span className="text-sm font-medium">
                                {lifecycleMetrics.time_to_churn_days} days
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Reactivation & Success Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          Churn Events
                        </p>
                        <p className="text-lg font-semibold">
                          {lifecycleMetrics.total_churn_events}
                        </p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          Reactivations
                        </p>
                        <p className="text-lg font-semibold text-emerald-600">
                          {lifecycleMetrics.successful_reactivations}
                        </p>
                      </div>
                      <div
                        className={`p-3 rounded-lg ${
                          Number(lifecycleMetrics.reactivation_success_rate) >
                          50
                            ? "bg-emerald-50 dark:bg-emerald-950/30"
                            : "bg-muted/50"
                        }`}
                      >
                        <p className="text-sm text-muted-foreground">
                          Reactivation Rate
                        </p>
                        <p
                          className={`text-lg font-semibold ${Number(lifecycleMetrics.reactivation_success_rate) > 50 ? "text-emerald-600" : ""}`}
                        >
                          {Number(
                            lifecycleMetrics.reactivation_success_rate,
                          ).toFixed(0)}
                          %
                        </p>
                      </div>
                      {lifecycleMetrics.time_to_reactivation_days !== null && (
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <p className="text-sm text-muted-foreground">
                            Time to Reactivate
                          </p>
                          <p className="text-lg font-semibold">
                            {lifecycleMetrics.time_to_reactivation_days} days
                          </p>
                        </div>
                      )}
                      {lifecycleMetrics.last_reactivation_trigger && (
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <p className="text-sm text-muted-foreground">
                            Last Trigger
                          </p>
                          <p className="text-sm font-medium capitalize">
                            {lifecycleMetrics.last_reactivation_trigger}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Lifecycle Event History */}
                    {lifecycleHistory && lifecycleHistory.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <Activity className="h-4 w-4" />
                          Lifecycle History
                        </h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {lifecycleHistory.slice(0, 5).map((event) => (
                            <div
                              key={event.id}
                              className="flex items-center justify-between p-2 bg-muted/30 rounded-lg"
                            >
                              <div className="flex items-center gap-3">
                                <Badge
                                  variant={
                                    event.event_type === "reactivated"
                                      ? "default"
                                      : event.event_type === "churned"
                                        ? "destructive"
                                        : event.event_type === "at_risk_alert"
                                          ? "secondary"
                                          : "outline"
                                  }
                                  className={
                                    event.event_type === "reactivated"
                                      ? "bg-emerald-500"
                                      : ""
                                  }
                                >
                                  {event.event_type === "stage_change"
                                    ? "Stage Change"
                                    : event.event_type === "reactivated"
                                      ? "Reactivated"
                                      : event.event_type === "churned"
                                        ? "Churned"
                                        : "At Risk"}
                                </Badge>
                                <div>
                                  {event.from_stage && event.to_stage && (
                                    <p className="text-sm font-medium flex items-center gap-1 capitalize">
                                      {event.from_stage.replace("_", " ")}
                                      <ArrowUpRight className="h-3 w-3" />
                                      {event.to_stage.replace("_", " ")}
                                    </p>
                                  )}
                                  {event.trigger_reason && (
                                    <p className="text-xs text-muted-foreground">
                                      {event.trigger_reason}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                {event.churn_risk_score_at_event !== null && (
                                  <p className="text-sm font-medium">
                                    Risk:{" "}
                                    {Number(
                                      event.churn_risk_score_at_event,
                                    ).toFixed(0)}
                                    %
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground">
                                  {format(
                                    new Date(event.created_at),
                                    "MMM d, yyyy",
                                  )}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No lifecycle metrics available for this customer</p>
                    <p className="text-xs mt-1">
                      Metrics will be calculated when the customer has activity
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Content Interaction & Intent Metrics Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Content Interaction & Intent Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                {contentIntentMetrics ? (
                  <>
                    {/* Intent Score Hero */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <div
                        className={`p-4 rounded-lg border-2 ${
                          getIntentLevelConfig(
                            contentIntentMetrics.intent_level,
                          ).bgColor
                        } ${getIntentLevelConfig(contentIntentMetrics.intent_level).color.replace("text-", "border-")}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">
                            Intent Score
                          </span>
                          <Badge
                            className={`${getIntentLevelConfig(contentIntentMetrics.intent_level).bgColor} ${getIntentLevelConfig(contentIntentMetrics.intent_level).color}`}
                          >
                            {
                              getIntentLevelConfig(
                                contentIntentMetrics.intent_level,
                              ).label
                            }
                          </Badge>
                        </div>
                        <div className="flex items-end gap-2">
                          <span className="text-3xl font-bold">
                            {Number(contentIntentMetrics.intent_score).toFixed(
                              0,
                            )}
                          </span>
                          <span className="text-lg text-muted-foreground mb-1">
                            /100
                          </span>
                          {contentIntentMetrics.intent_trend ===
                            "increasing" && (
                            <ArrowUpRight className="h-5 w-5 text-emerald-500 mb-1" />
                          )}
                          {contentIntentMetrics.intent_trend ===
                            "decreasing" && (
                            <ArrowDownRight className="h-5 w-5 text-red-500 mb-1" />
                          )}
                        </div>
                        <Progress
                          value={Number(contentIntentMetrics.intent_score)}
                          className="h-2 mt-2"
                        />
                      </div>

                      <div className="p-4 bg-muted/50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">
                            Engagement Depth
                          </span>
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <span className="text-2xl font-bold">
                          {Number(
                            contentIntentMetrics.engagement_depth_score,
                          ).toFixed(0)}
                          %
                        </span>
                        <Progress
                          value={Number(
                            contentIntentMetrics.engagement_depth_score,
                          )}
                          className="h-2 mt-2"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {contentIntentMetrics.total_messages_read_deeply} deep
                          reads / {contentIntentMetrics.total_messages_opened}{" "}
                          opens
                        </p>
                      </div>

                      <div className="p-4 bg-muted/50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">
                            Message Relevance
                          </span>
                          <Target className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <span className="text-2xl font-bold">
                          {Number(
                            contentIntentMetrics.message_relevance_score,
                          ).toFixed(0)}
                          %
                        </span>
                        <Progress
                          value={Number(
                            contentIntentMetrics.message_relevance_score,
                          )}
                          className="h-2 mt-2"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Quick open rate:{" "}
                          {Number(contentIntentMetrics.quick_open_rate).toFixed(
                            0,
                          )}
                          %
                        </p>
                      </div>
                    </div>

                    {/* Content Type Engagement */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="p-4 bg-muted/30 rounded-lg">
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <BookOpen className="h-4 w-4" />
                          Content Type Engagement
                        </h4>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">
                              Story Content
                            </span>
                            <div className="text-right">
                              <span className="text-sm font-medium">
                                {contentIntentMetrics.total_story_views} views
                              </span>
                              <span className="text-xs text-muted-foreground ml-2">
                                (
                                {Number(
                                  contentIntentMetrics.story_engagement_rate,
                                ).toFixed(1)}
                                % CTR)
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">
                              Offer Content
                            </span>
                            <div className="text-right">
                              <span className="text-sm font-medium">
                                {contentIntentMetrics.total_offer_views} views
                              </span>
                              <span className="text-xs text-muted-foreground ml-2">
                                (
                                {Number(
                                  contentIntentMetrics.offer_engagement_rate,
                                ).toFixed(1)}
                                % CTR)
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t">
                            <span className="text-sm text-muted-foreground">
                              Preferred Type
                            </span>
                            <Badge variant="outline" className="capitalize">
                              {contentIntentMetrics.preferred_content_type}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-muted/30 rounded-lg">
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <BarChart3 className="h-4 w-4" />
                          Edu vs Promo Response
                        </h4>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">
                              Educational
                            </span>
                            <div className="text-right">
                              <span className="text-sm font-medium">
                                {Number(
                                  contentIntentMetrics.educational_response_rate,
                                ).toFixed(1)}
                                %
                              </span>
                              <span className="text-xs text-muted-foreground ml-2">
                                (
                                {
                                  contentIntentMetrics.educational_messages_engaged
                                }
                                /
                                {
                                  contentIntentMetrics.educational_messages_received
                                }
                                )
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">
                              Promotional
                            </span>
                            <div className="text-right">
                              <span className="text-sm font-medium">
                                {Number(
                                  contentIntentMetrics.promotional_response_rate,
                                ).toFixed(1)}
                                %
                              </span>
                              <span className="text-xs text-muted-foreground ml-2">
                                (
                                {
                                  contentIntentMetrics.promotional_messages_engaged
                                }
                                /
                                {
                                  contentIntentMetrics.promotional_messages_received
                                }
                                )
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t">
                            <span className="text-sm text-muted-foreground">
                              Preference
                            </span>
                            <Badge
                              className={`${getContentPreferenceConfig(contentIntentMetrics.content_preference as "educational" | "promotional" | "balanced").bgColor} ${getContentPreferenceConfig(contentIntentMetrics.content_preference as "educational" | "promotional" | "balanced").color}`}
                            >
                              {
                                getContentPreferenceConfig(
                                  contentIntentMetrics.content_preference as
                                    | "educational"
                                    | "promotional"
                                    | "balanced",
                                ).icon
                              }{" "}
                              {
                                getContentPreferenceConfig(
                                  contentIntentMetrics.content_preference as
                                    | "educational"
                                    | "promotional"
                                    | "balanced",
                                ).label
                              }
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* CTA & Click Patterns */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          CTA Click Rate
                        </p>
                        <p className="text-xl font-bold text-primary">
                          {Number(contentIntentMetrics.cta_click_rate).toFixed(
                            1,
                          )}
                          %
                        </p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          CTA Frequency
                        </p>
                        <p className="text-xl font-bold">
                          {Number(
                            contentIntentMetrics.cta_interaction_frequency,
                          ).toFixed(2)}
                          /msg
                        </p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          Brand Story Open
                        </p>
                        <p className="text-xl font-bold">
                          {Number(
                            contentIntentMetrics.brand_story_open_rate,
                          ).toFixed(1)}
                          %
                        </p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          Click Consistency
                        </p>
                        <p className="text-xl font-bold">
                          {Number(
                            contentIntentMetrics.click_pattern_consistency_score,
                          ).toFixed(0)}
                          %
                        </p>
                      </div>
                    </div>

                    {/* Click Pattern Details */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <p className="text-xs text-muted-foreground">
                          Click Timing
                        </p>
                        <Badge
                          className={`mt-1 ${getClickTimingConfig(contentIntentMetrics.click_timing_pattern as "immediate" | "considered" | "delayed" | "unknown").color}`}
                        >
                          {
                            getClickTimingConfig(
                              contentIntentMetrics.click_timing_pattern as
                                | "immediate"
                                | "considered"
                                | "delayed"
                                | "unknown",
                            ).label
                          }
                        </Badge>
                      </div>
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <p className="text-xs text-muted-foreground">
                          Clicks (7d)
                        </p>
                        <p className="text-lg font-semibold">
                          {contentIntentMetrics.cta_clicks_last_7d}
                        </p>
                      </div>
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <p className="text-xs text-muted-foreground">
                          Clicks (30d)
                        </p>
                        <p className="text-lg font-semibold">
                          {contentIntentMetrics.cta_clicks_last_30d}
                        </p>
                      </div>
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <p className="text-xs text-muted-foreground">
                          Most Clicked CTA
                        </p>
                        <p className="text-sm font-medium capitalize">
                          {contentIntentMetrics.most_clicked_cta_type || "-"}
                        </p>
                      </div>
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <p className="text-xs text-muted-foreground">
                          Depth Ratio
                        </p>
                        <p className="text-lg font-semibold">
                          {(
                            Number(contentIntentMetrics.depth_ratio) * 100
                          ).toFixed(0)}
                          %
                        </p>
                      </div>
                    </div>

                    {/* Session Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
                        <p className="text-sm text-emerald-700 dark:text-emerald-300">
                          Multi-Content Sessions
                        </p>
                        <p className="text-xl font-bold text-emerald-800 dark:text-emerald-200">
                          {contentIntentMetrics.multi_content_sessions}
                        </p>
                      </div>
                      <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                          Single-Content Sessions
                        </p>
                        <p className="text-xl font-bold text-blue-800 dark:text-blue-200">
                          {contentIntentMetrics.single_content_sessions}
                        </p>
                      </div>
                      <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
                        <p className="text-sm text-purple-700 dark:text-purple-300">
                          First CTA Clicks
                        </p>
                        <p className="text-xl font-bold text-purple-800 dark:text-purple-200">
                          {contentIntentMetrics.clicks_on_first_cta}
                        </p>
                      </div>
                      <div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg border border-orange-200 dark:border-orange-800">
                        <p className="text-sm text-orange-700 dark:text-orange-300">
                          After-Scroll Clicks
                        </p>
                        <p className="text-xl font-bold text-orange-800 dark:text-orange-200">
                          {contentIntentMetrics.clicks_after_scrolling}
                        </p>
                      </div>
                    </div>

                    {/* Interaction History */}
                    {interactionHistory && interactionHistory.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <MousePointerClick className="h-4 w-4" />
                          Recent Interactions
                        </h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {interactionHistory.slice(0, 5).map((event) => (
                            <div
                              key={event.id}
                              className="flex items-center justify-between p-2 bg-muted/30 rounded-lg"
                            >
                              <div className="flex items-center gap-3">
                                <Badge variant="outline" className="capitalize">
                                  {event.channel}
                                </Badge>
                                <div>
                                  <p className="text-sm font-medium capitalize">
                                    {event.interaction_type.replace("_", " ")}
                                  </p>
                                  <p className="text-xs text-muted-foreground capitalize">
                                    {event.content_type} -{" "}
                                    {event.content_category || "General"}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                {event.is_deep_engagement && (
                                  <Badge
                                    variant="default"
                                    className="text-xs bg-emerald-500"
                                  >
                                    Deep
                                  </Badge>
                                )}
                                <p className="text-xs text-muted-foreground">
                                  {format(
                                    new Date(event.created_at),
                                    "MMM d, h:mm a",
                                  )}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No content intent metrics available for this customer</p>
                    <p className="text-xs mt-1">
                      Metrics will be calculated when the customer interacts
                      with content
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Negative Behavior & Risk Signals Card */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5" />
                  Negative Behavior & Risk Signals
                </CardTitle>
              </CardHeader>
              <CardContent>
                {riskSignals ? (
                  <>
                    {/* Overall Risk Assessment */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <div
                        className={`p-4 rounded-lg border-2 ${
                          getRiskLevelConfig(riskSignals.risk_level).bgColor
                        } ${getRiskLevelConfig(riskSignals.risk_level).color.replace("text-", "border-")}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">
                            Overall Risk Score
                          </span>
                          <Badge
                            className={`${getRiskLevelConfig(riskSignals.risk_level).bgColor} ${getRiskLevelConfig(riskSignals.risk_level).color}`}
                          >
                            {getRiskLevelConfig(riskSignals.risk_level).icon}{" "}
                            {getRiskLevelConfig(riskSignals.risk_level).label}
                          </Badge>
                        </div>
                        <div className="flex items-end gap-2">
                          <span className="text-3xl font-bold">
                            {Number(riskSignals.overall_risk_score).toFixed(0)}
                          </span>
                          <span className="text-lg text-muted-foreground mb-1">
                            /100
                          </span>
                          <span
                            className={`text-sm mb-1 ${getRiskTrendConfig(riskSignals.risk_trend).color}`}
                          >
                            {getRiskTrendConfig(riskSignals.risk_trend).icon}{" "}
                            {getRiskTrendConfig(riskSignals.risk_trend).label}
                          </span>
                        </div>
                        <Progress
                          value={Number(riskSignals.overall_risk_score)}
                          className="h-2 mt-2"
                        />
                        <p className="text-xs text-muted-foreground mt-2">
                          {
                            getRiskLevelConfig(riskSignals.risk_level)
                              .description
                          }
                        </p>
                      </div>

                      <div className="p-4 bg-muted/50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">
                            Suppression Status
                          </span>
                          {riskSignals.should_suppress ? (
                            <Ban className="h-4 w-4 text-red-500" />
                          ) : (
                            <ShieldAlert className="h-4 w-4 text-green-500" />
                          )}
                        </div>
                        <Badge
                          variant={
                            riskSignals.should_suppress
                              ? "destructive"
                              : "outline"
                          }
                        >
                          {riskSignals.should_suppress
                            ? "Suppressed"
                            : "Active"}
                        </Badge>
                        {riskSignals.suppression_reason && (
                          <p className="text-xs text-muted-foreground mt-2">
                            {riskSignals.suppression_reason}
                          </p>
                        )}
                        {riskSignals.last_risk_assessment_at && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Last assessed:{" "}
                            {format(
                              new Date(riskSignals.last_risk_assessment_at),
                              "MMM d, h:mm a",
                            )}
                          </p>
                        )}
                      </div>

                      <div className="p-4 bg-muted/50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">
                            Active Risk Factors
                          </span>
                          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                        </div>
                        {riskSignals.risk_factors &&
                        riskSignals.risk_factors.length > 0 ? (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {riskSignals.risk_factors.map((factor, i) => (
                              <Badge
                                key={i}
                                variant="outline"
                                className="text-xs capitalize"
                              >
                                {getRiskFactorLabel(factor)}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            No active risk factors
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Individual Risk Scores */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      {/* Opt-Out Risk */}
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Ban className="h-4 w-4 text-red-500" />
                          <p className="text-xs text-muted-foreground">
                            Opt-Out Risk
                          </p>
                        </div>
                        <p className="text-xl font-bold">
                          {Number(riskSignals.opt_out_risk_score).toFixed(0)}
                        </p>
                        {riskSignals.is_rapid_opt_out && (
                          <Badge variant="destructive" className="text-xs mt-1">
                            Rapid
                          </Badge>
                        )}
                      </div>

                      {/* Ignore Streak Risk */}
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <VolumeX className="h-4 w-4 text-yellow-500" />
                          <p className="text-xs text-muted-foreground">
                            Ignore Streak
                          </p>
                        </div>
                        <p className="text-xl font-bold">
                          {Number(riskSignals.ignore_streak_risk_score).toFixed(
                            0,
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Current: {riskSignals.current_ignore_streak} msgs
                        </p>
                      </div>

                      {/* Engagement Gap Risk */}
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <MessageSquare className="h-4 w-4 text-blue-500" />
                          <p className="text-xs text-muted-foreground">
                            Engagement Gap
                          </p>
                        </div>
                        <p className="text-xl font-bold">
                          {Number(
                            riskSignals.engagement_gap_risk_score,
                          ).toFixed(0)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {riskSignals.messages_since_last_engagement} since
                          engage
                        </p>
                      </div>

                      {/* Dormancy Risk */}
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Moon className="h-4 w-4 text-indigo-500" />
                          <p className="text-xs text-muted-foreground">
                            Dormancy
                          </p>
                        </div>
                        <p className="text-xl font-bold">
                          {Number(riskSignals.dormancy_risk_score).toFixed(0)}
                        </p>
                        {riskSignals.is_long_term_dormant && (
                          <Badge variant="secondary" className="text-xs mt-1">
                            Dormant
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Second Row of Risks */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      {/* Coupon Dependency */}
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Ticket className="h-4 w-4 text-purple-500" />
                          <p className="text-xs text-muted-foreground">
                            Coupon Depend.
                          </p>
                        </div>
                        <p className="text-xl font-bold">
                          {Number(
                            riskSignals.coupon_dependency_risk_score,
                          ).toFixed(0)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {Number(riskSignals.coupon_only_ratio).toFixed(0)}% w/
                          coupon
                        </p>
                      </div>

                      {/* Incentive Abuse */}
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Gift className="h-4 w-4 text-orange-500" />
                          <p className="text-xs text-muted-foreground">
                            Incentive Abuse
                          </p>
                        </div>
                        <p className="text-xl font-bold">
                          {Number(
                            riskSignals.incentive_abuse_risk_score,
                          ).toFixed(0)}
                        </p>
                        {riskSignals.is_suspected_incentive_abuser && (
                          <Badge variant="destructive" className="text-xs mt-1">
                            Suspected
                          </Badge>
                        )}
                      </div>

                      {/* Bounce Risk */}
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <MailX className="h-4 w-4 text-red-500" />
                          <p className="text-xs text-muted-foreground">
                            Bounce Risk
                          </p>
                        </div>
                        <p className="text-xl font-bold">
                          {Number(riskSignals.bounce_risk_score).toFixed(0)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {riskSignals.total_hard_bounces} hard bounces
                        </p>
                      </div>

                      {/* SMS Risk */}
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Phone className="h-4 w-4 text-gray-500" />
                          <p className="text-xs text-muted-foreground">
                            SMS Risk
                          </p>
                        </div>
                        <p className="text-xl font-bold">
                          {Number(riskSignals.sms_risk_score).toFixed(0)}
                        </p>
                        {riskSignals.is_sms_unreachable && (
                          <Badge variant="destructive" className="text-xs mt-1">
                            Unreachable
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Detailed Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      {/* Opt-Out Details */}
                      <div className="p-4 bg-muted/30 rounded-lg">
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <Ban className="h-4 w-4" />
                          Opt-Out Details
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Total Opt-Outs
                            </span>
                            <span className="font-medium">
                              {riskSignals.total_opt_outs}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              SMS Opt-Outs
                            </span>
                            <span className="font-medium">
                              {riskSignals.sms_opt_outs}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Email Opt-Outs
                            </span>
                            <span className="font-medium">
                              {riskSignals.email_opt_outs}
                            </span>
                          </div>
                          {riskSignals.messages_before_opt_out !== null && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Msgs Before Opt-Out
                              </span>
                              <span className="font-medium">
                                {riskSignals.messages_before_opt_out}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Bounce Details */}
                      <div className="p-4 bg-muted/30 rounded-lg">
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <MailX className="h-4 w-4" />
                          Deliverability Issues
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Hard Bounces
                            </span>
                            <span className="font-medium">
                              {riskSignals.total_hard_bounces}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Soft Bounces
                            </span>
                            <span className="font-medium">
                              {riskSignals.total_soft_bounces}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Consecutive Hard
                            </span>
                            <span className="font-medium">
                              {riskSignals.consecutive_hard_bounces}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Email Valid
                            </span>
                            <Badge
                              variant={
                                riskSignals.is_email_invalid
                                  ? "destructive"
                                  : "outline"
                              }
                              className="text-xs"
                            >
                              {riskSignals.is_email_invalid
                                ? "Invalid"
                                : "Valid"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Recent Negative Events */}
                    {negativeEvents && negativeEvents.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          Recent Negative Events
                        </h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {negativeEvents.slice(0, 5).map((event) => {
                            const eventConfig = getEventTypeConfig(
                              event.event_type,
                            );
                            return (
                              <div
                                key={event.id}
                                className="flex items-center justify-between p-2 bg-muted/30 rounded-lg"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="text-lg">
                                    {eventConfig.icon}
                                  </span>
                                  <div>
                                    <p
                                      className={`text-sm font-medium ${eventConfig.color}`}
                                    >
                                      {eventConfig.label}
                                    </p>
                                    <p className="text-xs text-muted-foreground capitalize">
                                      {event.channel}{" "}
                                      {event.event_subtype
                                        ? `- ${event.event_subtype}`
                                        : ""}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <Badge variant="outline" className="text-xs">
                                    Impact: +
                                    {Number(event.risk_score_impact).toFixed(0)}
                                  </Badge>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {format(
                                      new Date(event.created_at),
                                      "MMM d, h:mm a",
                                    )}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <ShieldAlert className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No risk signal data available for this customer</p>
                    <p className="text-xs mt-1">
                      Signals will be calculated based on customer behavior
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

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
                    <p className="text-xl font-bold">
                      {customer.sms_total_sent}
                    </p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Delivered</p>
                    <p className="text-xl font-bold">
                      {customer.sms_total_delivered}
                    </p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Clicked</p>
                    <p className="text-xl font-bold">
                      {customer.sms_total_clicked}
                    </p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Replied</p>
                    <p className="text-xl font-bold">
                      {customer.sms_total_replied}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    <p className="text-sm text-emerald-700 dark:text-emerald-300">
                      Delivery Rate
                    </p>
                    <p className="text-xl font-bold text-emerald-800 dark:text-emerald-200">
                      {customer.sms_delivery_rate.toFixed(1)}%
                    </p>
                  </div>
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Reply Rate
                    </p>
                    <p className="text-xl font-bold text-blue-800 dark:text-blue-200">
                      {customer.sms_reply_rate.toFixed(1)}%
                    </p>
                  </div>
                  <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
                    <p className="text-sm text-purple-700 dark:text-purple-300">
                      Click Rate
                    </p>
                    <p className="text-xl font-bold text-purple-800 dark:text-purple-200">
                      {customer.sms_click_rate.toFixed(1)}%
                    </p>
                  </div>
                  <div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg border border-orange-200 dark:border-orange-800">
                    <p className="text-sm text-orange-700 dark:text-orange-300">
                      Avg Response
                    </p>
                    <p className="text-xl font-bold text-orange-800 dark:text-orange-200">
                      {customer.sms_avg_response_time_minutes > 0
                        ? `${customer.sms_avg_response_time_minutes.toFixed(0)} min`
                        : "-"}
                    </p>
                  </div>
                </div>
                {customer.sms_total_opt_outs > 0 && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-700 dark:text-red-300">
                      Opt-Out Rate
                    </p>
                    <p className="text-xl font-bold text-red-800 dark:text-red-200">
                      {customer.sms_opt_out_rate.toFixed(1)}%
                    </p>
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
                    <p className="text-xl font-bold">
                      {customer.email_total_sent}
                    </p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Opened</p>
                    <p className="text-xl font-bold">
                      {customer.email_total_opened}
                    </p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Clicked</p>
                    <p className="text-xl font-bold">
                      {customer.email_total_clicked}
                    </p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Bounced</p>
                    <p className="text-xl font-bold">
                      {customer.email_total_bounced}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    <p className="text-sm text-emerald-700 dark:text-emerald-300">
                      Open Rate
                    </p>
                    <p className="text-xl font-bold text-emerald-800 dark:text-emerald-200">
                      {customer.email_open_rate.toFixed(1)}%
                    </p>
                  </div>
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Click Rate
                    </p>
                    <p className="text-xl font-bold text-blue-800 dark:text-blue-200">
                      {customer.email_click_rate.toFixed(1)}%
                    </p>
                  </div>
                </div>
                {customer.email_total_unsubscribes > 0 && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-700 dark:text-red-300">
                      Unsubscribes
                    </p>
                    <p className="text-xl font-bold text-red-800 dark:text-red-200">
                      {customer.email_total_unsubscribes}
                    </p>
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
          <div className="space-y-4">
            <div className="flex justify-end">
              <a
                href={`/activity?customer=${customer.id}`}
                className="text-sm text-brand-teal hover:underline"
              >
                Open Activity Center
              </a>
            </div>
            <ActivityFeedList feed={activityFeed} groupMode="campaign" />
          </div>
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
