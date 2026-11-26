import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/utils/toast";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { useCompanyInfo } from "@/hooks/useCompanyInfo";
import {
  ensureTenantWeeklyTheme,
  type ThisWeeksTheme,
} from "@/hooks/useThisWeeksTheme";
import { supabase } from "@/integrations/supabase/client";
import { persistCampaignDraft } from "@/lib/crm/campaignEditor";
import { buildCampaignOrigin } from "@/lib/crm/campaignOrigin";
import { buildStudioDesignSystem } from "@/lib/studio/designSystem";
import { buildNewsletterIdeaDraftSeed } from "@/lib/studio/newsletterIdeaSeed";
import { sanitizeThemeSeedDraft } from "@/lib/studio/themeNewsletter";
import type { WeeklyThemeImage } from "@/lib/studio/weeklyThemeSeed";

/** Navigation state Studio reads to write the newsletter on arrival. */
export type ThemeGenerationNavigationState = {
  themeGeneration: {
    weekNumber: number;
    themeImages: WeeklyThemeImage[];
  };
};

export function readThemeGenerationState(
  state: unknown,
): ThemeGenerationNavigationState["themeGeneration"] | null {
  if (!state || typeof state !== "object") return null;
  const value = (state as Record<string, unknown>).themeGeneration;
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.weekNumber !== "number") return null;
  return {
    weekNumber: record.weekNumber,
    themeImages: Array.isArray(record.themeImages)
      ? (record.themeImages as WeeklyThemeImage[])
      : [],
  };
}

/**
 * The tenant's existing unsent draft for this week's theme, if any. Each
 * click used to create another draft, so a tenant collected several
 * near-identical "Year-End Garden Review" drafts for one theme.
 */
const THEME_DRAFT_REUSE_MS = 60 * 24 * 60 * 60 * 1000;

export async function findThemeDraft(
  tenantId: string,
  origins: string[],
): Promise<string | null> {
  const { data, error } = await supabase
    .from("crm_campaigns")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("status", "draft")
    .in("origin", origins)
    // Week numbers repeat each year: only reuse a draft from this season.
    .gte("created_at", new Date(Date.now() - THEME_DRAFT_REUSE_MS).toISOString())
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0]?.id ?? null;
}

/**
 * "Start from this week's theme": make sure the tenant has its own weekly
 * theme row, create the draft (a clean deterministic seed that also serves
 * as the fallback) with origin weekly_theme:<theme row id>, and open it in
 * Design Studio, which then writes the newsletter with AI.
 */
export function useStartThemeNewsletter() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { companyInfo } = useCompanyInfo();
  const designSystem = React.useMemo(
    () => buildStudioDesignSystem(companyInfo),
    [companyInfo],
  );
  const [starting, setStarting] = React.useState(false);
  const startingRef = React.useRef(false);

  const start = React.useCallback(
    async (theme: ThisWeeksTheme) => {
      if (startingRef.current) return;
      startingRef.current = true;
      setStarting(true);
      try {
        const { source, idea } = theme;
        let themeCampaignId = source.themeCampaignId;
        let themeImages = source.images;
        if (tenant?.id && user?.id) {
          try {
            const row = await ensureTenantWeeklyTheme({
              tenantId: tenant.id,
              userId: user.id,
              source,
            });
            themeCampaignId = row.id;
            themeImages = row.images;
            void queryClient.invalidateQueries({ queryKey: ["this-weeks-theme"] });
          } catch (error) {
            // The newsletter can still start from the master week.
            console.warn("Couldn't save this week's theme for the team", error);
          }
        }

        const seed = sanitizeThemeSeedDraft(
          buildNewsletterIdeaDraftSeed(
            { ...idea, themeCampaignId: themeCampaignId ?? undefined },
            "block-builder",
            designSystem,
          ),
          { brief: source.description, storeName: designSystem.company.name },
        );
        const masterOrigin = buildCampaignOrigin(
          "weekly_theme",
          `master:${source.weekNumber}`,
        );
        const origin = themeCampaignId
          ? buildCampaignOrigin("weekly_theme", themeCampaignId)
          : masterOrigin;

        // Reopen this week's draft instead of starting another copy. The
        // draft was already written, so Studio does not regenerate it.
        if (tenant?.id) {
          const existingId = await findThemeDraft(
            tenant.id,
            Array.from(new Set([origin, masterOrigin])),
          );
          if (existingId) {
            navigate(`/crm/campaigns/${existingId}/studio`);
            return;
          }
        }

        const saved = await persistCampaignDraft({
          tenantId: tenant?.id ?? null,
          campaignType: "email",
          status: "draft",
          name: seed.name,
          subjectLine: seed.subjectLine,
          preheaderText: seed.preheaderText,
          senderName: "",
          senderEmail: "",
          contentBlocks: seed.contentBlocks,
          smsMessage: "",
          sendAt: null,
          sendImmediately: false,
          segments: [],
          personas: [],
          origin,
        });
        navigate(`/crm/campaigns/${saved.id}/studio`, {
          state: {
            themeGeneration: { weekNumber: source.weekNumber, themeImages },
          } satisfies ThemeGenerationNavigationState,
        });
      } catch (error) {
        console.error("Couldn't start this week's newsletter", error);
        toast.error("Couldn't start this week's newsletter. Try again.");
      } finally {
        startingRef.current = false;
        setStarting(false);
      }
    },
    [designSystem, navigate, queryClient, tenant?.id, user?.id],
  );

  return { start, starting };
}
