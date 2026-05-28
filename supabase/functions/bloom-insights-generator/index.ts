import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "npm:@supabase/supabase-js@2";

import { buildCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { generateInsights as generateCampaignAnomalies } from "./generators/campaign-anomalies.ts";
import { generateInsights as generateDormantCustomers } from "./generators/dormant-customers.ts";
import { generateInsights as generateLowStock } from "./generators/low-stock.ts";
import { generateInsights as generatePendingDrafts } from "./generators/pending-drafts.ts";
import { generateInsights as generateRevenueAnomalies } from "./generators/revenue-anomalies.ts";
import type { ActiveTenant, GeneratedInsight, ServiceClient } from "./types.ts";
import { buildInsightDedupKey, toInsightInsert } from "./utils.ts";

const CORS_OPTIONS = {
  allowHeaders:
    "authorization, x-client-info, apikey, content-type, traceparent, tracestate, x-task-signature",
  allowMethods: "POST, OPTIONS",
};

const GENERATORS = [
  { key: "low-stock", run: generateLowStock },
  { key: "dormant-customers", run: generateDormantCustomers },
  { key: "campaign-anomalies", run: generateCampaignAnomalies },
  { key: "revenue-anomalies", run: generateRevenueAnomalies },
  { key: "pending-drafts", run: generatePendingDrafts },
] as const;

const MAX_INSIGHTS_PER_TENANT_PER_24H = 3;

type GeneratorKey = (typeof GENERATORS)[number]["key"];

type GeneratorStats = {
  generated: number;
  inserted: number;
  duplicates: number;
  errors: number;
};

type RunError = {
  tenantId: string | null;
  tenantName: string | null;
  generator: GeneratorKey | "cleanup" | "tenants";
  message: string;
};

type RecentInsightState = {
  dedupKeys: Set<string>;
  existingCount: number;
};

type PendingInsightInsert = {
  dedupeKey: string;
  generatorKey: GeneratorKey;
  insight: GeneratedInsight;
  order: number;
};

function createGeneratorStatsRecord(): Record<GeneratorKey, GeneratorStats> {
  return {
    "low-stock": { generated: 0, inserted: 0, duplicates: 0, errors: 0 },
    "dormant-customers": {
      generated: 0,
      inserted: 0,
      duplicates: 0,
      errors: 0,
    },
    "campaign-anomalies": {
      generated: 0,
      inserted: 0,
      duplicates: 0,
      errors: 0,
    },
    "revenue-anomalies": {
      generated: 0,
      inserted: 0,
      duplicates: 0,
      errors: 0,
    },
    "pending-drafts": { generated: 0, inserted: 0, duplicates: 0, errors: 0 },
  };
}

async function verifySignature(
  payload: string,
  signature: string,
  secret: string,
) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  const signatureBytes = new Uint8Array(
    signature.match(/.{1,2}/g)?.map((value) => Number.parseInt(value, 16)) ??
      [],
  );

  return crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes,
    encoder.encode(payload),
  );
}

async function authorizeInvocation(req: Request, serviceRoleKey: string) {
  const cronSecret = Deno.env.get("CRON_SIGNING_SECRET");
  const signature = req.headers.get("x-task-signature");

  if (cronSecret && signature) {
    const currentHour = new Date().toISOString().slice(0, 13);
    const previousHour = new Date(Date.now() - 3_600_000)
      .toISOString()
      .slice(0, 13);

    const currentValid = await verifySignature(
      `bloom-insights-generator:${currentHour}`,
      signature,
      cronSecret,
    );
    const previousValid = currentValid
      ? false
      : await verifySignature(
          `bloom-insights-generator:${previousHour}`,
          signature,
          cronSecret,
        );

    if (currentValid || previousValid) {
      return "cron-signature";
    }
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Authorization required.");
  }

  const token = authHeader.slice(7).trim();
  if (token !== serviceRoleKey) {
    throw new Error("Unauthorized.");
  }

  return "service-role";
}

async function loadActiveTenants(serviceClient: ServiceClient) {
  const { data, error } = await serviceClient
    .from("tenants")
    .select("id, name")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as ActiveTenant[];
}

async function loadRecentInsightState(
  serviceClient: ServiceClient,
  tenantId: string,
  now: Date,
): Promise<RecentInsightState> {
  const dedupeStart = new Date(now.getTime() - 86_400_000).toISOString();
  const { data, error } = await serviceClient
    .from("bloom_proactive_insights")
    .select("insight_type, entity_id")
    .eq("tenant_id", tenantId)
    .gte("created_at", dedupeStart);

  if (error) {
    throw error;
  }

  const rows = data ?? [];

  return {
    dedupKeys: new Set(
      rows.map((entry) =>
        buildInsightDedupKey(entry.insight_type, entry.entity_id),
      ),
    ),
    existingCount: rows.length,
  };
}

function getInsightSeverityRank(insight: GeneratedInsight) {
  switch (insight.severity) {
    case "critical":
      return 3;
    case "warning":
      return 2;
    case "info":
    default:
      return 1;
  }
}

function prioritizeInsights(
  insights: PendingInsightInsert[],
): PendingInsightInsert[] {
  return [...insights].sort((left, right) => {
    const severityDelta =
      getInsightSeverityRank(right.insight) -
      getInsightSeverityRank(left.insight);

    if (severityDelta !== 0) {
      return severityDelta;
    }

    return left.order - right.order;
  });
}

function jsonResponse(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...buildCorsHeaders(req, CORS_OPTIONS),
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req) => {
  const preflightResponse = handleCorsPreflight(req, CORS_OPTIONS);
  if (preflightResponse) {
    return preflightResponse;
  }

  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseServiceKey) {
    return jsonResponse(
      req,
      { error: "Missing Supabase service configuration." },
      500,
    );
  }

  const startTime = Date.now();

  try {
    const authorizationMode = await authorizeInvocation(
      req,
      supabaseServiceKey,
    );
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });
    const now = new Date();
    const generatorStats = createGeneratorStatsRecord();
    const runErrors: RunError[] = [];
    let tenantsProcessed = 0;
    let generatedInsights = 0;
    let insertedInsights = 0;
    let duplicateSkips = 0;

    const tenants = await loadActiveTenants(serviceClient);

    for (const tenant of tenants) {
      tenantsProcessed += 1;

      let recentInsightState: RecentInsightState;
      try {
        recentInsightState = await loadRecentInsightState(
          serviceClient,
          tenant.id,
          now,
        );
      } catch (error) {
        runErrors.push({
          tenantId: tenant.id,
          tenantName: tenant.name,
          generator: "tenants",
          message:
            error instanceof Error
              ? error.message
              : "Failed to load dedupe state.",
        });
        continue;
      }

      const candidateInsights: PendingInsightInsert[] = [];
      const seenDedupKeys = new Set(recentInsightState.dedupKeys);
      let insightOrder = 0;

      for (const generator of GENERATORS) {
        try {
          const insights = await generator.run(serviceClient, tenant.id, now);
          generatorStats[generator.key].generated += insights.length;
          generatedInsights += insights.length;

          for (const insight of insights) {
            const dedupeKey = buildInsightDedupKey(
              insight.insightType,
              insight.entityId,
            );
            if (seenDedupKeys.has(dedupeKey)) {
              generatorStats[generator.key].duplicates += 1;
              duplicateSkips += 1;
              continue;
            }

            seenDedupKeys.add(dedupeKey);
            candidateInsights.push({
              dedupeKey,
              generatorKey: generator.key,
              insight,
              order: insightOrder,
            });
            insightOrder += 1;
          }
        } catch (error) {
          generatorStats[generator.key].errors += 1;
          runErrors.push({
            tenantId: tenant.id,
            tenantName: tenant.name,
            generator: generator.key,
            message:
              error instanceof Error ? error.message : "Generator failed.",
          });
        }
      }

      const availableSlots = Math.max(
        0,
        MAX_INSIGHTS_PER_TENANT_PER_24H - recentInsightState.existingCount,
      );

      if (availableSlots === 0 || candidateInsights.length === 0) {
        continue;
      }

      let insertedForTenant = 0;

      for (const candidate of prioritizeInsights(candidateInsights)) {
        if (insertedForTenant >= availableSlots) {
          break;
        }

        const { error } = await serviceClient
          .from("bloom_proactive_insights")
          .insert(toInsightInsert(tenant.id, candidate.insight));

        if (error) {
          generatorStats[candidate.generatorKey].errors += 1;
          runErrors.push({
            tenantId: tenant.id,
            tenantName: tenant.name,
            generator: candidate.generatorKey,
            message: error.message,
          });
          continue;
        }

        recentInsightState.dedupKeys.add(candidate.dedupeKey);
        generatorStats[candidate.generatorKey].inserted += 1;
        insertedInsights += 1;
        insertedForTenant += 1;
      }
    }

    let expiredDeleted = 0;
    const { data: deletedRows, error: cleanupError } = await serviceClient
      .from("bloom_proactive_insights")
      .delete()
      .lt("expires_at", now.toISOString())
      .select("id");

    if (cleanupError) {
      runErrors.push({
        tenantId: null,
        tenantName: null,
        generator: "cleanup",
        message: cleanupError.message,
      });
    } else {
      expiredDeleted = deletedRows?.length ?? 0;
    }

    return jsonResponse(req, {
      success: true,
      authorization: authorizationMode,
      runAt: now.toISOString(),
      durationMs: Date.now() - startTime,
      tenantsProcessed,
      generatedInsights,
      insertedInsights,
      duplicateSkips,
      expiredDeleted,
      generatorStats,
      errors: runErrors,
    });
  } catch (error) {
    return jsonResponse(
      req,
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error.",
        durationMs: Date.now() - startTime,
      },
      500,
    );
  }
});
