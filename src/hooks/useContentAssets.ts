
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Asset {
  id: string;
  name: string;
  type: string;
  size_bytes: number;
  dimensions?: string;
  duration?: string;
  tags: string[];
  file_path: string;
  created_at: string;
  url?: string;
}

export const useContentAssets = () => {
  const { user } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchAttemptRef = useRef(0);
  const isMountedRef = useRef(true);

  const fetchAssets = useCallback(async (retryCount = 0) => {
    // Wait for user to be available
    if (!user?.id) {
      console.log('[useContentAssets] No user, skipping fetch');
      setLoading(false);
      return;
    }
    
    const currentAttempt = ++fetchAttemptRef.current;
    console.log('[useContentAssets] Fetching assets for user:', user.id, 'attempt:', currentAttempt);
    
    try {
      setLoading(true);
      
      // Explicitly filter by user_id for reliability (RLS also enforces this)
      const { data, error } = await supabase
        .from('content_assets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      // Ignore stale responses
      if (currentAttempt !== fetchAttemptRef.current || !isMountedRef.current) {
        console.log('[useContentAssets] Ignoring stale response');
        return;
      }

      if (error) throw error;
      
      console.log('[useContentAssets] Fetched', data?.length || 0, 'assets');
      
      // Generate public URLs for assets (not signed URLs - emails need permanent URLs)
      const assetsWithUrls = (data || []).map((asset) => {
        const { data: urlData } = supabase.storage
          .from('content-assets')
          .getPublicUrl(asset.file_path);

        return {
          ...asset,
          url: urlData?.publicUrl || '/placeholder.svg'
        };
      });

      setAssets(assetsWithUrls);
    } catch (error) {
      console.error('[useContentAssets] Error fetching assets:', error);
      
      // Retry up to 2 times with exponential backoff if auth might not be ready
      if (retryCount < 2 && isMountedRef.current) {
        const delay = (retryCount + 1) * 1000;
        console.log(`[useContentAssets] Retrying in ${delay}ms...`);
        setTimeout(() => {
          if (isMountedRef.current) {
            fetchAssets(retryCount + 1);
          }
        }, delay);
        return;
      }
      
      toast.error('Failed to load assets');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [user?.id]);

  const uploadAsset = async (file: File, tags: string[] = []) => {
    if (!user) return;

    try {
      // Create file path
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('content-assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Determine asset type
      const assetType = file.type.startsWith('image/') ? 'image' : 
                      file.type.startsWith('video/') ? 'video' : 'document';

      // Get dimensions for images
      let dimensions: string | undefined;
      if (assetType === 'image') {
        dimensions = await getImageDimensions(file);
      }

      // Save asset metadata to database
      const { data, error } = await supabase
        .from('content_assets')
        .insert({
          user_id: user.id,
          name: file.name,
          type: assetType,
          size_bytes: file.size,
          dimensions,
          tags,
          file_path: filePath
        })
        .select()
        .single();

      if (error) throw error;

      // Generate public URL (not signed - emails need permanent URLs)
      const { data: urlData } = supabase.storage
        .from('content-assets')
        .getPublicUrl(filePath);

      const assetWithUrl = {
        ...data,
        url: urlData?.publicUrl || '/placeholder.svg'
      };

      setAssets(prev => [assetWithUrl, ...prev]);
      toast.success('Asset uploaded successfully');
      return assetWithUrl;
    } catch (error) {
      console.error('Error uploading asset:', error);
      toast.error('Failed to upload asset');
      throw error;
    }
  };

  const deleteAsset = async (assetId: string) => {
    try {
      // Find the asset to get file path
      const asset = assets.find(a => a.id === assetId);
      if (!asset) return;

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('content-assets')
        .remove([asset.file_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error } = await supabase
        .from('content_assets')
        .delete()
        .eq('id', assetId);

      if (error) throw error;
      
      setAssets(prev => prev.filter(asset => asset.id !== assetId));
      toast.success('Asset deleted successfully');
    } catch (error) {
      console.error('Error deleting asset:', error);
      toast.error('Failed to delete asset');
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    fetchAttemptRef.current = 0;
    
    // Reset assets when user changes
    setAssets([]);
    setLoading(true);
    
    // Small delay to ensure auth session is established
    const timer = setTimeout(() => {
      if (isMountedRef.current) {
        fetchAssets();
      }
    }, 100);
    
    return () => {
      isMountedRef.current = false;
      clearTimeout(timer);
    };
  }, [user?.id, fetchAssets]);

  const searchAssets = async (query: string): Promise<Asset[]> => {
    if (!user?.id || !query.trim()) return [];
    
    console.log('[useContentAssets] Searching assets for query:', query);
    
    try {
      // SECURITY: [PostgREST filter injection] - Sanitize user input before interpolation into .or() filter
      const sanitizeForPostgrest = (input: string) => input.replace(/[,.()"'\\]/g, '');
      const sanitized = sanitizeForPostgrest(query);
      const { data, error } = await supabase
        .from('content_assets')
        .select('*')
        .eq('user_id', user.id)
        .or(`name.ilike.%${sanitized}%,tags.cs.{${sanitized}}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Generate public URLs for search results (not signed - emails need permanent URLs)
      const assetsWithUrls = (data || []).map((asset) => {
        const { data: urlData } = supabase.storage
          .from('content-assets')
          .getPublicUrl(asset.file_path);

        return {
          ...asset,
          url: urlData?.publicUrl || '/placeholder.svg'
        };
      });

      return assetsWithUrls;
    } catch (error) {
      console.error('Error searching assets:', error);
      return [];
    }
  };

  return {
    assets,
    loading,
    uploadAsset,
    deleteAsset,
    refetch: fetchAssets,
    searchAssets
  };
};

// Helper function to get image dimensions
const getImageDimensions = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve(`${img.width}x${img.height}`);
    };
    img.onerror = () => {
      resolve('unknown');
    };
    img.src = URL.createObjectURL(file);
  });
};
