
import React from 'react';
import { ContentBlock, BlockLayout } from '@/types/emailBuilder';
import { Layout1, Layout2, Layout3, Layout4, Layout6, Layout7 } from './LayoutTemplates';
import { cn } from '@/lib/utils';

interface LayoutRendererProps {
  block: ContentBlock;
  className?: string;
  editable?: boolean;
  onUpdate?: (updates: Partial<ContentBlock>) => void;
}

// Helper function to get spacing classes
const getSpacingClass = (spacing?: string, type: 'padding' | 'margin' = 'padding') => {
  const prefix = type === 'padding' ? 'p' : 'm';
  switch (spacing) {
    case 'none': return `${prefix}-0`;
    case 'small': return `${prefix}-2`;
    case 'medium': return `${prefix}-4`;
    case 'large': return `${prefix}-8`;
    default: return `${prefix}-4`; // Default to medium
  }
};

// Helper function to get animation classes
const getAnimationClass = (animation?: string) => {
  switch (animation) {
    case 'fade-in': return 'animate-fade-in';
    case 'slide-up': return 'animate-fade-in'; // Using fade-in as fallback
    case 'scale-in': return 'animate-scale-in';
    case 'none':
    default: return '';
  }
};

// Helper function to get block styles
const getBlockStyles = (block: ContentBlock): React.CSSProperties => {
  const styles: React.CSSProperties = {};
  
  if (block.backgroundColor) {
    styles.backgroundColor = block.backgroundColor;
  }
  
  if (block.textColor) {
    styles.color = block.textColor;
  }
  
  return styles;
};

// Helper function to get alignment classes
const getAlignmentClass = (alignment?: string) => {
  switch (alignment) {
    case 'left': return 'text-left';
    case 'center': return 'text-center';
    case 'right': return 'text-right';
    default: return 'text-left';
  }
};

// Helper function to get responsive behavior classes
const getResponsiveClass = (behavior?: string, layout?: string) => {
  if (layout === 'full-width') return '';
  
  switch (behavior) {
    case 'reverse': return 'flex-col-reverse md:flex-row';
    case 'hide-image': return '[&_img]:hidden md:[&_img]:block';
    case 'stack':
    default: return 'flex-col md:flex-row';
  }
};

export const LayoutRenderer: React.FC<LayoutRendererProps> = ({ 
  block, 
  className = '', 
  editable = false, 
  onUpdate 
}) => {
  // Skip rendering if block is hidden
  if (block.visible === false) {
    return null;
  }

  // Build spacing, alignment, and animation classes
  const paddingClass = getSpacingClass(block.padding, 'padding');
  const marginClass = getSpacingClass(block.margin, 'margin');
  const alignmentClass = getAlignmentClass(block.alignment);
  const responsiveClass = getResponsiveClass(block.responsiveBehavior, block.layout);
  const animationClass = getAnimationClass(block.animation);
  const blockStyles = getBlockStyles(block);
  
  // Combine all styling classes
  const styleClasses = cn(
    paddingClass,
    marginClass,
    alignmentClass,
    responsiveClass,
    animationClass,
    'transition-all duration-300', // Smooth transitions
    className
  );

  const renderLayoutComponent = () => {
    // Map the layout type to the appropriate template component
    switch (block.layout) {
      case 'two-column-left':
        return <Layout1 block={block} className={styleClasses} editable={editable} onUpdate={onUpdate} />;
      case 'two-column-right':
        return <Layout2 block={block} className={styleClasses} editable={editable} onUpdate={onUpdate} />;
      case 'full-width':
      default:
        // For full-width blocks, choose layout based on content type
        if (block.type === 'image') {
          return <Layout1 block={block} className={styleClasses} editable={editable} onUpdate={onUpdate} />;
        } else if (block.type === 'text') {
          return <Layout6 block={block} className={styleClasses} editable={editable} onUpdate={onUpdate} />;
        } else {
          return <Layout6 block={block} className={styleClasses} editable={editable} onUpdate={onUpdate} />;
        }
    }
  };

  return (
    <div className="layout-renderer" style={blockStyles}>
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

export const LayoutPreview: React.FC<{ block: ContentBlock; onUpdate?: (updates: Partial<ContentBlock>) => void }> = ({ 
  block, 
  onUpdate 
}) => {
  return (
    <div className="p-4 bg-muted/30 rounded-lg border">
      <div className="mb-3">
        <span className="text-sm font-medium text-muted-foreground">
          Layout Preview
        </span>
      </div>
      <div className="bg-white p-4 rounded-md border">
        <LayoutRenderer block={block} editable={true} onUpdate={onUpdate} />
      </div>
    </div>
  );
};
