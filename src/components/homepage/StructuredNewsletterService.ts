import { supabase } from "@/integrations/supabase/client";
import {
  transformCampaignTitle,
  cleanContentFromWeekReferences,
} from "@/utils/campaignTitleUtils";

export interface PromoItem {
  name: string;
  sale_text: string;
  link: string;
}

export const generateStructuredNewsletter = async (
  campaignId: string,
  campaignTitle: string,
  weekNumber: number,
  userId?: string,
  weekDescription?: string,
  promoItems: PromoItem[] = [],
  toneNote?: string,
) => {
  // Transform title to remove week references
  const cleanTitle = transformCampaignTitle(campaignTitle);
  try {
    // Determine if this is a holiday or seasonal theme
    const isHoliday = weekNumber === 0;
    const focusDescription = isHoliday
      ? weekDescription || `Special ${cleanTitle} content for garden centers`
      : weekDescription || `Seasonal focus on ${cleanTitle}`;

    const { data, error } = await supabase.functions.invoke(
      "generate-structured-newsletter",
      {
        body: {
          business_name: "", // Will be filled from company profile
          theme: cleanTitle,
          week_focus: focusDescription,
          promo_items: promoItems,
          tone_note: toneNote || "",
          userId: userId,
          is_holiday: isHoliday,
          holiday_context: isHoliday ? cleanTitle : undefined,
        },
      },
    );
    if (error) {
      console.error(
        "❌ Error generating 4-section structured newsletter:",
        error,
      );
      throw new Error(
        `Structured newsletter generation failed: ${error.message || "Unknown error"}`,
      );
    }

    const content = data?.yamlContent;
    if (!content) {
      throw new Error("No structured newsletter content returned");
    }

    // Clean any remaining week references from the content
    const cleanedContent = cleanContentFromWeekReferences(content);

    // Basic validation - ensure we have some content
    if (!cleanedContent || cleanedContent.trim().length < 50) {
      throw new Error("Generated newsletter content is invalid or too short");
    }

    // Validate that the content has the expected structure (either YAML blocks or markdown sections)
    const blockMatches = cleanedContent.match(/- title:/g);
    const headerMatches = cleanedContent.match(/## /g);
    const blockCount = blockMatches ? blockMatches.length : 0;
    const headerCount = headerMatches ? headerMatches.length : 0;

    if (blockCount > 0) {
    } else if (headerCount > 0) {
    } else {
    }

    return cleanedContent;
  } catch (error) {
    console.error("❌ Error in generateStructuredNewsletter:", error);
    throw error;
  }
};
