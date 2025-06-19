
import React from 'react';
import { parseNewsletterYAML, formatNewsletterForDisplay, getNewsletterMetadata, StructuredNewsletter } from '@/utils/newsletterUtils';
import { Badge } from '@/components/ui/badge';
import { Clock, Lightbulb } from 'lucide-react';

interface StructuredNewsletterDisplayProps {
  content: string;
  className?: string;
}

export const StructuredNewsletterDisplay = ({ content, className }: StructuredNewsletterDisplayProps) => {
  const newsletter = parseNewsletterYAML(content);
  
  if (!newsletter) {
    // Fallback to regular display if not structured
    return (
      <div className={`prose prose-lg max-w-none ${className || ''}`}>
        <div dangerouslySetInnerHTML={{ __html: content }} />
      </div>
    );
  }

  const metadata = getNewsletterMetadata(newsletter);
  const formattedContent = formatNewsletterForDisplay(newsletter);

  return (
    <div className={className}>
      {/* Newsletter Metadata */}
      <div className="flex items-center gap-3 mb-6 p-4 bg-slate-50 rounded-lg">
        <Badge variant="outline" className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {metadata.readingTime}
        </Badge>
        <Badge variant="outline">
          {metadata.blockCount} blocks
        </Badge>
        {metadata.theme && (
          <Badge variant="secondary">
            {metadata.theme}
          </Badge>
        )}
      </div>

      {/* Newsletter Content */}
      <div 
        className="prose prose-lg max-w-none mb-8"
        dangerouslySetInnerHTML={{ __html: formattedContent }}
      />

      {/* Content Ideas Section */}
      {newsletter.extra_content_ideas.length > 0 && (
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-yellow-500" />
            Extra Content Ideas
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {newsletter.extra_content_ideas.map((idea, index) => (
              <div key={index} className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-900 mb-1">{idea.title}</h4>
                <p className="text-sm text-blue-700">{idea.quick_desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Newsletter Blocks Details */}
      {newsletter.blocks.length > 0 && (
        <div className="border-t pt-6 mt-6">
          <h3 className="text-lg font-semibold mb-4">Content Blocks</h3>
          <div className="space-y-4">
            {newsletter.blocks.map((block, index) => (
              <div key={index} className="p-4 border rounded-lg bg-gray-50">
                <h4 className="font-medium mb-2">{block.title}</h4>
                <p className="text-sm text-gray-700 mb-2">{block.body}</p>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>CTA: {block.cta}</span>
                  <span>Image: {block.image_prompt}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
