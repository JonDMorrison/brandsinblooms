
import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, Star, Clock, Grid, Mail, MessageSquare, Target, FileText, Image, Square, ArrowLeft, ArrowRight, Quote, MousePointer } from 'lucide-react';
import { LayoutType } from '../BlockLayoutModal';
import { LayoutOption } from './LayoutOption';
import { LayoutPreview } from './LayoutPreview';
import { SearchAndFilters } from './SearchAndFilters';

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
  {
    id: 'quote-featured' as LayoutType,
    title: 'Featured Quote',
    description: 'Elegant quote block with author attribution',
    category: 'Newsletter',
    icon: <Quote className="h-4 w-4 text-muted-foreground" />,
    isNew: true,
    previewType: 'quote-featured' as const
  },
  {
    id: 'cta-primary' as LayoutType,
    title: 'Enhanced CTA',
    description: 'Advanced call-to-action with customizable styling',
    category: 'Newsletter',
    icon: <Target className="h-4 w-4 text-muted-foreground" />,
    isPopular: true,
    isNew: true,
    previewType: 'cta-primary' as const
  },

  // Header Layouts
  {
    id: 'header-hero' as LayoutType,
    title: 'Feature Banner',
    description: 'Eye-catching hero section with background image and overlay text',
    category: 'Header',
    icon: <Square className="h-4 w-4 text-muted-foreground" />,
    isPopular: true,
    previewType: 'header-hero' as const
  },
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
    id: 'image-60-40' as LayoutType,
    title: 'Image Focus (60/40)',
    description: 'Image-dominant layout with 60% image, 40% text',
    category: 'Image',
    icon: <Image className="h-4 w-4 text-muted-foreground" />,
    isNew: true,
    previewType: 'image-60-40' as const
  },
  {
    id: 'image-70-30' as LayoutType,
    title: 'Image Dominant (70/30)',
    description: 'Strong visual impact with 70% image, 30% text',
    category: 'Image',
    icon: <Image className="h-4 w-4 text-muted-foreground" />,
    isNew: true,
    previewType: 'image-70-30' as const
  },
  {
    id: 'image-overlay' as LayoutType,
    title: 'Text Overlay',
    description: 'Text overlaid on background image for dramatic effect',
    category: 'Image',
    icon: <Image className="h-4 w-4 text-muted-foreground" />,
    isNew: true,
    previewType: 'image-overlay' as const
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
  {
    id: 'button-left' as LayoutType,
    title: 'Left Aligned Button',
    description: 'Left-aligned button with text',
    category: 'Button',
    icon: <ArrowLeft className="h-4 w-4 text-muted-foreground" />,
    previewType: 'button-left' as const
  },
  {
    id: 'button-right' as LayoutType,
    title: 'Right Aligned Button',
    description: 'Right-aligned button with text',
    category: 'Button',
    icon: <ArrowRight className="h-4 w-4 text-muted-foreground" />,
    previewType: 'button-right' as const
  },
  
  // Text Layouts
  {
    id: 'text-double' as LayoutType,
    title: 'Two Columns',
    description: 'Text split into two columns for better readability',
    category: 'Text',
    icon: <FileText className="h-4 w-4 text-muted-foreground" />,
    previewType: 'text-double' as const
  },
  {
    id: 'text-triple' as LayoutType,
    title: 'Three Columns',
    description: 'Text split into three columns for compact presentation',
    category: 'Text',
    icon: <FileText className="h-4 w-4 text-muted-foreground" />,
    isNew: true,
    previewType: 'text-triple' as const
  }
];

export const EnhancedBlockLayoutModal: React.FC<EnhancedBlockLayoutModalProps> = ({ 
  isOpen,
  onClose,
  onSelect
}) => {
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const handleSelect = (layoutType: LayoutType) => {
    console.log('🚀 EnhancedBlockLayoutModal handleSelect called with:', layoutType);
    onSelect(layoutType);
    onClose();
  };

  const categories = Array.from(new Set(layoutOptions.map(opt => opt.category)));
  
  const filteredOptions = useMemo(() => {
    let filtered = layoutOptions;

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(option =>
        option.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        option.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        option.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by selected categories
    if (selectedCategories.length > 0) {
      filtered = filtered.filter(option => selectedCategories.includes(option.category));
    }

    // Filter by tab
    switch (activeTab) {
      case 'popular':
        filtered = filtered.filter(option => option.isPopular);
        break;
      case 'recent':
        filtered = filtered.filter(option => option.isNew);
        break;
      case 'all':
      default:
        break;
    }

    return filtered;
  }, [searchQuery, selectedCategories, activeTab]);

  const handleCategoryToggle = (category: string) => {
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedCategories([]);
  };

  const popularCount = layoutOptions.filter(opt => opt.isPopular).length;
  const recentCount = layoutOptions.filter(opt => opt.isNew).length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] md:max-h-[85vh] overflow-y-auto">
        <DialogHeader className="pb-4 border-b border-border/10">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Plus className="h-5 w-5 text-primary" />
            Choose Block Layout
          </DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="pt-4">
          <div className="sticky top-0 bg-background/95 backdrop-blur-sm pb-4 border-b border-border/10 mb-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all" className="flex items-center gap-2 text-xs sm:text-sm">
                <Grid className="h-4 w-4" />
                All Layouts
                <Badge variant="secondary" className="ml-1 text-xs">
                  {layoutOptions.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="popular" className="flex items-center gap-2 text-xs sm:text-sm">
                <Star className="h-4 w-4 text-muted-foreground" />
                Popular
                <Badge variant="outline" className="ml-1 text-xs text-muted-foreground">
                  {popularCount}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="recent" className="flex items-center gap-2 text-xs sm:text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                New
                <Badge variant="outline" className="ml-1 text-xs text-muted-foreground">
                  {recentCount}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="categories" className="text-xs sm:text-sm">
                Categories
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="min-h-0">
            <TabsContent value="all" className="mt-0 space-y-6">
              <SearchAndFilters
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                selectedCategories={selectedCategories}
                onCategoryToggle={handleCategoryToggle}
                availableCategories={categories}
                onClearFilters={handleClearFilters}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
                {filteredOptions.map((option) => (
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

              {filteredOptions.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Grid className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-lg font-medium mb-2">No layouts found</p>
                  <p className="text-sm">Try adjusting your search or filters</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="popular" className="mt-0 space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <Star className="h-5 w-5 text-muted-foreground" />
                <h3 className="text-lg font-semibold">Popular Layouts</h3>
                <Badge variant="outline" className="text-muted-foreground">Most used by teams</Badge>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
                {layoutOptions.filter(opt => opt.isPopular).map((option) => (
                  <LayoutOption
                    key={option.id}
                    id={option.id}
                    title={option.title}
                    description={option.description}
                    category={option.category}
                    icon={option.icon}
                    isPopular={option.isPopular}
                    preview={<LayoutPreview type={option.previewType} />}
                    onClick={() => handleSelect(option.id)}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="recent" className="mt-0 space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <h3 className="text-lg font-semibold">New Layouts</h3>
                <Badge variant="outline" className="text-muted-foreground">Recently added</Badge>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
                {layoutOptions.filter(opt => opt.isNew).map((option) => (
                  <LayoutOption
                    key={option.id}
                    id={option.id}
                    title={option.title}
                    description={option.description}
                    category={option.category}
                    icon={option.icon}
                    isNew={option.isNew}
                    preview={<LayoutPreview type={option.previewType} />}
                    onClick={() => handleSelect(option.id)}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="categories" className="mt-0 space-y-8 pb-4">
              {categories.map(category => (
                <div key={category}>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    {category} Blocks
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      {layoutOptions.filter(opt => opt.category === category).length}
                    </Badge>
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {layoutOptions
                      .filter(option => option.category === category)
                      .map((option) => (
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
                      ))
                    }
                  </div>
                </div>
              ))}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
