
import React from 'react';
import { ContentBlock, BlockLayout } from '@/types/emailBuilder';
import { Layout1, Layout2, Layout3, Layout4, Layout6, Layout7 } from './LayoutTemplates';

interface LayoutRendererProps {
  block: ContentBlock;
  className?: string;
}

export const LayoutRenderer: React.FC<LayoutRendererProps> = ({ block, className = '' }) => {
  const renderLayoutComponent = () => {
    // Map the layout type to the appropriate template component
    switch (block.layout) {
      case 'two-column-left':
        return <Layout1 block={block} className={className} />;
      case 'two-column-right':
        return <Layout2 block={block} className={className} />;
      case 'full-width':
      default:
        // For full-width blocks, choose layout based on content type
        if (block.type === 'image') {
          return <Layout1 block={block} className={className} />;
        } else if (block.type === 'text') {
          return <Layout6 block={block} className={className} />;
        } else {
          return <Layout6 block={block} className={className} />;
        }
    }
  };

  return (
    <div className="layout-renderer">
      {renderLayoutComponent()}
    </div>
  );
};

// Helper function to map modal layout types to block layout types
export const mapModalLayoutToBlockLayout = (modalLayoutType: string): BlockLayout => {
  switch (modalLayoutType) {
    case 'image-left':
      return 'two-column-left';
    case 'image-right':
      return 'two-column-right';
    case 'image-vertical-left':
      return 'two-column-left';
    case 'image-vertical-right':
      return 'two-column-right';
    case 'text-double':
    case 'text-triple':
    default:
      return 'full-width';
  }
};

// Helper function to determine block type based on layout
export const determineBlockTypeFromLayout = (modalLayoutType: string): ContentBlock['type'] => {
  switch (modalLayoutType) {
    case 'image-left':
    case 'image-right':
    case 'image-vertical-left':
    case 'image-vertical-right':
      return 'image';
    case 'text-double':
    case 'text-triple':
    default:
      return 'text';
  }
};

// Enhanced layout preview component for block editor
export const LayoutPreview: React.FC<{ block: ContentBlock }> = ({ block }) => {
  return (
    <div className="p-4 bg-muted/30 rounded-lg border">
      <div className="mb-3">
        <span className="text-sm font-medium text-muted-foreground">
          Layout Preview
        </span>
      </div>
      <div className="bg-white p-4 rounded-md border">
        <LayoutRenderer block={block} />
      </div>
    </div>
  );
};
