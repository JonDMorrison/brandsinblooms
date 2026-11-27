import Switch from "@mui/joy/Switch";
import { Lock } from "lucide-react";
import * as React from "react";
import Box from "@mui/joy/Box";
import Chip from "@mui/joy/Chip";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { ArrowLeft, Copy, LayoutTemplate, Mail, Pencil, Plus, Trash2 } from "lucide-react";
import { formatDistanceToNow, isValid } from "date-fns";
import { useNavigate } from "react-router-dom";
import { TemplatePreview } from "@/components/crm/campaigns/TemplatePreview";
import { JoyAlertDialog } from "@/components/joy/JoyAlertDialog";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyDialog, JoyDialogActions, JoyDialogContent } from "@/components/joy/JoyDialog";
import { JoyEmptyState } from "@/components/joy/JoyEmptyState";
import { JoyInput } from "@/components/joy/JoyInput";
import { JoySelect } from "@/components/joy/JoySelect";
import { JoyTextarea } from "@/components/joy/JoyTextarea";
import { PageContainer } from "@/components/joy/PageContainer";
import { useSavedTemplates, type SavedTemplate } from "@/hooks/useSavedTemplates";
import { useUserRole } from "@/hooks/useUserRole";
import {
  categoriesInUse,
  DEFAULT_TEMPLATE_FILTERS,
  filterTemplates,
  parseTagInput,
  TEMPLATE_CATEGORIES,
  TEMPLATE_SORTS,
  type TemplateFilters,
  type TemplateSort,
} from "@/lib/crm/templateLibrary";
import { toast } from "@/utils/toast";
import { PageTitle } from "@/components/joy/PageHeader";

/** Where "Use for a new email" sends people. The editor applies the design once. */
export const newEmailFromTemplatePath = (templateId: string) =>
  `/crm/campaigns/new?type=email&template=${encodeURIComponent(templateId)}`;

function savedLabel(template: SavedTemplate) {
  const date = new Date(template.updated_at || template.created_at);
  const when = isValid(date) ? `Saved ${formatDistanceToNow(date, { addSuffix: true })}` : "Saved";
  return template.isOwn ? `${when} by you` : `${when} by a teammate`;
}

function TemplateCard({
  template,
  canWrite,
  busy,
  onUse,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  template: SavedTemplate;
  canWrite: boolean;
  busy: boolean;
  onUse: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const blockCount = template.layout_json.length;
  return (
    <Sheet
      variant="outlined"
      component="article"
      aria-label={template.name}
      data-testid={`template-card-${template.id}`}
      sx={{ borderRadius: "lg", p: 1.5, display: "flex", flexDirection: "column", gap: 1, bgcolor: "background.surface", minWidth: 0 }}
    >
      <TemplatePreview blocks={template.layout_json} name={template.name} />
      <Typography level="title-md" sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>
        {template.name}
      </Typography>
      {template.description ? (
        <Typography level="body-sm" sx={{ color: "neutral.700", display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2, overflow: "hidden" }}>
          {template.description}
        </Typography>
      ) : null}
      <Stack direction="row" useFlexGap flexWrap="wrap" gap={0.5}>
        {template.isLocked ? (
          <Chip size="sm" variant="soft" color="warning" startDecorator={<Lock size={12} />}>Locked design</Chip>
        ) : null}
        {template.category ? (
          <Chip size="sm" variant="soft" color="primary">{template.category}</Chip>
        ) : null}
        {template.tags.map((tag) => (
          <Chip key={tag} size="sm" variant="outlined" color="neutral">{tag}</Chip>
        ))}
      </Stack>
      <Typography level="body-xs" sx={{ color: "neutral.600" }}>
        {blockCount} block{blockCount === 1 ? "" : "s"} · {savedLabel(template)}
      </Typography>
      <Stack direction="row" useFlexGap flexWrap="wrap" gap={0.75} sx={{ mt: "auto", pt: 0.5 }}>
        {canWrite ? (
          <JoyButton size="sm" color="neutral" variant="solid" startDecorator={<Mail size={14} />} disabled={busy} onClick={onUse}>
            Use for a new email
          </JoyButton>
        ) : null}
        {canWrite ? (
          <JoyButton size="sm" color="neutral" variant="outlined" startDecorator={<Copy size={14} />} disabled={busy} onClick={onDuplicate} aria-label={`Make a copy of ${template.name}`}>
            Copy
          </JoyButton>
        ) : null}
        {/* Only the person who saved a design can change or delete it. */}
        {canWrite && template.isOwn ? (
          <>
            <JoyButton size="sm" color="neutral" variant="outlined" startDecorator={<Pencil size={14} />} disabled={busy} onClick={onEdit} aria-label={`Edit details of ${template.name}`}>
              Details
            </JoyButton>
            <JoyButton size="sm" color="neutral" variant="plain" startDecorator={<Trash2 size={14} />} disabled={busy} onClick={onDelete} aria-label={`Delete ${template.name}`}>
              Delete
            </JoyButton>
          </>
        ) : null}
      </Stack>
    </Sheet>
  );
}

export function CampaignTemplatesPage() {
  const navigate = useNavigate();
  const { hasPermission } = useUserRole();
  const canDesign = hasPermission("content.design");
  const canWrite = hasPermission("campaigns.write");
  const {
    savedTemplates,
    isLoading,
    error,
    updateTemplateDetails,
    duplicateTemplate,
    archiveTemplate,
    isUpdatingDetails,
    isDuplicating,
    isArchiving,
  } = useSavedTemplates();
  const [filters, setFilters] = React.useState<TemplateFilters>(DEFAULT_TEMPLATE_FILTERS);
  const [editing, setEditing] = React.useState<SavedTemplate | null>(null);
  const [draft, setDraft] = React.useState({ name: "", description: "", category: "", tags: "", isLocked: false });
  const [deleting, setDeleting] = React.useState<SavedTemplate | null>(null);
  const busy = isUpdatingDetails || isDuplicating || isArchiving;

  const shown = React.useMemo(() => filterTemplates(savedTemplates, filters), [filters, savedTemplates]);
  const categories = React.useMemo(() => categoriesInUse(savedTemplates), [savedTemplates]);
  const hasUncategorised = savedTemplates.some((template) => !template.category);
  const filtersOn = Boolean(filters.search || filters.category || filters.owner);

  const openEdit = (template: SavedTemplate) => {
    setDraft({
      name: template.name,
      description: template.description ?? "",
      category: template.category ?? "",
      tags: template.tags.join(", "),
      isLocked: template.isLocked,
    });
    setEditing(template);
  };

  const saveDetails = async () => {
    if (!editing) return;
    try {
      await updateTemplateDetails({
        id: editing.id,
        name: draft.name,
        description: draft.description,
        category: draft.category,
        tags: parseTagInput(draft.tags),
        ...(canDesign && draft.isLocked !== editing.isLocked ? { isLocked: draft.isLocked } : {}),
      });
      toast.success("Template details saved");
      setEditing(null);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "The details could not be saved. Try again.");
    }
  };

  const copy = async (template: SavedTemplate) => {
    try {
      const created = await duplicateTemplate(template);
      toast.success(`Copied as "${created.name}"`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "The template could not be copied. Try again.");
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await archiveTemplate(deleting.id);
      toast.success("Template deleted");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "The template could not be deleted. Try again.");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <PageContainer>
      <Stack spacing={2.5}>
        <Stack spacing={1}>
          <JoyButton
            variant="plain"
            color="neutral"
            size="sm"
            startDecorator={<ArrowLeft size={14} />}
            onClick={() => navigate("/crm/campaigns")}
            sx={{ alignSelf: "flex-start", px: 0.5 }}
          >
            Back to campaigns
          </JoyButton>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} justifyContent="space-between" alignItems={{ md: "center" }}>
            <Stack spacing={0.25}>
              <PageTitle>Templates</PageTitle>
              <Typography level="body-sm" sx={{ color: "neutral.700", maxWidth: 640 }}>
                Designs your business has saved to use again. A template is never sent. Using one makes a new email, and later changes to the template do not change that email.
              </Typography>
            </Stack>
            {canWrite ? (
              <JoyButton color="neutral" variant="solid" startDecorator={<Plus size={16} />} onClick={() => navigate("/crm/campaigns/new?type=email")}>
                Design a new email
              </JoyButton>
            ) : null}
          </Stack>
        </Stack>

        {savedTemplates.length > 0 ? (
          <Sheet variant="outlined" sx={{ borderRadius: "lg", p: 1.5 }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.25} alignItems={{ md: "flex-end" }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <JoyInput
                  label="Search"
                  placeholder="Name, category or tag"
                  value={filters.search}
                  onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                />
              </Box>
              <Box sx={{ width: { xs: "100%", md: 200 } }}>
                <JoySelect
                  label="Category"
                  value={filters.category}
                  onValueChange={(category) => setFilters((current) => ({ ...current, category }))}
                  options={[
                    { value: "", label: "All categories" },
                    ...categories.map((category) => ({ value: category, label: category })),
                    ...(hasUncategorised && categories.length > 0 ? [{ value: "none", label: "No category" }] : []),
                  ]}
                />
              </Box>
              <Box sx={{ width: { xs: "100%", md: 180 } }}>
                <JoySelect
                  label="Saved by"
                  value={filters.owner}
                  onValueChange={(owner) => setFilters((current) => ({ ...current, owner: owner === "mine" ? "mine" : "" }))}
                  options={[
                    { value: "", label: "Anyone" },
                    { value: "mine", label: "Me" },
                  ]}
                />
              </Box>
              <Box sx={{ width: { xs: "100%", md: 180 } }}>
                <JoySelect
                  label="Sort"
                  value={filters.sort}
                  onValueChange={(sort) => setFilters((current) => ({ ...current, sort: sort as TemplateSort }))}
                  options={TEMPLATE_SORTS.map(({ value, label }) => ({ value, label }))}
                />
              </Box>
            </Stack>
            <Typography level="body-xs" role="status" sx={{ color: "neutral.600", mt: 1 }}>
              Showing {shown.length} of {savedTemplates.length} template{savedTemplates.length === 1 ? "" : "s"}
            </Typography>
          </Sheet>
        ) : null}

        {error ? (
          <Sheet variant="soft" color="warning" role="alert" sx={{ borderRadius: "lg", p: 2 }}>
            <Typography level="body-sm">Your templates could not be loaded. Check your connection and reload the page.</Typography>
          </Sheet>
        ) : isLoading ? (
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))" }, gap: 2 }}>
            {[0, 1, 2].map((key) => (
              <Skeleton key={key} variant="rectangular" height={320} sx={{ borderRadius: "lg" }} />
            ))}
          </Box>
        ) : savedTemplates.length === 0 ? (
          <Sheet variant="outlined" sx={{ borderRadius: "lg" }}>
            <JoyEmptyState
              icon={<LayoutTemplate size={28} />}
              title="No templates yet"
              description="Build an email in Design Studio, then choose Save as template. It will appear here for your whole team to reuse."
              primaryAction={canWrite ? { label: "Design a new email", onClick: () => navigate("/crm/campaigns/new?type=email") } : undefined}
            />
          </Sheet>
        ) : shown.length === 0 ? (
          <Sheet variant="outlined" sx={{ borderRadius: "lg" }}>
            <JoyEmptyState
              icon={<LayoutTemplate size={28} />}
              title="No templates match"
              description="Try a different word, or clear the filters."
              primaryAction={filtersOn ? { label: "Clear filters", onClick: () => setFilters((current) => ({ ...DEFAULT_TEMPLATE_FILTERS, sort: current.sort })) } : undefined}
            />
          </Sheet>
        ) : (
          <Box
            data-testid="template-library-grid"
            sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}
          >
            {shown.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                canWrite={canWrite}
                busy={busy}
                onUse={() => navigate(newEmailFromTemplatePath(template.id))}
                onEdit={() => openEdit(template)}
                onDuplicate={() => void copy(template)}
                onDelete={() => setDeleting(template)}
              />
            ))}
          </Box>
        )}
      </Stack>

      <JoyDialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Template details"
        description="These help your team find the right design. They do not change the design itself."
        size="md"
      >
        <JoyDialogContent>
          <Stack spacing={1.5}>
            <JoyInput label="Name" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
            <JoyTextarea label="Description" minRows={2} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
            <JoySelect
              label="Category"
              value={draft.category}
              onValueChange={(category) => setDraft((current) => ({ ...current, category }))}
              options={[
                { value: "", label: "No category" },
                ...Array.from(new Set([...TEMPLATE_CATEGORIES, ...(draft.category ? [draft.category] : [])])).map((category) => ({ value: category, label: category })),
              ]}
            />
            <JoyInput
              label="Tags"
              placeholder="sale, perennials, weekend"
              helperText="Separate tags with commas."
              value={draft.tags}
              onChange={(event) => setDraft((current) => ({ ...current, tags: event.target.value }))}
            />
            {canDesign ? (
              <Stack spacing={0.5}>
                <Stack direction="row" spacing={1.25} alignItems="center">
                  <Switch
                    checked={draft.isLocked}
                    onChange={(event) => setDraft((current) => ({ ...current, isLocked: event.target.checked }))}
                    slotProps={{ input: { "aria-label": "Lock this design" } }}
                  />
                  <Typography level="body-md">Lock this design</Typography>
                </Stack>
                <Typography level="body-sm" sx={{ color: "neutral.700" }}>
                  Emails started from a locked design keep its layout, colours and styling. Staff who cannot
                  change designs can still change the words, photos, prices, dates and links.
                </Typography>
              </Stack>
            ) : null}
          </Stack>
        </JoyDialogContent>
        <JoyDialogActions>
          <JoyButton variant="plain" color="neutral" onClick={() => setEditing(null)}>Cancel</JoyButton>
          <JoyButton color="neutral" variant="solid" loading={isUpdatingDetails} disabled={!draft.name.trim()} onClick={() => void saveDetails()}>
            Save details
          </JoyButton>
        </JoyDialogActions>
      </JoyDialog>

      <JoyAlertDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        variant="warning"
        loading={isArchiving}
        title={`Delete "${deleting?.name ?? ""}"?`}
        description="This removes the template for your whole team and cannot be undone. Emails already made from it are not changed."
        confirmLabel="Delete template"
      />
    </PageContainer>
  );
}

export default CampaignTemplatesPage;
