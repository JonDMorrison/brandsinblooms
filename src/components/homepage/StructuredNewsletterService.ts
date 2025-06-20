
import { supabase } from "@/integrations/supabase/client";

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
  toneNote?: string
) => {
  console.log(`🎯 Generating structured newsletter for campaign: ${campaignTitle} (Week ${weekNumber})`);
  console.log('📋 Newsletter generation parameters:', { campaignId, campaignTitle, weekNumber, userId, weekDescription, promoItems, toneNote });
  
  try {
    console.log('📡 Calling generate-structured-newsletter function');

    const { data, error } = await supabase.functions.invoke('generate-structured-newsletter', {
      body: {
        business_name: '', // Will be filled from company profile
        theme: campaignTitle,
        week_focus: weekDescription || `Week ${weekNumber} focus`,
        promo_items: promoItems,
        tone_note: toneNote || '',
        userId: userId,
        format: 'magazine' // Request magazine-style format
      }
    });

    console.log('📨 Response from generate-structured-newsletter function:', { data, error });

    if (error) {
      console.error('❌ Error generating structured newsletter:', error);
      console.log('🔄 Falling back to magazine-style newsletter generation');
      return await generateMagazineStyleNewsletter(campaignTitle, weekDescription, userId);
    }

    const content = data?.content;
    if (!content) {
      console.warn('⚠️ No structured newsletter content returned, using fallback');
      return await generateMagazineStyleNewsletter(campaignTitle, weekDescription, userId);
    }

    console.log(`✅ Generated structured newsletter successfully`);
    console.log('📄 Generated content preview:', content.substring(0, 200) + '...');
    return content;
  } catch (error) {
    console.error('❌ Error in generateStructuredNewsletter:', error);
    
    // Fallback to generate content in the proper magazine format
    console.log('🔄 Falling back to magazine-style newsletter generation');
    return await generateMagazineStyleNewsletter(campaignTitle, weekDescription, userId);
  }
};

// Enhanced fallback function to generate magazine-style newsletter
const generateMagazineStyleNewsletter = async (
  campaignTitle: string,
  weekDescription?: string,
  userId?: string
) => {
  console.log('📰 Generating fallback magazine-style newsletter');
  
  try {
    const { data, error } = await supabase.functions.invoke('generate-content', {
      body: {
        postType: 'newsletter',
        campaignTitle: campaignTitle,
        weekDescription: weekDescription,
        userId: userId,
        format: 'magazine',
        structure: 'sections_with_images'
      }
    });

    if (error) {
      console.error('❌ Fallback generation failed:', error);
      return createBasicMagazineNewsletter(campaignTitle, weekDescription);
    }

    // Structure the content in magazine format
    const content = data?.content || '';
    console.log('📄 Fallback content preview:', content.substring(0, 200) + '...');
    return formatContentAsMagazineNewsletter(content, campaignTitle);
  } catch (error) {
    console.error('❌ Fallback newsletter generation failed:', error);
    // Return a basic structured format
    return createBasicMagazineNewsletter(campaignTitle, weekDescription);
  }
};

const formatContentAsMagazineNewsletter = (content: string, title: string): string => {
  console.log('🔄 Formatting content as magazine newsletter');
  
  const lines = content.split('\n').filter(line => line.trim());
  const sections = [];
  
  // Parse content into sections
  let currentSection = '';
  for (const line of lines) {
    if (line.match(/^#+\s+/) || line.match(/^\*\*.*\*\*$/)) {
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = line;
    } else if (line.trim()) {
      currentSection += '\n' + line;
    }
  }
  
  if (currentSection) {
    sections.push(currentSection);
  }

  console.log(`✅ Parsed ${sections.length} sections from content`);

  // Format as structured newsletter with sections
  const structuredContent = `---
newsletter_md: |
  # ${title}

  *Discover this week's gardening insights and seasonal tips to help your garden thrive.*

${sections.map((section, index) => {
    const lines = section.split('\n').filter(l => l.trim());
    const heading = lines[0].replace(/^#+\s*/, '').replace(/^\*\*(.*)\*\*$/, '$1');
    const body = lines.slice(1).join(' ').substring(0, 280);
    
    return `  ## ${heading}
  
  ${body}`;
  }).join('\n\n')}

blocks:
${sections.map((section, index) => {
    const lines = section.split('\n').filter(l => l.trim());
    const heading = lines[0].replace(/^#+\s*/, '').replace(/^\*\*(.*)\*\*$/, '$1');
    const body = lines.slice(1).join(' ').substring(0, 280);
    
    return `- title: "${heading}"
  body: "${body}"
  cta: "Learn More"
  link: "#"
  image_prompt: "${title.toLowerCase()} ${heading.toLowerCase()} garden plants seasonal"
  alt_text: "${heading} related garden content"`;
  }).join('\n')}

meta:
  reading_time: "≈3 min"
  theme: "${title}"
  week_focus: "Seasonal gardening tips and insights"
`;

  console.log('✅ Successfully formatted structured newsletter');
  return structuredContent;
};

const createBasicMagazineNewsletter = (title: string, description?: string): string => {
  console.log('📝 Creating basic magazine newsletter template');
  
  return `---
newsletter_md: |
  # ${title}

  *${description || 'Discover this week\'s gardening insights and seasonal tips to help your garden thrive.'}*

  ## Seasonal Plant Care

  Learn essential care techniques for your plants during this time of year. From watering schedules to pruning tips, we'll help you maintain a healthy garden throughout the season.

  ## Garden Maintenance Tips  

  Keep your garden looking its best with these practical maintenance suggestions. Simple steps can make a big difference in your garden's health and appearance.

  ## This Week's Garden Focus

  Discover what to prioritize in your garden this week. From planting opportunities to seasonal preparations, stay ahead of the gardening calendar.

blocks:
- title: "Seasonal Plant Care"
  body: "Learn essential care techniques for your plants during this time of year. From watering schedules to pruning tips, we'll help you maintain a healthy garden throughout the season."
  cta: "Learn More"
  link: "#"
  image_prompt: "${title.toLowerCase()} seasonal plant care gardening tips maintenance"
  alt_text: "Seasonal plant care and gardening techniques"

- title: "Garden Maintenance Tips"
  body: "Keep your garden looking its best with these practical maintenance suggestions. Simple steps can make a big difference in your garden's health and appearance."
  cta: "Read More"
  link: "#"
  image_prompt: "${title.toLowerCase()} garden maintenance tools pruning watering"
  alt_text: "Garden maintenance and care tools"

- title: "This Week's Garden Focus"
  body: "Discover what to prioritize in your garden this week. From planting opportunities to seasonal preparations, stay ahead of the gardening calendar."
  cta: "Get Started"
  link: "#"
  image_prompt: "${title.toLowerCase()} weekly garden planning seasonal tasks"
  alt_text: "Weekly garden planning and priorities"

meta:
  reading_time: "≈3 min"
  theme: "${title}"
  week_focus: "${description || 'Weekly gardening insights'}"
`;
};
