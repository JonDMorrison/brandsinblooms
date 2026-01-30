import React, { useState, useMemo, useEffect, useRef } from 'react';
import { FormField, FormSettings, FormCompliance, DEFAULT_FORM_SETTINGS, DEFAULT_FORM_COMPLIANCE } from '@/types/formBuilder';
import { FormPreviewRenderer } from './FormPreviewRenderer';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { 
  Monitor, 
  Smartphone, 
  RefreshCw, 
  AlertTriangle,
  Eye,
  EyeOff,
  Palette
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PreviewPanelProps {
  fields: FormField[];
  settings: FormSettings | null;
  compliance: FormCompliance | null;
  className?: string;
}

type DeviceWidth = 'desktop' | 'mobile';
type BackgroundColor = 'white' | 'gray';

export function PreviewPanel({
  fields,
  settings,
  compliance,
  className,
}: PreviewPanelProps) {
  const [deviceWidth, setDeviceWidth] = useState<DeviceWidth>('desktop');
  const [background, setBackground] = useState<BackgroundColor>('white');
  const [showBranding, setShowBranding] = useState(true);
  const [previewKey, setPreviewKey] = useState(0);

  // Debounce config changes to avoid jitter
  const [debouncedFields, setDebouncedFields] = useState(fields);
  const [debouncedSettings, setDebouncedSettings] = useState(settings);
  const [debouncedCompliance, setDebouncedCompliance] = useState(compliance);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      setDebouncedFields(fields);
      setDebouncedSettings(settings);
      setDebouncedCompliance(compliance);
    }, 200);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [fields, settings, compliance]);

  const resolvedSettings = useMemo(() => {
    const base = debouncedSettings || DEFAULT_FORM_SETTINGS;
    // Override show_branding with local toggle for preview
    return {
      ...base,
      show_branding: showBranding && base.show_branding,
    };
  }, [debouncedSettings, showBranding]);

  const resolvedCompliance = debouncedCompliance || DEFAULT_FORM_COMPLIANCE;

  const handleReset = () => {
    setPreviewKey((k) => k + 1);
  };

  // Validation warnings
  const warnings = useMemo(() => {
    const list: string[] = [];
    if (debouncedFields.length === 0) {
      list.push('No fields added yet');
    }
    const emailField = debouncedFields.find((f) => f.type === 'email');
    if (!emailField) {
      list.push('No email field (recommended)');
    }
    return list;
  }, [debouncedFields]);

  const previewWidth = deviceWidth === 'desktop' ? '480px' : '360px';

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Preview Controls */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b mb-4">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Preview</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Device Width Toggle */}
          <ToggleGroup
            type="single"
            value={deviceWidth}
            onValueChange={(v) => v && setDeviceWidth(v as DeviceWidth)}
            size="sm"
          >
            <ToggleGroupItem value="desktop" aria-label="Desktop preview">
              <Monitor className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="mobile" aria-label="Mobile preview">
              <Smartphone className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>

          {/* Background Toggle */}
          <ToggleGroup
            type="single"
            value={background}
            onValueChange={(v) => v && setBackground(v as BackgroundColor)}
            size="sm"
          >
            <ToggleGroupItem value="white" aria-label="White background">
              <div className="w-4 h-4 rounded border border-border bg-white" />
            </ToggleGroupItem>
            <ToggleGroupItem value="gray" aria-label="Gray background">
              <div className="w-4 h-4 rounded border border-border bg-muted" />
            </ToggleGroupItem>
          </ToggleGroup>

          {/* Reset Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-8 w-8 p-0"
            title="Reset preview"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Warnings Banner */}
      {warnings.length > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            <span className="font-medium">Preview warnings:</span>
            <ul className="mt-1 list-disc list-inside">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Preview Container */}
      <div
        className={cn(
          'flex-1 overflow-auto rounded-lg border transition-colors',
          background === 'white' ? 'bg-white' : 'bg-muted/50'
        )}
      >
        <div
          className="mx-auto p-6 transition-all duration-200"
          style={{ maxWidth: previewWidth }}
        >
          {debouncedFields.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <EyeOff className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-sm">Add fields to see a preview</p>
            </div>
          ) : (
            <FormPreviewRenderer
              key={previewKey}
              fields={debouncedFields}
              settings={resolvedSettings}
              compliance={resolvedCompliance}
              mode="preview"
            />
          )}
        </div>
      </div>

      {/* Branding Toggle */}
      <div className="pt-3 mt-3 border-t">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowBranding(!showBranding)}
          className="text-xs text-muted-foreground w-full justify-start gap-2"
        >
          <Palette className="h-3 w-3" />
          {showBranding ? 'Hide' : 'Show'} branding (preview only)
        </Button>
      </div>
    </div>
  );
}

export default PreviewPanel;
