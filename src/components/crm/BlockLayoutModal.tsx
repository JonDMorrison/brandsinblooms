
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export type LayoutType = 'image-left' | 'image-right' | 'image-vertical-left' | 'image-vertical-right' | 'text-double' | 'text-triple';

interface BlockLayoutModalProps {
  onSelect: (layoutType: LayoutType) => void;
  triggerText?: string;
}

const layoutOptions = [
  { 
    id: 1, 
    type: 'image-left' as LayoutType, 
    name: 'Image Left',
    icon: <LayoutImageLeft /> 
  },
  { 
    id: 2, 
    type: 'image-right' as LayoutType, 
    name: 'Image Right',
    icon: <LayoutImageRight /> 
  },
  { 
    id: 3, 
    type: 'image-vertical-left' as LayoutType, 
    name: 'Image Vertical Left',
    icon: <LayoutImageVerticalLeft /> 
  },
  { 
    id: 4, 
    type: 'image-vertical-right' as LayoutType, 
    name: 'Image Vertical Right',
    icon: <LayoutImageVerticalRight /> 
  },
  { 
    id: 6, 
    type: 'text-double' as LayoutType, 
    name: 'Text Double',
    icon: <LayoutTextDouble /> 
  },
  { 
    id: 7, 
    type: 'text-triple' as LayoutType, 
    name: 'Text Triple',
    icon: <LayoutTextTriple /> 
  },
];

export const BlockLayoutModal: React.FC<BlockLayoutModalProps> = ({ 
  onSelect, 
  triggerText = "Add Block" 
}) => {
  const [open, setOpen] = useState(false);

  const handleSelect = (type: LayoutType) => {
    setOpen(false);
    onSelect(type);
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} className="gap-2">
        <Plus className="h-4 w-4" />
        {triggerText}
      </Button>
      
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl" style={{ backgroundColor: '#F6F1EB' }}>
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-gray-700 mb-4">
              Select a Layout
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-3 gap-4 p-4">
            {layoutOptions.map(({ id, type, name, icon }) => (
              <button
                key={id}
                className="group rounded-lg border border-gray-200 hover:border-[#B2B394] hover:shadow-md p-6 bg-white flex flex-col items-center justify-center transition-all duration-200 hover:bg-gradient-to-b hover:from-white hover:to-[#F1F1F1] min-h-[120px]"
                onClick={() => handleSelect(type)}
              >
                <div className="mb-3 group-hover:scale-105 transition-transform duration-200">
                  {icon}
                </div>
                <span className="text-sm text-gray-600 font-medium text-center">
                  {name}
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

// Layout icon components with clean line art style
function LayoutImageLeft() {
  return (
    <div className="w-16 h-12 flex bg-gray-50 rounded border">
      <div className="w-1/2 h-full border-r border-gray-300 bg-gray-200 rounded-l flex items-center justify-center">
        <div className="w-4 h-3 bg-gray-400 rounded"></div>
      </div>
      <div className="flex-1 h-full flex flex-col justify-center px-2 space-y-1">
        <div className="h-1 bg-gray-400 rounded w-full"></div>
        <div className="h-1 bg-gray-400 rounded w-3/4"></div>
        <div className="h-1 bg-gray-400 rounded w-1/2"></div>
      </div>
    </div>
  );
}

function LayoutImageRight() {
  return (
    <div className="w-16 h-12 flex bg-gray-50 rounded border">
      <div className="flex-1 h-full flex flex-col justify-center px-2 space-y-1">
        <div className="h-1 bg-gray-400 rounded w-full"></div>
        <div className="h-1 bg-gray-400 rounded w-3/4"></div>
        <div className="h-1 bg-gray-400 rounded w-1/2"></div>
      </div>
      <div className="w-1/2 h-full border-l border-gray-300 bg-gray-200 rounded-r flex items-center justify-center">
        <div className="w-4 h-3 bg-gray-400 rounded"></div>
      </div>
    </div>
  );
}

function LayoutImageVerticalLeft() {
  return (
    <div className="w-16 h-12 flex bg-gray-50 rounded border">
      <div className="w-1/3 h-full bg-gray-200 rounded-l flex items-center justify-center mr-1">
        <div className="w-3 h-6 bg-gray-400 rounded"></div>
      </div>
      <div className="flex-1 h-full flex flex-col justify-center space-y-1">
        <div className="h-1 bg-gray-400 rounded w-full"></div>
        <div className="h-1 bg-gray-400 rounded w-3/4"></div>
        <div className="h-1 bg-gray-400 rounded w-1/2"></div>
      </div>
    </div>
  );
}

function LayoutImageVerticalRight() {
  return (
    <div className="w-16 h-12 flex bg-gray-50 rounded border">
      <div className="flex-1 h-full flex flex-col justify-center space-y-1 mr-1">
        <div className="h-1 bg-gray-400 rounded w-full"></div>
        <div className="h-1 bg-gray-400 rounded w-3/4"></div>
        <div className="h-1 bg-gray-400 rounded w-1/2"></div>
      </div>
      <div className="w-1/3 h-full bg-gray-200 rounded-r flex items-center justify-center">
        <div className="w-3 h-6 bg-gray-400 rounded"></div>
      </div>
    </div>
  );
}

function LayoutTextDouble() {
  return (
    <div className="w-16 h-12 flex bg-gray-50 rounded border">
      <div className="w-1/2 h-full flex flex-col justify-center px-2 space-y-1 border-r border-gray-300">
        <div className="h-1 bg-gray-400 rounded w-full"></div>
        <div className="h-1 bg-gray-400 rounded w-3/4"></div>
        <div className="h-1 bg-gray-400 rounded w-1/2"></div>
      </div>
      <div className="w-1/2 h-full flex flex-col justify-center px-2 space-y-1">
        <div className="h-1 bg-gray-400 rounded w-full"></div>
        <div className="h-1 bg-gray-400 rounded w-3/4"></div>
        <div className="h-1 bg-gray-400 rounded w-1/2"></div>
      </div>
    </div>
  );
}

function LayoutTextTriple() {
  return (
    <div className="w-16 h-12 flex bg-gray-50 rounded border">
      <div className="w-1/3 h-full flex flex-col justify-center px-1 space-y-1 border-r border-gray-300">
        <div className="h-1 bg-gray-400 rounded w-full"></div>
        <div className="h-1 bg-gray-400 rounded w-3/4"></div>
      </div>
      <div className="w-1/3 h-full flex flex-col justify-center px-1 space-y-1 border-r border-gray-300">
        <div className="h-1 bg-gray-400 rounded w-full"></div>
        <div className="h-1 bg-gray-400 rounded w-3/4"></div>
      </div>
      <div className="w-1/3 h-full flex flex-col justify-center px-1 space-y-1">
        <div className="h-1 bg-gray-400 rounded w-full"></div>
        <div className="h-1 bg-gray-400 rounded w-3/4"></div>
      </div>
    </div>
  );
}
