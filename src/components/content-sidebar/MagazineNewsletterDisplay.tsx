
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
  const [imageErrors, setImageErrors] = useState<Record<number, string>>({});

  console.log('🖼️ MagazineNewsletterDisplay received content:', {
    hasContent: !!content,
    contentLength: content?.length || 0,
    contentPreview: content?.substring(0, 200)
  });

  // Try to parse as structured YAML first
  const newsletter = parseNewsletterYAML(content);
  
  // Create a robust newsletter structure for both YAML and plain text
  const processedNewsletter = newsletter || {
    newsletter_md: content,
    blocks: createBlocksFromPlainText(content),
    extra_content_ideas: [],
    meta: {
      reading_time: calculateReadingTime(content),
      theme: 'Newsletter',
      week_focus: 'Content Update'
    }
  };

  console.log('📄 Processed newsletter structure:', {
    isStructured: !!newsletter,
    blockCount: processedNewsletter.blocks.length,
    hasValidBlocks: processedNewsletter.blocks.some(b => b.body && b.body.trim().length > 0)
  });

  // Enhanced function to create meaningful blocks from plain text
  function createBlocksFromPlainText(rawContent: string) {
    if (!rawContent || rawContent.trim().length === 0) {
      return [{
        title: 'Newsletter Content',
        body: 'Newsletter content is being prepared...',
        cta: '',
        link: '',
        image_prompt: 'newsletter professional clean informative',
        alt_text: 'Newsletter content image'
      }];
    }

    // Split content into meaningful sections
    const lines = rawContent.split('\n').filter(line => line.trim().length > 0);
    const sections = [];
    let currentSection = '';
    
    for (const line of lines) {
      // Check if this looks like a header (all caps, short, or has specific patterns)
      const isHeader = line.length < 60 && (
        line === line.toUpperCase() ||
        line.includes('WEEK') ||
        line.includes('FOCUS') ||
        line.includes(':') ||
        /^[A-Z][A-Za-z\s]+$/.test(line.trim())
      );
      
      if (isHeader && currentSection.length > 100) {
        // Start a new section
        sections.push(currentSection.trim());
        currentSection = line + '\n';
      } else {
        currentSection += line + '\n';
      }
    }
    
    // Add the last section
    if (currentSection.trim().length > 0) {
      sections.push(currentSection.trim());
    }
    
    // If we couldn't parse into sections, treat as one block
    if (sections.length === 0) {
      sections.push(rawContent);
    }
    
    return sections.map((section, index) => {
      const lines = section.split('\n');
      const title = lines[0]?.trim() || `Section ${index + 1}`;
      const body = lines.slice(1).join('\n').trim() || section;
      
      return {
        title: title.length > 100 ? `Section ${index + 1}` : title,
        body: body || section,
        cta: index === sections.length - 1 ? 'Visit us for more information' : '',
        link: '',
        image_prompt: `newsletter professional ${title.toLowerCase().replace(/[^a-z0-9\s]/g, '')} informative`,
        alt_text: `${title} - newsletter section image`
      };
    });
  }

  // Calculate reading time based on content length
  function calculateReadingTime(text: string): string {
    if (!text) return '≈1 min';
    const wordCount = text.replace(/<[^>]*>/g, '').split(/\s+/).length;
    const minutes = Math.ceil(wordCount / 200); // Average reading speed
    return `≈${minutes} min`;
  }

  // Fetch images for newsletter blocks
  useEffect(() => {
    const fetchImages = async () => {
      if (!processedNewsletter.blocks.length) {
        console.log('[NEWSLETTER] No blocks found, skipping image fetch');
        return;
      }
      
      setLoadingImages(true);
      setImageErrors({});
      console.log('[NEWSLETTER] Starting image fetch for', processedNewsletter.blocks.length, 'blocks');
      
      const imagePromises = processedNewsletter.blocks.map(async (block, index) => {
        if (!block.image_prompt) {
          console.log('[NEWSLETTER] Block', index, 'has no image prompt, skipping');
          return null;
        }
        
        try {
          console.log('[NEWSLETTER] Fetching image for block', index, 'with prompt:', block.image_prompt);
          
          const { data, error } = await supabase.functions.invoke('fetch-unsplash-images', {
            body: { 
              query: block.image_prompt,
              contentType: 'newsletter'
            }
          });
          
          if (error) {
            console.error('[NEWSLETTER] Supabase function error for block', index, ':', error);
            setImageErrors(prev => ({ ...prev, [index]: error.message || 'Function call failed' }));
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
          } else {
            console.warn('[NEWSLETTER] No images in response for block', index);
            setImageErrors(prev => ({ ...prev, [index]: 'No images found for query' }));
            return null;
          }
        } catch (error) {
          console.error('[NEWSLETTER] Exception fetching image for block', index, ':', error);
          setImageErrors(prev => ({ ...prev, [index]: error.message || 'Network error' }));
          return null;
        }
      });

      try {
        const results = await Promise.all(imagePromises);
        const imageMap: Record<number, ImageData> = {};
        
        results.forEach(result => {
          if (result) {
            imageMap[result.index] = result.image;
          }
        });
        
        console.log('[NEWSLETTER] Final image map:', imageMap);
        setImages(imageMap);
      } catch (error) {
        console.error('[NEWSLETTER] Error in Promise.all:', error);
      } finally {
        setLoadingImages(false);
      }
    };

    fetchImages();
  }, [content]);

  // Extract main headline from newsletter_md
  const headlineMatch = processedNewsletter.newsletter_md.match(/^# (.+)$/m);
  const headline = headlineMatch?.[1] || extractTitleFromContent(processedNewsletter.newsletter_md) || 'Newsletter Update';
  
  // Extract intro from newsletter_md
  const introMatch = processedNewsletter.newsletter_md.match(/\*(.+?)\*/);
  const intro = introMatch?.[1] || generateIntroFromContent(processedNewsletter.newsletter_md);

  function extractTitleFromContent(content: string): string {
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    if (lines.length > 0) {
      const firstLine = lines[0].trim();
      // If first line looks like a title (short and not a sentence)
      if (firstLine.length < 100 && !firstLine.endsWith('.') && !firstLine.includes('\n')) {
        return firstLine;
      }
    }
    return 'Newsletter Update';
  }

  function generateIntroFromContent(content: string): string {
    const lines = content.split('\n').filter(line => line.trim().length > 20);
    const firstMeaningfulLine = lines.find(line => 
      !line.includes('#') && 
      !line.includes('WEEK') && 
      line.length > 30 &&
      line.length < 200
    );
    return firstMeaningfulLine || 'Welcome to our latest newsletter update';
  }

  return (
    <div className={`max-w-4xl mx-auto ${className || ''}`}>
      {/* Header Section */}
      <div className="mb-8 pb-6 border-b border-gray-200">
        <div className="flex items-center gap-3 mb-4">
          <Badge variant="outline" className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {processedNewsletter.meta.reading_time}
          </Badge>
          {processedNewsletter.meta.theme && (
            <Badge variant="secondary">
              {processedNewsletter.meta.theme}
            </Badge>
          )}
          <Badge variant="outline">
            Newsletter
          </Badge>
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

      {/* Debug Info in Development */}
      {import.meta.env.DEV && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">Debug Info</h3>
          <div className="text-sm text-blue-800 space-y-1">
            <div>Newsletter type: {newsletter ? 'Structured YAML' : 'Plain text'}</div>
            <div>Blocks: {processedNewsletter.blocks.length}</div>
            <div>Images loaded: {Object.keys(images).length}</div>
            <div>Loading: {loadingImages ? 'Yes' : 'No'}</div>
            {Object.keys(imageErrors).length > 0 && (
              <div>Errors: {JSON.stringify(imageErrors)}</div>
            )}
          </div>
        </div>
      )}

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
                // Plain text newsletter - enhanced formatting
                <>
                  {block.title !== block.body && (
                    <h3 className="text-2xl font-bold text-slate-900 mb-4 leading-tight">
                      {block.title}
                    </h3>
                  )}
                  
                  <div className="prose prose-slate max-w-none">
                    <div className="text-lg text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {block.body}
                    </div>
                  </div>
                </>
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
                  <div className="text-center text-gray-500">
                    <ImageIcon className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-sm">Loading image...</p>
                  </div>
                </div>
              ) : images[index] ? (
                <div className="aspect-[4/3] rounded-lg overflow-hidden shadow-sm">
                  <img
                    src={images[index].url}
                    alt={images[index].alt}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      console.error('[NEWSLETTER] Image failed to load:', images[index].url);
                      e.currentTarget.style.display = 'none';
                      const placeholder = e.currentTarget.nextElementSibling as HTMLElement;
                      if (placeholder) {
                        placeholder.classList.remove('hidden');
                      }
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
                <div className="aspect-[4/3] bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
                  <div className="text-center text-gray-500 p-4">
                    <ImageIcon className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-sm mb-1">Loading image...</p>
                    {imageErrors[index] && (
                      <p className="text-xs text-red-500">{imageErrors[index]}</p>
                    )}
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
