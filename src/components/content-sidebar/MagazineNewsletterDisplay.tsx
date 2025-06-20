
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

interface PlainNewsletterSection {
  title: string;
  body: string;
  imagePrompt: string;
}

export const MagazineNewsletterDisplay = ({ content, className }: MagazineNewsletterDisplayProps) => {
  const [images, setImages] = useState<Record<number, ImageData>>({});
  const [loadingImages, setLoadingImages] = useState(false);

  const newsletter = parseNewsletterYAML(content);
  
  // Parse plain newsletter content into sections for 60/40 layout
  const parsePlainNewsletter = (content: string) => {
    // Clean HTML tags and get text content
    const cleanContent = content.replace(/<[^>]*>/g, '\n').replace(/\n\s*\n/g, '\n').trim();
    const lines = cleanContent.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) return { title: 'Newsletter', sections: [] };
    
    // Extract title (first line or first heading)
    const title = lines[0].replace(/^#+\s*/, '').trim() || 'Newsletter';
    
    // Split content into sections based on paragraphs
    const paragraphs = lines.slice(1).filter(line => line.trim().length > 20);
    const sections: PlainNewsletterSection[] = [];
    
    // Create sections from paragraphs (group every 2-3 sentences)
    for (let i = 0; i < paragraphs.length; i += 2) {
      const sectionTitle = `Section ${Math.floor(i / 2) + 1}`;
      const body = paragraphs.slice(i, i + 2).join(' ');
      const imagePrompt = `newsletter content section ${Math.floor(i / 2) + 1}`;
      
      if (body.trim()) {
        sections.push({
          title: sectionTitle,
          body: body,
          imagePrompt: imagePrompt
        });
      }
    }
    
    // If no good sections found, create one from all content
    if (sections.length === 0 && paragraphs.length > 0) {
      sections.push({
        title: 'Newsletter Content',
        body: paragraphs.join(' '),
        imagePrompt: 'newsletter content'
      });
    }
    
    return { title, sections };
  };
  
  // Determine if this is structured or plain newsletter
  const isStructured = !!newsletter;
  const plainNewsletter = !isStructured ? parsePlainNewsletter(content) : null;
  
  // Get sections for image fetching
  const sectionsForImages = isStructured 
    ? newsletter.blocks 
    : (plainNewsletter?.sections || []);

  // Fetch images for each section
  useEffect(() => {
    const fetchImages = async () => {
      if (!sectionsForImages.length) return;
      
      setLoadingImages(true);
      const imagePromises = sectionsForImages.map(async (section, index) => {
        const prompt = isStructured 
          ? (section as any).image_prompt 
          : (section as PlainNewsletterSection).imagePrompt;
          
        if (!prompt) return null;
        
        try {
          const { data } = await supabase.functions.invoke('fetch-unsplash-images', {
            body: { query: prompt }
          });
          
          if (data?.images?.[0]) {
            return {
              index,
              image: {
                url: data.images[0].thumb_url,
                alt: data.images[0].alt || prompt,
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
  }, [sectionsForImages]);

  // For structured newsletters
  if (isStructured) {
    // Extract main headline from newsletter_md
    const headlineMatch = newsletter.newsletter_md.match(/^# (.+)$/m);
    const headline = headlineMatch?.[1] || 'Newsletter';
    
    // Extract intro from newsletter_md
    const introMatch = newsletter.newsletter_md.match(/\*(.+?)\*/);
    const intro = introMatch?.[1] || '';

    return (
      <div className={`max-w-6xl mx-auto bg-white ${className || ''}`}>
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

        {/* Content Blocks - 60/40 Split */}
        <div className="space-y-12">
          {newsletter.blocks.map((block, index) => (
            <div key={index} className="grid lg:grid-cols-[3fr_2fr] gap-8 items-start">
              {/* Content Section - 60% */}
              <div className="space-y-4">
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

              {/* Image Section - 40% */}
              <div className="lg:pl-4">
                {loadingImages ? (
                  <div className="aspect-[4/3] bg-gradient-to-br from-teal-100 to-cyan-100 rounded-lg flex items-center justify-center border border-teal-200">
                    <ImageIcon className="w-8 h-8 text-teal-500" />
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
                  <div className="aspect-[4/3] bg-gradient-to-br from-teal-100 to-cyan-100 rounded-lg flex items-center justify-center border border-teal-200">
                    <div className="text-center text-teal-600">
                      <ImageIcon className="w-8 h-8 mx-auto mb-2" />
                      <p className="text-sm font-medium">Newsletter Image</p>
                      <p className="text-xs opacity-75">{block.image_prompt}</p>
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

  // For plain newsletters - use same 60/40 layout
  if (plainNewsletter && plainNewsletter.sections.length > 0) {
    return (
      <div className={`max-w-6xl mx-auto bg-white ${className || ''}`}>
        {/* Header Section */}
        <div className="mb-8 pb-6 border-b border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <Badge variant="outline" className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              ≈3 min
            </Badge>
            <Badge variant="secondary">
              Newsletter
            </Badge>
          </div>
          
          <h1 className="text-4xl font-bold text-slate-900 leading-tight mb-4">
            {plainNewsletter.title}
          </h1>
        </div>

        {/* Content Sections - 60/40 Split */}
        <div className="space-y-12">
          {plainNewsletter.sections.map((section, index) => (
            <div key={index} className="grid lg:grid-cols-[3fr_2fr] gap-8 items-start">
              {/* Content Section - 60% */}
              <div className="space-y-4">
                <h3 className="text-2xl font-bold text-slate-900 mb-4 leading-tight">
                  {section.title}
                </h3>
                
                <div className="prose prose-slate max-w-none">
                  <p className="text-lg text-slate-700 leading-relaxed mb-6">
                    {section.body}
                  </p>
                </div>
              </div>

              {/* Image Section - 40% */}
              <div className="lg:pl-4">
                {loadingImages ? (
                  <div className="aspect-[4/3] bg-gradient-to-br from-teal-100 to-cyan-100 rounded-lg flex items-center justify-center border border-teal-200">
                    <ImageIcon className="w-8 h-8 text-teal-500" />
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
                  <div className="aspect-[4/3] bg-gradient-to-br from-teal-100 to-cyan-100 rounded-lg flex items-center justify-center border border-teal-200">
                    <div className="text-center text-teal-600">
                      <ImageIcon className="w-8 h-8 mx-auto mb-2" />
                      <p className="text-sm font-medium">Newsletter Image</p>
                      <p className="text-xs opacity-75">{section.imagePrompt}</p>
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

  // Final fallback for empty or invalid content
  return (
    <div className={`prose prose-lg max-w-none ${className || ''}`}>
      <div dangerouslySetInnerHTML={{ __html: content }} />
    </div>
  );
};
