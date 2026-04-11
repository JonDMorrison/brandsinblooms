import React, { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useCRMPersonas } from "@/hooks/useCRMPersonas";
import { useCRMTags } from "@/hooks/useCRMTags";
import { ArrowRight, Tag, Users, X } from "lucide-react";

interface FormAudienceTabProps {
  audience: {
    assign_personas: string[];
    assign_tags: string[];
  };
  onAudienceChange: (audience: {
    assign_personas: string[];
    assign_tags: string[];
  }) => void;
}

export function FormAudienceTab({
  audience,
  onAudienceChange,
}: FormAudienceTabProps) {
  const { personas, loading: personasLoading } = useCRMPersonas();
  const { tags, loading: tagsLoading } = useCRMTags();

  const sortedPersonas = useMemo(
    () =>
      [...personas].sort((left, right) =>
        left.persona_name.localeCompare(right.persona_name),
      ),
    [personas],
  );

  const personaLookup = useMemo(
    () =>
      new Map(
        sortedPersonas.map((persona) => [
          persona.id,
          {
            id: persona.id,
            name: persona.persona_name,
            description: persona.persona_description ?? null,
          },
        ]),
      ),
    [sortedPersonas],
  );

  const tagLookup = useMemo(
    () => new Map(tags.map((tag) => [tag.id, tag])),
    [tags],
  );

  const selectedPersonas = useMemo(
    () =>
      (audience.assign_personas || []).map((personaId) => {
        const persona = personaLookup.get(personaId);
        return {
          id: personaId,
          label: persona?.name || "Unknown persona",
          missing: !persona,
        };
      }),
    [audience.assign_personas, personaLookup],
  );

  const selectedTags = useMemo(
    () =>
      (audience.assign_tags || []).map((tagId) => {
        const tag = tagLookup.get(tagId);
        return {
          id: tagId,
          label: tag?.name || "Unknown tag",
          missing: !tag,
        };
      }),
    [audience.assign_tags, tagLookup],
  );

  const togglePersona = (personaId: string) => {
    const current = audience.assign_personas || [];
    const updated = current.includes(personaId)
      ? current.filter((id) => id !== personaId)
      : [...current, personaId];

    onAudienceChange({ ...audience, assign_personas: updated });
  };

  const toggleTag = (tagId: string) => {
    const current = audience.assign_tags || [];
    const updated = current.includes(tagId)
      ? current.filter((id) => id !== tagId)
      : [...current, tagId];

    onAudienceChange({ ...audience, assign_tags: updated });
  };

  return (
    <div className="space-y-6">
      <AudienceSection
        title="Auto-Assign Personas"
        description="Selected personas will be automatically assigned to customers who submit this form."
        icon={Users}
      >
        {personasLoading ? (
          <AudienceEmptyState message="Loading personas..." icon={Users} />
        ) : sortedPersonas.length === 0 ? (
          <AudienceEmptyState
            message="No personas found. Create CRM personas first to use this automation."
            icon={Users}
          />
        ) : (
          <div className="space-y-3">
            {sortedPersonas.map((persona) => (
              <SelectableRow
                key={persona.id}
                checked={(audience.assign_personas || []).includes(persona.id)}
                title={persona.persona_name}
                description={
                  persona.persona_description ?? "No description provided."
                }
                onSelect={() => togglePersona(persona.id)}
              />
            ))}
          </div>
        )}

        <SelectionBadgeList
          title="Selected personas"
          items={selectedPersonas}
          icon={Users}
          onRemove={togglePersona}
        />
      </AudienceSection>

      <AudienceSection
        title="Auto-Assign Tags"
        description="Selected tags will be automatically applied to customers who submit this form."
        icon={Tag}
      >
        {tagsLoading ? (
          <AudienceEmptyState message="Loading tags..." icon={Tag} />
        ) : tags.length === 0 ? (
          <AudienceEmptyState
            message="No tags available. Create tags in the CRM module to use them here."
            icon={Tag}
          />
        ) : (
          <div className="space-y-3">
            {tags.map((tag) => (
              <SelectableRow
                key={tag.id}
                checked={(audience.assign_tags || []).includes(tag.id)}
                title={tag.name}
                description="Apply this CRM tag automatically after a successful submission."
                onSelect={() => toggleTag(tag.id)}
              />
            ))}
          </div>
        )}

        <SelectionBadgeList
          title="Selected tags"
          items={selectedTags}
          icon={Tag}
          onRemove={toggleTag}
        />
      </AudienceSection>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowRight className="h-5 w-5" />
            Segment Evaluation
          </CardTitle>
          <CardDescription>
            After each submission, BloomSuite automatically evaluates whether
            the customer qualifies for any active segments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Segment evaluation is always active. No additional configuration is
            required in this tab.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

interface AudienceSectionProps {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}

function AudienceSection({
  title,
  description,
  icon: Icon,
  children,
}: AudienceSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

interface SelectableRowProps {
  checked: boolean;
  title: string;
  description: string;
  onSelect: () => void;
}

function SelectableRow({
  checked,
  title,
  description,
  onSelect,
}: SelectableRowProps) {
  return (
    <button
      type="button"
      className="flex w-full items-start gap-3 rounded-xl border border-border px-4 py-3 text-left transition-colors hover:bg-muted/40"
      onClick={onSelect}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={onSelect}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </button>
  );
}

function AudienceEmptyState({
  message,
  icon: Icon,
}: {
  message: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
      <Icon className="mx-auto mb-2 h-8 w-8 opacity-50" />
      <p>{message}</p>
    </div>
  );
}

function SelectionBadgeList({
  title,
  items,
  icon: Icon,
  onRemove,
}: {
  title: string;
  items: Array<{ id: string; label: string; missing: boolean }>;
  icon: React.ComponentType<{ className?: string }>;
  onRemove: (id: string) => void;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {title}
      </p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Badge
            key={item.id}
            variant={item.missing ? "outline" : "secondary"}
            className="gap-1.5 rounded-full px-3 py-1.5"
          >
            <Icon className="h-3.5 w-3.5" />
            {item.label}
            <button
              type="button"
              className="text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => onRemove(item.id)}
              aria-label={`Remove ${item.label}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </Badge>
        ))}
      </div>
    </div>
  );
}
