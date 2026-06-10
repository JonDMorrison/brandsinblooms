/**
 * Bloom-led weekly suggestions card for the dashboard.
 *
 * Shows up to three date-aware suggestions for what to send this week. Each
 * one writes a Bloom proactive insight row (the same surface Bloom already
 * picks up from /bloom?insight=<id>) and navigates the user into Bloom with
 * the conversation already started.
 *
 * Bloom does the drafting and follow-through. This card is just the
 * invitation.
 */

import * as React from "react";
import Box from "@mui/joy/Box";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { JoyButton } from "@/components/joy/JoyButton";
import { bloomSupabase } from "@/hooks/bloom/types";
import { useTenant } from "@/hooks/useTenant";
import { useWeeklyThemes } from "@/hooks/useWeeklyThemes";
import { supabase } from "@/integrations/supabase/client";
import {
  rankWeeklySuggestions,
  type RecentCampaignLite,
  type WeeklySuggestion,
} from "@/lib/crm/weeklySuggestions";

const INSIGHT_EXPIRY_HOURS = 6;
const RECENT_CAMPAIGN_WINDOW_DAYS = 35;

async function fetchRecentCampaigns(
  tenantId: string,
): Promise<RecentCampaignLite[]> {
  const cutoff = new Date(
    Date.now() - RECENT_CAMPAIGN_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { data, error } = await supabase
    .from("crm_campaigns")
    .select("name, sent_at, send_completed_at")
    .eq("tenant_id", tenantId)
    .gte("sent_at", cutoff)
    .limit(50);
  if (error) {
    return [];
  }
  return (data ?? []).map((row) => ({
    name: typeof row.name === "string" ? row.name : "",
    sentAt:
      typeof row.sent_at === "string"
        ? row.sent_at
        : typeof row.send_completed_at === "string"
          ? row.send_completed_at
          : null,
  }));
}

function SkeletonRow() {
  return (
    <Stack
      spacing={0.5}
      sx={{
        p: 1.25,
        borderRadius: "8px",
        border: "1px solid",
        borderColor: "neutral.100",
      }}
    >
      <Skeleton variant="text" sx={{ width: "70%" }} />
      <Skeleton variant="text" sx={{ width: "50%" }} />
    </Stack>
  );
}

export function BloomWeeklySuggestionsCard() {
  const navigate = useNavigate();
  const { tenant } = useTenant();
  const { themes, loading: themesLoading } = useWeeklyThemes();
  const [recentCampaigns, setRecentCampaigns] = React.useState<
    RecentCampaignLite[]
  >([]);
  const [recentLoading, setRecentLoading] = React.useState(true);
  const [openingId, setOpeningId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    if (!tenant?.id) {
      setRecentCampaigns([]);
      setRecentLoading(false);
      return () => {
        cancelled = true;
      };
    }
    setRecentLoading(true);
    void fetchRecentCampaigns(tenant.id).then((rows) => {
      if (cancelled) return;
      setRecentCampaigns(rows);
      setRecentLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [tenant?.id]);

  const suggestions = React.useMemo(() => {
    if (themesLoading || recentLoading) return [];
    return rankWeeklySuggestions({ themes, recentCampaigns });
  }, [themes, themesLoading, recentCampaigns, recentLoading]);

  const isLoading = themesLoading || recentLoading;

  const handleOpen = React.useCallback(
    async (suggestion: WeeklySuggestion) => {
      if (!tenant?.id || openingId) return;
      setOpeningId(suggestion.id);
      try {
        const expiresAt = new Date(
          Date.now() + INSIGHT_EXPIRY_HOURS * 60 * 60 * 1000,
        ).toISOString();
        const { data, error } = await bloomSupabase
          .from("bloom_proactive_insights")
          .insert({
            tenant_id: tenant.id,
            insight_type: "weekly_suggestion",
            title: suggestion.title,
            description: suggestion.whyNow,
            action_prompt: suggestion.seedPrompt,
            entity_type: null,
            entity_id: null,
            severity: "info",
            expires_at: expiresAt,
          })
          .select("id")
          .single();
        if (error || !data?.id) {
          throw error ?? new Error("No insight id returned");
        }
        navigate(`/bloom?insight=${data.id}`);
      } catch (error) {
        toast.error("Couldn't start that one", {
          description:
            error instanceof Error
              ? error.message
              : "Try again in a moment.",
        });
        setOpeningId(null);
      }
    },
    [navigate, openingId, tenant?.id],
  );

  // Hide the card entirely if there's nothing to suggest and we're not loading
  // — better than leaving a header with no content.
  if (!isLoading && suggestions.length === 0) {
    return null;
  }

  return (
    <Sheet
      variant="outlined"
      data-testid="bloom-weekly-suggestions-card"
      sx={{ borderRadius: "12px", p: 2, backgroundColor: "#FFFFFF" }}
    >
      <Stack spacing={1.5}>
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          justifyContent="space-between"
        >
          <Stack spacing={0.25}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: "8px",
                  backgroundColor: "primary.50",
                  color: "primary.600",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Sparkles size={16} />
              </Box>
              <Typography
                level="title-md"
                sx={{ fontSize: "16px", fontWeight: 600 }}
              >
                This week's marketing
              </Typography>
            </Stack>
            <Typography level="body-xs" sx={{ color: "neutral.500" }}>
              Bloom has a few ideas — pick one and Bloom will draft it with
              you.
            </Typography>
          </Stack>
        </Stack>

        <Stack spacing={1}>
          {isLoading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : (
            suggestions.map((suggestion) => (
              <Box
                key={suggestion.id}
                component="button"
                type="button"
                disabled={openingId !== null}
                onClick={() => void handleOpen(suggestion)}
                data-testid={`bloom-weekly-suggestion-${suggestion.id}`}
                sx={{
                  display: "block",
                  textAlign: "left",
                  width: "100%",
                  p: 1.25,
                  borderRadius: "8px",
                  border: "1px solid",
                  borderColor: "neutral.200",
                  backgroundColor: "background.body",
                  cursor: openingId !== null ? "wait" : "pointer",
                  transition:
                    "border-color 120ms ease, background-color 120ms ease",
                  "&:hover": {
                    borderColor: "primary.300",
                    backgroundColor: "primary.50",
                  },
                  "&:focus-visible": {
                    outline: "2px solid var(--joy-palette-primary-400)",
                    outlineOffset: "1px",
                  },
                  "&:disabled": {
                    opacity: openingId === suggestion.id ? 0.85 : 0.6,
                  },
                }}
              >
                <Stack spacing={0.25}>
                  <Typography
                    level="body-sm"
                    sx={{ fontWeight: 600, color: "neutral.900" }}
                  >
                    {suggestion.title}
                  </Typography>
                  <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                    {suggestion.whyNow}
                  </Typography>
                </Stack>
              </Box>
            ))
          )}
        </Stack>

        {!isLoading && suggestions.length > 0 ? (
          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
            <JoyButton
              variant="plain"
              color="neutral"
              size="sm"
              onClick={() => navigate("/bloom?new=true")}
            >
              Open Bloom for anything else
            </JoyButton>
          </Box>
        ) : null}
      </Stack>
    </Sheet>
  );
}
