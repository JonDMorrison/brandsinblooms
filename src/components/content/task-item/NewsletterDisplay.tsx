
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Image as ImageIcon, Clock, Info } from 'lucide-react';
import { parseNewsletterYAML, formatNewsletterForDisplay, getNewsletterMetadata } from '@/utils/newsletterUtils';
import { getPostTypeIcon, getPostTypeColor } from './display-utils';

interface NewsletterDisplayProps {
  content: string;
  className?: string;
}

export const NewsletterDisplay = ({ content, className }: NewsletterDisplayProps) => {
  const IconComponent = getPostTypeIcon('newsletter');
  
  // Try to parse as structured newsletter first
  const newsletter = parseNewsletterYAML(content);
  
  if (newsletter) {
    // Handle structured newsletter
    const metadata = getNewsletterMetadata(newsletter);
    const formattedContent = formatNewsletterForDisplay(newsletter);
    
    return (
      <div className={`bg-gradient-to-br ${getPostTypeColor('newsletter')} rounded-lg p-6 border ${className || ''}`}>
        <div className="flex items-center gap-3 mb-6">
          <IconComponent className="w-5 h-5 text-purple-500" />
          <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200">
            Newsletter
          </Badge>
          <Badge variant="outline" className="text-xs">
            Structured
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1 text-xs">
            <Clock className="w-3 h-3" />
            {metadata.readingTime}
          </Badge>
        </div>

        <div className="aspect-video bg-gradient-to-br from-purple-100 to-indigo-100 rounded-lg mb-6 flex items-center justify-center border border-purple-200">
          <div className="text-center text-purple-600">
            <ImageIcon className="w-8 h-8 mx-auto mb-2" />
            <p className="text-sm font-medium">Newsletter Header</p>
            <p className="text-xs opacity-75">{metadata.theme}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 leading-tight mb-2">
              {metadata.title}
            </h2>
            <div className="w-16 h-1 bg-purple-500 mx-auto rounded-full"></div>
          </div>
          
          {/* Content preview - first block */}
          {newsletter.blocks.length > 0 && (
            <div className="bg-white/50 rounded-lg p-4 border border-purple-200">
              <h3 className="font-bold text-lg mb-2 text-gray-900">
                {newsletter.blocks[0].title}
              </h3>
              <p className="text-gray-700 leading-relaxed text-sm">
                {newsletter.blocks[0].body.substring(0, 150)}
                {newsletter.blocks[0].body.length > 150 ? '...' : ''}
              </p>
            </div>
          )}
          
          {/* Additional blocks indicator */}
          {newsletter.blocks.length > 1 && (
            <div className="text-center">
              <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                <Info className="w-3 h-3 mr-1" />
                +{newsletter.blocks.length - 1} more sections
              </Badge>
            </div>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-purple-200">
          <p className="text-center text-sm text-purple-600 italic">
            Thanks for reading! 📧
          </p>
        </div>
      </div>
    );
  }
  
  // Fallback to basic newsletter parsing for non-structured content
  const parseBasicNewsletter = (content: string) => {
    if (content.includes('newsletter_md:') || content.includes('---')) {
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
    
    const lines = content.split('\n').filter(line => line.trim());
    const title = lines[0] || 'Newsletter';
    const sections = lines.slice(1);
    
    return { title, sections, isStructured: false };
  };

  const { title, sections, isStructured } = parseBasicNewsletter(content);

  return (
    <div className={`bg-gradient-to-br ${getPostTypeColor('newsletter')} rounded-lg p-6 border ${className || ''}`}>
      <div className="flex items-center gap-3 mb-6">
        <IconComponent className="w-5 h-5 text-purple-500" />
        <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200">
          Newsletter
        </Badge>
        {isStructured && (
          <Badge variant="outline" className="text-xs">
            Basic Format
          </Badge>
        )}
      </div>

      <div className="aspect-video bg-gradient-to-br from-purple-100 to-indigo-100 rounded-lg mb-6 flex items-center justify-center border border-purple-200">
        <div className="text-center text-purple-600">
          <ImageIcon className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm">Newsletter header image</p>
        </div>
      </div>

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

      <div className="mt-6 pt-4 border-t border-purple-200">
        <p className="text-center text-sm text-purple-600 italic">
          Thanks for reading! 📧
        </p>
      </div>
    </div>
  );
};
