import React, { useEffect, useCallback } from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { useOverlayManager } from '@/providers/OverlayManager';

export interface SafeSelectProps {
  children: React.ReactNode;
  value?: string;
  onValueChange?: (value: string) => void;
  defaultValue?: string;
  disabled?: boolean;
  name?: string;
  autoComplete?: string;
  dir?: 'ltr' | 'rtl';
  required?: boolean;
  preventAutoClose?: boolean;
  context?: string;
}

export const SafeSelect: React.FC<SafeSelectProps> = ({
  children,
  value,
  onValueChange,
  defaultValue,
  disabled,
  name,
  autoComplete,
  dir,
  required,
  preventAutoClose = false,
  context = 'select',
  ...props
}) => {
  const { openOverlay, closeOverlay } = useOverlayManager();
  const [isOpen, setIsOpen] = React.useState(false);

  const handleOpenChange = useCallback((open: boolean) => {
    // Prevent auto-close for single option dropdowns if preventAutoClose is true
    if (!open && preventAutoClose) {
      return;
    }

    setIsOpen(open);
    
    if (open) {
      openOverlay(context);
      console.log(`[SafeSelect] Opened: ${context}`);
    } else {
      closeOverlay(context);
      console.log(`[SafeSelect] Closed: ${context}`);
    }
  }, [openOverlay, closeOverlay, context, preventAutoClose]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isOpen) {
        closeOverlay(context);
      }
    };
  }, [isOpen, closeOverlay, context]);

  return (
    <SelectPrimitive.Root
      value={value}
      onValueChange={onValueChange}
      defaultValue={defaultValue}
      onOpenChange={handleOpenChange}
      disabled={disabled}
      name={name}
      autoComplete={autoComplete}
      dir={dir}
      required={required}
      {...props}
    >
      {children}
    </SelectPrimitive.Root>
  );
};

// Re-export other Select components for convenience
export const SafeSelectGroup = SelectPrimitive.Group;
export const SafeSelectValue = SelectPrimitive.Value;