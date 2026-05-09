import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const GRAPH_API_VERSION = Deno.env.get("FACEBOOK_GRAPH_API_VERSION") || "v18.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type SocialConnection = {
  id: string;
  platform: string;
  platform_account_id: string;
  platform_account_name: string | null;
  access_token: string;
  user_id: string;
};

type ContentTaskAnalyticsTarget = {
  id: string;
  platform_post_id: string | null;
};

type PostPerformanceUpsert = {
  content_task_id: string;
  platform: "facebook" | "instagram";
  platform_post_id: string;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  reach: number;
  impressions: number;
  engagement_rate: number;
  collected_at: string;
};

function getLatestMetricValue(
  metric: { values?: Array<{ value?: number | null }> } | null | undefined,
) {
  if (!metric?.values?.length) {
    return 0;
  }

  const latestValue = metric.values[metric.values.length - 1]?.value;
  return typeof latestValue === "number" ? latestValue : 0;
}

function calculateEngagementRate(metrics: {
  likes_count: number;
  comments_count: number;
  shares_count: number;
  reach: number;
  impressions: number;
}) {
  const denominator = metrics.reach > 0 ? metrics.reach : metrics.impressions;

  if (denominator <= 0) {
    return 0;
  }

  const engagements =
    metrics.likes_count + metrics.comments_count + metrics.shares_count;

  return Number(((engagements / denominator) * 100).toFixed(2));
}

async function fetchPublishedTasksForPlatform(
  supabaseClient: any,
  userId: string,
  platform: "facebook" | "instagram",
) {
  const { data, error } = await supabaseClient
    .from("content_tasks")
    .select("id, platform_post_id")
    .eq("user_id", userId)
    .eq("post_type", platform)
    .is("deleted_at", null)
    .not("platform_post_id", "is", null);

  if (error) {
    throw error;
  }

  return (data || []).filter(
    (task: ContentTaskAnalyticsTarget) =>
      typeof task.platform_post_id === "string" &&
      task.platform_post_id.trim().length > 0,
  );
}

async function upsertPostPerformance(
  supabaseClient: any,
  payload: PostPerformanceUpsert,
) {
  const { error } = await supabaseClient
    .from("post_performance")
    .upsert(payload, { onConflict: "content_task_id,platform" });

  if (error) {
    throw error;
  }
}

async function syncFacebookPostPerformanceMetrics(
  supabaseClient: any,
  connection: SocialConnection,
) {
  const tasks = await fetchPublishedTasksForPlatform(
    supabaseClient,
    connection.user_id,
    "facebook",
  );
  const collectedAt = new Date().toISOString();

  for (const task of tasks) {
    try {
      const postUrl = new URL(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${task.platform_post_id}`,
      );
      postUrl.searchParams.set(
        "fields",
        "likes.summary(true),comments.summary(true),shares",
      );
      postUrl.searchParams.set("access_token", connection.access_token);

      const insightsUrl = new URL(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${task.platform_post_id}/insights`,
      );
      insightsUrl.searchParams.set(
        "metric",
        "post_impressions,post_impressions_unique",
      );
      insightsUrl.searchParams.set("access_token", connection.access_token);

      const [postResponse, insightsResponse] = await Promise.all([
        fetch(postUrl),
        fetch(insightsUrl),
      ]);

      const postData = await postResponse.json();
      const insightsData = await insightsResponse.json();

      if (postData.error) {
        throw new Error(
          `Facebook post metrics error: ${postData.error.message}`,
        );
      }

      if (insightsData.error) {
        throw new Error(
          `Facebook post insights error: ${insightsData.error.message}`,
        );
      }

      const insightsByName = new Map(
        (insightsData.data || []).map(
          (metric: {
            name: string;
            values?: Array<{ value?: number | null }>;
          }) => [metric.name, getLatestMetricValue(metric)],
        ),
      );

      const row = {
        content_task_id: task.id,
        platform: "facebook" as const,
        platform_post_id: task.platform_post_id,
        likes_count: postData.likes?.summary?.total_count || 0,
        comments_count: postData.comments?.summary?.total_count || 0,
        shares_count: postData.shares?.count || 0,
        reach: insightsByName.get("post_impressions_unique") || 0,
        impressions: insightsByName.get("post_impressions") || 0,
        engagement_rate: 0,
        collected_at: collectedAt,
      };

      row.engagement_rate = calculateEngagementRate(row);

      await upsertPostPerformance(supabaseClient, row);
    } catch (error) {
      console.error(
        `Error syncing Facebook post metrics for task ${task.id}:`,
        error,
      );
    }
  }
}

async function syncInstagramPostPerformanceMetrics(
  supabaseClient: any,
  connection: SocialConnection,
) {
  const tasks = await fetchPublishedTasksForPlatform(
    supabaseClient,
    connection.user_id,
    "instagram",
  );
  const collectedAt = new Date().toISOString();

  for (const task of tasks) {
    try {
      const mediaUrl = new URL(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${task.platform_post_id}`,
      );
      mediaUrl.searchParams.set("fields", "like_count,comments_count");
      mediaUrl.searchParams.set("access_token", connection.access_token);

      const insightsUrl = new URL(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${task.platform_post_id}/insights`,
      );
      insightsUrl.searchParams.set("metric", "impressions,reach");
      insightsUrl.searchParams.set("access_token", connection.access_token);

      const [mediaResponse, insightsResponse] = await Promise.all([
        fetch(mediaUrl),
        fetch(insightsUrl),
      ]);

      const mediaData = await mediaResponse.json();
      const insightsData = await insightsResponse.json();

      if (mediaData.error) {
        throw new Error(
          `Instagram media metrics error: ${mediaData.error.message}`,
        );
      }

      if (insightsData.error) {
        throw new Error(
          `Instagram media insights error: ${insightsData.error.message}`,
        );
      }

      const insightsByName = new Map(
        (insightsData.data || []).map(
          (metric: {
            name: string;
            values?: Array<{ value?: number | null }>;
          }) => [metric.name, getLatestMetricValue(metric)],
        ),
      );

      const row = {
        content_task_id: task.id,
        platform: "instagram" as const,
        platform_post_id: task.platform_post_id,
        likes_count: mediaData.like_count || 0,
        comments_count: mediaData.comments_count || 0,
        shares_count: 0,
        reach: insightsByName.get("reach") || 0,
        impressions: insightsByName.get("impressions") || 0,
        engagement_rate: 0,
        collected_at: collectedAt,
      };

      row.engagement_rate = calculateEngagementRate(row);

      await upsertPostPerformance(supabaseClient, row);
    } catch (error) {
      console.error(
        `Error syncing Instagram post metrics for task ${task.id}:`,
        error,
      );
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Get all active social connections
    const { data: connections, error: connectionsError } = await supabaseClient
      .from("social_connections")
      .select("*")
      .eq("is_active", true);

    if (connectionsError) throw connectionsError;

    const syncResults = [];

    for (const connection of connections || []) {
      try {
        console.log(
          `Syncing analytics for ${connection.platform} - ${connection.platform_account_name}`,
        );

        if (connection.platform === "facebook") {
          await syncFacebookMetrics(supabaseClient, connection);
        } else if (connection.platform === "instagram") {
          await syncInstagramMetrics(supabaseClient, connection);
        } else if (connection.platform === "google_my_business") {
          await syncGoogleMyBusinessMetrics(supabaseClient, connection);
        }

        syncResults.push({
          platform: connection.platform,
          account: connection.platform_account_name,
          status: "success",
        });
      } catch (error) {
        console.error(`Error syncing ${connection.platform}:`, error);
        syncResults.push({
          platform: connection.platform,
          account: connection.platform_account_name,
          status: "error",
          error: error.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        synced: syncResults.length,
        results: syncResults,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error in sync-analytics:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function syncFacebookMetrics(supabaseClient: any, connection: any) {
  const today = new Date().toISOString().split("T")[0];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  // Get Facebook page insights
  const insightsUrl = `https://graph.facebook.com/v18.0/${connection.platform_account_id}/insights/page_impressions,page_reach,page_engaged_users?since=${sevenDaysAgo}&until=${today}&access_token=${connection.access_token}`;

  const response = await fetch(insightsUrl);
  const data = await response.json();

  if (data.error) {
    throw new Error(`Facebook API Error: ${data.error.message}`);
  }

  // Store metrics in analytics_data table
  for (const metric of data.data || []) {
    const metricType =
      metric.name === "page_impressions"
        ? "impressions"
        : metric.name === "page_reach"
          ? "reach"
          : "engagement";

    const value = metric.values[metric.values.length - 1]?.value || 0;

    await supabaseClient.from("analytics_data").upsert({
      connection_id: connection.id,
      metric_type: metricType,
      metric_value: value,
      date_collected: today,
      metadata: { source: "facebook_insights", period: "7_days" },
    });
  }

  await syncFacebookPostPerformanceMetrics(supabaseClient, connection);
}

async function syncInstagramMetrics(supabaseClient: any, connection: any) {
  const today = new Date().toISOString().split("T")[0];

  // Get Instagram insights
  const insightsUrl = `https://graph.facebook.com/v18.0/${connection.platform_account_id}/insights?metric=impressions,reach,profile_views&period=day&access_token=${connection.access_token}`;

  const response = await fetch(insightsUrl);
  const data = await response.json();

  if (data.error) {
    throw new Error(`Instagram API Error: ${data.error.message}`);
  }

  // Store metrics
  for (const metric of data.data || []) {
    const value = metric.values[metric.values.length - 1]?.value || 0;

    await supabaseClient.from("analytics_data").upsert({
      connection_id: connection.id,
      metric_type: metric.name,
      metric_value: value,
      date_collected: today,
      metadata: { source: "instagram_insights", period: "day" },
    });
  }

  await syncInstagramPostPerformanceMetrics(supabaseClient, connection);
}

async function syncGoogleMyBusinessMetrics(
  supabaseClient: any,
  connection: any,
) {
  const today = new Date().toISOString().split("T")[0];

  // Get Google My Business insights
  const insightsUrl = `https://mybusiness.googleapis.com/v4/${connection.platform_account_id}/locations:reportInsights`;

  const requestBody = {
    reportRequests: [
      {
        metricRequests: [
          { metric: "QUERIES_DIRECT" },
          { metric: "QUERIES_INDIRECT" },
          { metric: "VIEWS_MAPS" },
          { metric: "VIEWS_SEARCH" },
          { metric: "ACTIONS_WEBSITE" },
          { metric: "ACTIONS_PHONE" },
        ],
        timeRange: {
          startTime: { year: 2024, month: 12, day: 6 },
          endTime: { year: 2024, month: 12, day: 13 },
        },
      },
    ],
  };

  const response = await fetch(insightsUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${connection.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`Google My Business API Error: ${data.error.message}`);
  }

  // Store metrics
  const report = data.reportResults?.[0];
  if (report?.metricValues) {
    for (const metric of report.metricValues) {
      let metricType = "views";
      let value = 0;

      switch (metric.metric) {
        case "QUERIES_DIRECT":
        case "QUERIES_INDIRECT":
          metricType = "search_queries";
          value = metric.totalValue?.value || 0;
          break;
        case "VIEWS_MAPS":
        case "VIEWS_SEARCH":
          metricType = "views";
          value = metric.totalValue?.value || 0;
          break;
        case "ACTIONS_WEBSITE":
          metricType = "clicks";
          value = metric.totalValue?.value || 0;
          break;
        case "ACTIONS_PHONE":
          metricType = "calls";
          value = metric.totalValue?.value || 0;
          break;
      }

      await supabaseClient.from("analytics_data").upsert({
        connection_id: connection.id,
        metric_type: metricType,
        metric_value: value,
        date_collected: today,
        metadata: {
          source: "google_my_business",
          metric_name: metric.metric,
          period: "7_days",
        },
      });
    }
  }
}
