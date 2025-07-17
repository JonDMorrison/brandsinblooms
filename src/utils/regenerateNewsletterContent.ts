import { supabase } from "@/integrations/supabase/client";

export async function regenerateNewsletterContent(
  contentTaskId: string,
  existingContent: string,
  campaignTitle: string
): Promise<string> {
  try {
    // Get the user's company profile for business context
    const { data: profile } = await supabase
      .from('company_profiles')
      .select('company_name')
      .single();

    console.log('🔄 Regenerating newsletter with existing content:', {
      contentLength: existingContent.length,
      campaignTitle,
      contentPreview: existingContent.substring(0, 200)
    });

    // Call the structured newsletter generation with existing content
    const { data, error } = await supabase.functions.invoke('generate-structured-newsletter', {
      body: {
        business_name: profile?.company_name || 'Your Garden Center',
        theme: campaignTitle,
        week_focus: `Restructure existing ${campaignTitle} content into proper YAML format`,
        existingContent: existingContent,
        userId: (await supabase.auth.getUser()).data.user?.id,
        promo_items: [],
        tone_note: 'Restructure existing content',
        is_holiday: false,
        holiday_context: ''
      }
    });

    if (error) {
      console.error('Error generating structured newsletter:', error);
      throw error;
    }

    if (!data?.yamlContent) {
      throw new Error('No YAML content received from generation function');
    }

    // Update the content task with the new structured content
    const { error: updateError } = await supabase
      .from('content_tasks')
      .update({
        ai_output: data.yamlContent,
        status: 'completed'
      })
      .eq('id', contentTaskId);

    if (updateError) {
      console.error('Error updating content task:', updateError);
      throw updateError;
    }

    return data.yamlContent;
  } catch (error) {
    console.error('Error in regenerateNewsletterContent:', error);
    throw error;
  }
}