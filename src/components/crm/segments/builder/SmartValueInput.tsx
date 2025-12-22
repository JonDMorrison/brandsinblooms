import * as React from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DollarSign, Percent, Calendar, Hash, Type, ToggleLeft } from 'lucide-react';
import type { ConditionOperator } from '@/types/segmentation';

interface ValueOption {
  label: string;
  value: string;
}

interface SmartValueInputProps {
  value: string | number;
  onChange: (value: string | number) => void;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array';
  operator: ConditionOperator;
  unit?: string;
  placeholder?: string;
  valueOptions?: ValueOption[];
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
  showSlider?: boolean;
  aiSuggestion?: number | string;
}

// Preset quick values for common use cases
const QUICK_VALUES: Record<string, { label: string; value: number }[]> = {
  days: [
    { label: '7 days', value: 7 },
    { label: '14 days', value: 14 },
    { label: '30 days', value: 30 },
    { label: '60 days', value: 60 },
    { label: '90 days', value: 90 },
  ],
  currency: [
    { label: '$50', value: 50 },
    { label: '$100', value: 100 },
    { label: '$250', value: 250 },
    { label: '$500', value: 500 },
    { label: '$1,000', value: 1000 },
  ],
  percentage: [
    { label: '10%', value: 10 },
    { label: '25%', value: 25 },
    { label: '50%', value: 50 },
    { label: '75%', value: 75 },
    { label: '90%', value: 90 },
  ],
  count: [
    { label: '1', value: 1 },
    { label: '3', value: 3 },
    { label: '5', value: 5 },
    { label: '10', value: 10 },
  ],
};

export const SmartValueInput: React.FC<SmartValueInputProps> = ({
  value,
  onChange,
  type,
  operator,
  unit,
  placeholder,
  valueOptions,
  min = 0,
  max = 10000,
  step = 1,
  disabled = false,
  className,
  showSlider = false,
  aiSuggestion,
}) => {
  // Handle operators that don't need value input
  const noValueNeeded = ['is_empty', 'is_not_empty', 'is_true', 'is_false'].includes(operator);
  
  if (noValueNeeded) {
    const displayText = operator === 'is_true' ? 'Yes' 
      : operator === 'is_false' ? 'No'
      : operator === 'is_empty' ? 'Empty'
      : 'Has value';
    
    return (
      <div className={cn(
        "flex items-center gap-2 h-11 px-4 rounded-lg",
        "bg-muted/50 border-2 border-dashed border-muted-foreground/20",
        className
      )}>
        <ToggleLeft className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground font-medium">{displayText}</span>
      </div>
    );
  }

  // Boolean type with switch
  if (type === 'boolean') {
    const boolValue = value === 'true' || value === 1 || String(value) === 'true';
    return (
      <div className={cn(
        "flex items-center gap-3 h-11 px-4 rounded-lg bg-muted/30",
        className
      )}>
        <Switch
          checked={boolValue}
          onCheckedChange={(checked) => onChange(checked ? 'true' : 'false')}
          disabled={disabled}
        />
        <Label className="text-sm font-medium">
          {boolValue ? 'Yes' : 'No'}
        </Label>
      </div>
    );
  }

  // Select options if available
  if (valueOptions && valueOptions.length > 0) {
    return (
      <select
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn(
          "w-full h-11 px-3 text-sm border-2 rounded-lg bg-background hover:border-primary/40 transition-colors",
          className
        )}
      >
        <option value="">{placeholder || "Select value"}</option>
        {valueOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  // Date type with days operators
  if (type === 'date' || ['days_ago_less_than', 'days_ago_greater_than'].includes(operator)) {
    const quickValues = QUICK_VALUES.days;
    
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="number"
              value={value}
              onChange={(e) => onChange(Number(e.target.value))}
              placeholder="Enter days"
              disabled={disabled}
              className="pl-10 pr-16 h-11 border-2 hover:border-primary/40 transition-colors"
              min={0}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              days
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {quickValues.map((qv) => (
            <button
              key={qv.value}
              type="button"
              onClick={() => onChange(qv.value)}
              disabled={disabled}
              className={cn(
                "px-2 py-0.5 text-xs rounded-full transition-all",
                "hover:bg-primary hover:text-primary-foreground",
                value === qv.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {qv.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Number type with currency
  if (type === 'number' && unit === '$') {
    const quickValues = QUICK_VALUES.currency;
    
    return (
      <div className={cn("space-y-2", className)}>
        <div className="relative">
          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="number"
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            placeholder={placeholder || "0.00"}
            disabled={disabled}
            className="pl-10 h-11 border-2 hover:border-primary/40 transition-colors"
            min={min}
            step={step}
          />
        </div>
        {showSlider && (
          <Slider
            value={[Number(value) || 0]}
            onValueChange={([val]) => onChange(val)}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            className="py-2"
          />
        )}
        <div className="flex flex-wrap gap-1">
          {quickValues.map((qv) => (
            <button
              key={qv.value}
              type="button"
              onClick={() => onChange(qv.value)}
              disabled={disabled}
              className={cn(
                "px-2 py-0.5 text-xs rounded-full transition-all",
                "hover:bg-primary hover:text-primary-foreground",
                value === qv.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {qv.label}
            </button>
          ))}
        </div>
        {aiSuggestion !== undefined && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="bg-violet-500/10 text-violet-600 border-violet-500/30">
              ✨ AI suggests
            </Badge>
            <span>${aiSuggestion}</span>
          </div>
        )}
      </div>
    );
  }

  // Number type with percentage
  if (type === 'number' && unit === '%') {
    const quickValues = QUICK_VALUES.percentage;
    
    return (
      <div className={cn("space-y-2", className)}>
        <div className="relative">
          <Input
            type="number"
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            placeholder={placeholder || "0"}
            disabled={disabled}
            className="pr-10 h-11 border-2 hover:border-primary/40 transition-colors"
            min={0}
            max={100}
            step={1}
          />
          <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>
        <Slider
          value={[Number(value) || 0]}
          onValueChange={([val]) => onChange(val)}
          min={0}
          max={100}
          step={1}
          disabled={disabled}
          className="py-2"
        />
        <div className="flex flex-wrap gap-1">
          {quickValues.map((qv) => (
            <button
              key={qv.value}
              type="button"
              onClick={() => onChange(qv.value)}
              disabled={disabled}
              className={cn(
                "px-2 py-0.5 text-xs rounded-full transition-all",
                "hover:bg-primary hover:text-primary-foreground",
                value === qv.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {qv.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Default number type
  if (type === 'number') {
    const quickValues = QUICK_VALUES.count;
    
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="number"
              value={value}
              onChange={(e) => onChange(Number(e.target.value))}
              placeholder={placeholder || "Enter value"}
              disabled={disabled}
              className={cn(
                "pl-10 h-11 border-2 hover:border-primary/40 transition-colors",
                unit && "pr-16"
              )}
              min={min}
              step={step}
            />
            {unit && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {unit}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {quickValues.map((qv) => (
            <button
              key={qv.value}
              type="button"
              onClick={() => onChange(qv.value)}
              disabled={disabled}
              className={cn(
                "px-2 py-0.5 text-xs rounded-full transition-all",
                "hover:bg-primary hover:text-primary-foreground",
                value === qv.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {qv.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Default text input
  return (
    <div className="relative">
      <Type className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "Enter value"}
        disabled={disabled}
        className={cn(
          "pl-10 h-11 border-2 hover:border-primary/40 transition-colors",
          className
        )}
      />
    </div>
  );
};
