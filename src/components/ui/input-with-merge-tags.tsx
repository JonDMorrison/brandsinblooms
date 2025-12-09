import React, { useRef } from 'react';
import { Input } from '@/components/ui/input';
import { MergeTagPicker } from '@/components/shared/MergeTagPicker';
import type { MergeTagCategory } from '@/lib/mergeTagDefinitions';
import { cn } from '@/lib/utils';

interface InputWithMergeTagsProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  excludeCategories?: MergeTagCategory[];
  showMergeTags?: boolean;
  className?: string;
  inputClassName?: string;
}

export const InputWithMergeTags: React.FC<InputWithMergeTagsProps> = ({
  value,
  onChange,
  excludeCategories = [],
  showMergeTags = true,
  className,
  inputClassName,
  ...inputProps
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleInsertTag = (tag: string) => {
    const input = inputRef.current;
    if (!input) {
      // Fallback: append to end
      onChange(value + tag);
      return;
    }

    const start = input.selectionStart ?? value.length;
    const end = input.selectionEnd ?? value.length;
    
    // Insert tag at cursor position
    const newValue = value.slice(0, start) + tag + value.slice(end);
    onChange(newValue);

    // Restore focus and set cursor after inserted tag
    setTimeout(() => {
      input.focus();
      const newCursorPos = start + tag.length;
      input.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  return (
    <div className={cn("relative flex items-center gap-1", className)}>
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn("flex-1 pr-10", inputClassName)}
        {...inputProps}
      />
      {showMergeTags && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2">
          <MergeTagPicker
            variant="icon"
            size="sm"
            excludeCategories={excludeCategories}
            onSelectTag={handleInsertTag}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
          />
        </div>
      )}
    </div>
  );
};

export default InputWithMergeTags;
