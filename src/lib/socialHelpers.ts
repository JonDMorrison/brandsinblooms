
import { supabase } from '@/integrations/supabase/client';

export async function areConnectionsValid(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('social_connections')
      .select('platform, expires_at, is_active')
      .eq('user_id', userId)
      .eq('is_active', true)
      .in('platform', ['facebook', 'instagram']);

    if (error || !data) return false;
    
    // Need both Facebook and Instagram connections
    const platforms = data.map(c => c.platform);
    const hasFacebook = platforms.includes('facebook');
    const hasInstagram = platforms.includes('instagram');
    
    if (!hasFacebook || !hasInstagram) return false;
    
    // Check if tokens are not expired
    const now = new Date();
    return data.every(connection => {
      if (!connection.expires_at) return true; // No expiry means it's valid
      return new Date(connection.expires_at) > now;
    });
  } catch (error) {
    console.error('Error checking social connections:', error);
    return false;
  }
}
