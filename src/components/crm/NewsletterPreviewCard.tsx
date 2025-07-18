import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, FileText, Eye } from 'lucide-react';
import { useState } from 'react';

interface NewsletterPreviewCardProps {
  originalContent: string;
  isFromNewsletter: boolean;
}

export const NewsletterPreviewCard: React.FC<NewsletterPreviewCardProps> = ({
  originalContent,
  isFromNewsletter
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isFromNewsletter || !originalContent) {
    return null;
  }

  // Extract title from content if possible
  const getNewsletterTitle = () => {
    const titleMatch = originalContent.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      return titleMatch[1];
    }
    
    // Fallback to newsletter_md extraction
    const newsletterMdMatch = originalContent.match(/newsletter_md:\s*\|\s*\n\s*#\s+(.+)/);
    if (newsletterMdMatch) {
      return newsletterMdMatch[1];
    }
    
    return 'Newsletter Content';
  };

  // Get reading time estimate
  const getReadingTime = () => {
    const wordCount = originalContent.replace(/<[^>]*>/g, '').split(/\s+/).length;
    const readingTime = Math.max(1, Math.ceil(wordCount / 200));
    return `${readingTime} min read`;
  };

  // Get content preview (first 200 chars)
  const getPreview = () => {
    // Try to get the main content after the title
    let preview = originalContent;
    
    // Remove YAML frontmatter-like content
    preview = preview.replace(/^[\s\S]*?newsletter_md:\s*\|\s*\n/, '');
    preview = preview.replace(/^[\s\S]*?blocks:\s*\n/, '');
    
    // Remove markdown headers
    preview = preview.replace(/^#+\s+.+$/gm, '');
    
    // Remove bold/italic markdown
    preview = preview.replace(/\*\*(.*?)\*\*/g, '$1');
    preview = preview.replace(/\*(.*?)\*/g, '$1');
    
    // Clean up and truncate
    preview = preview.trim().substring(0, 200);
    
    if (preview.length >= 200) {
      preview += '...';
    }
    
    return preview || 'Newsletter content preview not available';
  };

  const title = getNewsletterTitle();
  const readingTime = getReadingTime();
  const preview = getPreview();

  return (
    <Card className="border-l-4 border-l-green-500 bg-green-50/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-green-600" />
            Original Newsletter
          </CardTitle>
          <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 text-xs">
            Source Content
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <h4 className="font-medium text-sm mb-1">{title}</h4>
          <p className="text-xs text-muted-foreground">{readingTime}</p>
        </div>
        
        <div className="text-sm text-slate-600 leading-relaxed">
          {preview}
        </div>
        
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between text-xs h-8">
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {isExpanded ? 'Hide' : 'View'} Full Content
              </span>
              {isExpanded ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2">
            <div className="mt-3 p-3 bg-white/50 rounded-lg border border-green-200">
              <div className="text-xs text-slate-600 font-mono whitespace-pre-wrap max-h-60 overflow-y-auto">
                {originalContent}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
        
        <div className="text-xs text-green-700 bg-green-100 p-2 rounded-lg">
          💡 <strong>Tip:</strong> This content has been automatically converted to email format. 
          You can edit the email content above while keeping this as reference.
        </div>
      </CardContent>
    </Card>
  );
};