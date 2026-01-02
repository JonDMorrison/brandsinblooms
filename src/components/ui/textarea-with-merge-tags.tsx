import React, { useRef, useCallback, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { MergeTagPicker } from '@/components/shared/MergeTagPicker';
import { MergeTagQuickBar } from '@/components/shared/MergeTagQuickBar';
import { MergeTagCommandPalette } from '@/components/shared/MergeTagCommandPalette';
import type { MergeTagCategory } from '@/lib/mergeTagDefinitions';
import { cn } from '@/lib/utils';

interface TextareaWithMergeTagsProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  excludeCategories?: MergeTagCategory[];
  showMergeTags?: boolean;
  showQuickBar?: boolean;
  className?: string;
  textareaClassName?: string;
}

export const TextareaWithMergeTags: React.FC<TextareaWithMergeTagsProps> = ({
  value,
  onChange,
  excludeCategories = [],
  showMergeTags = true,
  showQuickBar = true,
  className,
  textareaClassName,
  ...textareaProps
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const handleInsertTag = useCallback((tag: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      // Fallback: append to end
      onChange(value + tag);
      return;
    }

    const start = textarea.selectionStart ?? value.length;
    const end = textarea.selectionEnd ?? value.length;
    
    // Insert tag at cursor position
    const newValue = value.slice(0, start) + tag + value.slice(end);
    onChange(newValue);

    // Restore focus and set cursor after inserted tag
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + tag.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }, [value, onChange]);

  // Handle keyboard shortcut for command palette
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Ctrl/Cmd + K opens command palette
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      setPaletteOpen(true);
    }
  }, []);

  return (
    <div className={cn("relative w-full", className)}>
      {showMergeTags && (
        <div className="flex justify-end mb-1">
          <MergeTagPicker
            variant="button"
            size="sm"
            excludeCategories={excludeCategories}
            onSelectTag={handleInsertTag}
          />
        </div>
      )}
      
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        className={cn(textareaClassName)}
        {...textareaProps}
      />

      {showMergeTags && showQuickBar && (
        <div className="mt-2">
          <MergeTagQuickBar
            onSelectTag={handleInsertTag}
            onOpenPalette={() => setPaletteOpen(true)}
            excludeCategories={excludeCategories}
          />
        </div>
      )}

      {/* Command Palette */}
      <MergeTagCommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onSelectTag={handleInsertTag}
        excludeCategories={excludeCategories}
      />
    </div>
  );
};

export default TextareaWithMergeTags;
