import { supabase } from "@/integrations/supabase/client";
import { PlanItem } from "@/components/plan/constants";

interface SocialGenerationResult {
  content: string;
  imageQuery: string;
  hashtags: string;
}

/**
 * Generate high-quality Facebook and Instagram content using AI
 */
export async function batchGenerateSocialPosts(
  items: PlanItem[],
  month: string,
  themes: Array<{ id: string; label: string; description?: string }>,
): Promise<PlanItem[]> {
  // Filter to only Facebook and Instagram items
  const socialItems = items.filter((item) =>
    ["facebook", "instagram"].includes(item.type),
  );
  const nonSocialItems = items.filter(
    (item) => !["facebook", "instagram"].includes(item.type),
  );

  if (socialItems.length === 0) {
    return items;
  }

  // Get company profile for context
  let companyProfile;
  try {
    const { data: profile } = await supabase
      .from("company_profiles")
      .select("company_name, brand_voice, target_audience")
      .single();
    companyProfile = profile;
  } catch (error) {}

  // Process all social posts in parallel for maximum speed
  const generationPromises = socialItems.map(async (item) => {
    try {
      // Find the theme for this item
      const theme = themes.find((t) => t.id === item.themeId) || themes[0];

      const socialContent = await generateSingleSocialPost({
        platform: item.type as "facebook" | "instagram",
        theme: theme.label,
        themeDescription: theme.description,
        month,
        weekNumber: item.week || 1,
        contentType: determineContentType(item),
        companyProfile,
      });

      if (socialContent) {
        // Return updated item with AI-generated content
        return {
          ...item,
          caption: socialContent.content,
          imageQuery: socialContent.imageQuery,
          hashtags: socialContent.hashtags || item.hashtags,
        };
      } else {
        // Fallback: keep original content
        return item;
      }
    } catch (error) {
      console.error(
        `Failed to generate content for ${item.type} ${item.id}:`,
        error,
      );
      // Fallback: keep original content
      return item;
    }
  });

  // Wait for all social posts to complete in parallel
  const processedSocialItems = await Promise.all(generationPromises);
  // Combine processed social posts with non-social items
  return [...processedSocialItems, ...nonSocialItems];
}

/**
 * Generate content for a single social post using the edge function
 */
async function generateSingleSocialPost(request: {
  platform: "facebook" | "instagram";
  theme: string;
  themeDescription?: string;
  month: string;
  weekNumber: number;
  contentType?:
    | "tips"
    | "feature"
    | "workshop"
    | "inspiration"
    | "behind-scenes";
  companyProfile?: {
    company_name?: string;
    brand_voice?: string;
    target_audience?: string;
  };
}): Promise<SocialGenerationResult | null> {
  try {
    const { data, error } = await supabase.functions.invoke(
      "generate-social-content",
      {
        body: request,
      },
    );

    if (error) {
      console.error("Edge function error:", error);
      return null;
    }

    return data as SocialGenerationResult;
  } catch (error) {
    console.error("Failed to call generate-social-content function:", error);
    return null;
  }
}

/**
 * Determine content type based on item title
 */
function determineContentType(
  item: PlanItem,
): "tips" | "feature" | "workshop" | "inspiration" | "behind-scenes" {
  const title = item.title.toLowerCase();

  if (title.includes("tips") || title.includes("monday")) {
    return "tips";
  }
  if (title.includes("workshop") || title.includes("weekend")) {
    return "workshop";
  }
  if (title.includes("feature") || title.includes("friday")) {
    return "feature";
  }
  if (title.includes("behind") || title.includes("scenes")) {
    return "behind-scenes";
  }
  if (
    title.includes("inspiration") ||
    title.includes("story") ||
    title.includes("transformation")
  ) {
    return "inspiration";
  }

  return "tips"; // Default
}
