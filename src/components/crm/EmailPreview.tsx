
import React from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LayoutRenderer } from './LayoutRenderer';
import { Mail, Eye } from 'lucide-react';

interface EmailPreviewProps {
  blocks: ContentBlock[];
  campaignName: string;
  subjectLine: string;
  senderName: string;
  senderEmail: string;
}

export const EmailPreview: React.FC<EmailPreviewProps> = ({
  blocks,
  campaignName,
  subjectLine,
  senderName,
  senderEmail
}) => {
  return (
    <Card>
      <CardHeader className="py-2">
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          Email Preview
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        {/* Email Header Info */}
        <div className="mb-2 p-2 bg-muted/30 rounded-lg border">
          <div className="flex items-center gap-1 mb-1">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Email Details</span>
          </div>
          <div className="space-y-1 text-sm">
            <div><strong>From:</strong> {senderName} &lt;{senderEmail}&gt;</div>
            <div><strong>Subject:</strong> {subjectLine || 'No subject'}</div>
            <div><strong>Campaign:</strong> {campaignName || 'Untitled Campaign'}</div>
          </div>
        </div>

        {/* Email Content Preview */}
        <div className="bg-white border rounded-lg overflow-hidden">
          <div className="max-h-96 overflow-y-auto">
            {blocks.length > 0 ? (
              <div className="p-4 space-y-4">
                {blocks
                  .filter(block => block.visible !== false)
                  .map((block) => (
                    <div key={block.id}>
                      <LayoutRenderer 
                        block={block} 
                        editable={false}
                      />
                    </div>
                  ))
                }
                {/* Footer Block Preview */}
                <div className="border-t border-muted pt-4 mt-4">
                  <div className="bg-muted/20 p-4 rounded text-center text-xs text-muted-foreground">
                    <div className="font-medium mb-2">{senderName}</div>
                    <div className="mb-2">123 Business St, Suite 100, City, State 12345</div>
                    <div className="text-xs mb-3">
                      You are receiving this email because you opted in at {senderName || 'our website'}.
                    </div>
                    <div className="flex justify-center gap-3 text-xs">
                      <span className="underline cursor-pointer hover:text-foreground">Unsubscribe</span>
                      <span className="underline cursor-pointer hover:text-foreground">Manage Preferences</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-base mb-2">No content blocks added yet</p>
                <p className="text-sm">Add blocks to see your email preview</p>
              </div>
            )}
          </div>
        </div>

        {/* Block Count Info */}
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>{blocks.length} total blocks</span>
          <span>{blocks.filter(b => b.visible !== false).length} visible blocks</span>
        </div>
      </CardContent>
    </Card>
  );
};
