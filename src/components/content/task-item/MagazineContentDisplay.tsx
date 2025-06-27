import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Instagram, Facebook, FileText, Video, Hash, Clock, Image as ImageIcon, Mail } from 'lucide-react';
import { parseNewsletterYAML } from '@/utils/newsletterUtils';
import { useImageSuggestions } from '@/hooks/useImageSuggestions';
import { ImageCarousel } from '@/components/ui/image-carousel';

interface MagazineContentDisplayProps {
  content: string;
  postType: string;
  className?: string;
  contentTaskId?: string;
  campaignTitle?: string;
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

// Function to extract headline from HTML content
const extractHeadline = (htmlContent: string): string => {
  const h1Match = htmlContent.match(/<h1[^>]*>([^<]+)<\/h1>/);
  if (h1Match) return h1Match[1];
  
  const h2Match = htmlContent.match(/<h2[^>]*>([^<]+)<\/h2>/);
  if (h2Match) return h2Match[1];
  
  return '';
};

// Function to remove headline from content
const removeHeadlineFromContent = (htmlContent: string): string => {
  return htmlContent
    .replace(/<h1[^>]*>[^<]+<\/h1>/i, '')
    .replace(/<h2[^>]*>[^<]+<\/h2>/i, '')
    .trim();
};

export const MagazineContentDisplay = ({ content, postType, className, contentTaskId, campaignTitle }: MagazineContentDisplayProps) => {
  const [hasAttemptedFetch, setHasAttemptedFetch] = useState(false);
  
  // Use the smart image suggestions hook
  const { images, loading: loadingImage, fetchNewImages, query } = useImageSuggestions(contentTaskId, postType);

  // Debug logging
  useEffect(() => {
    console.log('[MAGAZINE_DISPLAY] Props received:', {
      contentTaskId,
      postType,
      campaignTitle,
      contentLength: content?.length,
      hasImages: images.length > 0
    });
  }, [contentTaskId, postType, campaignTitle, content, images.length]);

  // Auto-fetch images when component mounts with proper content analysis
  useEffect(() => {
    if (!hasAttemptedFetch && contentTaskId && content && content.trim().length > 20) {
      console.log('[MAGAZINE_DISPLAY] Auto-fetching images with smart analysis');
      console.log('[MAGAZINE_DISPLAY] Content preview:', content.substring(0, 150));
      console.log('[MAGAZINE_DISPLAY] Campaign title:', campaignTitle);
      
      // Trigger smart image fetch with content analysis
      fetchNewImages('', contentTaskId, postType, content, campaignTitle);
      setHasAttemptedFetch(true);
    } else if (!contentTaskId) {
      console.log('[MAGAZINE_DISPLAY] No contentTaskId provided - cannot fetch images');
    } else if (!content || content.trim().length <= 20) {
      console.log('[MAGAZINE_DISPLAY] Content too short for image analysis:', content?.length);
    }
  }, [contentTaskId, content, postType, campaignTitle, hasAttemptedFetch, fetchNewImages]);

  // Helper function to render featured image only (first image)
  const renderFeaturedImage = (containerClasses: string, fallbackText: string) => {
    if (loadingImage) {
      return (
        <div className={`${containerClasses} flex items-center justify-center`}>
          <div className="text-center text-gray-500">
            <div className="animate-spin h-6 w-6 border-2 border-gray-400 border-t-transparent rounded-full mx-auto mb-2"></div>
            <p className="text-sm">Finding relevant images...</p>
          </div>
        </div>
      );
    }

    if (images.length > 0) {
      const featuredImage = images[0];
      return (
        <div className={containerClasses}>
          <img
            src={featuredImage.thumb_url}
            alt={featuredImage.alt}
            className="w-full h-full object-cover rounded-lg"
          />
        </div>
      );
    }

    // No images available - show informative placeholder
    return (
      <div className={`${containerClasses} flex items-center justify-center`}>
        <div className="text-center text-gray-500 p-4">
          <ImageIcon className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p className="text-sm">{fallbackText}</p>
          {!contentTaskId && (
            <p className="text-xs text-gray-400 mt-1">No task ID provided</p>
          )}
          {contentTaskId && !hasAttemptedFetch && (
            <p className="text-xs text-gray-400 mt-1">Content too short for analysis</p>
          )}
        </div>
      </div>
    );
  };

  // Helper function to render thumbnail alternatives section
  const renderThumbnailSection = () => {
    console.log('[MAGAZINE_DISPLAY] renderThumbnailSection called with:', {
      loadingImage,
      imagesLength: images.length,
      imagesArray: images,
      hasValidThumbnails: images.slice(1).length > 0
    });

    if (loadingImage) {
      console.log('[MAGAZINE_DISPLAY] Still loading images, not showing thumbnails');
      return null;
    }

    if (images.length < 2) {
      console.log('[MAGAZINE_DISPLAY] Not enough images for thumbnails, need at least 2, have:', images.length);
      return null;
    }

    const thumbnails = images.slice(1); // Get alternatives (skip featured image)
    console.log('[MAGAZINE_DISPLAY] Thumbnails to render:', thumbnails);
    
    return (
      <div className="mt-8 pt-6 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Alternative Images</h4>
        <div className="grid grid-cols-3 gap-4">
          {thumbnails.map((image, index) => {
            console.log('[MAGAZINE_DISPLAY] Rendering thumbnail:', { index, image });
            return (
              <div key={image.id || index} className="relative group cursor-pointer">
                <div className="aspect-[4/3] overflow-hidden rounded-lg border border-gray-200 hover:border-gray-400 transition-colors h-24">
                  <img
                    src={image.thumb_url}
                    alt={image.alt}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      console.error('[MAGAZINE_DISPLAY] Thumbnail image failed to load:', image.thumb_url);
                      e.currentTarget.style.display = 'none';
                    }}
                    onLoad={() => {
                      console.log('[MAGAZINE_DISPLAY] Thumbnail image loaded successfully:', image.thumb_url);
                    }}
                  />
                </div>
                <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-10 transition-opacity rounded-lg pointer-events-none" />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Helper function to render ImageCarousel or fallback (for social media types)
  const renderImageSection = (containerClasses: string, fallbackText: string) => {
    if (loadingImage) {
      return (
        <div className={`${containerClasses} flex items-center justify-center`}>
          <div className="text-center text-gray-500">
            <div className="animate-spin h-6 w-6 border-2 border-gray-400 border-t-transparent rounded-full mx-auto mb-2"></div>
            <p className="text-sm">Finding relevant images...</p>
          </div>
        </div>
      );
    }

    if (images.length > 0) {
      return (
        <div className={containerClasses}>
          <ImageCarousel
            images={images}
            query={query}
            contentTaskId={contentTaskId}
          />
        </div>
      );
    }

    // No images available - show informative placeholder
    return (
      <div className={`${containerClasses} flex items-center justify-center`}>
        <div className="text-center text-gray-500 p-4">
          <ImageIcon className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p className="text-sm">{fallbackText}</p>
          {!contentTaskId && (
            <p className="text-xs text-gray-400 mt-1">No task ID provided</p>
          )}
          {contentTaskId && !hasAttemptedFetch && (
            <p className="text-xs text-gray-400 mt-1">Content too short for analysis</p>
          )}
        </div>
      </div>
    );
  };

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
            {renderFeaturedImage(
              "bg-gradient-to-br from-purple-100 to-indigo-100 rounded-lg mb-6 border border-purple-200 p-4 h-40",
              "Newsletter featured image"
            )}

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

            {/* Thumbnail Alternatives Section */}
            {renderThumbnailSection()}
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
        {renderFeaturedImage(
          "bg-gradient-to-br from-purple-100 to-indigo-100 rounded-lg mb-6 border border-purple-200 p-4 h-40",
          "Newsletter featured image"
        )}

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

        {/* Thumbnail Alternatives Section */}
        {renderThumbnailSection()}
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

        {/* Image with ImageCarousel */}
        {renderImageSection(
          "bg-gradient-to-br from-pink-100 to-purple-100 rounded-lg mb-4 border border-pink-200 p-4",
          "Visual content area"
        )}

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
          
          {/* Image with ImageCarousel */}
          {renderImageSection(
            "bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg border border-blue-200 p-4",
            "Featured image"
          )}

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
    const parsedHtml = parseMarkdownToHtml(content);
    const headline = extractHeadline(parsedHtml);
    const contentWithoutHeadline = removeHeadlineFromContent(parsedHtml);

    return (
      <div className={`bg-gradient-to-br ${getPostTypeColor()} rounded-lg p-6 border ${className || ''}`}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          {getPostTypeIcon()}
          <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
            Blog Article
          </Badge>
        </div>

        {/* Blog Headline */}
        {headline && (
          <h1 className="text-3xl font-bold text-gray-900 mb-6 leading-tight">
            {headline}
          </h1>
        )}

        {/* Article Content with Floating Featured Image */}
        <div className="relative">
          {/* Floating Featured Image - Top Right */}
          <div className="w-1/4 float-right ml-6 mb-4">
            {renderFeaturedImage(
              "bg-gradient-to-br from-green-100 to-emerald-100 rounded-lg border border-green-200 p-2 h-32",
              "Featured image"
            )}
          </div>

          {/* Article Content - Now with proper markdown parsing and text wrapping */}
          <div className="space-y-4">
            <div 
              className="prose prose-sm max-w-none text-gray-700 [&>*]:text-justify"
              dangerouslySetInnerHTML={{ __html: contentWithoutHeadline }}
            />
          </div>
          
          {/* Clear float */}
          <div className="clear-both"></div>
        </div>

        {/* Thumbnail Alternatives Section */}
        {renderThumbnailSection()}
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
