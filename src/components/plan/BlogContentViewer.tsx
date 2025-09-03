import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Clock, Tag, Copy, ExternalLink } from 'lucide-react';
import { showToast } from '@/utils/toastUtils';

interface BlogContentViewerProps {
  blogItem: {
    title: string;
    caption: string;
    enhancedContent?: {
      title: string;
      description: string;
      fullContent: string;
      tags: string[];
      readingTime: string;
    };
  };
}

export const BlogContentViewer: React.FC<BlogContentViewerProps> = ({ blogItem }) => {
  const enhanced = blogItem.enhancedContent;

  if (!enhanced) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Blog Content Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-lg">{blogItem.title}</h3>
              <p className="text-muted-foreground mt-2">{blogItem.caption}</p>
            </div>
            <Badge variant="outline" className="text-xs">
              Basic Description Only
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  const copyContent = () => {
    navigator.clipboard.writeText(enhanced.fullContent);
    showToast.success('Blog content copied to clipboard!');
  };

  const copyMarkdown = () => {
    const markdown = enhanced.fullContent;
    navigator.clipboard.writeText(markdown);
    showToast.success('Markdown content copied to clipboard!');
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-purple-600" />
                {enhanced.title}
              </CardTitle>
              <p className="text-muted-foreground">{enhanced.description}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {enhanced.readingTime}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            {enhanced.tags.map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                <Tag className="h-3 w-3 mr-1" />
                {tag}
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={copyContent}
              className="flex items-center gap-2"
            >
              <Copy className="h-4 w-4" />
              Copy Content
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={copyMarkdown}
              className="flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Copy Markdown
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Content Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Content Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-y-auto prose prose-sm max-w-none">
            <div className="whitespace-pre-wrap font-mono text-sm bg-muted p-4 rounded-lg">
              {enhanced.fullContent.substring(0, 1000)}
              {enhanced.fullContent.length > 1000 && (
                <div className="text-muted-foreground mt-2">
                  ... and {enhanced.fullContent.length - 1000} more characters
                </div>
              )}
            </div>
          </div>
          <div className="mt-4 text-sm text-muted-foreground">
            Total content length: {enhanced.fullContent.length} characters
          </div>
        </CardContent>
      </Card>
    </div>
  );
};