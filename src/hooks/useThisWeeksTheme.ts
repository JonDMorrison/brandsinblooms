import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { getCurrentWeekNumber } from "@/utils/dateUtils";
import {
  buildWeeklyThemeIdea,
  buildWeeklyThemeImageQuery,
  toWeeklyThemeImages,
  type WeeklyThemeImage,
  type WeeklyThemeSource,
} from "@/lib/studio/weeklyThemeSeed";
import type { NewsletterIdea } from "@/types/newsletter";
import type { Json } from "@/integrations/supabase/types";

/** Monday (yyyy-mm-dd, local) of the ISO week containing `date`. */
export function isoWeekStartDate(date: Date) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const month = String(monday.getMonth() + 1).padStart(2, "0");
  const day = String(monday.getDate()).padStart(2, "0");
  return `${monday.getFullYear()}-${month}-${day}`;
}

/**
 * The tenant's own weekly theme row (public.campaigns) for this week,
 * created from the master week when the tenant has none yet, so everyone on
 * the team shares one theme and one set of photos. Only ever writes a row
 * for `tenantId`, as the signed-in user (RLS: user_id = auth.uid()).
 */
export async function ensureTenantWeeklyTheme(input: {
  tenantId: string;
  userId: string;
  source: WeeklyThemeSource;
}): Promise<{ id: string; images: WeeklyThemeImage[] }> {
  const { tenantId, userId, source } = input;
  if (source.themeCampaignId) {
    return { id: source.themeCampaignId, images: source.images };
  }
  const existing = await supabase
    .from("campaigns")
    .select("id, theme_images")
    .eq("tenant_id", tenantId)
    .eq("week_number", source.weekNumber)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1);
  if (existing.error) throw existing.error;
  let row = existing.data?.[0] ?? null;
  if (!row) {
    // Only the master week's title and theme are copied; its content ideas
    // stay an internal brief, read from the master row when needed.
    const inserted = await supabase
      .from("campaigns")
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        created_by_user_id: userId,
        week_number: source.weekNumber,
        start_date: isoWeekStartDate(new Date()),
        title: source.title || source.theme || `Week ${source.weekNumber}`,
        theme: source.theme || source.title || null,
        source: "master_templates",
      })
      .select("id, theme_images")
      .single();
    if (inserted.error) throw inserted.error;
    row = inserted.data;
  }
  let images = toWeeklyThemeImages(row.theme_images);
  if (images.length === 0 && source.images.length > 0) {
    const { data: stored, error } = await supabase.rpc("set_weekly_theme_images", {
      p_campaign_id: row.id,
      p_images: source.images as unknown as Json,
    });
    if (error) {
      console.warn("Could not save weekly theme images", error);
      images = source.images;
    } else {
      const shared = toWeeklyThemeImages(stored);
      images = shared.length > 0 ? shared : source.images;
    }
  }
  return { id: row.id, images };
}

export interface ThisWeeksTheme {
  source: WeeklyThemeSource;
  idea: NewsletterIdea;
}

const THEME_IMAGE_COUNT = 3;

async function fetchThemePhotos(query: string): Promise<WeeklyThemeImage[]> {
  const { data, error } = await supabase.functions.invoke("fetch-unsplash-images", {
    body: {
      query,
      rawQuery: true,
      maxImages: THEME_IMAGE_COUNT,
      orientation: "landscape",
      orderBy: "relevant",
      contentFilter: "high",
    },
  });
  if (error) throw error;
  const images = Array.isArray(data?.images) ? data.images : [];
  return images.flatMap((image: Record<string, unknown>) => {
    const urls = (image.urls ?? {}) as Record<string, unknown>;
    const url =
      typeof urls.regular === "string"
        ? urls.regular
        : typeof image.download_url === "string"
          ? image.download_url
          : "";
    if (!url.startsWith("https://")) return [];
    return [
      {
        url,
        alt: typeof image.alt === "string" ? image.alt : "",
        credit:
          typeof image.photographer === "string"
            ? `Photo by ${image.photographer} on Unsplash`
            : "",
      },
    ];
  });
}

/**
 * This week's theme for the current tenant, ready to start a newsletter from:
 * the tenant's own weekly theme row (public.campaigns) for the current ISO
 * week, merged with the shared master week for its seasonal focus, plus its
 * images. Images come from the tenant row, then the master week, then a photo
 * search on the theme; the first set found is stored on the tenant row so the
 * whole team gets the same images.
 */
export function useThisWeeksTheme(options: { enabled?: boolean } = {}) {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const tenantId = tenant?.id ?? null;
  const userId = user?.id ?? null;
  const weekNumber = getCurrentWeekNumber();

  return useQuery({
    queryKey: ["this-weeks-theme", tenantId, userId, weekNumber],
    enabled: Boolean(userId) && options.enabled !== false,
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<ThisWeeksTheme | null> => {
      let tenantQuery = supabase
        .from("campaigns")
        .select("id, title, theme, description, prompt, week_number, theme_images")
        .eq("week_number", weekNumber)
        .is("deleted_at", null)
        .order("start_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(1);
      tenantQuery = tenantId
        ? tenantQuery.eq("tenant_id", tenantId)
        : tenantQuery.is("tenant_id", null).eq("user_id", userId as string);

      const [tenantResult, masterResult] = await Promise.all([
        tenantQuery,
        supabase
          .from("master_campaign_templates")
          .select("week_number, title, theme, content_ideas, seasonal_focus, theme_images")
          .eq("week_number", weekNumber)
          .maybeSingle(),
      ]);
      if (tenantResult.error) throw tenantResult.error;
      if (masterResult.error) throw masterResult.error;

      const row = tenantResult.data?.[0] ?? null;
      const master = masterResult.data ?? null;
      if (!row && !master) return null;

      const source: WeeklyThemeSource = {
        weekNumber,
        themeCampaignId: row?.id ?? null,
        title: row?.title || master?.title || "",
        theme: row?.theme || master?.theme || row?.title || "",
        description:
          row?.description || row?.prompt || master?.content_ideas || "",
        seasonalFocus: master?.seasonal_focus || "",
        images: toWeeklyThemeImages(row?.theme_images),
      };
      if (source.images.length === 0) {
        source.images = toWeeklyThemeImages(master?.theme_images);
      }
      if (source.images.length === 0) {
        try {
          source.images = await fetchThemePhotos(buildWeeklyThemeImageQuery(source));
        } catch (error) {
          console.warn("Weekly theme photos unavailable; starting without images", error);
        }
        if (row?.id && source.images.length > 0) {
          const { data: stored, error } = await supabase.rpc("set_weekly_theme_images", {
            p_campaign_id: row.id,
            p_images: source.images as unknown as Json,
          });
          if (error) {
            console.warn("Could not save weekly theme images", error);
          } else {
            // Another team member may have saved first: use their images.
            const shared = toWeeklyThemeImages(stored);
            if (shared.length > 0) source.images = shared;
          }
        }
      }

      return { source, idea: buildWeeklyThemeIdea(source) };
    },
  });
}
