import React from "react";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui-legacy/badge";
import { Button } from "@/components/ui-legacy/button";
import {
  BASIC_FIELD_DEFINITIONS,
  COMPLIANCE_FIELD_DEFINITIONS,
  canAddFieldType,
} from "@/lib/forms/fieldRegistry";
import { FormField, FormFieldType } from "@/types/formBuilder";

interface AddFieldPanelProps {
  fields: FormField[];
  onSelectField: (type: FormFieldType) => void;
}

function FieldPaletteSection({
  title,
  description,
  fields,
  existingFields,
  onSelectField,
}: {
  title: string;
  description: string;
  fields: typeof BASIC_FIELD_DEFINITIONS | typeof COMPLIANCE_FIELD_DEFINITIONS;
  existingFields: FormField[];
  onSelectField: (type: FormFieldType) => void;
}) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="grid gap-2">
        {fields.map((field) => {
          const Icon = field.icon;
          const isDisabled = !canAddFieldType(field.type, existingFields);

          return (
            <Button
              key={field.type}
              type="button"
              variant="ghost"
              className="h-auto w-full justify-start rounded-2xl border border-border/80 bg-background/80 px-4 py-4 text-left transition hover:border-primary/30 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => onSelectField(field.type)}
              disabled={isDisabled}
            >
              <div className="flex w-full items-start gap-3">
                <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                  <Icon className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {field.label}
                    </span>
                    {field.category === "compliance" && (
                      <Badge
                        variant="outline"
                        className="rounded-full text-[10px] uppercase"
                      >
                        {field.type === "email_consent" ? "CASL" : "TCPA"}
                      </Badge>
                    )}
                    {isDisabled && (
                      <Badge
                        variant="secondary"
                        className="rounded-full text-[10px] uppercase"
                      >
                        Added
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {field.description}
                  </p>
                </div>

                {!isDisabled && (
                  <Plus className="mt-1 h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </Button>
          );
        })}
      </div>
    </section>
  );
}

export function AddFieldPanel({ fields, onSelectField }: AddFieldPanelProps) {
  return (
    <div className="space-y-6">
      <FieldPaletteSection
        title="Basic Fields"
        description="Add the core inputs visitors will complete."
        fields={BASIC_FIELD_DEFINITIONS}
        existingFields={fields}
        onSelectField={onSelectField}
      />

      <FieldPaletteSection
        title="Compliance Fields"
        description="Add explicit consent controls for email and SMS marketing."
        fields={COMPLIANCE_FIELD_DEFINITIONS}
        existingFields={fields}
        onSelectField={onSelectField}
      />
    </div>
  );
}
