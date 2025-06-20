
import React, { useEffect, useState } from 'react';
import { parseNewsletterYAML, StructuredNewsletter } from '@/utils/newsletterUtils';
import { Badge } from '@/components/ui/badge';
import { Clock, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { parseNewsletterJson } from '@/utils/contentUtils';

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

  console.log('MagazineNewsletterDisplay: Rendering with content preview:', content.substring(0, 200));

  // First try to parse as structured YAML newsletter
  const newsletter = parseNewsletterYAML(content);
  
  // If not structured, try JSON newsletter format
  const jsonNewsletter = !newsletter ? parseNewsletterJson(content) : null;
  
  console.log('MagazineNewsletterDisplay: Parsed formats:', {
    structuredNewsletter: !!newsletter,
    jsonNewsletter: !!jsonNewsletter,
    hasBlocks: newsletter?.blocks?.length || 0
  });

  // Handle structured YAML newsletter
  if (newsletter) {
    // Fetch images for each block
    useEffect(() => {
      const fetchImages = async () => {
        if (!newsletter.blocks.length) return;
        
        setLoadingImages(true);
        const imagePromises = newsletter.blocks.map(async (block, index) => {
          if (!block.image_prompt) return null;
          
          try {
            const { data } = await supabase.functions.invoke('fetch-unsplash-images', {
              body: { query: block.image_prompt }
            });
            
            if (data?.images?.[0]) {
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
            console.error('Error fetching image:', error);
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
        
        setImages(imageMap);
        setLoadingImages(false);
      };

      fetchImages();
    }, [newsletter.blocks]);

    // Extract main headline from newsletter_md
    const headlineMatch = newsletter.newsletter_md.match(/^# (.+)$/m);
    const headline = headlineMatch?.[1] || 'Newsletter';
    
    // Extract intro from newsletter_md
    const introMatch = newsletter.newsletter_md.match(/\*(.+?)\*/);
    const intro = introMatch?.[1] || '';

    return (
      <div className={`max-w-4xl mx-auto ${className || ''}`}>
        {/* Header Section */}
        <div className="mb-8 pb-6 border-b border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <Badge variant="outline" className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {newsletter.meta.reading_time || '≈3 min'}
            </Badge>
            {newsletter.meta.theme && (
              <Badge variant="secondary">
                {newsletter.meta.theme}
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
          {newsletter.blocks.map((block, index) => (
            <div key={index} className="grid lg:grid-cols-3 gap-8 items-start">
              {/* Content */}
              <div className="lg:col-span-2">
                <h3 className="text-2xl font-bold text-slate-900 mb-4 leading-tight">
                  {block.title}
                </h3>
                
                <div className="prose prose-slate max-w-none">
                  <p className="text-lg text-slate-700 leading-relaxed mb-6">
                    {block.body}
                  </p>
                </div>
                
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
                  <div className="aspect-[4/3] bg-gray-100 rounded-lg flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-gray-400" />
                  </div>
                ) : images[index] ? (
                  <div className="aspect-[4/3] rounded-lg overflow-hidden shadow-sm">
                    <img
                      src={images[index].url}
                      alt={images[index].alt}
                      className="w-full h-full object-cover"
                    />
                    {images[index].photographer && (
                      <p className="text-xs text-gray-500 mt-2 text-center">
                        Photo by {images[index].photographer}
                      </p>
                    )}
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
  }

  // Handle JSON newsletter format
  if (jsonNewsletter) {
    return (
      <div className={`max-w-4xl mx-auto ${className || ''}`}>
        <div className="mb-8 pb-6 border-b border-gray-200">
          <h1 className="text-4xl font-bold text-slate-900 leading-tight mb-4">
            {jsonNewsletter.subject}
          </h1>
        </div>
        
        <div 
          className="prose prose-lg prose-headings:font-display prose-a:text-primary prose-strong:text-slate-900 prose-li:marker:text-primary max-w-none"
          dangerouslySetInnerHTML={{ __html: jsonNewsletter.content }}
        />
        
        <div className="mt-16 pt-8 border-t border-gray-200 text-center">
          <p className="text-gray-600">
            Thanks for reading! 🌿
          </p>
        </div>
      </div>
    );
  }

  // Fallback for any newsletter content that doesn't parse as structured
  console.log('MagazineNewsletterDisplay: Using fallback display for newsletter content');
  
  return (
    <div className={`max-w-4xl mx-auto ${className || ''}`}>
      <div className="mb-8 pb-6 border-b border-gray-200">
        <h1 className="text-4xl font-bold text-slate-900 leading-tight mb-4">
          Newsletter
        </h1>
      </div>
      
      <div className="prose prose-lg prose-headings:font-display prose-a:text-primary prose-strong:text-slate-900 prose-li:marker:text-primary max-w-none">
        <div className="whitespace-pre-wrap text-slate-700 leading-relaxed">
          {content}
        </div>
      </div>
      
      <div className="mt-16 pt-8 border-t border-gray-200 text-center">
        <p className="text-gray-600">
          Thanks for reading! 🌿
        </p>
      </div>
    </div>
  );
};
