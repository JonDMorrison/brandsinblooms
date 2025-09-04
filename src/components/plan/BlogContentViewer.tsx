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
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                window.open('data:text/html;charset=utf-8,' + encodeURIComponent(`
                  <html>
                    <head>
                      <title>${enhanced.title}</title>
                      <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
                        h1 { color: #1f2937; border-bottom: 3px solid #10b981; padding-bottom: 10px; }
                        h2 { color: #374151; margin-top: 2em; }
                        h3 { color: #4b5563; }
                        ul, ol { margin: 1em 0; }
                        li { margin: 0.5em 0; }
                        p { margin: 1em 0; }
                        strong { color: #1f2937; }
                        code { background: #f3f4f6; padding: 2px 4px; border-radius: 3px; }
                        pre { background: #f3f4f6; padding: 15px; border-radius: 6px; overflow-x: auto; }
                        blockquote { border-left: 4px solid #10b981; margin: 0; padding-left: 20px; font-style: italic; }
                        .highlight { background: #fef3c7; padding: 2px 4px; border-radius: 3px; }
                      </style>
                    </head>
                    <body>
                      ${enhanced.fullContent
                        .replace(/\n/g, '<br>')
                        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
                        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
                        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
                        .replace(/<h[1-3]>([^<]+)<br>/g, '<h$1>$2</h$1>')
                        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                        .replace(/^\* (.+)$/gm, '<li>$1</li>')
                        .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
                        .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
                        .replace(/<br><br>/g, '</p><p>')
                        .replace(/^/, '<p>')
                        .replace(/$/, '</p>')
                      }
                    </body>
                  </html>
                `), '_blank');
              }}
              className="flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Open in New Tab
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