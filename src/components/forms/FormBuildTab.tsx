import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, LayoutTemplate, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { isConsentFieldType } from "@/lib/forms/fieldRegistry";
import {
  createDefaultFormStep,
  getEditableFormSteps,
  isMultiStepEnabled,
  normalizeFieldStepIndex,
} from "@/lib/forms/formFlow";
import { PublishValidationIssue } from "@/lib/forms/publish";
import { cn } from "@/lib/utils";
import { FormCompliance, FormField, FormSettings } from "@/types/formBuilder";
import { DraggableFieldList } from "./DraggableFieldList";
import { FormTemplatesDialog } from "./FormTemplatesDialog";

interface FormBuildTabProps {
  fields: FormField[];
  updateFields: (fields: FormField[]) => void;
  settings: FormSettings;
  updateSettings: (settings: FormSettings) => void;
  compliance: FormCompliance;
  updateCompliance: (compliance: FormCompliance) => void;
  onApplyTemplate?: (templateData: any) => void;
  publishValidationIssue?: PublishValidationIssue | null;
}

export function FormBuildTab({
  fields,
  updateFields,
  settings,
  updateSettings,
  compliance,
  updateCompliance,
  onApplyTemplate,
  publishValidationIssue,
}: FormBuildTabProps) {
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [focusedStepIndex, setFocusedStepIndex] = useState(0);
  const buildCardRef = useRef<HTMLDivElement | null>(null);
  const multiStepEnabled = isMultiStepEnabled(settings);
  const steps = getEditableFormSteps(fields, settings);

  const activeBuildIssue =
    publishValidationIssue?.targetTab === "build"
      ? publishValidationIssue
      : null;

  useEffect(() => {
    if (!activeBuildIssue) {
      return;
    }

    buildCardRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [activeBuildIssue]);

  useEffect(() => {
    if (steps.some((step) => step.index === focusedStepIndex)) {
      return;
    }

    setFocusedStepIndex(steps[0]?.index ?? 0);
  }, [focusedStepIndex, steps]);

  const handleMultiStepToggle = (enabled: boolean) => {
    if (enabled) {
      updateSettings({
        ...settings,
        steps: [createDefaultFormStep(0)],
      });
      updateFields(
        fields.map((field) => ({
          ...field,
          step_index: normalizeFieldStepIndex(field),
        })),
      );
      setFocusedStepIndex(0);
      return;
    }

    updateSettings({
      ...settings,
      steps: [],
    });
    updateFields(
      fields.map((field) => {
        const nextField = { ...field };
        delete nextField.step_index;
        return nextField;
      }),
    );
    setFocusedStepIndex(0);
  };

  const handleTemplateSelect = (templateData: any) => {
    if (onApplyTemplate) {
      onApplyTemplate(templateData);
    } else {
      if (templateData.fields_json) {
        updateFields(templateData.fields_json);
      }
      if (templateData.compliance_json) {
        updateCompliance(templateData.compliance_json);
      }
    }
    setTemplatesOpen(false);
  };

  const consentFields = fields.filter((field) =>
    isConsentFieldType(field.type),
  );
  const focusedStepLabel =
    steps[focusedStepIndex]?.title || `Step ${focusedStepIndex + 1}`;

  return (
    <>
      <div className="space-y-6">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
          <div
            ref={buildCardRef}
            className={cn(
              "relative overflow-hidden rounded-[28px] border border-border/80 bg-card/90 p-5 shadow-sm transition-all duration-200 sm:p-6",
              activeBuildIssue && "border-primary/40 ring-2 ring-primary/15",
            )}
          >
            <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-primary/10 blur-3xl" />

            {activeBuildIssue && (
              <Alert className="mb-5 border-primary/30 bg-primary/5 text-foreground">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <span className="font-medium">Publish is blocked.</span>{" "}
                  {activeBuildIssue.fixHint}
                </AlertDescription>
              </Alert>
            )}

            <div className="relative space-y-5">
              <div className="space-y-3">
                <Badge
                  variant="outline"
                  className="rounded-full bg-background/80"
                >
                  Structure
                </Badge>
                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                    Build the form flow
                  </h2>
                  <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
                    Add, reorder, and configure each field while keeping the
                    final visitor journey in focus.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[22px] border border-border/80 bg-background/80 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Fields
                  </p>
                  <p className="mt-3 text-2xl font-semibold text-foreground">
                    {fields.length}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Active inputs in the current form definition.
                  </p>
                </div>

                <div className="rounded-[22px] border border-border/80 bg-background/80 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Steps
                  </p>
                  <p className="mt-3 text-2xl font-semibold text-foreground">
                    {multiStepEnabled ? steps.length : 1}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {multiStepEnabled
                      ? `Currently adding to ${focusedStepLabel}.`
                      : "Single-screen form flow."}
                  </p>
                </div>

                <div className="rounded-[22px] border border-border/80 bg-background/80 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Compliance
                  </p>
                  <p className="mt-3 text-2xl font-semibold text-foreground">
                    {consentFields.length}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Consent controls currently included in the build.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[28px] border border-border/80 bg-card/90 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    Multi-Step Form
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Split the journey into guided screens with focused progress.
                  </p>
                </div>
                <div className="ml-auto">
                  <Switch
                    checked={multiStepEnabled}
                    onCheckedChange={handleMultiStepToggle}
                    aria-label="Toggle multi-step form mode"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-dashed border-border/80 bg-background/85 p-5 shadow-sm">
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  Build actions
                </p>
                <h3 className="text-xl font-semibold tracking-tight text-foreground">
                  Use a starting point
                </h3>
                <p className="text-sm text-muted-foreground">
                  Apply a template now, then use the field list below to append
                  or insert fields exactly where you want them.
                </p>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  className="rounded-full"
                  onClick={() => setTemplatesOpen(true)}
                >
                  <LayoutTemplate className="mr-2 h-4 w-4" />
                  Use Template
                </Button>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="rounded-full">
                  {fields.length} field{fields.length === 1 ? "" : "s"}
                </Badge>
                {multiStepEnabled && (
                  <Badge variant="secondary" className="rounded-full">
                    {steps.length} step{steps.length === 1 ? "" : "s"}
                  </Badge>
                )}
                {multiStepEnabled && (
                  <Badge
                    variant="outline"
                    className="rounded-full text-primary"
                  >
                    Adding to {focusedStepLabel}
                  </Badge>
                )}
                {consentFields.map((field) => (
                  <Badge
                    key={field.id}
                    variant="outline"
                    className="gap-1 rounded-full"
                  >
                    <ShieldCheck className="h-3 w-3" />
                    {field.type === "email_consent"
                      ? "Email consent"
                      : "SMS consent"}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>

        <DraggableFieldList
          fields={fields}
          updateFields={updateFields}
          settings={settings}
          updateSettings={updateSettings}
          compliance={compliance}
          updateCompliance={updateCompliance}
          focusedStepIndex={focusedStepIndex}
          onFocusedStepIndexChange={setFocusedStepIndex}
        />
      </div>

      <FormTemplatesDialog
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        onSelect={handleTemplateSelect}
      />
    </>
  );
}
