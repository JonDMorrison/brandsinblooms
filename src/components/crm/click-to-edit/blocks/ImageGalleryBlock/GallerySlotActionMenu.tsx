import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui-legacy/button';
import { Image, RefreshCw, Sparkles, Settings, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GallerySlotActionMenuProps {
  onAutoPickImage: () => void;
  onOpenMediaSelector: () => void;
  onOpenAIDialog: () => void;
  disabled?: boolean;
  isGenerating?: boolean;
}

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

const MenuItem: React.FC<MenuItemProps> = ({ 
  icon, 
  label, 
  onClick, 
  disabled = false 
}) => (
  <button
    onClick={(e) => {
      e.stopPropagation();
      if (!disabled) onClick();
    }}
    disabled={disabled}
    className={cn(
      "flex items-center gap-2 w-full px-3 py-2 text-left text-sm",
      "hover:bg-accent transition-colors rounded-md",
      "text-gray-700",
      disabled && "opacity-50 cursor-not-allowed"
    )}
  >
    <span className="w-4 h-4 flex items-center justify-center text-gray-600">
      {React.cloneElement(icon as React.ReactElement, { className: 'h-4 w-4' })}
    </span>
    <span className="font-medium">{label}</span>
  </button>
);

export const GallerySlotActionMenu: React.FC<GallerySlotActionMenuProps> = ({
  onAutoPickImage,
  onOpenMediaSelector,
  onOpenAIDialog,
  disabled = false,
  isGenerating = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Click outside handling
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        menuRef.current && !menuRef.current.contains(target) &&
        triggerRef.current && !triggerRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleItemClick = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        disabled={disabled || isGenerating}
        className={cn(
          "flex items-center gap-1 px-2 py-1 rounded-md",
          "border border-gray-200 shadow-sm",
          "transition-colors text-xs font-medium text-muted-foreground",
          isOpen ? "bg-gray-100" : "bg-white hover:bg-accent",
          (disabled || isGenerating) && "opacity-50 cursor-not-allowed"
        )}
      >
        <Settings className="h-3 w-3" />
        <ChevronDown className={cn(
          "h-2.5 w-2.5 transition-transform duration-200",
          isOpen && "rotate-180"
        )} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          ref={menuRef}
          className="absolute top-full right-0 mt-1 z-[9999] w-[160px] bg-white rounded-lg border border-gray-200 shadow-lg p-1"
          style={{
            animation: 'toolsSlideDownFadeIn 0.15s ease-out'
          }}
        >
          <MenuItem
            icon={<RefreshCw className="h-4 w-4" />}
            label="Auto Pick"
            onClick={() => handleItemClick(onAutoPickImage)}
            disabled={disabled || isGenerating}
          />
          <MenuItem
            icon={<Image className="h-4 w-4" />}
            label="Choose Image"
            onClick={() => handleItemClick(onOpenMediaSelector)}
            disabled={disabled || isGenerating}
          />
          <MenuItem
            icon={<Sparkles className="h-4 w-4" />}
            label="AI Assistant"
            onClick={() => handleItemClick(onOpenAIDialog)}
            disabled={disabled || isGenerating}
          />
        </div>
      )}
    </div>
  );
};
