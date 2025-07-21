
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Layout, Plus } from 'lucide-react';

export type LayoutType = 
  | 'image-left'
  | 'image-right' 
  | 'image-vertical-left'
  | 'image-vertical-right'
  | 'text-double'
  | 'text-triple'
  | 'header-hero'
  | 'header-simple'
  | 'image-full'
  | 'button-centered'
  | 'button-left'
  | 'button-right';

interface BlockLayoutModalProps {
  onSelect: (layoutType: LayoutType) => void;
  triggerText?: string;
}

export const BlockLayoutModal: React.FC<BlockLayoutModalProps> = ({ 
  onSelect, 
  triggerText = "Add Block with Layout" 
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const layoutOptions = [
    // Header Layouts
    {
      id: 'header-hero' as LayoutType,
      title: 'Hero Header',
      description: 'Large header with background image',
      category: 'Header',
      icon: '🎯',
      preview: (
        <div className="h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded flex items-center justify-center text-white text-xs font-medium">
          Hero Header
        </div>
      )
    },
    {
      id: 'header-simple' as LayoutType,
      title: 'Simple Header',
      description: 'Clean header with title and subtitle',
      category: 'Header',
      icon: '📄',
      preview: (
        <div className="h-16 bg-gray-100 rounded flex flex-col items-center justify-center">
          <div className="text-xs font-bold">Title</div>
          <div className="text-xs text-gray-500">Subtitle</div>
        </div>
      )
    },
    
    // Image Layouts
    {
      id: 'image-full' as LayoutType,
      title: 'Full Width Image',
      description: 'Full width responsive image with caption',
      category: 'Image',
      icon: '🖼️',
      preview: (
        <div className="h-16 bg-gray-200 rounded flex items-center justify-center">
          <div className="w-full h-10 bg-gray-300 rounded flex items-center justify-center text-xs">
            Full Image
          </div>
        </div>
      )
    },
    {
      id: 'image-left' as LayoutType,
      title: 'Image Left',
      description: 'Image on left, content on right',
      category: 'Image',
      icon: '⬅️',
      preview: (
        <div className="h-16 flex gap-1">
          <div className="w-1/2 bg-gray-300 rounded"></div>
          <div className="w-1/2 bg-gray-100 rounded flex items-center justify-center text-xs">
            Text
          </div>
        </div>
      )
    },
    {
      id: 'image-right' as LayoutType,
      title: 'Image Right',
      description: 'Content on left, image on right',
      category: 'Image',
      icon: '➡️',
      preview: (
        <div className="h-16 flex gap-1">
          <div className="w-1/2 bg-gray-100 rounded flex items-center justify-center text-xs">
            Text
          </div>
          <div className="w-1/2 bg-gray-300 rounded"></div>
        </div>
      )
    },
    
    // Button Layouts
    {
      id: 'button-centered' as LayoutType,
      title: 'Centered Button',
      description: 'Center-aligned button with optional text',
      category: 'Button',
      icon: '🔘',
      preview: (
        <div className="h-16 bg-gray-50 rounded flex flex-col items-center justify-center gap-1">
          <div className="text-xs">Text above</div>
          <div className="bg-blue-500 text-white px-2 py-1 rounded text-xs">Button</div>
        </div>
      )
    },
    {
      id: 'button-left' as LayoutType,
      title: 'Left Aligned Button',
      description: 'Left-aligned button with text',
      category: 'Button',
      icon: '⬅️',
      preview: (
        <div className="h-16 bg-gray-50 rounded flex flex-col justify-center pl-2 gap-1">
          <div className="text-xs">Text above</div>
          <div className="bg-blue-500 text-white px-2 py-1 rounded text-xs w-fit">Button</div>
        </div>
      )
    },
    {
      id: 'button-right' as LayoutType,
      title: 'Right Aligned Button',
      description: 'Right-aligned button with text',
      category: 'Button',
      icon: '➡️',
      preview: (
        <div className="h-16 bg-gray-50 rounded flex flex-col justify-center items-end pr-2 gap-1">
          <div className="text-xs">Text above</div>
          <div className="bg-blue-500 text-white px-2 py-1 rounded text-xs">Button</div>
        </div>
      )
    },
    
    // Text Layouts
    {
      id: 'text-double' as LayoutType,
      title: 'Two Columns',
      description: 'Text split into two columns',
      category: 'Text',
      icon: '📝',
      preview: (
        <div className="h-16 flex gap-1">
          <div className="w-1/2 bg-gray-100 rounded flex items-center justify-center text-xs">
            Column 1
          </div>
          <div className="w-1/2 bg-gray-100 rounded flex items-center justify-center text-xs">
            Column 2
          </div>
        </div>
      )
    },
    {
      id: 'text-triple' as LayoutType,
      title: 'Three Columns',
      description: 'Text split into three columns',
      category: 'Text',
      icon: '📋',
      preview: (
        <div className="h-16 flex gap-1">
          <div className="w-1/3 bg-gray-100 rounded flex items-center justify-center text-xs">
            Col 1
          </div>
          <div className="w-1/3 bg-gray-100 rounded flex items-center justify-center text-xs">
            Col 2
          </div>
          <div className="w-1/3 bg-gray-100 rounded flex items-center justify-center text-xs">
            Col 3
          </div>
        </div>
      )
    }
  ];

  const handleSelect = (layoutType: LayoutType) => {
    onSelect(layoutType);
    setIsOpen(false);
  };

  const categories = ['Header', 'Image', 'Button', 'Text'];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Layout className="h-4 w-4" />
          {triggerText}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Choose Block Layout
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {categories.map(category => (
            <div key={category}>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                {category} Blocks
                <Badge variant="secondary" className="text-xs">
                  {layoutOptions.filter(opt => opt.category === category).length}
                </Badge>
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {layoutOptions
                  .filter(option => option.category === category)
                  .map((option) => (
                    <Card 
                      key={option.id}
                      className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-primary/20"
                      onClick={() => handleSelect(option.id)}
                    >
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{option.icon}</span>
                            <div>
                              <h4 className="font-medium text-sm">{option.title}</h4>
                              <p className="text-xs text-muted-foreground">{option.description}</p>
                            </div>
                          </div>
                          
                          <div className="aspect-video">
                            {option.preview}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                }
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
