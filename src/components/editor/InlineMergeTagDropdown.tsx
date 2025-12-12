/**
 * Inline Merge Tag Dropdown
 * 
 * A simple, portal-free dropdown for inserting merge tags.
 * No portals, no global event listeners, no complexity.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import { normalizeMergeTags } from '@/utils/mergeTagSanitizer';

interface InlineMergeTagDropdownProps {
  insertText: (text: string) => void;
}

const MERGE_TAGS = [
  { label: 'First name', value: '{{ first_name | default: "Friend" }}' },
  { label: 'Last name', value: '{{ last_name | default: "" }}' },
  { label: 'Email', value: '{{ email | default: "" }}' },
  { label: 'Phone', value: '{{ phone | default: "" }}' },
  { label: 'Company name', value: '{{ company_name | default: "Our Team" }}' },
  { label: 'Lifetime value', value: '{{ lifetime_value | default: "0" }}' },
  { label: 'Last purchase date', value: '{{ last_purchase_date | default: "" }}' },
  { label: 'Total spent', value: '{{ total_spent | default: "0" }}' },
];

export function InlineMergeTagDropdown({ insertText }: InlineMergeTagDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const handleTagSelect = (tag: typeof MERGE_TAGS[0]) => {
    // Normalize the tag to ensure proper syntax
    const normalizedTag = normalizeMergeTags(tag.value);
    insertText(normalizedTag);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1 text-xs"
        onMouseDown={(e) => e.preventDefault()} // Prevent editor blur
        onClick={() => setOpen((prev) => !prev)}
      >
        <Sparkles className="h-3 w-3" />
        Personalize
      </Button>

      {open && (
        <div
          data-merge-tag-dropdown="true"
          className="absolute left-0 top-full z-50 mt-1 w-56 rounded-md border border-border bg-popover p-1 shadow-md"
        >
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
            Insert merge tag
          </div>
          <div className="max-h-[200px] overflow-y-auto">
            {MERGE_TAGS.map((tag) => (
              <button
                key={tag.value}
                type="button"
                className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none"
                onMouseDown={(e) => e.preventDefault()} // Prevent editor blur
                onClick={() => handleTagSelect(tag)}
              >
                <span>{tag.label}</span>
                <code className="text-[10px] text-muted-foreground">
                  {'{{ ... }}'}
                </code>
              </button>
            ))}
          </div>
          <div className="border-t border-border mt-1 pt-1 px-2 py-1">
            <p className="text-[10px] text-muted-foreground text-center">
              Tags include default fallbacks
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default InlineMergeTagDropdown;
