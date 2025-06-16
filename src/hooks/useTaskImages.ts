
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TaskImage {
  id: string;
  thumb_url: string;
  alt: string;
}

export const useTaskImages = (taskId: string) => {
  const [images, setImages] = useState<TaskImage[]>([]);
  const [imageCount, setImageCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!taskId) return;

    const fetchImages = async () => {
      setLoading(true);
      try {
        // Get total count
        const { count } = await supabase
          .from('image_suggestions')
          .select('*', { count: 'exact', head: true })
          .eq('content_task_id', taskId);

        setImageCount(count || 0);

        // Get first 2 images for thumbnails
        const { data, error } = await supabase
          .from('image_suggestions')
          .select('id, thumb_url, alt')
          .eq('content_task_id', taskId)
          .limit(2);

        if (error) {
          console.error('Error fetching task images:', error);
        } else {
          setImages(data || []);
        }
      } catch (error) {
        console.error('Error in fetchImages:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchImages();
  }, [taskId]);

  return { images, imageCount, loading };
};
