import React from 'react';
import { EmailBlock, GlobalSettings } from '@/types/emailBuilder';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface EmailPreviewProps {
  blocks: EmailBlock[];
  globalSettings: GlobalSettings;
  campaignName: string;
  subjectLine: string;
}

export const EmailPreview: React.FC<EmailPreviewProps> = ({
  blocks,
  globalSettings,
  campaignName,
  subjectLine
}) => {
  const renderBlock = (block: EmailBlock) => {
    switch (block.block_type) {
      case 'header':
        return (
          <div 
            key={block.id}
            className="text-center py-8 px-4"
            style={{
              backgroundColor: globalSettings.headerStyle?.backgroundColor || '#1e40af',
              color: globalSettings.headerStyle?.textColor || '#ffffff'
            }}
          >
            <h1 className="text-3xl font-bold mb-2">
              {block.content?.title || 'Header Title'}
            </h1>
            {block.content?.subtitle && (
              <p className="text-lg opacity-90">{block.content.subtitle}</p>
            )}
          </div>
        );

      case 'text':
        return (
          <div key={block.id} className="py-6 px-4">
            {block.content?.title && (
              <h2 className="text-xl font-semibold mb-3">
                {block.content.title}
              </h2>
            )}
            {block.content?.content && (
              <div 
                className="prose max-w-none"
                style={{ fontFamily: globalSettings.fontFamily, fontSize: globalSettings.fontSize }}
              >
                {block.content.content.split('\n').map((paragraph: string, index: number) => (
                  <p key={index} className="mb-3">
                    {paragraph}
                  </p>
                ))}
              </div>
            )}
          </div>
        );

      case 'image':
        return (
          <div key={block.id} className="py-4 px-4 text-center">
            {block.image_url ? (
              <img
                src={block.image_url}
                alt={block.content?.alt || 'Email image'}
                className="max-w-full h-auto mx-auto rounded-lg"
                style={{ maxHeight: '400px' }}
              />
            ) : (
              <div className="bg-gray-200 h-48 flex items-center justify-center rounded-lg">
                <span className="text-gray-500">Image placeholder</span>
              </div>
            )}
          </div>
        );

      case 'button':
        return (
          <div key={block.id} className="py-6 px-4 text-center">
            <a
              href={block.cta_url || '#'}
              className="inline-block px-6 py-3 text-white font-semibold rounded-lg hover:opacity-90 transition-opacity"
              style={{
                backgroundColor: globalSettings.buttonStyle?.backgroundColor || '#22c55e',
                color: globalSettings.buttonStyle?.textColor || '#ffffff',
                borderRadius: globalSettings.buttonStyle?.cornerRadius || '6px'
              }}
            >
              {block.cta_text || 'Click Here'}
            </a>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email Preview</CardTitle>
        <div className="text-sm text-muted-foreground">
          <p><strong>Subject:</strong> {subjectLine || 'No subject set'}</p>
          <p><strong>Campaign:</strong> {campaignName || 'Untitled Campaign'}</p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden bg-white">
          {/* Email Header */}
          <div className="border-b p-4 bg-gray-50 text-sm text-gray-600">
            <div className="flex justify-between items-center">
              <span>From: Your Garden Center &lt;hello@yourgarden.com&gt;</span>
              <span>Subject: {subjectLine || 'Your Email Subject'}</span>
            </div>
          </div>

          {/* Email Body */}
          <div className="bg-white">
            {blocks.length > 0 ? (
              blocks
                .sort((a, b) => a.order_index - b.order_index)
                .map(renderBlock)
            ) : (
              <div className="py-12 px-4 text-center text-gray-500">
                <p>No content blocks to preview</p>
                <p className="text-sm">Add some blocks to see your email preview</p>
              </div>
            )}

            {/* Email Footer */}
            <div 
              className="py-4 px-4 text-center text-sm border-t"
              style={{
                backgroundColor: globalSettings.footerStyle?.backgroundColor || '#f8fafc',
                color: globalSettings.footerStyle?.textColor || '#64748b'
              }}
            >
              <p>© {new Date().getFullYear()} Your Garden Center. All rights reserved.</p>
              <p className="mt-1">
                <a href="#" className="hover:underline">Unsubscribe</a> | 
                <a href="#" className="hover:underline ml-1">Update Preferences</a>
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};