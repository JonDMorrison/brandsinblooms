import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Instagram, Facebook, FileText, Video, Hash, Clock, Image as ImageIcon, Mail } from 'lucide-react';
import { parseNewsletterYAML } from '@/utils/newsletterUtils';
import { supabase } from "@/integrations/supabase/client";

interface MagazineContentDisplayProps {
  content: string;
  postType: string;
  className?: string;
}

interface ImageData {
  url: string;
  alt: string;
  photographer?: string;
}

// Utility function to convert markdown to HTML
const parseMarkdownToHtml = (content: string): string => {
  if (!content) return '';
  
  return content
    // Convert headers
    .replace(/^### (.+)$/gm, '<h3 class="text-xl font-semibold text-gray-900 mt-6 mb-3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-2xl font-bold text-gray-900 mt-8 mb-4">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-3xl font-bold text-gray-900 mt-6 mb-4">$1</h1>')
    // Convert bold and italic
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="italic text-gray-700">$1</em>')
    // Convert unordered lists
    .replace(/^- (.+)$/gm, '<li class="text-gray-700 mb-1">$1</li>')
    // Convert numbered lists
    .replace(/^\d+\. (.+)$/gm, '<li class="text-gray-700 mb-1">$1</li>')
    // Convert paragraphs (split by double newlines)
    .split('\n\n')
    .map(paragraph => {
      paragraph = paragraph.trim();
      if (!paragraph) return '';
      
      // Skip if already wrapped in HTML tags
      if (paragraph.match(/^<(h[1-6]|li|ul|ol)/)) {
        return paragraph;
      }
      
      // Check if this paragraph contains list items
      if (paragraph.includes('<li class="text-gray-700 mb-1">')) {
        return `<ul class="list-disc list-inside space-y-1 my-4 ml-4">${paragraph}</ul>`;
      }
      
      // Wrap plain text in paragraph tags
      return `<p class="text-gray-700 leading-relaxed mb-4">${paragraph}</p>`;
    })
    .join('\n')
    // Clean up empty paragraphs
    .replace(/<p[^>]*><\/p>/g, '')
    .replace(/<p[^>]*>(<[h1-6])/g, '$1')
    .replace(/(<\/[h1-6]>)<\/p>/g, '$1');
};

// Function to generate image prompt based on content
const generateImagePrompt = (content: string, postType: string): string => {
  // Extract title or first meaningful line
  const lines = content.split('\n').filter(line => line.trim());
  let basePrompt = '';
  
  // Try to find a title (line starting with #)
  const titleLine = lines.find(line => line.startsWith('#'));
  if (titleLine) {
    basePrompt = titleLine.replace(/^#+\s*/, '').trim();
  } else if (lines.length > 0) {
    // Use first substantial line
    basePrompt = lines[0].substring(0, 100).trim();
  }
  
  // Clean up the prompt and add context
  basePrompt = basePrompt.replace(/[^\w\s]/g, ' ').trim();
  
  if (postType === 'blog') {
    return `${basePrompt} gardening blog article professional`;
  } else if (postType === 'video') {
    return `${basePrompt} gardening video tutorial educational`;
  }
  
  return `${basePrompt} gardening professional`;
};

export const MagazineContentDisplay = ({ content, postType, className }: MagazineContentDisplayProps) => {
  const [image, setImage] = useState<ImageData | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);

  // Fetch image for blog content only (removed video from image fetching)
  useEffect(() => {
    const fetchImage = async () => {
      if (postType !== 'blog') return; // Only fetch images for blog content
      
      setLoadingImage(true);
      console.log(`[MAGAZINE_DISPLAY] Fetching image for ${postType} content`);
      
      try {
        const imagePrompt = generateImagePrompt(content, postType);
        console.log(`[MAGAZINE_DISPLAY] Generated prompt: ${imagePrompt}`);
        
        const { data, error } = await supabase.functions.invoke('fetch-unsplash-images', {
          body: { 
            query: imagePrompt,
            contentType: postType
          }
        });
        
        if (error) {
          console.log(`[MAGAZINE_DISPLAY] Unsplash API error for ${postType}:`, error.message);
          setImage(null);
          return;
        }
        
        if (data?.images?.[0]) {
          console.log(`[MAGAZINE_DISPLAY] Successfully fetched image for ${postType}`);
          setImage({
            url: data.images[0].thumb_url,
            alt: data.images[0].alt || `${postType} content image`,
            photographer: data.images[0].photographer
          });
        }
      } catch (error) {
        console.error(`[MAGAZINE_DISPLAY] Error fetching image for ${postType}:`, error);
        setImage(null);
      } finally {
        setLoadingImage(false);
      }
    };

    fetchImage();
  }, [content, postType]);

  const getPostTypeIcon = () => {
    switch (postType) {
      case 'instagram': return <Instagram className="w-5 h-5 text-pink-500" />;
      case 'facebook': return <Facebook className="w-5 h-5 text-blue-600" />;
      case 'blog': return <FileText className="w-5 h-5 text-green-600" />;
      case 'video': return <Video className="w-5 h-5 text-red-500" />;
      case 'newsletter': return <Mail className="w-5 h-5 text-purple-500" />;
      default: return <FileText className="w-5 h-5 text-gray-500" />;
    }
  };

  const getPostTypeColor = () => {
    switch (postType) {
      case 'instagram': return 'from-pink-50 to-purple-50 border-pink-200';
      case 'facebook': return 'from-blue-50 to-indigo-50 border-blue-200';
      case 'blog': return 'from-green-50 to-emerald-50 border-green-200';
      case 'video': return 'from-red-50 to-orange-50 border-red-200';
      case 'newsletter': return 'from-purple-50 to-indigo-50 border-purple-200';
      default: return 'from-gray-50 to-slate-50 border-gray-200';
    }
  };

  const formatContent = (content: string) => {
    // Clean HTML tags if any
    const cleanContent = content.replace(/<[^>]*>/g, '');
    
    // Extract hashtags
    const hashtagRegex = /#[\w]+/g;
    const hashtags = cleanContent.match(hashtagRegex) || [];
    const textWithoutHashtags = cleanContent.replace(hashtagRegex, '').trim();
    
    return { text: textWithoutHashtags, hashtags };
  };

  const { text, hashtags } = formatContent(content);

  if (postType === 'newsletter') {
    // Check if this is a structured YAML newsletter
    const isStructuredNewsletter = content.includes('newsletter_md:') || content.includes('blocks:');
    
    if (isStructuredNewsletter) {
      // Try to parse as YAML newsletter
      const parsedNewsletter = parseNewsletterYAML(content);
      
      if (parsedNewsletter) {
        // Structured newsletter - show simplified preview since full display is in sidebar
        return (
          <div className={`bg-gradient-to-br ${getPostTypeColor()} rounded-lg p-6 border ${className || ''}`}>
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              {getPostTypeIcon()}
              <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200">
                Structured Newsletter
              </Badge>
            </div>

            {/* Featured Image */}
            <div className="aspect-video bg-gradient-to-br from-purple-100 to-indigo-100 rounded-lg mb-6 flex items-center justify-center border border-purple-200">
              <div className="text-center text-purple-600">
                <ImageIcon className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">Magazine-style newsletter</p>
              </div>
            </div>

            {/* Content Preview */}
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 leading-tight mb-2">
                  {parsedNewsletter.meta.theme || 'Newsletter'}
                </h2>
                <div className="w-16 h-1 bg-purple-500 mx-auto rounded-full"></div>
              </div>
              
              <div className="prose prose-sm max-w-none">
                <p className="text-gray-600 italic mb-4">
                  {parsedNewsletter.blocks.length}-section magazine-style newsletter with engaging headlines and content blocks. Click to view full layout.
                </p>
                
                {parsedNewsletter.blocks.slice(0, 2).map((block, index) => (
                  <div key={index} className="mb-3">
                    <h4 className="font-semibold text-gray-800 text-sm mb-1">
                      {block.title}
                    </h4>
                    <p className="text-gray-600 text-xs">
                      {block.body.length > 100 ? `${block.body.substring(0, 100)}...` : block.body}
                    </p>
                  </div>
                ))}
                
                {parsedNewsletter.blocks.length > 2 && (
                  <p className="text-gray-500 text-xs italic">
                    +{parsedNewsletter.blocks.length - 2} more sections...
                  </p>
                )}
              </div>
            </div>

            {/* Newsletter Footer */}
            <div className="mt-6 pt-4 border-t border-purple-200">
              <p className="text-center text-sm text-purple-600 italic">
                ≈{parsedNewsletter.meta.reading_time} • {parsedNewsletter.blocks.length} sections
              </p>
            </div>
          </div>
        );
      }
    }

    // Fallback for plain text newsletter
    return (
      <div className={`bg-gradient-to-br ${getPostTypeColor()} rounded-lg p-6 border ${className || ''}`}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          {getPostTypeIcon()}
          <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200">
            Newsletter
          </Badge>
        </div>

        {/* Featured Image */}
        <div className="aspect-video bg-gradient-to-br from-purple-100 to-indigo-100 rounded-lg mb-6 flex items-center justify-center border border-purple-200">
          <div className="text-center text-purple-600">
            <ImageIcon className="w-8 h-8 mx-auto mb-2" />
            <p className="text-sm">Newsletter content</p>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-4">
          <div className="prose prose-sm max-w-none">
            {text.split('\n\n').map((paragraph, index) => (
              <p key={index} className="text-gray-700 leading-relaxed mb-4">
                {paragraph}
              </p>
            ))}
          </div>
        </div>

        {/* Newsletter Footer */}
        <div className="mt-6 pt-4 border-t border-purple-200">
          <p className="text-center text-sm text-purple-600 italic">
            Thanks for reading! 📧
          </p>
        </div>
      </div>
    );
  }

  
  if (postType === 'instagram') {
    return (
      <div className={`bg-gradient-to-br ${getPostTypeColor()} rounded-lg p-6 border ${className || ''}`}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          {getPostTypeIcon()}
          <div>
            <Badge variant="secondary" className="bg-pink-100 text-pink-700 border-pink-200">
              Instagram Post
            </Badge>
          </div>
        </div>

        {/* Image Placeholder */}
        <div className="aspect-square bg-gradient-to-br from-pink-100 to-purple-100 rounded-lg mb-4 flex items-center justify-center border border-pink-200">
          <div className="text-center text-pink-600">
            <ImageIcon className="w-12 h-12 mx-auto mb-2" />
            <p className="text-sm">Visual content area</p>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-3">
          <p className="text-gray-800 leading-relaxed text-sm">
            {text}
          </p>
          
          {hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {hashtags.map((tag, index) => (
                <span key={index} className="inline-flex items-center gap-1 text-xs text-pink-600 bg-pink-100 px-2 py-1 rounded-full">
                  <Hash className="w-3 h-3" />
                  {tag.replace('#', '')}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (postType === 'facebook') {
    return (
      <div className={`bg-gradient-to-br ${getPostTypeColor()} rounded-lg p-6 border ${className || ''}`}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          {getPostTypeIcon()}
          <div>
            <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">
              Facebook Post
            </Badge>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-4">
          <p className="text-gray-800 leading-relaxed">
            {text}
          </p>
          
          {/* Image Placeholder */}
          <div className="aspect-video bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg flex items-center justify-center border border-blue-200">
            <div className="text-center text-blue-600">
              <ImageIcon className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm">Featured image</p>
            </div>
          </div>

          {hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {hashtags.map((tag, index) => (
                <span key={index} className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                  <Hash className="w-3 h-3" />
                  {tag.replace('#', '')}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (postType === 'blog') {
    return (
      <div className={`bg-gradient-to-br ${getPostTypeColor()} rounded-lg p-6 border ${className || ''}`}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          {getPostTypeIcon()}
          <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
            Blog Article
          </Badge>
        </div>

        {/* Featured Image */}
        <div className="aspect-video bg-gradient-to-br from-green-100 to-emerald-100 rounded-lg mb-6 flex items-center justify-center border border-green-200">
          {loadingImage ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin h-6 w-6 border-2 border-green-600 border-t-transparent rounded-full"></div>
            </div>
          ) : image ? (
            <img
              src={image.url}
              alt={image.alt}
              className="w-full h-full object-cover rounded-lg"
              onError={(e) => {
                console.error('[BLOG] Image failed to load:', image.url);
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : (
            <div className="text-center text-green-600">
              <ImageIcon className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm">Featured image</p>
            </div>
          )}
          {image && (
            <div className="hidden text-center text-green-600">
              <ImageIcon className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm">Image unavailable</p>
            </div>
          )}
        </div>

        {/* Article Content - Now with proper markdown parsing */}
        <div className="space-y-4">
          <div 
            className="prose prose-sm max-w-none text-gray-700"
            dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(content) }}
          />
        </div>
      </div>
    );
  }

  if (postType === 'video') {
    const lines = text.split('\n').filter(line => line.trim());
    
    return (
      <div className={`bg-gradient-to-br ${getPostTypeColor()} rounded-lg p-6 border ${className || ''}`}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          {getPostTypeIcon()}
          <Badge variant="secondary" className="bg-red-100 text-red-700 border-red-200">
            Video Script (90s Max)
          </Badge>
        </div>

        {/* Script Content - No placeholder, directly show content */}
        <div className="space-y-3">
          {lines.map((line, index) => (
            <div key={index} className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                <Clock className="w-4 h-4 text-red-600" />
              </div>
              <p className="text-gray-700 leading-relaxed flex-1">
                {line}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Default fallback for other content types
  return (
    <div className={`bg-gradient-to-br ${getPostTypeColor()} rounded-lg p-6 border ${className || ''}`}>
      <div className="flex items-center gap-3 mb-4">
        {getPostTypeIcon()}
        <Badge variant="secondary" className="capitalize">
          {postType} Content
        </Badge>
      </div>
      
      <p className="text-gray-800 leading-relaxed">
        {text}
      </p>
      
      {hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {hashtags.map((tag, index) => (
            <span key={index} className="inline-flex items-center gap-1 text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
              <Hash className="w-3 h-3" />
              {tag.replace('#', '')}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
