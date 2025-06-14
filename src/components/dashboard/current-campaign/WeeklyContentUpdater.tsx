
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export const WeeklyContentUpdater = () => {
  const { user } = useAuth();

  useEffect(() => {
    const updateWeek24Campaign = async () => {
      if (!user) return;

      console.log('🌱 Checking and updating Week 24 campaign with seasonal garden content...');

      try {
        // First, check if Week 24 campaign exists and needs updating
        const { data: existingCampaign, error: fetchError } = await supabase
          .from('campaigns')
          .select('*')
          .eq('week_number', 24)
          .eq('user_id', user.id)
          .maybeSingle();

        if (fetchError) {
          console.error('Error fetching Week 24 campaign:', fetchError);
          return;
        }

        if (existingCampaign) {
          // Check if it's still generic content that needs updating
          const isGenericContent = 
            existingCampaign.title === 'Week 24 Marketing Campaign' ||
            existingCampaign.theme === 'Weekly Marketing' ||
            (existingCampaign.description && existingCampaign.description.includes('Auto-generated weekly marketing campaign'));

          if (isGenericContent) {
            console.log('✅ Found generic Week 24 campaign, updating with seasonal garden content...');

            // Update with rich summer garden center theme
            const summerTheme = {
              title: "Summer Heat Solutions & Plant Care",
              theme: "Summer Garden Mastery", 
              description: "Master summer gardening challenges with heat-tolerant plants, efficient watering systems, and expert strategies for thriving gardens in hot weather. Focus on plant care, water conservation, and maintaining beautiful, productive gardens through peak summer conditions.",
              prompt: "Create practical summer gardening content focused on heat tolerance, water conservation, summer plant care, and maintaining healthy gardens in hot weather for garden center customers.",
              source: "seasonal_garden_themes"
            };

            const { error: updateError } = await supabase
              .from('campaigns')
              .update({
                title: summerTheme.title,
                theme: summerTheme.theme,
                description: summerTheme.description,
                prompt: summerTheme.prompt,
                source: summerTheme.source
              })
              .eq('id', existingCampaign.id);

            if (updateError) {
              console.error('Error updating Week 24 campaign:', updateError);
              return;
            }

            console.log('🌿 Successfully updated Week 24 with summer garden center theme!');
            
            // Also update any existing content tasks to reflect the new seasonal focus
            const { data: existingTasks } = await supabase
              .from('content_tasks')
              .select('id, notes')
              .eq('campaign_id', existingCampaign.id);

            if (existingTasks && existingTasks.length > 0) {
              // Update task notes to reflect the new seasonal theme
              for (const task of existingTasks) {
                await supabase
                  .from('content_tasks')
                  .update({ 
                    notes: `Generated from theme: ${summerTheme.theme} - ${summerTheme.description}` 
                  })
                  .eq('id', task.id);
              }
              console.log(`🌱 Updated ${existingTasks.length} content tasks with seasonal context`);
            }

            toast.success('🌿 Week 24 updated with summer garden center content!');
          } else {
            console.log('Week 24 campaign already has seasonal content');
          }
        } else {
          console.log('No Week 24 campaign found for this user');
        }
      } catch (error) {
        console.error('Error updating Week 24 campaign:', error);
      }
    };

    // Run the update when component mounts
    updateWeek24Campaign();
  }, [user]);

  return null; // This is a utility component that doesn't render anything
};
