import React, { useEffect, useState } from 'react';
import { parseNewsletterYAML, StructuredNewsletter } from '@/utils/newsletterUtils';
import { Badge } from '@/components/ui/badge';
import { Clock, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface MagazineNewsletterDisplayProps {
  content: string;
  className?: string;
  contentTaskId?: string;
  campaignTitle?: string;
}

interface ImageData {
  url: string;
  alt: string;
  photographer?: string;
}

export const MagazineNewsletterDisplay = ({ 
  content, 
  className,
  contentTaskId,
  campaignTitle 
}: MagazineNewsletterDisplayProps) => {
  const { user } = useAuth();
  const [images, setImages] = useState<Record<number, ImageData>>({});
  const [loadingImages, setLoadingImages] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<number, string>>({});
  const [regenerating, setRegenerating] = useState(false);

  console.log('🖼️ MagazineNewsletterDisplay received content:', {
    hasContent: !!content,
    contentLength: content?.length || 0,
    contentPreview: content?.substring(0, 200),
    contentTaskId,
    campaignTitle
  });

  // Much more conservative placeholder detection - only flag truly empty or minimal content
  const isPlaceholderContent = !content || 
    content.trim().length === 0 ||
    content.trim() === 'Newsletter Update' ||
    content.trim() === 'Newsletter Update.' ||
    content === 'Newsletter Update. Welcome to our latest newsletter update.' ||
    // Only flag as placeholder if content is extremely minimal (less than 50 characters and generic)
    (content.trim().length < 50 && 
     (content.includes('Welcome to our latest newsletter update') || 
      content === 'Newsletter Update. Welcome to our latest newsletter update'));

  console.log('🔍 Placeholder content check:', {
    isPlaceholder: isPlaceholderContent,
    contentLength: content?.length,
    trimmedLength: content?.trim().length,
    contentStart: content?.trim().substring(0, 100)
  });

  // Try to parse as structured YAML first
  const newsletter = parseNewsletterYAML(content);
  
  // Create a robust newsletter structure for both YAML and plain text
  const processedNewsletter = newsletter || {
    newsletter_md: content || '',
    blocks: createBlocksFromPlainText(content || ''),
    extra_content_ideas: [],
    meta: {
      reading_time: calculateReadingTime(content || ''),
      theme: campaignTitle || 'Newsletter',
      week_focus: 'Content Update'
    }
  };

  // Improved function to create meaningful blocks from plain text
  function createBlocksFromPlainText(rawContent: string) {
    if (!rawContent || rawContent.trim().length === 0) {
      console.log('🚫 Creating placeholder block due to empty content');
      return [{
        title: 'Newsletter Content Loading',
        body: 'Your newsletter content is being generated with expert gardening advice...',
        cta: 'Visit us for expert advice',
        link: '',
        image_prompt: 'newsletter professional garden center informative',
        alt_text: 'Newsletter content image'
      }];
    }

    // For legitimate content, create proper blocks
    const lines = rawContent.split('\n').filter(line => line.trim().length > 0);
    
    if (lines.length === 0) {
      return [{
        title: 'Newsletter Update',
        body: rawContent.trim(),
        cta: '',
        link: '',
        image_prompt: `newsletter professional ${campaignTitle || 'garden center'} informative`,
        alt_text: 'Newsletter content image'
      }];
    }

    // If we have multiple lines, create sections
    if (lines.length > 2) {
      const sections = [];
      let currentSection = '';
      
      for (const line of lines) {
        // Check if this looks like a header (short line that might be a title)
        const isHeader = line.length < 60 && (
          line === line.toUpperCase() ||
          line.includes('WEEK') ||
          line.includes('FOCUS') ||
          line.includes(':') ||
          /^[A-Z][A-Za-z\s]+$/.test(line.trim())
        );
        
        if (isHeader && currentSection.length > 50) {
          sections.push(currentSection.trim());
          currentSection = line + '\n';
        } else {
          currentSection += line + '\n';
        }
      }
      
      if (currentSection.trim().length > 0) {
        sections.push(currentSection.trim());
      }
      
      if (sections.length > 1) {
        return sections.map((section, index) => {
          const sectionLines = section.split('\n');
          const title = sectionLines[0]?.trim() || `Section ${index + 1}`;
          const body = sectionLines.slice(1).join('\n').trim() || section;
          
          return {
            title: title.length > 100 ? `Section ${index + 1}` : title,
            body: body || section,
            cta: index === sections.length - 1 ? 'Visit us for more information' : '',
            link: '',
            image_prompt: `newsletter professional ${campaignTitle || 'garden center'} ${title.toLowerCase().replace(/[^a-z0-9\s]/g, '')} informative`,
            alt_text: `${title} - newsletter section image`
          };
        });
      }
    }
    
    // For shorter content or single sections, create one main block
    const title = lines[0]?.trim() || 'Newsletter Update';
    const body = lines.length > 1 ? lines.slice(1).join('\n').trim() : rawContent.trim();
    
    return [{
      title: title.length > 100 ? 'Newsletter Update' : title,
      body: body || rawContent.trim(),
      cta: 'Visit us for more information',
      link: '',
      image_prompt: `newsletter professional ${campaignTitle || 'garden center'} ${title.toLowerCase().replace(/[^a-z0-9\s]/g, '')} informative`,
      alt_text: `${title} - newsletter image`
    }];
  }

  // Calculate reading time based on content length
  function calculateReadingTime(text: string): string {
    if (!text) return '≈1 min';
    const wordCount = text.replace(/<[^>]*>/g, '').split(/\s+/).length;
    const minutes = Math.ceil(wordCount / 200);
    return `≈${minutes} min`;
  }

  // Regenerate newsletter content
  const regenerateNewsletter = async () => {
    if (!user || !contentTaskId) {
      toast.error('Unable to regenerate newsletter - missing required information');
      return;
    }

    setRegenerating(true);
    try {
      console.log('🔄 Regenerating newsletter content for task:', contentTaskId);
      
      const { data, error } = await supabase.functions.invoke('generate-structured-newsletter', {
        body: {
          business_name: '',
          theme: campaignTitle || 'Seasonal Gardening',
          week_focus: `Expert gardening advice for ${campaignTitle || 'seasonal care'}`,
          promo_items: [],
          tone_note: '',
          userId: user.id,
          is_holiday: false
        }
      });

      if (error) {
        console.error('❌ Newsletter regeneration error:', error);
        toast.error('Failed to regenerate newsletter content');
        return;
      }

      if (data?.content) {
        console.log('✅ Generated new newsletter content, updating task...');
        
        // Update the task with new content
        const { error: updateError } = await supabase
          .from('content_tasks')
          .update({
            ai_output: data.content,
            status: 'review'
          })
          .eq('id', contentTaskId);

        if (updateError) {
          console.error('❌ Error updating newsletter:', updateError);
          toast.error('Failed to save regenerated newsletter');
        } else {
          toast.success('Newsletter regenerated successfully! Refreshing page...');
          setTimeout(() => window.location.reload(), 1500);
        }
      } else {
        console.error('❌ No content returned from generation function');
        toast.error('No content was generated');
      }
    } catch (error) {
      console.error('❌ Newsletter regeneration failed:', error);
      toast.error('Failed to regenerate newsletter');
    } finally {
      setRegenerating(false);
    }
  };

  // Skip image fetch if content is truly placeholder
  useEffect(() => {
    if (isPlaceholderContent) {
      console.log('[NEWSLETTER] Skipping image fetch - placeholder content detected');
      return;
    }
    
    if (!processedNewsletter.blocks.length) {
      console.log('[NEWSLETTER] Skipping image fetch - no valid blocks');
      return;
    }
    
    setLoadingImages(true);
    setImageErrors({});
    console.log('[NEWSLETTER] Starting image fetch for', processedNewsletter.blocks.length, 'blocks');
    
    const fetchImages = async () => {
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
  }, [content, isPlaceholderContent, contentTaskId]);

  // If content is truly placeholder, show regeneration option
  if (isPlaceholderContent) {
    console.log('🔄 Showing regeneration UI due to truly placeholder content');
    return (
      <div className={`w-full ${className || ''}`}>
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">
            Newsletter Content Needs Generation
          </h2>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            The newsletter content appears to be incomplete or just a placeholder. 
            Let's generate proper structured newsletter content with expert gardening advice.
          </p>
          <Button 
            onClick={regenerateNewsletter}
            disabled={regenerating || !contentTaskId}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
            {regenerating ? 'Generating Newsletter...' : 'Generate Full Newsletter'}
          </Button>
          {!contentTaskId && (
            <p className="text-sm text-gray-500 mt-2">
              Content ID required for regeneration
            </p>
          )}
        </div>
      </div>
    );
  }

  // Extract main headline from newsletter_md
  const headlineMatch = processedNewsletter.newsletter_md.match(/^# (.+)$/m);
  const headline = headlineMatch?.[1] || extractTitleFromContent(processedNewsletter.newsletter_md) || campaignTitle || 'Newsletter Update';
  
  // Extract intro from newsletter_md
  const introMatch = processedNewsletter.newsletter_md.match(/\*(.+?)\*/);
  const intro = introMatch?.[1] || generateIntroFromContent(processedNewsletter.newsletter_md);

  function extractTitleFromContent(content: string): string {
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    if (lines.length > 0) {
      const firstLine = lines[0].trim();
      if (firstLine.length < 100 && !firstLine.endsWith('.') && !firstLine.includes('\n')) {
        return firstLine;
      }
    }
    return campaignTitle || 'Newsletter Update';
  }

  function generateIntroFromContent(content: string): string {
    const lines = content.split('\n').filter(line => line.trim().length > 20);
    const firstMeaningfulLine = lines.find(line => 
      !line.includes('#') && 
      !line.includes('WEEK') && 
      line.length > 30 &&
      line.length < 200
    );
    return firstMeaningfulLine || `Discover expert gardening insights for ${campaignTitle || 'seasonal care'}`;
  }

  // Full magazine layout without width constraints
  return (
    <div className={`w-full ${className || ''}`}>
      {/* Header Section - Full Width */}
      <div className="mb-12 pb-8 border-b-2 border-gray-200">
        <div className="flex items-center gap-4 mb-6">
          <Badge variant="outline" className="flex items-center gap-2 px-3 py-1">
            <Clock className="w-4 h-4" />
            {processedNewsletter.meta.reading_time}
          </Badge>
          {processedNewsletter.meta.theme && (
            <Badge variant="secondary" className="px-3 py-1 text-sm">
              {processedNewsletter.meta.theme}
            </Badge>
          )}
          <Badge variant="outline" className="px-3 py-1 text-sm">
            Newsletter
          </Badge>
          {contentTaskId && (
            <Button
              size="sm"
              variant="outline"
              onClick={regenerateNewsletter}
              disabled={regenerating}
              className="ml-auto gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
              Regenerate
            </Button>
          )}
        </div>
        
        <h1 className="text-5xl font-bold text-slate-900 leading-tight mb-6">
          {headline}
        </h1>
        
        {intro && (
          <p className="text-2xl text-slate-600 leading-relaxed font-light max-w-4xl">
            {intro}
          </p>
        )}
      </div>

      {/* Content Blocks - Full Magazine Layout */}
      <div className="space-y-16">
        {processedNewsletter.blocks.map((block, index) => (
          <div key={index} className="grid lg:grid-cols-2 gap-12 items-start">
            {/* Content Section - Enhanced */}
            <div className="space-y-6">
              {newsletter ? (
                // Structured newsletter - show title and body separately
                <>
                  <h2 className="text-3xl font-bold text-slate-900 leading-tight">
                    {block.title}
                  </h2>
                  
                  <div className="prose prose-lg prose-slate max-w-none">
                    <p className="text-xl text-slate-700 leading-relaxed">
                      {block.body}
                    </p>
                  </div>
                </>
              ) : (
                // Plain text newsletter - enhanced formatting
                <>
                  {block.title !== block.body && (
                    <h2 className="text-3xl font-bold text-slate-900 leading-tight">
                      {block.title}
                    </h2>
                  )}
                  
                  <div className="prose prose-lg prose-slate max-w-none">
                    <div className="text-xl text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {block.body}
                    </div>
                  </div>
                </>
              )}
              
              {block.cta && (
                <div className="mt-8">
                  <a 
                    href={block.link || '#'} 
                    className="inline-flex items-center text-lg text-primary font-semibold hover:text-primary/80 transition-colors bg-primary/10 px-4 py-2 rounded-lg"
                  >
                    {block.cta} →
                  </a>
                </div>
              )}
            </div>

            {/* Image Section - Enhanced */}
            <div className="lg:col-span-1">
              {loadingImages ? (
                <div className="aspect-[3/2] bg-gray-100 rounded-xl flex items-center justify-center animate-pulse">
                  <div className="text-center text-gray-500">
                    <ImageIcon className="w-12 h-12 mx-auto mb-3" />
                    <p className="text-lg">Loading image...</p>
                  </div>
                </div>
              ) : images[index] ? (
                <div className="aspect-[3/2] rounded-xl overflow-hidden shadow-lg">
                  <img
                    src={images[index].url}
                    alt={images[index].alt}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      console.error('[NEWSLETTER] Image failed to load:', images[index].url);
                      e.currentTarget.style.display = 'none';
                      const placeholder = e.currentTarget.nextElementSibling as HTMLElement;
                      if (placeholder) {
                        placeholder.classList.remove('hidden');
                      }
                    }}
                  />
                  <div className="hidden aspect-[3/2] bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl flex items-center justify-center">
                    <div className="text-center text-gray-500">
                      <ImageIcon className="w-12 h-12 mx-auto mb-3" />
                      <p className="text-lg">Image unavailable</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="aspect-[3/2] bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl flex items-center justify-center border-2 border-gray-200 border-dashed">
                  <div className="text-center text-gray-500 p-6">
                    <ImageIcon className="w-12 h-12 mx-auto mb-3" />
                    <p className="text-lg mb-2">Loading image...</p>
                    {imageErrors[index] && (
                      <p className="text-sm text-red-500">{imageErrors[index]}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer - Enhanced */}
      <div className="mt-20 pt-12 border-t-2 border-gray-200 text-center">
        <p className="text-xl text-gray-600">
          Thanks for reading! 🌿
        </p>
      </div>
    </div>
  );

  // Helper functions moved to bottom for readability
  function createBlocksFromPlainText(rawContent: string) {
    if (!rawContent || rawContent.trim().length === 0) {
      console.log('🚫 Creating placeholder block due to empty content');
      return [{
        title: 'Newsletter Content Loading',
        body: 'Your newsletter content is being generated with expert gardening advice...',
        cta: 'Visit us for expert advice',
        link: '',
        image_prompt: 'newsletter professional garden center informative',
        alt_text: 'Newsletter content image'
      }];
    }

    // For legitimate content, create proper blocks
    const lines = rawContent.split('\n').filter(line => line.trim().length > 0);
    
    if (lines.length === 0) {
      return [{
        title: 'Newsletter Update',
        body: rawContent.trim(),
        cta: '',
        link: '',
        image_prompt: `newsletter professional ${campaignTitle || 'garden center'} informative`,
        alt_text: 'Newsletter content image'
      }];
    }

    // If we have multiple lines, create sections
    if (lines.length > 2) {
      const sections = [];
      let currentSection = '';
      
      for (const line of lines) {
        // Check if this looks like a header (short line that might be a title)
        const isHeader = line.length < 60 && (
          line === line.toUpperCase() ||
          line.includes('WEEK') ||
          line.includes('FOCUS') ||
          line.includes(':') ||
          /^[A-Z][A-Za-z\s]+$/.test(line.trim())
        );
        
        if (isHeader && currentSection.length > 50) {
          sections.push(currentSection.trim());
          currentSection = line + '\n';
        } else {
          currentSection += line + '\n';
        }
      }
      
      if (currentSection.trim().length > 0) {
        sections.push(currentSection.trim());
      }
      
      if (sections.length > 1) {
        return sections.map((section, index) => {
          const sectionLines = section.split('\n');
          const title = sectionLines[0]?.trim() || `Section ${index + 1}`;
          const body = sectionLines.slice(1).join('\n').trim() || section;
          
          return {
            title: title.length > 100 ? `Section ${index + 1}` : title,
            body: body || section,
            cta: index === sections.length - 1 ? 'Visit us for more information' : '',
            link: '',
            image_prompt: `newsletter professional ${campaignTitle || 'garden center'} ${title.toLowerCase().replace(/[^a-z0-9\s]/g, '')} informative`,
            alt_text: `${title} - newsletter section image`
          };
        });
      }
    }
    
    // For shorter content or single sections, create one main block
    const title = lines[0]?.trim() || 'Newsletter Update';
    const body = lines.length > 1 ? lines.slice(1).join('\n').trim() : rawContent.trim();
    
    return [{
      title: title.length > 100 ? 'Newsletter Update' : title,
      body: body || rawContent.trim(),
      cta: 'Visit us for more information',
      link: '',
      image_prompt: `newsletter professional ${campaignTitle || 'garden center'} ${title.toLowerCase().replace(/[^a-z0-9\s]/g, '')} informative`,
      alt_text: `${title} - newsletter image`
    }];
  }

  function calculateReadingTime(text: string): string {
    if (!text) return '≈1 min';
    const wordCount = text.replace(/<[^>]*>/g, '').split(/\s+/).length;
    const minutes = Math.ceil(wordCount / 200);
    return `≈${minutes} min`;
  }

  // Skip image fetch if content is truly placeholder
  useEffect(() => {
    if (isPlaceholderContent) {
      console.log('[NEWSLETTER] Skipping image fetch - placeholder content detected');
      return;
    }
    
    if (!processedNewsletter.blocks.length) {
      console.log('[NEWSLETTER] Skipping image fetch - no valid blocks');
      return;
    }
    
    setLoadingImages(true);
    setImageErrors({});
    console.log('[NEWSLETTER] Starting image fetch for', processedNewsletter.blocks.length, 'blocks');
    
    const fetchImages = async () => {
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
  }, [content, isPlaceholderContent, contentTaskId]);
};
