
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ContentBlock, BlockLayout } from '@/types/emailBuilder';
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
  const renderBlockToHTML = (block: ContentBlock, index: number): string => {
    const blockStyle = 'margin-bottom: 32px; padding: 0 24px;';
    const mobileStyle = '@media only screen and (max-width: 600px) { .mobile-stack { display: block !important; } .desktop-hide { display: none !important; } }';
    
    switch (block.layout) {
      case 'two-column-left':
        return `
          <div style="${blockStyle}">
            <table style="width: 100%; border-collapse: collapse;" class="desktop-hide">
              <tr>
                <td style="width: 50%; vertical-align: top; padding-right: 12px;">
                  ${block.imageUrl ? `
                    <img src="${block.imageUrl}" alt="${block.title || 'Image'}" style="width: 100%; height: auto; border-radius: 8px; margin-bottom: 16px;" />
                  ` : `
                    <div style="width: 100%; height: 200px; background-color: #f1f5f9; border-radius: 8px; display: flex; align-items: center; justify-content: center; border: 2px dashed #cbd5e1; margin-bottom: 16px;">
                      <span style="color: #64748b; font-size: 14px;">Image Placeholder</span>
                    </div>
                  `}
                </td>
                <td style="width: 50%; vertical-align: top; padding-left: 12px;">
                  ${block.title ? `<h3 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 600; color: #1e293b;">${block.title}</h3>` : ''}
                  ${block.content ? `<p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #475569;">${block.content}</p>` : ''}
                  ${block.ctaText && block.ctaUrl ? `
                    <a href="${block.ctaUrl}" style="display: inline-block; padding: 12px 24px; background-color: #22c55e; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                      ${block.ctaText}
                    </a>
                  ` : ''}
                </td>
              </tr>
            </table>
            
            <!-- Mobile Stack -->
            <div class="mobile-stack" style="display: none;">
              ${block.imageUrl ? `
                <img src="${block.imageUrl}" alt="${block.title || 'Image'}" style="width: 100%; height: auto; border-radius: 8px; margin-bottom: 16px;" />
              ` : `
                <div style="width: 100%; height: 200px; background-color: #f1f5f9; border-radius: 8px; display: flex; align-items: center; justify-content: center; border: 2px dashed #cbd5e1; margin-bottom: 16px;">
                  <span style="color: #64748b; font-size: 14px;">Image Placeholder</span>
                </div>
              `}
              ${block.title ? `<h3 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 600; color: #1e293b;">${block.title}</h3>` : ''}
              ${block.content ? `<p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #475569;">${block.content}</p>` : ''}
              ${block.ctaText && block.ctaUrl ? `
                <a href="${block.ctaUrl}" style="display: inline-block; padding: 12px 24px; background-color: #22c55e; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                  ${block.ctaText}
                </a>
              ` : ''}
            </div>
          </div>
        `;

      case 'two-column-right':
        return `
          <div style="${blockStyle}">
            <table style="width: 100%; border-collapse: collapse;" class="desktop-hide">
              <tr>
                <td style="width: 50%; vertical-align: top; padding-right: 12px;">
                  ${block.title ? `<h3 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 600; color: #1e293b;">${block.title}</h3>` : ''}
                  ${block.content ? `<p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #475569;">${block.content}</p>` : ''}
                  ${block.ctaText && block.ctaUrl ? `
                    <a href="${block.ctaUrl}" style="display: inline-block; padding: 12px 24px; background-color: #22c55e; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                      ${block.ctaText}
                    </a>
                  ` : ''}
                </td>
                <td style="width: 50%; vertical-align: top; padding-left: 12px;">
                  ${block.imageUrl ? `
                    <img src="${block.imageUrl}" alt="${block.title || 'Image'}" style="width: 100%; height: auto; border-radius: 8px; margin-bottom: 16px;" />
                  ` : `
                    <div style="width: 100%; height: 200px; background-color: #f1f5f9; border-radius: 8px; display: flex; align-items: center; justify-content: center; border: 2px dashed #cbd5e1; margin-bottom: 16px;">
                      <span style="color: #64748b; font-size: 14px;">Image Placeholder</span>
                    </div>
                  `}
                </td>
              </tr>
            </table>
            
            <!-- Mobile Stack -->
            <div class="mobile-stack" style="display: none;">
              ${block.imageUrl ? `
                <img src="${block.imageUrl}" alt="${block.title || 'Image'}" style="width: 100%; height: auto; border-radius: 8px; margin-bottom: 16px;" />
              ` : `
                <div style="width: 100%; height: 200px; background-color: #f1f5f9; border-radius: 8px; display: flex; align-items: center; justify-content: center; border: 2px dashed #cbd5e1; margin-bottom: 16px;">
                  <span style="color: #64748b; font-size: 14px;">Image Placeholder</span>
                </div>
              `}
              ${block.title ? `<h3 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 600; color: #1e293b;">${block.title}</h3>` : ''}
              ${block.content ? `<p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #475569;">${block.content}</p>` : ''}
              ${block.ctaText && block.ctaUrl ? `
                <a href="${block.ctaUrl}" style="display: inline-block; padding: 12px 24px; background-color: #22c55e; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                  ${block.ctaText}
                </a>
              ` : ''}
            </div>
          </div>
        `;

      default:
        // Full-width layout based on block type
        switch (block.type) {
          case 'header':
            return `
              <div style="${blockStyle}">
                <div style="background-color: #1e40af; color: #ffffff; padding: 32px 24px; text-align: center; border-radius: 8px; margin-bottom: 24px;">
                  <h1 style="margin: 0 0 8px 0; font-size: 28px; font-weight: bold; line-height: 1.2;">
                    ${block.title || 'Header Title'}
                  </h1>
                  ${block.content ? `
                    <p style="margin: 0; font-size: 16px; opacity: 0.9; line-height: 1.4;">
                      ${block.content}
                    </p>
                  ` : ''}
                </div>
              </div>
            `;

          case 'text':
            return `
              <div style="${blockStyle}">
                <div style="text-align: center; max-width: 600px; margin: 0 auto;">
                  ${block.title ? `
                    <h2 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 600; color: #1e293b; line-height: 1.3;">
                      ${block.title}
                    </h2>
                  ` : ''}
                  ${block.content ? `
                    <div style="font-size: 16px; line-height: 1.6; color: #475569; margin-bottom: 24px;">
                      ${block.content.split('\n').map(paragraph => `<p style="margin: 0 0 16px 0;">${paragraph}</p>`).join('')}
                    </div>
                  ` : ''}
                  ${block.ctaText && block.ctaUrl ? `
                    <a href="${block.ctaUrl}" style="display: inline-block; padding: 16px 32px; background-color: #22c55e; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 18px;">
                      ${block.ctaText}
                    </a>
                  ` : ''}
                </div>
              </div>
            `;

          case 'image':
            return `
              <div style="${blockStyle}">
                <div style="text-align: center;">
                  ${block.imageUrl ? `
                    <img src="${block.imageUrl}" alt="${block.title || 'Email image'}" style="max-width: 100%; height: auto; border-radius: 8px; margin-bottom: 16px;" />
                  ` : `
                    <div style="width: 100%; height: 300px; background-color: #f1f5f9; border-radius: 8px; display: flex; align-items: center; justify-content: center; border: 2px dashed #cbd5e1; margin-bottom: 16px;">
                      <span style="color: #64748b; font-size: 16px;">Image Placeholder</span>
                    </div>
                  `}
                  ${block.title ? `
                    <p style="margin: 0 0 16px 0; font-size: 14px; color: #64748b; font-style: italic;">
                      ${block.title}
                    </p>
                  ` : ''}
                  ${block.ctaText && block.ctaUrl ? `
                    <a href="${block.ctaUrl}" style="display: inline-block; padding: 12px 24px; background-color: #22c55e; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                      ${block.ctaText}
                    </a>
                  ` : ''}
                </div>
              </div>
            `;

          case 'button':
            return `
              <div style="${blockStyle}">
                <div style="text-align: center;">
                  <a href="${block.ctaUrl || '#'}" style="display: inline-block; padding: 16px 32px; background-color: #22c55e; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 18px;">
                    ${block.ctaText || block.content || 'Click Here'}
                  </a>
                </div>
              </div>
            `;

          default:
            return '';
        }
    }
  };

  const generateEmailHTML = (): string => {
    const renderedContent = blocks.map((block, index) => renderBlockToHTML(block, index)).join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subjectLine || 'Email Preview'}</title>
          <style>
            @media only screen and (max-width: 600px) {
              .mobile-stack {
                display: block !important;
              }
              .desktop-hide {
                display: none !important;
              }
              table {
                width: 100% !important;
              }
              td {
                display: block !important;
                width: 100% !important;
                padding: 0 !important;
                margin-bottom: 16px !important;
              }
            }
          </style>
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f8fafc;">
          <div style="max-width: 600px; margin: 0 auto; background: #ffffff;">
            ${renderedContent}
            
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
        </body>
      </html>
    `;
  };

  const emailHTML = generateEmailHTML();

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
