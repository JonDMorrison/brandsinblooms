
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Grid, Mail, FileText, Image, ArrowLeft, ArrowRight, Quote, MousePointer, ShoppingBag, Star, ImageIcon, Minus, SeparatorHorizontal } from 'lucide-react';
import { LayoutType } from '../BlockLayoutModal';
import { LayoutOption } from './LayoutOption';
import { LayoutPreview } from './LayoutPreview';


interface EnhancedBlockLayoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (layoutType: LayoutType) => void;
}

const layoutOptions = [
  // NEW: Email-safe hero blocks at the top (recommended for emails)
  {
    id: 'email-safe-hero' as LayoutType,
    title: 'Hero (Email Safe)',
    description: 'Recommended – text on solid background, image below. Dark mode friendly.',
    category: 'Hero',
    icon: <Star className="h-4 w-4 text-emerald-500" />,
    isPopular: true,
    isRecommended: true,
    previewType: 'email-safe-hero' as const
  },
  {
    id: 'graphic-hero' as LayoutType,
    title: 'Graphic Hero',
    description: 'Single image with text baked in. Use when you design the hero in Canva.',
    category: 'Hero',
    icon: <ImageIcon className="h-4 w-4 text-violet-500" />,
    isNew: true,
    previewType: 'graphic-hero' as const
  },
  
  // Enhanced Image Layouts
  {
    id: 'image-full' as LayoutType,
    title: 'Full-Width Image',
    description: 'Responsive image that spans the full email width with optional caption',
    category: 'Image',
    icon: <Image className="h-4 w-4 text-muted-foreground" />,
    isPopular: true,
    previewType: 'image-full' as const
  },
  {
    id: 'image-left' as LayoutType,
    title: 'Image Left, Text Right',
    description: 'Visual content on left side with descriptive text on right',
    category: 'Image',
    icon: <ArrowLeft className="h-4 w-4 text-muted-foreground" />,
    previewType: 'image-left' as const
  },
  {
    id: 'image-right' as LayoutType,
    title: 'Image Right, Text Left',
    description: 'Descriptive text on left with supporting visual on right',
    category: 'Image',
    icon: <ArrowRight className="h-4 w-4 text-muted-foreground" />,
    previewType: 'image-right' as const
  },
  {
    id: 'image-gallery' as LayoutType,
    title: 'Image Gallery',
    description: 'Grid of 3, 6, or 9 images with headline and CTA',
    category: 'Image',
    icon: <Grid className="h-4 w-4 text-muted-foreground" />,
    isNew: true,
    previewType: 'image-gallery' as const
  },
  {
    id: 'product-gallery' as LayoutType,
    title: 'Product Gallery',
    description: '2×2 grid showcasing up to 4 products with badges',
    category: 'Product',
    icon: <ShoppingBag className="h-4 w-4 text-muted-foreground" />,
    isNew: true,
    previewType: 'product-gallery' as const
  },

  // Text Layouts
  {
    id: 'text-plain' as LayoutType,
    title: 'Plain Text',
    description: 'Single column body text for articles and content',
    category: 'Text',
    icon: <FileText className="h-4 w-4 text-muted-foreground" />,
    isPopular: true,
    previewType: 'text-plain' as const
  },

  // Structure
  {
    id: 'divider' as LayoutType,
    title: 'Divider',
    description: 'Styled horizontal line to separate content sections',
    category: 'Structure',
    icon: <Minus className="h-4 w-4 text-muted-foreground" />,
    previewType: 'divider' as const
  },
  {
    id: 'button' as LayoutType,
    title: 'Button',
    description: 'Call-to-action button with customizable text and link',
    category: 'Structure',
    icon: <MousePointer className="h-4 w-4 text-muted-foreground" />,
    isPopular: true,
    previewType: 'button' as const
  },
];

export const EnhancedBlockLayoutModal: React.FC<EnhancedBlockLayoutModalProps> = ({ 
  isOpen,
  onClose,
  onSelect
}) => {
  const handleSelect = (layoutType: LayoutType) => {
    console.log('🚀 EnhancedBlockLayoutModal handleSelect called with:', layoutType);
    onSelect(layoutType);
    onClose();
  };


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] md:max-h-[85vh] overflow-y-auto">
        <DialogHeader className="pb-4 border-b border-border/10">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Plus className="h-5 w-5 text-primary" />
            Choose Block Layout
          </DialogTitle>
        </DialogHeader>
        
        <div className="pt-4">
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
            {layoutOptions.map((option) => (
              <LayoutOption
                key={option.id}
                id={option.id}
                title={option.title}
                description={option.description}
                category={option.category}
                icon={option.icon}
                isPopular={option.isPopular}
                isNew={option.isNew}
                isRecommended={(option as any).isRecommended}
                preview={<LayoutPreview type={option.previewType} />}
                onClick={() => handleSelect(option.id)}
              />
            ))}
          </div>

          {layoutOptions.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Grid className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-lg font-medium mb-2">No layouts found</p>
              <p className="text-sm">Try adjusting your search or filters</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
