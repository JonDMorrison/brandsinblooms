
import React, { useEffect, useState } from 'react';
import { BlogPostLayout } from '@/components/blog/BlogPostLayout';
import { Button } from '@/components/ui/button';
import { RefreshCw, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface BlogContentDisplayProps {
  content: string;
  postType?: string;
  className?: string;
}

interface ImageData {
  url: string;
  alt: string;
  photographer?: string;
  isPlaceholder?: boolean;
}

export const BlogContentDisplay = ({ content, postType, className }: BlogContentDisplayProps) => {
  const [heroImage, setHeroImage] = useState<ImageData | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);
  const [imageRefreshCount, setImageRefreshCount] = useState(0);

  console.log('📝 BlogContentDisplay rendering with content length:', content.length);

  // Extract title and generate image query from content
  const extractTitleAndQuery = (content: string) => {
    // Try to extract title from various formats
    const titleMatch = content.match(/^#\s+(.+)$/m) || 
                      content.match(/^\*\*(.+)\*\*$/m) ||
                      content.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    
    let title = 'Blog Post';
    if (titleMatch) {
      title = titleMatch[1].trim();
    } else {
      // If no clear title, use first meaningful line
      const lines = content.split('\n').filter(line => line.trim() && line.length > 10);
      if (lines.length > 0) {
        title = lines[0].replace(/<[^>]*>/g, '').trim().substring(0, 60);
      }
    }

    // Generate search query from title
    const query = `${title} garden plants seasonal blog`.toLowerCase();
    
    return { title, query };
  };

  const { title, query } = extractTitleAndQuery(content);

  // Fetch hero image
  const fetchHeroImage = async () => {
    setLoadingImage(true);
    console.log('🖼️ Fetching hero image for blog with query:', query);
    
    try {
      const { data, error } = await supabase.functions.invoke('fetch-unsplash-images', {
        body: { query }
      });
      
      if (error) {
        console.warn('⚠️ Image fetch failed, using placeholder:', error);
        setHeroImage({
          url: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=300&fit=crop&auto=format',
          alt: `Blog hero image for ${title}`,
          photographer: 'Sample Garden Center',
          isPlaceholder: true
        });
        return;
      }
      
      if (data?.images?.[0]) {
        console.log('✅ Successfully fetched hero image');
        setHeroImage({
          url: data.images[0].thumb_url,
          alt: data.images[0].alt || `Blog hero image for ${title}`,
          photographer: data.images[0].photographer,
          isPlaceholder: false
        });
      } else {
        // Fallback to placeholder
        setHeroImage({
          url: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=300&fit=crop&auto=format',
          alt: `Blog hero image for ${title}`,
          photographer: 'Sample Garden Center',
          isPlaceholder: true
        });
      }
    } catch (error) {
      console.error('❌ Error fetching hero image:', error);
      setHeroImage({
        url: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=300&fit=crop&auto=format',
        alt: `Blog hero image for ${title}`,
        photographer: 'Sample Garden Center',
        isPlaceholder: true
      });
    } finally {
      setLoadingImage(false);
    }
  };

  useEffect(() => {
    fetchHeroImage();
  }, [query, imageRefreshCount]);

  const refreshImage = () => {
    setImageRefreshCount(prev => prev + 1);
  };

  // Inject hero image into content at the beginning
  const contentWithHeroImage = React.useMemo(() => {
    if (!heroImage) return content;

    // Create hero image HTML
    const heroImageHtml = `
      <div class="blog-hero-image" style="float: right; margin: 0 0 20px 20px; max-width: 400px; width: 40%;">
        <img 
          src="${heroImage.url}" 
          alt="${heroImage.alt}" 
          style="width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);"
          onError="this.src='https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=300&fit=crop&auto=format'"
        />
        ${heroImage.photographer ? `
          <p style="font-size: 12px; color: #666; margin-top: 8px; text-align: center;">
            Photo by ${heroImage.photographer}${heroImage.isPlaceholder ? ' (Sample)' : ''}
          </p>
        ` : ''}
      </div>
    `;

    // Insert hero image after the first heading or at the beginning of content
    const headingMatch = content.match(/(<h1[^>]*>.*?<\/h1>)/i);
    if (headingMatch) {
      return content.replace(headingMatch[1], headingMatch[1] + heroImageHtml);
    } else {
      return heroImageHtml + content;
    }
  }, [content, heroImage]);

  return (
    <div className={`bg-white ${className || ''}`}>
      {/* Image controls */}
      <div className="flex items-center justify-end gap-2 mb-4 p-4 border-b border-gray-100">
        <Button
          variant="ghost"
          size="sm"
          onClick={refreshImage}
          disabled={loadingImage}
          className="text-xs"
        >
          <RefreshCw className={`w-3 h-3 mr-1 ${loadingImage ? 'animate-spin' : ''}`} />
          Refresh Image
        </Button>
        {heroImage?.isPlaceholder && (
          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
            <Info className="w-3 h-3 mr-1" />
            Sample Image
          </Badge>
        )}
      </div>

      {/* Blog content with hero image */}
      <BlogPostLayout
        content={contentWithHeroImage}
        className="px-4 pb-4"
      />
    </div>
  );
};
