import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Smartphone, Monitor, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CampaignPreviewProps {
  campaignData: {
    name: string;
    subject_line: string;
    content: string;
  };
  senderConfig?: {
    senderEmail: string;
    displayName: string;
    deliveryMethod: string;
  };
}

export const CampaignPreview: React.FC<CampaignPreviewProps> = ({
  campaignData,
  senderConfig
}) => {
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');

  // Process content with test merge tags
  const processedContent = React.useMemo(() => {
    let content = campaignData.content || '<p>No content yet. Start building your email!</p>';
    
    // Replace merge tags with test data
    content = content.replace(/\{firstName\}/g, 'Test User');
    content = content.replace(/\{company_name\}/g, senderConfig?.displayName || 'Your Garden Center');
    content = content.replace(/\{unsubscribe_link\}/g, 'https://bloomsuite.app/unsubscribe/test');
    content = content.replace(/\{company_website\}/g, 'your-website.com');
    content = content.replace(/\{company_address\}/g, 'Your Business Address');
    
    return content;
  }, [campaignData.content, senderConfig]);

  const senderDisplay = senderConfig?.deliveryMethod === 'custom_domain' 
    ? `${senderConfig.displayName} <${senderConfig.senderEmail}>`
    : `${senderConfig?.displayName || 'Your Garden Center'} via BloomSuite <noreply@bloomsuite.email>`;

  return (
    <Card className="h-full">
      <CardHeader className="space-y-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            Preview
            <Badge variant="outline" className="text-xs">
              Test Mode
            </Badge>
          </CardTitle>
          
          <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
            <Button
              variant={viewMode === 'desktop' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('desktop')}
              className="h-8 px-2"
            >
              <Monitor className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'mobile' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('mobile')}
              className="h-8 px-2"
            >
              <Smartphone className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Email Header Preview */}
        <div className="space-y-2 p-3 bg-muted/50 rounded-lg text-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-medium">From:</p>
              <p className="text-muted-foreground">{senderDisplay}</p>
            </div>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
              <ExternalLink className="h-3 w-3 mr-1" />
              View in Browser
            </Button>
          </div>
          <div>
            <p className="font-medium">Subject:</p>
            <p className="text-muted-foreground">
              {campaignData.subject_line || 'Your email subject line will appear here'}
            </p>
          </div>
          <div>
            <p className="font-medium">To:</p>
            <p className="text-muted-foreground">test@example.com</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="border-t">
          <div 
            className={cn(
              "transition-all duration-300 mx-auto bg-white border-x",
              viewMode === 'mobile' ? 'max-w-sm' : 'max-w-2xl'
            )}
          >
            <div 
              className="prose prose-sm max-w-none p-6"
              dangerouslySetInnerHTML={{ __html: processedContent }}
              style={{
                fontSize: viewMode === 'mobile' ? '14px' : '16px',
                lineHeight: viewMode === 'mobile' ? '1.4' : '1.6'
              }}
            />
            
            {/* Auto-generated footer preview */}
            <div className="px-6 pb-6">
              <div className="border-t pt-4 mt-8 text-xs text-gray-500 space-y-1">
                <p>
                  You're receiving this email from {senderConfig?.displayName || 'Your Garden Center'} because you signed up for updates.
                </p>
                <p>
                  To unsubscribe, <a href="#" className="text-gray-500 underline">click here</a>.
                </p>
                <p>
                  {senderConfig?.displayName || 'Your Garden Center'} | Your Business Address
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};