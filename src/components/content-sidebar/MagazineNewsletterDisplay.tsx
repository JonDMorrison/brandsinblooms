
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
  
  // Enhanced parsing for magazine-style display
  const parseMagazineNewsletter = (content: string) => {
    const cleanContent = content.replace(/<[^>]*>/g, '\n').replace(/\n\s*\n/g, '\n').trim();
    const lines = cleanContent.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) return { title: 'Newsletter', sections: [] };
    
    // Extract title - look for main heading
    let title = 'Newsletter Update';
    const titleMatch = content.match(/^#\s+(.+)$/m) || content.match(/^\*\*(.+)\*\*$/m);
    if (titleMatch) {
      title = titleMatch[1].trim();
    } else if (lines[0] && !lines[0].includes('*') && !lines[0].includes('#')) {
      title = lines[0].trim();
    }
    
    // Parse into structured sections
    const sections: PlainNewsletterSection[] = [];
    let currentHeading = '';
    let currentBody = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check if this is a heading (starts with ##, ***, or is in title case)
      if (line.match(/^##\s+/) || line.match(/^\*\*.*\*\*$/) || 
          (line.length < 60 && line.match(/^[A-Z][a-zA-Z\s]+$/) && !line.includes('.'))) {
        
        // Save previous section if it exists
        if (currentHeading && currentBody) {
          sections.push({
            title: currentHeading,
            body: currentBody.trim(),
            imagePrompt: `${title.toLowerCase()} ${currentHeading.toLowerCase()} garden plants`
          });
        }
        
        // Start new section
        currentHeading = line.replace(/^##\s*/, '').replace(/^\*\*(.*)\*\*$/, '$1').trim();
        currentBody = '';
      } else if (line && currentHeading) {
        // Add to current section body
        currentBody += (currentBody ? ' ' : '') + line;
      }
    }
    
    // Add final section
    if (currentHeading && currentBody) {
      sections.push({
        title: currentHeading,
        body: currentBody.trim(),
        imagePrompt: `${title.toLowerCase()} ${currentHeading.toLowerCase()} garden plants`
      });
    }
    
    // If no good sections found, create default ones
    if (sections.length === 0) {
      const paragraphs = lines.filter(line => line.length > 20);
      const chunks = [];
      for (let i = 0; i < paragraphs.length; i += 3) {
        chunks.push(paragraphs.slice(i, i + 3).join(' '));
      }
      
      chunks.forEach((chunk, index) => {
        sections.push({
          title: `Garden Insight ${index + 1}`,
          body: chunk.substring(0, 300),
          imagePrompt: `${title.toLowerCase()} garden insight ${index + 1}`
        });
      });
    }
    
    return { title, sections };
  };
  
  // Determine content type and parse accordingly
  const isStructured = !!newsletter;
  const magazineNewsletter = !isStructured ? parseMagazineNewsletter(content) : null;
  
  const sectionsForImages = isStructured 
    ? newsletter.blocks 
    : (magazineNewsletter?.sections || []);

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

  // Render structured newsletter
  if (isStructured) {
    const headlineMatch = newsletter.newsletter_md.match(/^# (.+)$/m);
    const headline = headlineMatch?.[1] || 'Newsletter Update';
    
    const introMatch = newsletter.newsletter_md.match(/\*(.+?)\*/);
    const intro = introMatch?.[1] || '';

    return (
      <div className={`max-w-4xl mx-auto bg-white ${className || ''}`}>
        {/* Header */}
        <div className="mb-8 pb-6 border-b border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <Badge variant="outline" className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {newsletter.meta.reading_time || '≈3 min'}
            </Badge>
            <Badge variant="secondary">Newsletter</Badge>
          </div>
          
          <h1 className="text-3xl font-bold text-slate-900 leading-tight mb-4">
            {headline}
          </h1>
          
          {intro && (
            <p className="text-lg text-slate-600 leading-relaxed font-light italic">
              {intro}
            </p>
          )}
        </div>

        {/* Content Sections - Magazine Layout */}
        <div className="space-y-12">
          {newsletter.blocks.map((block, index) => (
            <div key={index} className="grid lg:grid-cols-[3fr_2fr] gap-8 items-start">
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-slate-900 leading-tight">
                  {block.title}
                </h2>
                <p className="text-slate-700 leading-relaxed">
                  {block.body}
                </p>
              </div>

              <div className="lg:pl-4">
                {loadingImages ? (
                  <div className="aspect-[4/3] bg-gradient-to-br from-green-100 to-emerald-100 rounded-lg flex items-center justify-center border border-green-200">
                    <ImageIcon className="w-8 h-8 text-green-500" />
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
                  <div className="aspect-[4/3] bg-gradient-to-br from-green-100 to-emerald-100 rounded-lg flex items-center justify-center border border-green-200">
                    <div className="text-center text-green-600">
                      <ImageIcon className="w-8 h-8 mx-auto mb-2" />
                      <p className="text-sm font-medium">Garden Image</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 pt-8 border-t border-gray-200 text-center">
          <p className="text-gray-600">Thanks for reading! 🌿</p>
        </div>
      </div>
    );
  }

  // Render magazine-style newsletter for plain content
  if (magazineNewsletter && magazineNewsletter.sections.length > 0) {
    return (
      <div className={`max-w-4xl mx-auto bg-white ${className || ''}`}>
        {/* Header */}
        <div className="mb-8 pb-6 border-b border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <Badge variant="outline" className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              ≈3 min
            </Badge>
            <Badge variant="secondary">Newsletter</Badge>
          </div>
          
          <h1 className="text-3xl font-bold text-slate-900 leading-tight mb-4">
            {magazineNewsletter.title}
          </h1>
        </div>

        {/* Magazine Sections */}
        <div className="space-y-12">
          {magazineNewsletter.sections.map((section, index) => (
            <div key={index} className="grid lg:grid-cols-[3fr_2fr] gap-8 items-start">
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-slate-900 leading-tight">
                  {section.title}
                </h2>
                <p className="text-slate-700 leading-relaxed">
                  {section.body}
                </p>
              </div>

              <div className="lg:pl-4">
                {loadingImages ? (
                  <div className="aspect-[4/3] bg-gradient-to-br from-green-100 to-emerald-100 rounded-lg flex items-center justify-center border border-green-200">
                    <ImageIcon className="w-8 h-8 text-green-500" />
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
                  <div className="aspect-[4/3] bg-gradient-to-br from-green-100 to-emerald-100 rounded-lg flex items-center justify-center border border-green-200">
                    <div className="text-center text-green-600">
                      <ImageIcon className="w-8 h-8 mx-auto mb-2" />
                      <p className="text-sm font-medium">Garden Image</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 pt-8 border-t border-gray-200 text-center">
          <p className="text-gray-600">Thanks for reading! 🌿</p>
        </div>
      </div>
    );
  }

  // Fallback for any other content
  return (
    <div className={`prose prose-lg max-w-none ${className || ''}`}>
      <div dangerouslySetInnerHTML={{ __html: content }} />
    </div>
  );
};
