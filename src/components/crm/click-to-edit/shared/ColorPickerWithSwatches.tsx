import React, { useMemo } from 'react';
import { Input } from '@/components/ui-legacy/input';
import { Label } from '@/components/ui-legacy/label';
import { useCompanyInfo } from '@/hooks/useCompanyInfo';
import { cn } from '@/lib/utils';

interface ColorPickerWithSwatchesProps {
  label: string;
  value: string;
  onChange: (color: string) => void;
  defaultValue?: string;
  id?: string;
  className?: string;
  labelClassName?: string;
  compact?: boolean;
}

export const ColorPickerWithSwatches: React.FC<ColorPickerWithSwatchesProps> = ({
  label,
  value,
  onChange,
  defaultValue = '#ffffff',
  id,
  className,
  labelClassName,
  compact = false
}) => {
  const { companyInfo } = useCompanyInfo();
  
  // Brand color swatches
  const brandColorSwatches = useMemo(() => [
    { label: 'Primary', value: companyInfo?.brandPrimaryColor || '#22c55e' },
    { label: 'Secondary', value: companyInfo?.brandSecondaryColor || '#1e40af' },
    { label: 'Accent', value: companyInfo?.brandAccentColor || '#f59e0b' },
    { label: 'Text', value: companyInfo?.brandTextColor || '#1f2937' },
    { label: 'White', value: '#ffffff' },
    { label: 'Black', value: '#000000' },
  ], [companyInfo?.brandPrimaryColor, companyInfo?.brandSecondaryColor, companyInfo?.brandAccentColor, companyInfo?.brandTextColor]);

  const currentValue = value || defaultValue;

  if (compact) {
    return (
      <div className={cn("grid grid-cols-[60px_40px_1fr] items-center gap-3", className)}>
        <Label className={cn("text-xs", labelClassName)}>{label}</Label>
        <Input
          type="color"
          id={id}
          value={currentValue}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 p-0.5 cursor-pointer rounded border"
        />
        <div className="flex gap-1.5 justify-end">
          {brandColorSwatches.map(swatch => (
            <button
              key={`${id}-${swatch.value}`}
              onClick={() => onChange(swatch.value)}
              className={cn(
                "w-6 h-6 rounded border-2 transition-all",
                currentValue?.toLowerCase() === swatch.value.toLowerCase()
                  ? "border-primary ring-2 ring-primary/20" 
                  : "border-gray-300 hover:border-gray-400"
              )}
              style={{ backgroundColor: swatch.value }}
              title={swatch.label}
              type="button"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          type="color"
          id={id}
          value={currentValue}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 p-1 cursor-pointer rounded border"
        />
        <div className="flex gap-1.5 flex-wrap">
          {brandColorSwatches.map(swatch => (
            <button
              key={`${id}-${swatch.value}`}
              onClick={() => onChange(swatch.value)}
              className={cn(
                "w-7 h-7 rounded border-2 transition-all",
                currentValue?.toLowerCase() === swatch.value.toLowerCase()
                  ? "border-primary ring-2 ring-primary/20" 
                  : "border-gray-300 hover:border-gray-400"
              )}
              style={{ backgroundColor: swatch.value }}
              title={swatch.label}
              type="button"
            />
          ))}
        </div>
      </div>
    </div>
  );
};
