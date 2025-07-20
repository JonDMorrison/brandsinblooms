
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ContentBlock } from '@/types/emailBuilder';
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
  const renderBlock = (block: ContentBlock, index: number) => {
    const blockStyle = "margin-bottom: 24px;";
    
    switch (block.type) {
      case 'header':
        return (
          <div key={index} style={blockStyle}>
            <div style={{
              backgroundColor: '#1e40af',
              color: '#ffffff',
              padding: '32px 24px',
              textAlign: 'center',
              borderRadius: '8px 8px 0 0'
            }}>
              <h1 style={{
                margin: '0 0 8px 0',
                fontSize: '28px',
                fontWeight: 'bold',
                lineHeight: '1.2'
              }}>
                {block.title || 'Header Title'}
              </h1>
              {block.content && (
                <p style={{
                  margin: '0',
                  fontSize: '16px',
                  opacity: '0.9',
                  lineHeight: '1.4'
                }}>
                  {block.content}
                </p>
              )}
            </div>
          </div>
        );

      case 'text':
        return (
          <div key={index} style={blockStyle}>
            <div style={{ padding: '0 24px' }}>
              {block.title && (
                <h2 style={{
                  margin: '0 0 12px 0',
                  fontSize: '20px',
                  fontWeight: '600',
                  color: '#1e293b',
                  lineHeight: '1.3'
                }}>
                  {block.title}
                </h2>
              )}
              <div style={{
                fontSize: '16px',
                lineHeight: '1.6',
                color: '#475569'
              }}>
                {block.content?.split('\n').map((paragraph, pIndex) => (
                  <p key={pIndex} style={{ margin: '0 0 12px 0' }}>
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
          </div>
        );

      case 'image':
        return (
          <div key={index} style={blockStyle}>
            <div style={{ padding: '0 24px', textAlign: 'center' }}>
              {block.imageUrl ? (
                <img
                  src={block.imageUrl}
                  alt={block.title || 'Email image'}
                  style={{
                    maxWidth: '100%',
                    height: 'auto',
                    borderRadius: '8px',
                    marginBottom: '8px'
                  }}
                />
              ) : (
                <div style={{
                  width: '100%',
                  height: '200px',
                  backgroundColor: '#f1f5f9',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px dashed #cbd5e1',
                  marginBottom: '8px'
                }}>
                  <span style={{ color: '#64748b', fontSize: '14px' }}>
                    Image Placeholder
                  </span>
                </div>
              )}
              {block.title && (
                <p style={{
                  margin: '0',
                  fontSize: '14px',
                  color: '#64748b',
                  fontStyle: 'italic'
                }}>
                  {block.title}
                </p>
              )}
            </div>
          </div>
        );

      case 'button':
        return (
          <div key={index} style={blockStyle}>
            <div style={{ padding: '0 24px', textAlign: 'center' }}>
              <a
                href={block.ctaUrl || '#'}
                style={{
                  display: 'inline-block',
                  padding: '12px 24px',
                  backgroundColor: '#22c55e',
                  color: '#ffffff',
                  textDecoration: 'none',
                  borderRadius: '6px',
                  fontWeight: '600',
                  fontSize: '16px'
                }}
              >
                {block.ctaText || block.content || 'Click Here'}
              </a>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const emailHTML = `
    <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; background: #ffffff;">
      ${blocks.map((block, index) => renderBlock(block, index)).join('')}
      
      <!-- Footer -->
      <div style="background: #f8fafc; padding: 24px; text-align: center; color: #64748b; font-size: 14px; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0 0 8px 0;">Thanks for reading!</p>
        <p style="margin: 0; font-size: 12px;">
          © ${new Date().getFullYear()} ${senderName}. All rights reserved.
        </p>
        <p style="margin: 8px 0 0 0; font-size: 12px;">
          <a href="#" style="color: #64748b; text-decoration: underline;">Unsubscribe</a> |
          <a href="#" style="color: #64748b; text-decoration: underline; margin-left: 8px;">Update Preferences</a>
        </p>
      </div>
    </div>
  `;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          Email Preview
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Email Headers */}
        <div className="mb-4 p-4 bg-muted/30 rounded-lg text-sm">
          <div className="flex justify-between items-center mb-2">
            <span className="font-medium">From:</span>
            <span>{senderName} &lt;{senderEmail}&gt;</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-medium">Subject:</span>
            <span className="font-medium">{subjectLine || 'No subject set'}</span>
          </div>
        </div>

        {/* Email Preview */}
        <div className="border rounded-lg overflow-hidden bg-white">
          {blocks.length > 0 ? (
            <iframe
              srcDoc={emailHTML}
              className="w-full border-0"
              style={{ height: '600px', minHeight: '400px' }}
              title="Email Preview"
            />
          ) : (
            <div className="py-12 px-4 text-center text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No content to preview</p>
              <p className="text-sm">Add some content blocks to see your email preview</p>
            </div>
          )}
        </div>

        {/* Campaign Info */}
        <div className="mt-4 p-3 bg-muted/20 rounded text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Campaign:</span>
            <span className="font-medium">{campaignName || 'Untitled Campaign'}</span>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-muted-foreground">Content Blocks:</span>
            <span className="font-medium">{blocks.length}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
