import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Laptop,
  Monitor,
  RefreshCw,
  RotateCw,
  Smartphone,
  Tablet,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui-legacy/badge";
import { Button } from "@/components/ui-legacy/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui-legacy/dialog";
import { Input } from "@/components/ui-legacy/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui-legacy/tooltip";
import { normalizeFormSettings } from "@/lib/forms/designSettings";
import { cn } from "@/lib/utils";
import {
  DEFAULT_FORM_COMPLIANCE,
  FormCompliance,
  FormField,
  FormSettings,
} from "@/types/formBuilder";
import { FormPreviewRenderer } from "./FormPreviewRenderer";

type PreviewDevice = "desktop" | "laptop" | "tablet" | "phone" | "custom";
type PreviewOrientation = "portrait" | "landscape";
type PreviewBackground = "white" | "gray" | "dark" | "checker";

interface FormPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fields: FormField[];
  settings: FormSettings | null;
  compliance: FormCompliance | null;
  formName: string;
  uploadEmbedKey?: string;
}

const PREVIEW_DEVICES: Array<{
  label: string;
  value: PreviewDevice;
  icon: typeof Monitor;
}> = [
  { label: "Desktop", value: "desktop", icon: Monitor },
  { label: "Laptop", value: "laptop", icon: Laptop },
  { label: "Tablet", value: "tablet", icon: Tablet },
  { label: "Phone", value: "phone", icon: Smartphone },
  { label: "Custom", value: "custom", icon: Monitor },
];

const BACKGROUND_OPTIONS: Array<{
  label: string;
  value: PreviewBackground;
}> = [
  { label: "White", value: "white" },
  { label: "Light Gray", value: "gray" },
  { label: "Dark", value: "dark" },
  { label: "Checker", value: "checker" },
];

const CUSTOM_WIDTH_DEFAULT = 960;

function clampCustomWidth(value: number) {
  if (Number.isNaN(value)) {
    return CUSTOM_WIDTH_DEFAULT;
  }

  return Math.min(1600, Math.max(320, value));
}

function getPreviewWidth(
  device: PreviewDevice,
  orientation: PreviewOrientation,
  customWidth: number,
) {
  switch (device) {
    case "desktop":
      return 1320;
    case "laptop":
      return 1120;
    case "tablet":
      return orientation === "portrait" ? 820 : 1100;
    case "phone":
      return orientation === "portrait" ? 420 : 740;
    case "custom":
      return customWidth;
    default:
      return CUSTOM_WIDTH_DEFAULT;
  }
}

export function FormPreviewDialog({
  open,
  onOpenChange,
  fields,
  settings,
  compliance,
  formName,
  uploadEmbedKey,
}: FormPreviewDialogProps) {
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const [orientation, setOrientation] =
    useState<PreviewOrientation>("portrait");
  const [background, setBackground] = useState<PreviewBackground>("gray");
  const [customWidth, setCustomWidth] = useState(String(CUSTOM_WIDTH_DEFAULT));
  const [resetSignal, setResetSignal] = useState(0);
  const [changedIds, setChangedIds] = useState<Set<string>>(new Set());
  const prevFieldsRef = useRef("");
  const prevSettingsRef = useRef("");
  const prevComplianceRef = useRef("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      const currentFieldsJson = JSON.stringify(fields);
      const currentSettingsJson = JSON.stringify(settings);
      const currentComplianceJson = JSON.stringify(compliance);
      const nextChangedIds = new Set<string>();

      if (
        prevFieldsRef.current &&
        prevFieldsRef.current !== currentFieldsJson
      ) {
        const prevFields = JSON.parse(prevFieldsRef.current) as FormField[];

        fields.forEach((field) => {
          const prevField = prevFields.find((item) => item.id === field.id);
          if (
            !prevField ||
            JSON.stringify(prevField) !== JSON.stringify(field)
          ) {
            nextChangedIds.add(field.id);
          }
        });
      }

      if (
        prevSettingsRef.current &&
        prevSettingsRef.current !== currentSettingsJson
      ) {
        const prevSettings = JSON.parse(
          prevSettingsRef.current,
        ) as FormSettings;
        const nextSettings = settings as FormSettings & {
          form_headline?: string;
          form_subheadline?: string;
        };
        const previousSettings = prevSettings as FormSettings & {
          form_headline?: string;
          form_subheadline?: string;
        };

        if (
          nextSettings?.form_headline !== previousSettings?.form_headline ||
          nextSettings?.form_subheadline !== previousSettings?.form_subheadline
        ) {
          nextChangedIds.add("__headline");
        } else {
          nextChangedIds.add("__settings");
        }
      }

      if (
        prevComplianceRef.current &&
        prevComplianceRef.current !== currentComplianceJson
      ) {
        nextChangedIds.add("__compliance");
      }

      prevFieldsRef.current = currentFieldsJson;
      prevSettingsRef.current = currentSettingsJson;
      prevComplianceRef.current = currentComplianceJson;

      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }

      if (nextChangedIds.size > 0) {
        setChangedIds(nextChangedIds);
        highlightTimeoutRef.current = setTimeout(() => {
          setChangedIds(new Set());
        }, 800);
      }
    }, 200);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [fields, settings, compliance]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  const resolvedSettings = useMemo(
    () => normalizeFormSettings(settings),
    [settings],
  );
  const resolvedCompliance = compliance || DEFAULT_FORM_COMPLIANCE;
  const normalizedCustomWidth = clampCustomWidth(Number(customWidth));
  const previewWidth = useMemo(
    () => getPreviewWidth(device, orientation, normalizedCustomWidth),
    [device, normalizedCustomWidth, orientation],
  );
  const isHandheld = device === "tablet" || device === "phone";
  const warnings = useMemo(() => {
    const nextWarnings: string[] = [];

    if (fields.length === 0) {
      nextWarnings.push(
        "Add at least one field to preview the full experience.",
      );
    }

    if (!fields.some((field) => field.type === "email")) {
      nextWarnings.push(
        "No email field detected. Most campaigns should capture one.",
      );
    }

    return nextWarnings;
  }, [fields]);

  const checkerboardStyle =
    background === "checker"
      ? {
          backgroundColor: "hsl(var(--background))",
          backgroundImage:
            "linear-gradient(45deg, hsl(var(--muted) / 0.45) 25%, transparent 25%), linear-gradient(-45deg, hsl(var(--muted) / 0.45) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, hsl(var(--muted) / 0.45) 75%), linear-gradient(-45deg, transparent 75%, hsl(var(--muted) / 0.45) 75%)",
          backgroundPosition: "0 0, 0 12px, 12px -12px, -12px 0px",
          backgroundSize: "24px 24px",
        }
      : undefined;

  return (
    <TooltipProvider>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          overlayClassName="bg-foreground/50 backdrop-blur-md"
          className="h-[calc(100vh-1.5rem)] max-h-[calc(100vh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] gap-0 overflow-hidden rounded-[28px] border-border bg-background/95 p-0 shadow-2xl"
        >
          <div className="flex h-full min-h-0 flex-col">
            <div className="border-b border-border/80 bg-background/90 px-4 py-4 backdrop-blur sm:px-6">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className="rounded-full bg-background/80"
                    >
                      Live Preview
                    </Badge>
                    {warnings.length > 0 ? (
                      <Badge variant="outline" className="gap-1 rounded-full">
                        <AlertTriangle className="h-3 w-3" />
                        {warnings.length} check
                        {warnings.length === 1 ? "" : "s"}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="space-y-1">
                    <DialogTitle className="text-xl font-semibold tracking-tight sm:text-2xl">
                      {(formName || "Untitled form").trim()} preview
                    </DialogTitle>
                    <DialogDescription>
                      Validate layout, spacing, and progressive disclosure
                      before you publish.
                    </DialogDescription>
                  </div>
                </div>

                <div className="flex flex-col gap-3 xl:items-end">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex flex-wrap items-center gap-1 rounded-full border border-border/80 bg-background/80 p-1">
                      {PREVIEW_DEVICES.map(({ label, value, icon: Icon }) => (
                        <Tooltip key={value}>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              size="sm"
                              variant={device === value ? "default" : "ghost"}
                              className="rounded-full"
                              onClick={() => setDevice(value)}
                            >
                              <Icon className="mr-2 h-4 w-4" />
                              {label}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{label} canvas</TooltipContent>
                        </Tooltip>
                      ))}
                    </div>

                    {(device === "tablet" || device === "phone") && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="rounded-full"
                            onClick={() =>
                              setOrientation((current) =>
                                current === "portrait"
                                  ? "landscape"
                                  : "portrait",
                              )
                            }
                          >
                            <RotateCw className="mr-2 h-4 w-4" />
                            {orientation === "portrait"
                              ? "Portrait"
                              : "Landscape"}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          Rotate tablet or phone preview
                        </TooltipContent>
                      </Tooltip>
                    )}

                    {device === "custom" && (
                      <div className="flex items-center gap-2 rounded-full border border-border/80 bg-background/80 px-3 py-1.5">
                        <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                          Width
                        </span>
                        <Input
                          type="number"
                          min={320}
                          max={1600}
                          value={customWidth}
                          onChange={(event) =>
                            setCustomWidth(event.target.value)
                          }
                          className="h-8 w-24 border-none bg-transparent px-0 text-right shadow-none focus-visible:ring-0"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex flex-wrap items-center gap-1 rounded-full border border-border/80 bg-background/80 p-1">
                      {BACKGROUND_OPTIONS.map((option) => (
                        <Button
                          key={option.value}
                          type="button"
                          size="sm"
                          variant={
                            background === option.value ? "default" : "ghost"
                          }
                          className="rounded-full"
                          onClick={() => setBackground(option.value)}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="rounded-full"
                          onClick={() =>
                            setResetSignal((current) => current + 1)
                          }
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Reset
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Reset the preview back to its initial state
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="rounded-full"
                          onClick={() => onOpenChange(false)}
                          aria-label="Close preview"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Close preview</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>

              {warnings.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {warnings.map((warning) => (
                    <div
                      key={warning}
                      className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground"
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span>{warning}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div
              className={cn(
                "min-h-0 flex-1 overflow-auto p-4 sm:p-6",
                background === "white" && "bg-background",
                background === "gray" && "bg-muted/35",
                background === "dark" && "bg-foreground/95",
              )}
              style={checkerboardStyle}
            >
              <div className="mx-auto flex min-h-full w-full items-start justify-center">
                <div
                  className="w-full max-w-full transition-[width] duration-300 ease-out"
                  style={{ width: previewWidth, maxWidth: "100%" }}
                >
                  <div
                    className={cn(
                      "mx-auto overflow-hidden border border-border/80 bg-card/95 shadow-2xl",
                      isHandheld
                        ? "rounded-[32px] p-2.5 sm:p-3"
                        : "rounded-[30px] p-3 sm:p-4",
                    )}
                  >
                    {isHandheld ? (
                      <div className="mb-2 flex justify-center">
                        <div className="h-1.5 w-20 rounded-full bg-muted-foreground/25" />
                      </div>
                    ) : (
                      <div className="mb-3 flex items-center gap-2 rounded-[20px] border border-border/80 bg-muted/35 px-4 py-3">
                        <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
                        <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
                        <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/20" />
                        <div className="ml-2 h-8 flex-1 rounded-full border border-border/80 bg-background/90" />
                      </div>
                    )}

                    <div className="overflow-hidden rounded-[24px] border border-border/80 bg-background">
                      <div className="max-h-[calc(100vh-16rem)] overflow-auto p-3 sm:p-6">
                        {fields.length === 0 ? (
                          <div className="flex min-h-[420px] items-center justify-center rounded-[20px] border border-dashed border-border bg-muted/20 px-6 text-center">
                            <div className="space-y-2">
                              <p className="text-base font-semibold text-foreground">
                                Add fields to preview the experience
                              </p>
                              <p className="max-w-md text-sm text-muted-foreground">
                                The live runtime is ready. Once you add fields,
                                this dialog will mirror the public form layout.
                              </p>
                            </div>
                          </div>
                        ) : (
                          <FormPreviewRenderer
                            fields={fields}
                            settings={resolvedSettings}
                            compliance={resolvedCompliance}
                            mode="preview"
                            uploadEmbedKey={uploadEmbedKey}
                            changedIds={changedIds}
                            resetSignal={resetSignal}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
