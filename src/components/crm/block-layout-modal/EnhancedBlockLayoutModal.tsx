
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Grid, Mail, FileText, Image, ArrowLeft, ArrowRight, Quote, MousePointer } from 'lucide-react';
import { LayoutType } from '../BlockLayoutModal';
import { LayoutOption } from './LayoutOption';
import { LayoutPreview } from './LayoutPreview';


interface EnhancedBlockLayoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (layoutType: LayoutType) => void;
}

const layoutOptions = [
  // Newsletter Layouts
  {
    id: 'newsletter-header' as LayoutType,
    title: 'Newsletter Header',
    description: 'Professional newsletter header with title, issue number, and date',
    category: 'Newsletter',
    icon: <Mail className="h-4 w-4 text-muted-foreground" />,
    isPopular: true,
    isNew: true,
    previewType: 'newsletter-header' as const
  },

  // Header Layouts
  {
    id: 'header-simple' as LayoutType,
    title: 'Text Only Header',
    description: 'Clean full-width text section with title and subtitle',
    category: 'Header',
    icon: <FileText className="h-4 w-4 text-muted-foreground" />,
    previewType: 'header-simple' as const
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
    id: 'image-background' as LayoutType,
    title: 'Background Image',
    description: 'Content with subtle background image',
    category: 'Image',
    icon: <Image className="h-4 w-4 text-muted-foreground" />,
    isNew: true,
    previewType: 'image-background' as const
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
  
  // Button Layouts
  {
    id: 'button-centered' as LayoutType,
    title: 'Call to Action (CTA)',
    description: 'Center-aligned action button with supporting text above',
    category: 'Button',
    icon: <MousePointer className="h-4 w-4 text-muted-foreground" />,
    isPopular: true,
    previewType: 'button-centered' as const
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
