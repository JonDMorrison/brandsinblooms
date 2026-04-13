import React, { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useCRMTags } from "@/hooks/useCRMTags";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Layers, Tag, Users, X } from "lucide-react";

interface FormAudienceTabProps {
  audience: {
    assign_personas: string[];
    assign_tags: string[];
    segment_ids?: string[];
  };
  onAudienceChange: (audience: {
    assign_personas: string[];
    assign_tags: string[];
    segment_ids?: string[];
  }) => void;
}

interface GlobalPersona {
  id: string;
  name: string;
  description: string | null;
}

interface Segment {
  id: string;
  name: string;
  description: string | null;
}

export function FormAudienceTab({
  audience,
  onAudienceChange,
}: FormAudienceTabProps) {
  const { tenant } = useTenant();
  const { tags, loading: tagsLoading } = useCRMTags();

  // ── Fetch global personas (not tenant-scoped) ──────────────
  const [personas, setPersonas] = useState<GlobalPersona[]>([]);
  const [personasLoading, setPersonasLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setPersonasLoading(true);
      const { data } = await supabase
        .from("personas")
        .select("id, name, description")
        .order("name");
      setPersonas((data as GlobalPersona[]) || []);
      setPersonasLoading(false);
    })();
  }, []);

  // ── Fetch tenant segments ──────────────────────────────────
  const [segments, setSegments] = useState<Segment[]>([]);
  const [segmentsLoading, setSegmentsLoading] = useState(true);

  useEffect(() => {
    if (!tenant?.id) return;
    (async () => {
      setSegmentsLoading(true);
      const { data } = await supabase
        .from("crm_segments")
        .select("id, name, description")
        .eq("tenant_id", tenant.id)
        .order("name");
      setSegments((data as Segment[]) || []);
      setSegmentsLoading(false);
    })();
  }, [tenant?.id]);

  // ── Lookups ────────────────────────────────────────────────
  const personaLookup = useMemo(
    () => new Map(personas.map((p) => [p.id, p])),
    [personas],
  );

  const segmentLookup = useMemo(
    () => new Map(segments.map((s) => [s.id, s])),
    [segments],
  );

  const tagLookup = useMemo(
    () => new Map(tags.map((tag) => [tag.id, tag])),
    [tags],
  );

  // ── Selected item lists (for badge display) ────────────────
  const selectedPersonas = useMemo(
    () =>
      (audience.assign_personas || []).map((id) => ({
        id,
        label: personaLookup.get(id)?.name || "Unknown persona",
        missing: !personaLookup.has(id),
      })),
    [audience.assign_personas, personaLookup],
  );

  const selectedSegments = useMemo(
    () =>
      (audience.segment_ids || []).map((id) => ({
        id,
        label: segmentLookup.get(id)?.name || "Unknown segment",
        missing: !segmentLookup.has(id),
      })),
    [audience.segment_ids, segmentLookup],
  );

  const selectedTags = useMemo(
    () =>
      (audience.assign_tags || []).map((id) => ({
        id,
        label: tagLookup.get(id)?.name || "Unknown tag",
        missing: !tagLookup.has(id),
      })),
    [audience.assign_tags, tagLookup],
  );

  // ── Togglers ───────────────────────────────────────────────
  const togglePersona = (personaId: string) => {
    const current = audience.assign_personas || [];
    const updated = current.includes(personaId)
      ? current.filter((id) => id !== personaId)
      : [...current, personaId];
    onAudienceChange({ ...audience, assign_personas: updated });
  };

  const toggleSegment = (segmentId: string) => {
    const current = audience.segment_ids || [];
    const updated = current.includes(segmentId)
      ? current.filter((id) => id !== segmentId)
      : [...current, segmentId];
    onAudienceChange({ ...audience, segment_ids: updated });
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
      {/* ── Segments ── */}
      <AudienceSection
        title="Auto-Assign Segments"
        description="Selected segments will be automatically assigned to customers who submit this form."
        icon={Layers}
      >
        {segmentsLoading ? (
          <AudienceEmptyState message="Loading segments..." icon={Layers} />
        ) : segments.length === 0 ? (
          <AudienceEmptyState
            message="No segments found. Create segments in the CRM to use this feature."
            icon={Layers}
          />
        ) : (
          <div className="space-y-3">
            {segments.map((seg) => (
              <SelectableRow
                key={seg.id}
                checked={(audience.segment_ids || []).includes(seg.id)}
                title={seg.name}
                description={
                  seg.description || "Assign this segment on submission."
                }
                onSelect={() => toggleSegment(seg.id)}
              />
            ))}
          </div>
        )}

        <SelectionBadgeList
          title="Selected segments"
          items={selectedSegments}
          icon={Layers}
          onRemove={toggleSegment}
        />
      </AudienceSection>

      {/* ── Personas ── */}
      <AudienceSection
        title="Auto-Assign Personas"
        description="Selected personas will be automatically assigned to customers who submit this form."
        icon={Users}
      >
        {personasLoading ? (
          <AudienceEmptyState message="Loading personas..." icon={Users} />
        ) : personas.length === 0 ? (
          <AudienceEmptyState
            message="No personas available."
            icon={Users}
          />
        ) : (
          <div className="space-y-3">
            {personas.map((persona) => (
              <SelectableRow
                key={persona.id}
                checked={(audience.assign_personas || []).includes(persona.id)}
                title={persona.name}
                description={
                  persona.description ?? "No description provided."
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

      {/* ── Tags ── */}
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

      {/* ── Info card ── */}
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

// ── Shared sub-components ──────────────────────────────────────

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

function SelectableRow({
  checked,
  title,
  description,
  onSelect,
}: {
  checked: boolean;
  title: string;
  description: string;
  onSelect: () => void;
}) {
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
  if (items.length === 0) return null;

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
