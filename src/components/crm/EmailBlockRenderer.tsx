import React from 'react';
import { EmailBlock, GlobalSettings } from '@/types/emailBuilder';

interface EmailBlockRendererProps {
  block: EmailBlock;
  globalSettings: GlobalSettings;
  isPreview: boolean;
}

export const EmailBlockRenderer: React.FC<EmailBlockRendererProps> = ({
  block,
  globalSettings,
  isPreview
}) => {
  const baseStyle = {
    fontFamily: globalSettings.fontFamily,
    fontSize: globalSettings.fontSize,
  };

  const renderHeader = () => (
    <div
      style={{
        ...baseStyle,
        backgroundColor: globalSettings.headerStyle.backgroundColor,
        color: globalSettings.headerStyle.textColor,
        padding: '24px',
        textAlign: 'center' as const,
      }}
    >
      <h1 style={{ 
        margin: '0 0 8px 0', 
        fontSize: '28px', 
        fontWeight: 'bold',
        fontFamily: globalSettings.headlineFont || globalSettings.fontFamily
      }}>
        {block.content.title || 'Header Title'}
      </h1>
      {block.content.subtitle && (
        <p style={{ 
          margin: '0', 
          fontSize: '16px', 
          opacity: 0.8,
          fontFamily: globalSettings.subheadingFont || globalSettings.fontFamily
        }}>
          {block.content.subtitle}
        </p>
      )}
    </div>
  );

  const renderText = () => {
    // CRITICAL: Plain text blocks should NEVER render images, even if image_url exists
    // This is a pure text block - no images allowed
    const hasButton = (block.cta_text || block.content.buttonText) && (block.cta_url || block.content.buttonUrl);
    
    return (
      <div style={{ ...baseStyle, padding: '16px 24px' }}>
        {block.content.title && (
          <h2 style={{ 
            margin: '0 0 12px 0', 
            fontSize: '20px', 
            fontWeight: 'bold',
            fontFamily: globalSettings.subheadingFont || globalSettings.fontFamily
          }}>
            {block.content.title}
          </h2>
        )}
        <div style={{ 
          lineHeight: '1.6', 
          color: '#374151',
          marginBottom: hasButton ? '16px' : '0',
          fontFamily: globalSettings.bodyFont || globalSettings.fontFamily
        }}>
          {block.content.content || 'Add your text content here...'}
        </div>
        {hasButton && (
          <div style={{ 
            textAlign: block.content.alignment as any || 'left',
            marginTop: '16px'
          }}>
            <a
              href={block.cta_url || block.content.buttonUrl || '#'}
              style={{
                display: 'inline-block',
                padding: '12px 24px',
                backgroundColor: globalSettings.buttonStyle.backgroundColor,
                color: globalSettings.buttonStyle.textColor,
                borderRadius: globalSettings.buttonStyle.cornerRadius,
                textDecoration: 'none',
                fontWeight: 'bold',
                fontSize: '16px',
                fontFamily: globalSettings.buttonFont || globalSettings.fontFamily
              }}
            >
              {block.cta_text || block.content.buttonText || 'Click Here'}
            </a>
          </div>
        )}
      </div>
    );
  };

  const renderImage = () => {
    // Don't render anything if there's no image
    if (!block.image_url) {
      return null;
    }

    return (
      <div style={{ 
        padding: '16px 24px', 
        textAlign: block.content.alignment as any || 'center' 
      }}>
        <img
          src={block.image_url}
          alt={block.content.alt || 'Email image'}
          style={{
            maxWidth: '100%',
            height: 'auto',
            borderRadius: '8px',
          }}
        />
        {block.content.caption && (
          <p style={{ 
            margin: '8px 0 0 0', 
            fontSize: '14px', 
            color: '#6B7280',
            textAlign: 'center' as const,
            fontFamily: globalSettings.bodyFont || globalSettings.fontFamily
          }}>
            {block.content.caption}
          </p>
        )}
      </div>
    );
  };

  const renderButton = () => (
    <div style={{ 
      padding: '16px 24px', 
      textAlign: block.content.alignment as any || 'center' 
    }}>
      <a
        href={block.cta_url || block.content.url || '#'}
        style={{
          display: 'inline-block',
          padding: '12px 24px',
          backgroundColor: globalSettings.buttonStyle.backgroundColor,
          color: globalSettings.buttonStyle.textColor,
          borderRadius: globalSettings.buttonStyle.cornerRadius,
          textDecoration: 'none',
          fontWeight: 'bold',
          fontSize: '16px',
          fontFamily: globalSettings.buttonFont || globalSettings.fontFamily
        }}
      >
        {block.cta_text || block.content.text || 'Click Here'}
      </a>
    </div>
  );

  const renderDivider = () => (
    <div style={{ padding: '16px 24px' }}>
      <div
        style={{
          width: '100%',
          height: '1px',
          backgroundColor: block.content.color || '#E5E7EB',
          border: 'none',
        }}
      />
    </div>
  );

  const renderProduct = () => (
    <div style={{ 
      ...baseStyle, 
      padding: '24px',
      border: '1px solid #E5E7EB',
      borderRadius: '8px',
      margin: '16px 24px',
    }}>
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
        {block.image_url && (
          <img
            src={block.image_url}
            alt={block.content.name || 'Product'}
            style={{
              width: '80px',
              height: '80px',
              objectFit: 'cover',
              borderRadius: '8px',
            }}
          />
        )}
        <div style={{ flex: 1 }}>
          <h3 style={{ 
            margin: '0 0 4px 0', 
            fontSize: '18px', 
            fontWeight: 'bold',
            fontFamily: globalSettings.subheadingFont || globalSettings.fontFamily
          }}>
            {block.content.name || 'Product Name'}
          </h3>
          <p style={{ 
            margin: '0 0 8px 0', 
            color: '#6B7280',
            fontSize: '14px',
            fontFamily: globalSettings.bodyFont || globalSettings.fontFamily
          }}>
            {block.content.description || 'Product description'}
          </p>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between' 
          }}>
            <span style={{ 
              fontSize: '20px', 
              fontWeight: 'bold', 
              color: globalSettings.buttonStyle.backgroundColor 
            }}>
              {block.content.price || '$0.00'}
            </span>
            <a
              href={block.content.buttonUrl || '#'}
              style={{
                padding: '8px 16px',
                backgroundColor: globalSettings.buttonStyle.backgroundColor,
                color: globalSettings.buttonStyle.textColor,
                borderRadius: globalSettings.buttonStyle.cornerRadius,
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: 'bold',
                fontFamily: globalSettings.buttonFont || globalSettings.fontFamily
              }}
            >
              {block.content.buttonText || 'Shop Now'}
            </a>
          </div>
        </div>
      </div>
    </div>
  );

  const renderBlock = () => {
    // CRITICAL: Force text blocks to never render images
    // Even if image_url is accidentally set on a text block, ignore it
    const isTextBlock = block.block_type === 'text';
    
    switch (block.block_type) {
      case 'header':
        return renderHeader();
      case 'text':
        return renderText();
      case 'image':
        // Don't render image blocks if they're actually text blocks
        return isTextBlock ? renderText() : renderImage();
      case 'button':
        return renderButton();
      case 'divider':
        return renderDivider();
      case 'product':
        return renderProduct();
      default:
        return <div>Unknown block type</div>;
    }
  };

  return (
    <div className={isPreview ? 'hover:bg-muted/50 transition-colors cursor-pointer' : ''}>
      {renderBlock()}
    </div>
  );
};