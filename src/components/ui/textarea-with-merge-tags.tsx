import React, { useRef, useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { MergeTagPicker } from '@/components/shared/MergeTagPicker';
import type { MergeTagCategory } from '@/lib/mergeTagDefinitions';
import { cn } from '@/lib/utils';

interface TextareaWithMergeTagsProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  excludeCategories?: MergeTagCategory[];
  showMergeTags?: boolean;
  className?: string;
  textareaClassName?: string;
}

export const TextareaWithMergeTags: React.FC<TextareaWithMergeTagsProps> = ({
  value,
  onChange,
  excludeCategories = [],
  showMergeTags = true,
  className,
  textareaClassName,
  ...textareaProps
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
        className={cn(textareaClassName)}
        {...textareaProps}
      />
    </div>
  );
};

export default TextareaWithMergeTags;
