
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Instagram, Facebook, FileText, Video, Hash, Clock, Image as ImageIcon, Mail } from 'lucide-react';
import { parseNewsletterJson } from '@/utils/contentUtils';

interface MagazineContentDisplayProps {
  content: string;
  postType: string;
  className?: string;
}

export const MagazineContentDisplay = ({ content, postType, className }: MagazineContentDisplayProps) => {
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
    // Try to parse as JSON newsletter first
    const parsedNewsletter = parseNewsletterJson(content);
    
    if (parsedNewsletter) {
      // Structured newsletter with subject and content
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
              <p className="text-sm">Newsletter header image</p>
            </div>
          </div>

          {/* Newsletter Content */}
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 leading-tight mb-2">
                {parsedNewsletter.subject}
              </h2>
              <div className="w-16 h-1 bg-purple-500 mx-auto rounded-full"></div>
            </div>
            
            <div className="prose prose-sm max-w-none">
              {parsedNewsletter.content.split('\n\n').map((paragraph, index) => (
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
    } else {
      // Plain text newsletter
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
              <p className="text-sm">Newsletter header image</p>
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

        {/* Featured Image */}
        <div className="aspect-video bg-gradient-to-br from-green-100 to-emerald-100 rounded-lg mb-6 flex items-center justify-center border border-green-200">
          <div className="text-center text-green-600">
            <ImageIcon className="w-8 h-8 mx-auto mb-2" />
            <p className="text-sm">Featured image</p>
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
