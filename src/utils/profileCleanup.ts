import { supabase } from "@/integrations/supabase/client";

export const cleanupDuplicateProfiles = async (userId: string) => {
  try {
    console.log('Starting profile cleanup for user:', userId);
    
    // Get all profiles for this user
    const { data: profiles, error: fetchError } = await supabase
      .from('company_profiles')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Error fetching profiles:', fetchError);
      return false;
    }

    if (!profiles || profiles.length <= 1) {
      console.log('No duplicate profiles found');
      return true;
    }

    console.log(`Found ${profiles.length} profiles, keeping the most recent one`);
    
    // Keep the first (most recent) profile, delete the rest
    const profileToKeep = profiles[0];
    const profilesToDelete = profiles.slice(1);
    
    // Delete duplicate profiles
    for (const profile of profilesToDelete) {
      const { error: deleteError } = await supabase
        .from('company_profiles')
        .delete()
        .eq('id', profile.id);
      
      if (deleteError) {
        console.error('Error deleting duplicate profile:', deleteError);
      } else {
        console.log('Deleted duplicate profile:', profile.id);
      }
    }
    
    // Update the remaining profile to ensure proper flags are set
    const { error: updateError } = await supabase
      .from('company_profiles')
      .update({
        first_content_generated: true,
        onboarding_completed_at: new Date().toISOString(),
        first_welcome_dismissed: false // Allow welcome to show again
      })
      .eq('id', profileToKeep.id);
    
    if (updateError) {
      console.error('Error updating profile flags:', updateError);
      return false;
    }
    
    console.log('Profile cleanup completed successfully');
    return true;
    
  } catch (error) {
    console.error('Error in profile cleanup:', error);
    return false;
  }
};

export const ensureFirstTimeFlags = async (userId: string) => {
  try {
    // Check if user has content tasks in review status
    const { data: reviewTasks, error: tasksError } = await supabase
      .from('content_tasks')
      .select('id')
      .eq('status', 'review')
      .limit(1);
    
    if (tasksError) {
      console.error('Error checking tasks:', tasksError);
      return false;
    }
    
    if (reviewTasks && reviewTasks.length > 0) {
      // User has content, make sure their profile reflects this
      const { error: updateError } = await supabase
        .from('company_profiles')
        .update({
          first_content_generated: true,
          onboarding_completed_at: new Date().toISOString(),
          first_welcome_dismissed: false
        })
        .eq('user_id', userId);
      
      if (updateError) {
        console.error('Error updating first time flags:', updateError);
        return false;
      }
      
      console.log('Updated first time flags for user with existing content');
    }
    
    return true;
  } catch (error) {
    console.error('Error ensuring first time flags:', error);
    return false;
  }
};
