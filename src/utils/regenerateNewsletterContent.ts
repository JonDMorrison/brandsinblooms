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

    // Call the structured newsletter generation with existing content
    const { data, error } = await supabase.functions.invoke('generate-structured-newsletter', {
      body: {
        businessName: profile?.company_name || 'Your Garden Center',
        theme: campaignTitle,
        focus: 'Restructure existing newsletter content into proper YAML format',
        existingContent: existingContent,
        userId: (await supabase.auth.getUser()).data.user?.id
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