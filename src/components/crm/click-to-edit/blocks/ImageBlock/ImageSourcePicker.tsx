import React from 'react';
import { Images, Upload, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageSourcePickerProps {
  onSelectCollection: () => void;
  onUpload: () => void;
  onGenerateAI: () => void;
}

interface SourceOption {
  id: string;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  onClick: () => void;
}

export const ImageSourcePicker: React.FC<ImageSourcePickerProps> = ({
  onSelectCollection,
  onUpload,
  onGenerateAI
}) => {
  const options: SourceOption[] = [
    {
      id: 'collection',
      label: 'Choose From',
      sublabel: 'Our Collection',
      icon: <Images className="h-8 w-8" />,
      onClick: onSelectCollection
    },
    {
      id: 'upload',
      label: 'Upload',
      sublabel: 'Your Own',
      icon: <Upload className="h-8 w-8" />,
      onClick: onUpload
    },
    {
      id: 'ai',
      label: 'Generate',
      sublabel: 'With AI',
      icon: <Sparkles className="h-8 w-8" />,
      onClick: onGenerateAI
    }
  ];

  return (
    <div className="flex flex-col items-center justify-center py-8 px-4">
      <div className="flex gap-4 justify-center">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={option.onClick}
            className={cn(
              "flex flex-col items-center justify-center",
              "w-28 h-28 rounded-lg",
              "bg-gray-100 border-2 border-dashed border-gray-300",
              "hover:bg-gray-50 hover:border-gray-400 hover:shadow-sm",
              "transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            )}
          >
            <div className="text-gray-500 mb-2">
              {option.icon}
            </div>
            <span className="text-xs font-medium text-gray-700 text-center leading-tight">
              {option.label}
            </span>
            <span className="text-xs font-medium text-gray-700 text-center leading-tight">
              {option.sublabel}
            </span>
          </button>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Click an option to get started
      </p>
    </div>
  );
};
