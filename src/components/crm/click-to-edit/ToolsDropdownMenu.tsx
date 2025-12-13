import React, { useState, useRef, useEffect } from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { EditMode } from '@/hooks/useBlockEditMode';
import { cn } from '@/lib/utils';
import { 
  Settings, 
  ChevronDown, 
  Edit, 
  Image, 
  Sparkles, 
  Grid3X3, 
  Layers, 
  Zap, 
  Trash2 
} from 'lucide-react';

interface ToolsDropdownMenuProps {
  block: ContentBlock;
  editMode: EditMode;
  onModeChange: (mode: EditMode) => void;
  onAutoPickImage: () => void;
  onOpenAIImageDialog?: () => void;
  onOpenGridConfig?: () => void;
  onOpenOverlayDialog?: () => void;
  onStrengthenContent?: () => void;
  onDelete: () => void;
  disabled?: boolean;
}

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'destructive';
  disabled?: boolean;
  active?: boolean;
}

const MenuItem: React.FC<MenuItemProps> = ({ 
  icon, 
  label, 
  onClick, 
  variant = 'default', 
  disabled = false, 
  active = false 
}) => (
  <button
    onClick={(e) => {
      e.stopPropagation();
      if (!disabled) onClick();
    }}
    disabled={disabled}
    className={cn(
      "flex items-center gap-3 w-full px-3 py-2.5 text-left text-sm",
      "hover:bg-accent transition-colors rounded-lg",
      variant === 'destructive' && "text-destructive hover:bg-destructive/10",
      active && "bg-accent",
      disabled && "opacity-50 cursor-not-allowed"
    )}
  >
    <span className="w-4 h-4 flex items-center justify-center text-muted-foreground">
      {icon}
    </span>
    <span className="font-medium">{label}</span>
  </button>
);

export const ToolsDropdownMenu: React.FC<ToolsDropdownMenuProps> = ({
  block,
  editMode,
  onModeChange,
  onAutoPickImage,
  onOpenAIImageDialog,
  onOpenGridConfig,
  onOpenOverlayDialog,
  onStrengthenContent,
  onDelete,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Determine which actions to show based on block type
  const showTextEdit = block.type !== 'image' || block.content || block.title;
  const showImageActions = ['image', 'image-text', 'newsletter-header', 'header', 'graphic-hero', 'email-safe-hero', 'background-image-section'].includes(block.type);
  const showGridConfig = block.type === 'image-gallery';
  const showOverlaySettings = block.type === 'newsletter-header' && (block.imageUrl || block.backgroundImageUrl);

  // Calculate dropdown position
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
  }, [isOpen]);

  // Click outside and escape key handling
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

  // Inject animation CSS
  useEffect(() => {
    const styleId = 'tools-dropdown-animation';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes toolsSlideDownFadeIn {
        from {
          opacity: 0;
          transform: translateY(-4px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `;
    document.head.appendChild(style);

    return () => {
      const existingStyle = document.getElementById(styleId);
      if (existingStyle) {
        document.head.removeChild(existingStyle);
      }
    };
  }, []);

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
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md",
          "bg-background border border-border shadow-sm",
          "hover:bg-accent transition-colors",
          "text-sm font-medium text-muted-foreground",
          isOpen && "bg-accent"
        )}
      >
        <Settings className="h-3.5 w-3.5" />
        <span>Tools</span>
        <ChevronDown className={cn(
          "h-3 w-3 transition-transform duration-200",
          isOpen && "rotate-180"
        )} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          ref={menuRef}
          className="fixed z-[9999] min-w-[180px] bg-background rounded-xl border border-border shadow-lg p-1.5"
          style={{
            top: position.top,
            right: position.right,
            animation: 'toolsSlideDownFadeIn 0.15s ease-out'
          }}
        >
          {/* Edit text */}
          {showTextEdit && (
            <MenuItem
              icon={<Edit className="h-4 w-4" />}
              label="Edit text"
              onClick={() => handleItemClick(() => onModeChange('text'))}
              active={editMode === 'text'}
            />
          )}

          {/* Image actions */}
          {showImageActions && (
            <>
              <MenuItem
                icon={<Image className="h-4 w-4" />}
                label="Edit image"
                onClick={() => handleItemClick(() => onModeChange('image'))}
                active={editMode === 'image'}
              />
              <MenuItem
                icon={<Sparkles className="h-4 w-4" />}
                label="AI generate"
                onClick={() => handleItemClick(onAutoPickImage)}
                disabled={disabled}
              />
              {onOpenAIImageDialog && (
                <MenuItem
                  icon={<Sparkles className="h-4 w-4" />}
                  label="AI assistant"
                  onClick={() => handleItemClick(onOpenAIImageDialog)}
                  disabled={disabled}
                />
              )}
            </>
          )}

          {/* Conditional actions divider */}
          {(showGridConfig || showOverlaySettings || onStrengthenContent) && (
            <div className="my-1.5 h-px bg-border" />
          )}

          {/* Grid layout (gallery blocks only) */}
          {showGridConfig && onOpenGridConfig && (
            <MenuItem
              icon={<Grid3X3 className="h-4 w-4" />}
              label="Grid layout"
              onClick={() => handleItemClick(onOpenGridConfig)}
            />
          )}

          {/* Overlay settings (newsletter-header blocks only) */}
          {showOverlaySettings && onOpenOverlayDialog && (
            <MenuItem
              icon={<Layers className="h-4 w-4" />}
              label="Overlay settings"
              onClick={() => handleItemClick(onOpenOverlayDialog)}
            />
          )}

          {/* Strengthen content */}
          {onStrengthenContent && (
            <MenuItem
              icon={<Zap className="h-4 w-4" />}
              label="Strengthen"
              onClick={() => handleItemClick(onStrengthenContent)}
            />
          )}

          {/* Delete divider */}
          <div className="my-1.5 h-px bg-border" />

          {/* Delete */}
          <MenuItem
            icon={<Trash2 className="h-4 w-4" />}
            label="Delete"
            onClick={() => handleItemClick(onDelete)}
            variant="destructive"
          />
        </div>
      )}
    </div>
  );
};
