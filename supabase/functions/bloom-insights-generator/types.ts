import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export type InsightSeverity = "info" | "warning" | "critical";
export type InsightEntityType = "customer" | "product" | "campaign" | "segment";

export interface GeneratedInsight {
  insightType: string;
  title: string;
  description: string;
  actionPrompt: string | null;
  entityType: InsightEntityType | null;
  entityId: string | null;
  severity: InsightSeverity;
  expiresAt: string | null;
}

export interface ActiveTenant {
  id: string;
  name: string;
}

export type ServiceClient = SupabaseClient;
