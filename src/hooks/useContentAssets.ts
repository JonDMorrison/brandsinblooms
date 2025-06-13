
import { useState, useEffect } from 'react';
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

  const fetchAssets = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('content_assets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Generate signed URLs for assets
      const assetsWithUrls = await Promise.all(
        (data || []).map(async (asset) => {
          const { data: urlData } = await supabase.storage
            .from('content-assets')
            .createSignedUrl(asset.file_path, 3600); // 1 hour expiry

          return {
            ...asset,
            url: urlData?.signedUrl || '/placeholder.svg'
          };
        })
      );

      setAssets(assetsWithUrls);
    } catch (error) {
      console.error('Error fetching assets:', error);
      toast.error('Failed to load assets');
    } finally {
      setLoading(false);
    }
  };

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

      // Generate signed URL
      const { data: urlData } = await supabase.storage
        .from('content-assets')
        .createSignedUrl(filePath, 3600);

      const assetWithUrl = {
        ...data,
        url: urlData?.signedUrl || '/placeholder.svg'
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
    fetchAssets();
  }, [user]);

  return {
    assets,
    loading,
    uploadAsset,
    deleteAsset,
    refetch: fetchAssets
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
