import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Instagram, Facebook, FileText, Video, Hash, Clock, Image as ImageIcon, Mail } from 'lucide-react';
import { parseNewsletterJson } from '@/utils/contentUtils';
import { useImageSuggestions } from '@/hooks/useImageSuggestions';

interface MagazineContentDisplayProps {
  content: string;
  postType: string;
  className?: string;
}

export const MagazineContentDisplay = ({ content, postType, className }: MagazineContentDisplayProps) => {
  const { images, loading, fetchNewImages } = useImageSuggestions();
  const [contentImage, setContentImage] = useState<string | null>(null);

  // Extract keywords from content for image search
  const extractImageQuery = (content: string) => {
    const cleanContent = content.replace(/<[^>]*>/g, '').toLowerCase();
    const words = cleanContent.split(/\s+/).filter(word => 
      word.length > 4 && 
      !['with', 'that', 'this', 'your', 'have', 'they', 'will', 'from', 'been'].includes(word)
    );
    return `${words.slice(0, 3).join(' ')} garden plants seasonal`.trim();
  };

  // Fetch image when component mounts for social media posts
  useEffect(() => {
    if ((postType === 'facebook' || postType === 'instagram') && !contentImage && !loading) {
      const query = extractImageQuery(content);
      fetchNewImages(query);
    }
  }, [postType, content]);

  // Set the first image when images are loaded
  useEffect(() => {
    if (images.length > 0 && !contentImage) {
      setContentImage(images[0].thumb_url);
    }
  }, [images]);

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

  // FIXED: Enhanced newsletter parsing with better fallback handling
  const parseNewsletterContent = (content: string) => {
    // Try to parse as structured newsletter first
    if (content.includes('newsletter_md:') || content.includes('---')) {
      // Parse YAML-style structured newsletter
      const lines = content.split('\n');
      let title = '';
      let sections = [];
      let currentSection = '';
      let inContent = false;
      
      for (const line of lines) {
        if (line.startsWith('title:')) {
          title = line.replace('title:', '').trim().replace(/['"]/g, '');
        } else if (line.startsWith('newsletter_md:') || line === '---') {
          inContent = true;
        } else if (inContent && line.trim()) {
          if (line.startsWith('#')) {
            if (currentSection) {
              sections.push(currentSection);
            }
            currentSection = line;
          } else {
            currentSection += '\n' + line;
          }
        }
      }
      
      if (currentSection) {
        sections.push(currentSection);
      }
      
      if (title || sections.length > 0) {
        return { title, sections, isStructured: true };
      }
    }
    
    // Try JSON parsing
    const parsedNewsletter = parseNewsletterJson(content);
    if (parsedNewsletter) {
      return {
        title: parsedNewsletter.subject,
        sections: [parsedNewsletter.content],
        isStructured: true
      };
    }
    
    // Fallback to plain text with basic formatting
    const lines = content.split('\n').filter(line => line.trim());
    const title = lines[0] || 'Newsletter';
    const sections = lines.slice(1);
    
    return { title, sections, isStructured: false };
  };

  const { text, hashtags } = formatContent(content);

  if (postType === 'newsletter') {
    const { title, sections, isStructured } = parseNewsletterContent(content);
    
    return (
      <div className={`bg-gradient-to-br ${getPostTypeColor()} rounded-lg p-6 border ${className || ''}`}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          {getPostTypeIcon()}
          <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200">
            Newsletter
          </Badge>
          {isStructured && (
            <Badge variant="outline" className="text-xs">
              Structured
            </Badge>
          )}
        </div>

        {/* Featured Image */}
        <div className="aspect-video bg-gradient-to-br from-purple-100 to-indigo-100 rounded-lg mb-6 flex items-center justify-center border border-purple-200">
          <div className="text-center text-purple-600">
            <ImageIcon className="w-8 h-8 mx-auto mb-2" />
            <p className="text-sm">Newsletter header image</p>
          </div>
        </div>

        {/* Newsletter Content */}
        <div className="space-y-4">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 leading-tight mb-2">
              {title}
            </h2>
            <div className="w-16 h-1 bg-purple-500 mx-auto rounded-full"></div>
          </div>
          
          <div className="prose prose-sm max-w-none">
            {sections.map((section, index) => (
              <div key={index} className="mb-4">
                {section.startsWith('#') ? (
                  <div dangerouslySetInnerHTML={{ 
                    __html: section.replace(/^#+\s*/, '<h3 class="font-bold text-lg mb-2">') + '</h3>'
                  }} />
                ) : (
                  <div className="text-gray-700 leading-relaxed">
                    {section.split('\n').map((paragraph, pIndex) => (
                      paragraph.trim() && (
                        <p key={pIndex} className="mb-3">
                          {paragraph}
                        </p>
                      )
                    ))}
                  </div>
                )}
              </div>
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

        {/* 60/40 Layout: Text (60%) and Image (40%) */}
        <div className="flex gap-4 mb-4">
          {/* Text Content - 60% */}
          <div className="flex-[3] space-y-3">
            <p className="text-gray-800 leading-relaxed text-sm">
              {text}
            </p>
          </div>
          
          {/* Image - 40% */}
          <div className="flex-[2]">
            {loading ? (
              <div className="aspect-square bg-gradient-to-br from-pink-100 to-purple-100 rounded-lg flex items-center justify-center border border-pink-200">
                <ImageIcon className="w-8 h-8 text-pink-500 animate-pulse" />
              </div>
            ) : contentImage ? (
              <div className="aspect-square rounded-lg overflow-hidden border border-pink-200">
                <img
                  src={contentImage}
                  alt="Instagram post visual"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=400&fit=crop&auto=format';
                  }}
                />
              </div>
            ) : (
              <div className="aspect-square bg-gradient-to-br from-pink-100 to-purple-100 rounded-lg flex items-center justify-center border border-pink-200 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-pink-50/50 to-purple-50/50"></div>
                <div className="text-center text-pink-600 z-10">
                  <ImageIcon className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-xs font-medium">Instagram Visual</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Hashtags */}
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

        {/* 60/40 Layout: Text (60%) and Image (40%) */}
        <div className="flex gap-4 mb-4">
          {/* Text Content - 60% */}
          <div className="flex-[3] space-y-3">
            <p className="text-gray-800 leading-relaxed">
              {text}
            </p>
          </div>
          
          {/* Image - 40% */}
          <div className="flex-[2]">
            {loading ? (
              <div className="aspect-video bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg flex items-center justify-center border border-blue-200">
                <ImageIcon className="w-8 h-8 text-blue-500 animate-pulse" />
              </div>
            ) : contentImage ? (
              <div className="aspect-video rounded-lg overflow-hidden border border-blue-200">
                <img
                  src={contentImage}
                  alt="Facebook post visual"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=600&h=400&fit=crop&auto=format';
                  }}
                />
              </div>
            ) : (
              <div className="aspect-video bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg flex items-center justify-center border border-blue-200 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-indigo-50/50"></div>
                <div className="text-center text-blue-600 z-10">
                  <ImageIcon className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-xs font-medium">Facebook Featured Image</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Hashtags */}
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
    );
  }

  if (postType === 'blog') {
    const paragraphs = text.split('\n\n').filter(p => p.trim());
    const title = paragraphs[0] || 'Blog Post';
    const bodyParagraphs = paragraphs.slice(1);

    return (
      <div className={`bg-gradient-to-br ${getPostTypeColor()} rounded-lg p-6 border ${className || ''}`}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          {getPostTypeIcon()}
          <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
            Blog Article
          </Badge>
        </div>

        {/* FIXED: Enhanced Featured Image for blog posts */}
        <div className="aspect-video bg-gradient-to-br from-green-100 to-emerald-100 rounded-lg mb-6 flex items-center justify-center border border-green-200 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-green-50/50 to-emerald-50/50"></div>
          <div className="text-center text-green-600 z-10">
            <ImageIcon className="w-8 h-8 mx-auto mb-2" />
            <p className="text-sm font-medium">Blog Featured Image</p>
            <p className="text-xs opacity-75">Header image for article</p>
          </div>
        </div>

        {/* Article Content */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900 leading-tight">
            {title}
          </h2>
          
          {bodyParagraphs.map((paragraph, index) => (
            <p key={index} className="text-gray-700 leading-relaxed">
              {paragraph}
            </p>
          ))}
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
            Video Script
          </Badge>
        </div>

        {/* Video Thumbnail */}
        <div className="aspect-video bg-gradient-to-br from-red-100 to-orange-100 rounded-lg mb-6 flex items-center justify-center border border-red-200">
          <div className="text-center text-red-600">
            <Video className="w-12 h-12 mx-auto mb-2" />
            <p className="text-sm">Video preview</p>
          </div>
        </div>

        {/* Script Content */}
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
