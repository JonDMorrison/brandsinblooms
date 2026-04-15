import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  FormField,
  FormSettings,
  FormCompliance,
  DEFAULT_FORM_COMPLIANCE,
} from "@/types/formBuilder";
import { normalizeFormSettings } from "@/lib/forms/designSettings";
import { FormPreviewRenderer } from "./FormPreviewRenderer";
import { Button } from "@/components/ui-legacy/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui-legacy/toggle-group";
import {
  Monitor,
  Smartphone,
  Tablet,
  RefreshCw,
  AlertTriangle,
  Eye,
  EyeOff,
  Layout,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui-legacy/tooltip";

interface PreviewPanelProps {
  fields: FormField[];
  settings: FormSettings | null;
  compliance: FormCompliance | null;
  className?: string;
}

type DeviceWidth = "desktop" | "tablet" | "mobile";
type BackgroundColor = "white" | "webpage";

export function PreviewPanel({
  fields,
  settings,
  compliance,
  className,
}: PreviewPanelProps) {
  const [deviceWidth, setDeviceWidth] = useState<DeviceWidth>("desktop");
  const [background, setBackground] = useState<BackgroundColor>("white");
  const [resetSignal, setResetSignal] = useState(0);

  // Track changed field/setting IDs for highlight animation
  const [changedIds, setChangedIds] = useState<Set<string>>(new Set());
  const prevFieldsRef = useRef<string>("");
  const prevSettingsRef = useRef<string>("");
  const prevComplianceRef = useRef<string>("");

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
      if (
        prevFieldsRef.current &&
        prevFieldsRef.current !== currentFieldsJson
      ) {
        const prevFields: FormField[] = JSON.parse(prevFieldsRef.current);
        fields.forEach((field) => {
          const prevField = prevFields.find((f) => f.id === field.id);
          if (
            !prevField ||
            JSON.stringify(prevField) !== JSON.stringify(field)
          ) {
            newChangedIds.add(field.id);
          }
        });
      }

      // Check for settings changes
      if (
        prevSettingsRef.current &&
        prevSettingsRef.current !== currentSettingsJson
      ) {
        const prevSettings = JSON.parse(prevSettingsRef.current);
        const extSettings = settings as any;
        const prevExtSettings = prevSettings as any;

        // Check if headline/subheadline specifically changed
        if (
          extSettings?.form_headline !== prevExtSettings?.form_headline ||
          extSettings?.form_subheadline !== prevExtSettings?.form_subheadline
        ) {
          newChangedIds.add("__headline");
        } else {
          newChangedIds.add("__settings");
        }
      }

      // Check for compliance changes
      if (
        prevComplianceRef.current &&
        prevComplianceRef.current !== currentComplianceJson
      ) {
        newChangedIds.add("__compliance");
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
    return normalizeFormSettings(debouncedSettings);
  }, [debouncedSettings]);

  const resolvedCompliance = debouncedCompliance || DEFAULT_FORM_COMPLIANCE;

  const handleReset = () => {
    setResetSignal((current) => current + 1);
  };

  // Validation warnings
  const warnings = useMemo(() => {
    const list: string[] = [];
    if (debouncedFields.length === 0) {
      list.push("No fields added yet");
    }
    const emailField = debouncedFields.find((f) => f.type === "email");
    if (!emailField) {
      list.push("No email field (recommended)");
    }
    return list;
  }, [debouncedFields]);

  const previewWidth =
    deviceWidth === "desktop"
      ? "100%"
      : deviceWidth === "tablet"
        ? "768px"
        : "375px";

  return (
    <TooltipProvider>
      <div className={cn("flex flex-col h-full", className)}>
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
                  <p>Desktop width (full panel)</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <ToggleGroupItem value="tablet" aria-label="Tablet preview">
                    <Tablet className="h-4 w-4" />
                  </ToggleGroupItem>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Tablet width (768px)</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <ToggleGroupItem value="mobile" aria-label="Mobile preview">
                    <Smartphone className="h-4 w-4" />
                  </ToggleGroupItem>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Mobile width (375px)</p>
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
                  <ToggleGroupItem
                    value="webpage"
                    aria-label="Mock webpage background"
                  >
                    <Layout className="h-4 w-4" />
                  </ToggleGroupItem>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Mock webpage background</p>
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
            "relative flex-1 overflow-auto rounded-lg border transition-colors",
            background === "white" ? "bg-white" : "bg-slate-100",
          )}
        >
          {background === "webpage" && <MockWebpageBackground />}

          <div
            className="relative z-10 mx-auto w-full p-6 transition-all duration-200"
            style={{ maxWidth: previewWidth }}
          >
            {debouncedFields.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <EyeOff className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="text-sm">Add fields to see a preview</p>
              </div>
            ) : (
              <FormPreviewRenderer
                fields={debouncedFields}
                settings={resolvedSettings}
                compliance={resolvedCompliance}
                mode="preview"
                changedIds={changedIds}
                resetSignal={resetSignal}
              />
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

function MockWebpageBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.95),_rgba(226,232,240,0.65)_55%,_rgba(203,213,225,0.5))]" />
      <div className="absolute inset-x-6 top-6 h-14 rounded-2xl bg-white/80 shadow-sm backdrop-blur-sm" />
      <div className="absolute inset-x-6 top-28 grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="space-y-4">
          <div className="h-40 rounded-3xl bg-white/75 shadow-sm backdrop-blur-sm" />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-28 rounded-2xl bg-white/70 shadow-sm" />
            <div className="h-28 rounded-2xl bg-white/70 shadow-sm" />
          </div>
        </div>
        <div className="h-60 rounded-3xl bg-white/75 shadow-sm backdrop-blur-sm" />
      </div>
    </div>
  );
}

export default PreviewPanel;
