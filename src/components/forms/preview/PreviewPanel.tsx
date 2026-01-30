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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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

  // Track changed field/setting IDs for highlight animation
  const [changedIds, setChangedIds] = useState<Set<string>>(new Set());
  const prevFieldsRef = useRef<string>('');
  const prevSettingsRef = useRef<string>('');
  const prevComplianceRef = useRef<string>('');

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
      // Detect changed fields for highlight
      const currentFieldsJson = JSON.stringify(fields);
      const currentSettingsJson = JSON.stringify(settings);
      const currentComplianceJson = JSON.stringify(compliance);
      
      const newChangedIds = new Set<string>();
      
      // Check for field changes
      if (prevFieldsRef.current && prevFieldsRef.current !== currentFieldsJson) {
        const prevFields: FormField[] = JSON.parse(prevFieldsRef.current);
        fields.forEach((field) => {
          const prevField = prevFields.find((f) => f.id === field.id);
          if (!prevField || JSON.stringify(prevField) !== JSON.stringify(field)) {
            newChangedIds.add(field.id);
          }
        });
      }
      
      // Check for settings changes
      if (prevSettingsRef.current && prevSettingsRef.current !== currentSettingsJson) {
        const prevSettings = JSON.parse(prevSettingsRef.current);
        const extSettings = settings as any;
        const prevExtSettings = prevSettings as any;
        
        // Check if headline/subheadline specifically changed
        if (extSettings?.form_headline !== prevExtSettings?.form_headline ||
            extSettings?.form_subheadline !== prevExtSettings?.form_subheadline) {
          newChangedIds.add('__headline');
        } else {
          newChangedIds.add('__settings');
        }
      }
      
      // Check for compliance changes
      if (prevComplianceRef.current && prevComplianceRef.current !== currentComplianceJson) {
        newChangedIds.add('__compliance');
      }
      
      prevFieldsRef.current = currentFieldsJson;
      prevSettingsRef.current = currentSettingsJson;
      prevComplianceRef.current = currentComplianceJson;
      
      if (newChangedIds.size > 0) {
        setChangedIds(newChangedIds);
        // Clear highlights after animation
        setTimeout(() => setChangedIds(new Set()), 800);
      }
      
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
    <TooltipProvider>
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <ToggleGroupItem value="desktop" aria-label="Desktop preview">
                    <Monitor className="h-4 w-4" />
                  </ToggleGroupItem>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Desktop width (480px)</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <ToggleGroupItem value="mobile" aria-label="Mobile preview">
                    <Smartphone className="h-4 w-4" />
                  </ToggleGroupItem>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Mobile width (360px)</p>
                </TooltipContent>
              </Tooltip>
            </ToggleGroup>

            {/* Background Toggle */}
            <ToggleGroup
              type="single"
              value={background}
              onValueChange={(v) => v && setBackground(v as BackgroundColor)}
              size="sm"
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <ToggleGroupItem value="white" aria-label="White background">
                    <div className="w-4 h-4 rounded border border-border bg-white" />
                  </ToggleGroupItem>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>White background</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <ToggleGroupItem value="gray" aria-label="Gray background">
                    <div className="w-4 h-4 rounded border border-border bg-muted" />
                  </ToggleGroupItem>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Light gray background</p>
                </TooltipContent>
              </Tooltip>
            </ToggleGroup>

            {/* Reset Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                  className="h-8 w-8 p-0"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Reset preview to initial state</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Preview Mode Banner */}
        <div className="mb-3 px-3 py-2 rounded-md bg-primary/10 border border-primary/20 text-primary text-xs font-medium flex items-center gap-2">
          <Eye className="h-3.5 w-3.5" />
          Preview Mode — This is how your form will appear to visitors
        </div>

        {/* Warnings Banner */}
        {warnings.length > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-muted border border-border text-muted-foreground text-sm flex items-start gap-2">
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
                changedIds={changedIds}
              />
            )}
          </div>
        </div>

        {/* Branding Toggle */}
        <div className="pt-3 mt-3 border-t">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowBranding(!showBranding)}
                className="text-xs text-muted-foreground w-full justify-start gap-2"
              >
                <Palette className="h-3 w-3" />
                {showBranding ? 'Hide' : 'Show'} branding (preview only)
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Toggle "Powered by BloomSuite" footer visibility</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}

export default PreviewPanel;
