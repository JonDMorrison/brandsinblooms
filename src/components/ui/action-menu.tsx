import React, { useState } from 'react';
import { LucideIcon, MoreHorizontal, MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuShortcut,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Types
export interface ActionMenuItem {
  label: string;
  icon?: LucideIcon;
  onClick?: () => void;
  variant?: 'default' | 'destructive';
  disabled?: boolean;
  shortcut?: string;
  requiresConfirmation?: boolean;
  confirmationTitle?: string;
  confirmationDescription?: string;
  confirmationActionLabel?: string;
}

export interface ActionMenuSeparator {
  type: 'separator';
}

export interface ActionMenuGroup {
  label?: string;
  items: (ActionMenuItem | ActionMenuSeparator)[];
}

export type ActionMenuItemType = ActionMenuItem | ActionMenuSeparator | ActionMenuGroup;

export interface ActionMenuProps {
  items: ActionMenuItemType[];
  trigger?: 'horizontal' | 'vertical' | React.ReactNode;
  triggerClassName?: string;
  contentClassName?: string;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

// Type guards
const isSeparator = (item: ActionMenuItemType): item is ActionMenuSeparator => {
  return 'type' in item && item.type === 'separator';
};

const isGroup = (item: ActionMenuItemType): item is ActionMenuGroup => {
  return 'items' in item && Array.isArray(item.items);
};

const isActionItem = (item: ActionMenuItemType): item is ActionMenuItem => {
  return 'label' in item && !('items' in item);
};

// Confirmation state interface
interface ConfirmationState {
  isOpen: boolean;
  title: string;
  description: string;
  actionLabel: string;
  onConfirm: () => void;
}

export const ActionMenu: React.FC<ActionMenuProps> = ({
  items,
  trigger = 'horizontal',
  triggerClassName,
  contentClassName,
  align = 'end',
  side,
  disabled = false,
  open,
  onOpenChange,
}) => {
  const [confirmationState, setConfirmationState] = useState<ConfirmationState>({
    isOpen: false,
    title: '',
    description: '',
    actionLabel: 'Confirm',
    onConfirm: () => {},
  });

  const handleItemClick = (item: ActionMenuItem) => {
    if (item.requiresConfirmation) {
      setConfirmationState({
        isOpen: true,
        title: item.confirmationTitle || 'Are you sure?',
        description: item.confirmationDescription || 'This action cannot be undone.',
        actionLabel: item.confirmationActionLabel || 'Confirm',
        onConfirm: () => {
          item.onClick?.();
          setConfirmationState(prev => ({ ...prev, isOpen: false }));
        },
      });
    } else {
      item.onClick?.();
    }
  };

  const renderTrigger = () => {
    if (typeof trigger === 'string') {
      const IconComponent = trigger === 'vertical' ? MoreVertical : MoreHorizontal;
      return (
        <Button
          variant="ghost"
          size="sm"
          className={cn('h-8 w-8 p-0', triggerClassName)}
          disabled={disabled}
        >
          <IconComponent className="h-4 w-4" />
          <span className="sr-only">Open menu</span>
        </Button>
      );
    }
    return trigger;
  };

  const renderMenuItem = (item: ActionMenuItem, index: number) => {
    const Icon = item.icon;
    const isDestructive = item.variant === 'destructive';

    return (
      <DropdownMenuItem
        key={`item-${index}-${item.label}`}
        onClick={() => handleItemClick(item)}
        disabled={item.disabled}
        className={cn(
          isDestructive && 'text-destructive focus:text-destructive focus:bg-destructive/10'
        )}
      >
        {Icon && <Icon className="h-4 w-4 mr-2" />}
        {item.label}
        {item.shortcut && (
          <DropdownMenuShortcut>{item.shortcut}</DropdownMenuShortcut>
        )}
      </DropdownMenuItem>
    );
  };

  const renderItems = (itemList: ActionMenuItemType[]) => {
    return itemList.map((item, index) => {
      if (isSeparator(item)) {
        return <DropdownMenuSeparator key={`separator-${index}`} />;
      }

      if (isGroup(item)) {
        return (
          <React.Fragment key={`group-${index}`}>
            {index > 0 && <DropdownMenuSeparator />}
            {item.label && (
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                {item.label}
              </DropdownMenuLabel>
            )}
            {item.items.map((groupItem, groupIndex) => {
              if (isSeparator(groupItem)) {
                return <DropdownMenuSeparator key={`group-${index}-separator-${groupIndex}`} />;
              }
              if (isActionItem(groupItem)) {
                return renderMenuItem(groupItem, groupIndex);
              }
              return null;
            })}
          </React.Fragment>
        );
      }

      if (isActionItem(item)) {
        return renderMenuItem(item, index);
      }

      return null;
    });
  };

  return (
    <>
      <DropdownMenu open={open} onOpenChange={onOpenChange}>
        <DropdownMenuTrigger asChild>
          {renderTrigger()}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={align}
          side={side}
          className={cn('z-[1000020] bg-popover', contentClassName)}
        >
          {renderItems(items)}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={confirmationState.isOpen}
        onOpenChange={(isOpen) =>
          setConfirmationState(prev => ({ ...prev, isOpen }))
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmationState.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmationState.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmationState.onConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {confirmationState.actionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ActionMenu;
