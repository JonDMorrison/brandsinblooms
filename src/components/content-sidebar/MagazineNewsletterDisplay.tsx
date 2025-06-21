import React, { useEffect, useState } from 'react';
import { parseNewsletterYAML, StructuredNewsletter } from '@/utils/newsletterUtils';
import { Badge } from '@/components/ui/badge';
import { Clock, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface MagazineNewsletterDisplayProps {
  content: string;
  className?: string;
}

interface ImageData {
  url: string;
  alt: string;
  photographer?: string;
}

export const MagazineNewsletterDisplay = ({ content, className }: MagazineNewsletterDisplayProps) => {
  const [images, setImages] = useState<Record<number, ImageData>>({});
  const [loadingImages, setLoadingImages] = useState(false);

  const newsletter = parseNewsletterYAML(content);
  
  // Create a newsletter structure for both YAML and plain text
  const processedNewsletter = newsletter || {
    newsletter_md: content,
    blocks: [{
      title: 'Newsletter Content',
      body: content, // Use full content, not truncated
      cta: '',
      link: '',
      image_prompt: 'newsletter professional clean informative gardening seasonal',
      alt_text: 'Newsletter content image'
    }],
    extra_content_ideas: [],
    meta: {
      reading_time: '≈3 min',
      theme: 'Newsletter',
      week_focus: 'General'
    }
  };

  // Fetch images for all newsletters (both structured and plain text)
  useEffect(() => {
    const fetchImages = async () => {
      if (!processedNewsletter.blocks.length) return;
      
      setLoadingImages(true);
      console.log('[NEWSLETTER] Fetching images for newsletter blocks:', processedNewsletter.blocks.length);
      
      const imagePromises = processedNewsletter.blocks.map(async (block, index) => {
        if (!block.image_prompt) return null;
        
        try {
          console.log('[NEWSLETTER] Fetching image for block', index, 'with prompt:', block.image_prompt);
          const { data, error } = await supabase.functions.invoke('fetch-unsplash-images', {
            body: { 
              query: block.image_prompt,
              contentType: 'newsletter'
            }
          });
          
          if (error) {
            console.log('[NEWSLETTER] Unsplash API error for block', index, ':', error.message);
            return null;
          }
          
          if (data?.images?.[0]) {
            console.log('[NEWSLETTER] Successfully fetched image for block', index);
            return {
              index,
              image: {
                url: data.images[0].thumb_url,
                alt: data.images[0].alt || block.alt_text || block.title,
                photographer: data.images[0].photographer
              }
            };
          }
        } catch (error) {
          console.error('[NEWSLETTER] Error fetching image for block', index, ':', error);
        }
        return null;
      });

      const results = await Promise.all(imagePromises);
      const imageMap: Record<number, ImageData> = {};
      
      results.forEach(result => {
        if (result) {
          imageMap[result.index] = result.image;
        }
      });
      
      console.log('[NEWSLETTER] Final image map:', imageMap);
      setImages(imageMap);
      setLoadingImages(false);
    };

    fetchImages();
  }, [content]);

  // Extract main headline from newsletter_md
  const headlineMatch = processedNewsletter.newsletter_md.match(/^# (.+)$/m);
  const headline = headlineMatch?.[1] || 'Newsletter';
  
  // Extract intro from newsletter_md
  const introMatch = processedNewsletter.newsletter_md.match(/\*(.+?)\*/);
  const intro = introMatch?.[1] || '';

  return (
    <div className={`max-w-4xl mx-auto ${className || ''}`}>
      {/* Header Section */}
      <div className="mb-8 pb-6 border-b border-gray-200">
        <div className="flex items-center gap-3 mb-4">
          <Badge variant="outline" className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {processedNewsletter.meta.reading_time || '≈3 min'}
          </Badge>
          {processedNewsletter.meta.theme && (
            <Badge variant="secondary">
              {processedNewsletter.meta.theme}
            </Badge>
          )}
        </div>
        
        <h1 className="text-4xl font-bold text-slate-900 leading-tight mb-4">
          {headline}
        </h1>
        
        {intro && (
          <p className="text-xl text-slate-600 leading-relaxed font-light">
            {intro}
          </p>
        )}
      </div>

      {/* Content Blocks */}
      <div className="space-y-12">
        {processedNewsletter.blocks.map((block, index) => (
          <div key={index} className="grid lg:grid-cols-3 gap-8 items-start">
            {/* Content */}
            <div className="lg:col-span-2">
              {newsletter ? (
                // Structured newsletter - show title and body separately
                <>
                  <h3 className="text-2xl font-bold text-slate-900 mb-4 leading-tight">
                    {block.title}
                  </h3>
                  
                  <div className="prose prose-slate max-w-none">
                    <p className="text-lg text-slate-700 leading-relaxed mb-6">
                      {block.body}
                    </p>
                  </div>
                </>
              ) : (
                // Plain text newsletter - show full content with proper formatting
                <div className="prose prose-slate max-w-none">
                  <div className="text-lg text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {block.body}
                  </div>
                </div>
              )}
              
              {block.cta && (
                <div className="mt-6">
                  <a 
                    href={block.link || '#'} 
                    className="inline-flex items-center text-primary font-semibold hover:text-primary/80 transition-colors"
                  >
                    {block.cta} →
                  </a>
                </div>
              )}
            </div>

            {/* Image */}
            <div className="lg:col-span-1">
              {loadingImages ? (
                <div className="aspect-[4/3] bg-gray-100 rounded-lg flex items-center justify-center animate-pulse">
                  <ImageIcon className="w-8 h-8 text-gray-400" />
                </div>
              ) : images[index] ? (
                <div className="aspect-[4/3] rounded-lg overflow-hidden shadow-sm">
                  <img
                    src={images[index].url}
                    alt={images[index].alt}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      console.error('[NEWSLETTER] Image failed to load:', images[index].url);
                      // Hide broken image and show placeholder
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                  <div className="hidden aspect-[4/3] bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg flex items-center justify-center">
                    <div className="text-center text-gray-500">
                      <ImageIcon className="w-8 h-8 mx-auto mb-2" />
                      <p className="text-sm">Image unavailable</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="aspect-[4/3] bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <ImageIcon className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-sm">{block.image_prompt}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-16 pt-8 border-t border-gray-200 text-center">
        <p className="text-gray-600">
          Thanks for reading! 🌿
        </p>
      </div>
    </div>
  );
};
