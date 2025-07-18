import React from 'react';
import { Card } from '@/components/ui/card';

interface MobilePreviewFrameProps {
  children: React.ReactNode;
  className?: string;
}

export const MobilePreviewFrame: React.FC<MobilePreviewFrameProps> = ({ 
  children, 
  className 
}) => {
  return (
    <div className={`mx-auto ${className}`} style={{ maxWidth: '390px' }}>
      <Card className="bg-white shadow-2xl rounded-[2.5rem] border-8 border-gray-800 overflow-hidden relative">
        {/* Phone bezel simulation */}
        <div className="bg-gray-800 h-6 flex items-center justify-center">
          <div className="w-12 h-1 bg-gray-600 rounded-full"></div>
        </div>
        
        {/* Screen content */}
        <div className="mobile-email-preview bg-white min-h-[600px] overflow-y-auto">
          <style>{`
            .mobile-email-preview {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            .mobile-email-preview img {
              max-width: 100%;
              height: auto;
              display: block;
            }
            .mobile-email-preview .email-block {
              padding: 8px 16px;
              border: none !important;
              margin: 0 !important;
            }
            .mobile-email-preview .email-block-header {
              text-align: center;
              padding: 16px;
              background: #f8f9fa;
            }
            .mobile-email-preview .email-block-text {
              padding: 12px;
              line-height: 1.5;
            }
            .mobile-email-preview .email-block-button {
              padding: 12px;
              text-align: center;
            }
            .mobile-email-preview .email-block-button button {
              width: 100%;
              min-height: 44px;
              font-size: 16px;
              border-radius: 8px;
            }
            .mobile-email-preview .email-block-image {
              padding: 8px;
            }
            .mobile-email-preview .email-block-product {
              padding: 12px;
              border-bottom: 1px solid #e5e7eb;
            }
            .mobile-email-preview .email-block-divider {
              margin: 8px 16px;
            }
          `}</style>
          {children}
        </div>
        
        {/* Phone bottom */}
        <div className="bg-gray-800 h-6"></div>
      </Card>
    </div>
  );
};