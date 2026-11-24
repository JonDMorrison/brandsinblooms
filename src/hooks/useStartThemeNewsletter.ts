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
        const origin = themeCampaignId
          ? buildCampaignOrigin("weekly_theme", themeCampaignId)
          : buildCampaignOrigin("weekly_theme", `master:${source.weekNumber}`);

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
