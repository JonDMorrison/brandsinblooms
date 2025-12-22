import * as React from 'react';
import { Check, ChevronDown, Search, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';

export interface ComboboxOption {
  value: string;
  label: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  category?: string;
  unit?: string;
  aiRecommended?: boolean;
}

export interface ComboboxGroup {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  color?: string;
  options: ComboboxOption[];
}

interface AutomationComboboxProps {
  value: string;
  onChange: (value: string) => void;
  groups: ComboboxGroup[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  showDescriptions?: boolean;
  showIcons?: boolean;
  className?: string;
  disabled?: boolean;
}

// Category color mapping for visual distinction
const CATEGORY_COLORS: Record<string, string> = {
  identity: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
  email_engagement: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
  sms_engagement: 'from-green-500/20 to-green-600/10 border-green-500/30',
  cross_channel: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30',
  purchase: 'from-amber-500/20 to-amber-600/10 border-amber-500/30',
  loyalty: 'from-pink-500/20 to-pink-600/10 border-pink-500/30',
  lifecycle: 'from-teal-500/20 to-teal-600/10 border-teal-500/30',
  risk: 'from-red-500/20 to-red-600/10 border-red-500/30',
};

const CATEGORY_ICONS: Record<string, string> = {
  identity: '👤',
  email_engagement: '📧',
  sms_engagement: '💬',
  cross_channel: '🔗',
  purchase: '💰',
  loyalty: '⭐',
  lifecycle: '📈',
  risk: '⚠️',
};

export const AutomationCombobox: React.FC<AutomationComboboxProps> = ({
  value,
  onChange,
  groups,
  placeholder = 'Select option...',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No results found.',
  showDescriptions = true,
  showIcons = true,
  className,
  disabled = false,
}) => {
  const [open, setOpen] = React.useState(false);

  // Find selected option across all groups
  const selectedOption = React.useMemo(() => {
    for (const group of groups) {
      const found = group.options.find(opt => opt.value === value);
      if (found) return { ...found, groupId: group.id, groupLabel: group.label };
    }
    return null;
  }, [groups, value]);

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between h-auto min-h-[44px] py-2 px-3",
            "bg-background hover:bg-accent/50 transition-all duration-200",
            "border-2 hover:border-primary/40",
            open && "border-primary ring-2 ring-primary/20",
            className
          )}
        >
          <div className="flex items-center gap-2 text-left flex-1 min-w-0">
            {selectedOption ? (
              <>
                {showIcons && selectedOption.groupId && (
                  <span className="text-base flex-shrink-0">
                    {CATEGORY_ICONS[selectedOption.groupId] || '📊'}
                  </span>
                )}
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="font-medium text-sm truncate">
                    {selectedOption.label}
                  </span>
                  {showDescriptions && selectedOption.description && (
                    <span className="text-xs text-muted-foreground truncate">
                      {selectedOption.description}
                    </span>
                  )}
                </div>
                {selectedOption.unit && (
                  <Badge variant="outline" className="text-xs ml-1 flex-shrink-0">
                    {selectedOption.unit}
                  </Badge>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronDown className={cn(
            "h-4 w-4 shrink-0 opacity-50 transition-transform duration-200",
            open && "rotate-180"
          )} />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[400px] p-0 shadow-xl border-2"
        align="start"
        sideOffset={8}
      >
        <Command className="bg-popover">
          <div className="flex items-center border-b px-3">
            <Search className="h-4 w-4 shrink-0 opacity-50 mr-2" />
            <CommandInput 
              placeholder={searchPlaceholder} 
              className="h-11 border-0 focus:ring-0"
            />
          </div>
          <CommandList className="max-h-[350px]">
            <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </CommandEmpty>
            {groups.map((group) => (
              <CommandGroup 
                key={group.id} 
                heading={
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground py-1">
                    <span>{CATEGORY_ICONS[group.id] || '📊'}</span>
                    <span>{group.label}</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                      {group.options.length}
                    </Badge>
                  </div>
                }
                className="px-1"
              >
                {group.options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={`${option.label} ${option.description || ''}`}
                    onSelect={() => handleSelect(option.value)}
                    className={cn(
                      "cursor-pointer py-2.5 px-3 mx-1 my-0.5 rounded-lg",
                      "transition-all duration-150",
                      "data-[selected=true]:bg-gradient-to-r",
                      CATEGORY_COLORS[group.id] || 'data-[selected=true]:bg-accent',
                      value === option.value && "bg-gradient-to-r border",
                      value === option.value && CATEGORY_COLORS[group.id]
                    )}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex flex-col flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {option.label}
                          </span>
                          {option.aiRecommended && (
                            <Badge className="bg-gradient-to-r from-violet-500 to-purple-500 text-white text-[10px] px-1.5 py-0 h-4 gap-0.5">
                              <Sparkles className="h-2.5 w-2.5" />
                              AI
                            </Badge>
                          )}
                          {option.unit && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                              {option.unit}
                            </Badge>
                          )}
                        </div>
                        {showDescriptions && option.description && (
                          <span className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {option.description}
                          </span>
                        )}
                      </div>
                      <Check
                        className={cn(
                          "h-4 w-4 shrink-0 transition-opacity",
                          value === option.value ? "opacity-100 text-primary" : "opacity-0"
                        )}
                      />
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
