import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import Avatar from "@mui/joy/Avatar";
import Box from "@mui/joy/Box";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  Archive,
  Copy,
  Eye,
  FileText,
  Globe,
  Inbox,
  LayoutGrid,
  Link2,
  List,
  MoreHorizontal,
  Plus,
  RefreshCw,
  TrendingUp,
  Trash2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { CatalogGridSkeleton } from "@/components/crm/catalog/CatalogCardSkeleton";
import {
  CatalogStatsStrip,
  CatalogStatsStripSkeleton,
} from "@/components/crm/catalog/CatalogStatsStrip";
import { FormTemplatesDialog } from "@/components/forms/FormTemplatesDialog";
import { FormPreviewDialog } from "@/components/forms/preview/FormPreviewDialog";
import { JoyAlertDialog } from "@/components/joy/JoyAlertDialog";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoyChip } from "@/components/joy/JoyChip";
import {
  JoyDropdownMenu,
  JoyDropdownMenuContent,
  JoyDropdownMenuItem,
  JoyDropdownMenuSeparator,
  JoyDropdownMenuTrigger,
} from "@/components/joy/JoyDropdownMenu";
import { JoyPageHeaderBand } from "@/components/joy/JoyPageHeaderBand";
import { JoySearchInput } from "@/components/joy/JoySearchInput";
import { JoySelect } from "@/components/joy/JoySelect";
import {
  JoyTable,
  JoyTableBody,
  JoyTableCell,
  JoyTableHead,
  JoyTableHeaderCell,
  JoyTableRow,
} from "@/components/joy/JoyTable";
import { JoyTooltip } from "@/components/joy/JoyTooltip";
import { PageContainer } from "@/components/joy/PageContainer";
import { useForms } from "@/hooks/useForms";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import {
  createFormFromTemplate,
  createStarterForm,
  getTemplateById,
} from "@/lib/formTemplates";
import { getPublicFormUrl } from "@/lib/forms/share";
import type {
  FormCompliance,
  FormField,
  FormSettings,
  FormStatus,
  FormWithStats,
} from "@/types/formBuilder";

type StatusFilter = "all" | FormStatus;
type SortOption =
  | "newest"
  | "oldest"
  | "name-asc"
  | "name-desc"
  | "submissions-desc"
  | "submissions-asc";
type ViewMode = "grid" | "list";

type ConfirmAction = {
  kind: "delete";
  form: FormWithStats;
} | null;

interface FormCreatePayload {
  name: string;
  fields_json?: FormField[];
  settings_json?: FormSettings;
  compliance_json?: FormCompliance;
}

const GRID_COLUMNS = {
  xs: "1fr",
  md: "repeat(2, minmax(0, 1fr))",
  xl: "repeat(3, minmax(0, 1fr))",
} as const;

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "name-asc", label: "Name A-Z" },
  { value: "name-desc", label: "Name Z-A" },
  { value: "submissions-desc", label: "Most submissions" },
  { value: "submissions-asc", label: "Fewest submissions" },
];

const isStatusFilter = (value: string | null): value is StatusFilter =>
  STATUS_OPTIONS.some((option) => option.value === value);

const isSortOption = (value: string | null): value is SortOption =>
  SORT_OPTIONS.some((option) => option.value === value);

const isViewMode = (value: string | null): value is ViewMode =>
  value === "grid" || value === "list";

const getStatusColor = (status: FormStatus) => {
  switch (status) {
    case "published":
      return "success" as const;
    case "archived":
      return "neutral" as const;
    case "draft":
    default:
      return "warning" as const;
  }
};

function CreateFormCard({ onClick }: { onClick: () => void }) {
  return (
    <JoyCard
      interactive
      onClick={onClick}
      sx={{
        minHeight: 272,
        display: "grid",
        placeItems: "center",
        borderStyle: "dashed",
        borderColor: "neutral.200",
        boxShadow: "none",
        textAlign: "center",
        "&:hover": {
          borderColor: "neutral.400",
          boxShadow: "none",
        },
      }}
    >
      <JoyCardContent
        sx={{
          pt: 4,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 1,
        }}
      >
        <Plus size={24} color="var(--joy-palette-neutral-300)" />
        <Typography
          level="body-sm"
          sx={{ fontWeight: 500, color: "neutral.700" }}
        >
          Create your first form
        </Typography>
      </JoyCardContent>
    </JoyCard>
  );
}

function FormsEmptyState({
  onCreate,
  filtered,
}: {
  onCreate: () => void;
  filtered: boolean;
}) {
  return (
    <Sheet
      variant="soft"
      sx={{
        borderRadius: "lg",
        px: 3,
        py: 6,
        textAlign: "center",
      }}
    >
      <Stack spacing={1.5} alignItems="center">
        <Avatar size="lg" variant="soft" color="neutral">
          <FileText size={24} />
        </Avatar>
        <Typography level="title-md">
          {filtered ? "No forms match these filters" : "No forms yet"}
        </Typography>
        <Typography level="body-sm" color="neutral" sx={{ maxWidth: 420 }}>
          {filtered
            ? "Adjust the current filters or create a new form to start collecting submissions."
            : "Build, publish, and track customer-facing forms for newsletters, waitlists, events, and feedback."}
        </Typography>
        <JoyButton onClick={onCreate} startDecorator={<Plus size={16} />}>
          New form
        </JoyButton>
      </Stack>
    </Sheet>
  );
}

function FormsTableSkeleton() {
  return (
    <JoyCard>
      <JoyCardContent sx={{ pt: 0 }}>
        <JoyTable>
          <JoyTableHead>
            <JoyTableRow>
              {Array.from({ length: 5 }).map((_, index) => (
                <JoyTableHeaderCell key={index}>
                  <Skeleton
                    variant="text"
                    width={72}
                    height={14}
                    animation="wave"
                  />
                </JoyTableHeaderCell>
              ))}
            </JoyTableRow>
          </JoyTableHead>
          <JoyTableBody>
            {Array.from({ length: 6 }).map((_, index) => (
              <JoyTableRow key={index}>
                {Array.from({ length: 5 }).map((__, cellIndex) => (
                  <JoyTableCell key={cellIndex}>
                    <Skeleton
                      variant="text"
                      width={cellIndex === 0 ? 180 : 72}
                      height={16}
                      animation="wave"
                    />
                  </JoyTableCell>
                ))}
              </JoyTableRow>
            ))}
          </JoyTableBody>
        </JoyTable>
      </JoyCardContent>
    </JoyCard>
  );
}

export default function FormsPage() {
  const navigate = useNavigate();
  const { tenant } = useTenant();
  const tenantId = tenant?.id;
  const [searchParams, setSearchParams] = useSearchParams();
  const handledTemplateRef = React.useRef<string | null>(null);
  const {
    forms,
    isLoading,
    isRefetching,
    error,
    refetchForms,
    createForm,
    updateForm,
    deleteForm,
    isCreating,
    isUpdating,
    isDeleting,
  } = useForms();
  const [templatesDialogOpen, setTemplatesDialogOpen] = React.useState(false);
  const [confirmAction, setConfirmAction] = React.useState<ConfirmAction>(null);
  const [previewForm, setPreviewForm] = React.useState<FormWithStats | null>(
    null,
  );
  const [pendingFormId, setPendingFormId] = React.useState<string | null>(null);

  const query = searchParams.get("q") ?? "";
  const status = isStatusFilter(searchParams.get("status"))
    ? searchParams.get("status")
    : "all";
  const sort = isSortOption(searchParams.get("sort"))
    ? searchParams.get("sort")
    : "newest";
  const view = isViewMode(searchParams.get("view"))
    ? searchParams.get("view")
    : "grid";

  const monthSubmissionsQuery = useQuery({
    queryKey: ["forms-month-submissions", tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      if (!tenantId) {
        return 0;
      }

      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const { count, error: countError } = await supabase
        .from("form_submissions")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .gte("submitted_at", monthStart.toISOString());

      if (countError) {
        throw countError;
      }

      return count ?? 0;
    },
    staleTime: 60_000,
  });

  const updateSearchParams = React.useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams);

      Object.entries(updates).forEach(([key, value]) => {
        if (!value) {
          next.delete(key);
          return;
        }

        next.set(key, value);
      });

      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const handleCreateFromPayload = React.useCallback(
    async (payload: FormCreatePayload) => {
      try {
        const newForm = await createForm(payload);
        if (newForm?.id) {
          setTemplatesDialogOpen(false);
          navigate(`/crm/forms/${newForm.id}?tab=build`);
        }
      } catch {
        // Mutation toasts in the hook.
      }
    },
    [createForm, navigate],
  );

  const handleStartFromScratch = React.useCallback(async () => {
    const starterForm = createStarterForm();
    await handleCreateFromPayload({
      name: "Untitled Form",
      fields_json: starterForm.fields_json,
    });
  }, [handleCreateFromPayload]);

  const handleDuplicate = React.useCallback(
    async (form: FormWithStats) => {
      try {
        const duplicated = await createForm({
          name: `${form.name} (Copy)`,
          fields_json: form.fields_json,
          settings_json: form.settings_json,
          compliance_json: form.compliance_json,
          audience_json: form.audience_json,
        });

        if (duplicated?.id) {
          toast.success("Form duplicated");
          navigate(`/crm/forms/${duplicated.id}?tab=build`);
        }
      } catch {
        // Mutation toasts in the hook.
      }
    },
    [createForm, navigate],
  );

  const handleTemplatesDialogOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      setTemplatesDialogOpen(nextOpen);

      if (nextOpen) {
        return;
      }

      const nextParams = new URLSearchParams(searchParams);
      const hadParams = nextParams.has("create") || nextParams.has("template");
      nextParams.delete("create");
      nextParams.delete("template");

      if (hadParams) {
        setSearchParams(nextParams, { replace: true });
      }
    },
    [searchParams, setSearchParams],
  );

  React.useEffect(() => {
    if (searchParams.get("create") === "1") {
      setTemplatesDialogOpen(true);
    }
  }, [searchParams]);

  React.useEffect(() => {
    const templateId = searchParams.get("template");

    if (!templateId) {
      handledTemplateRef.current = null;
      return;
    }

    if (handledTemplateRef.current === templateId || isCreating) {
      return;
    }

    const template = getTemplateById(templateId);

    if (!template) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("template");
      setSearchParams(nextParams, { replace: true });
      toast.error("That form template is no longer available.");
      return;
    }

    handledTemplateRef.current = templateId;
    const templatePayload = createFormFromTemplate(template);

    void handleCreateFromPayload({
      name: template.name,
      fields_json: templatePayload.fields_json,
      settings_json: templatePayload.settings_json,
      compliance_json: templatePayload.compliance_json,
    });
  }, [handleCreateFromPayload, isCreating, searchParams, setSearchParams]);

  const handleCopyPublicLink = React.useCallback(
    async (form: FormWithStats) => {
      if (!form.embed_key) {
        toast.error("This form does not have a public URL yet.");
        return;
      }

      try {
        await navigator.clipboard.writeText(getPublicFormUrl(form.embed_key));
        toast.success("Public form link copied");
      } catch {
        toast.error("Unable to copy the public form URL");
      }
    },
    [],
  );

  const handleArchiveToggle = React.useCallback(
    async (form: FormWithStats) => {
      setPendingFormId(form.id);

      try {
        await updateForm({
          id: form.id,
          status: form.status === "archived" ? "draft" : "archived",
        });
        toast.success(
          form.status === "archived" ? "Form restored" : "Form archived",
        );
      } catch {
        // Mutation toasts in the hook.
      } finally {
        setPendingFormId(null);
      }
    },
    [updateForm],
  );

  const filteredForms = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return [...forms]
      .filter((form) => {
        if (status !== "all" && form.status !== status) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        const haystack = [
          form.name,
          form.settings_json.form_description,
          form.settings_json.form_title,
          form.settings_json.form_headline,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(normalizedQuery);
      })
      .sort((left, right) => {
        switch (sort) {
          case "oldest":
            return (
              new Date(left.created_at).getTime() -
              new Date(right.created_at).getTime()
            );
          case "name-asc":
            return left.name.localeCompare(right.name);
          case "name-desc":
            return right.name.localeCompare(left.name);
          case "submissions-asc":
            return left.total_submissions - right.total_submissions;
          case "submissions-desc":
            return right.total_submissions - left.total_submissions;
          case "newest":
          default:
            return (
              new Date(right.created_at).getTime() -
              new Date(left.created_at).getTime()
            );
        }
      });
  }, [forms, query, sort, status]);

  const totalSubmissions = React.useMemo(
    () => forms.reduce((total, form) => total + form.total_submissions, 0),
    [forms],
  );
  const publishedCount = React.useMemo(
    () => forms.filter((form) => form.status === "published").length,
    [forms],
  );
  const draftCount = React.useMemo(
    () => forms.filter((form) => form.status === "draft").length,
    [forms],
  );
  const isPageLoading = isLoading || monthSubmissionsQuery.isLoading;
  const hasActiveFilters =
    Boolean(query.trim()) || status !== "all" || sort !== "newest";
  const hasNoForms = !isPageLoading && forms.length === 0;
  const hasNoFilteredResults =
    !isPageLoading && forms.length > 0 && filteredForms.length === 0;
  const statusFilterLabel =
    status === "all"
      ? "Status"
      : (STATUS_OPTIONS.find((option) => option.value === status)?.label ??
        "Status");
  const sortFilterLabel =
    SORT_OPTIONS.find((option) => option.value === sort)?.label ?? "Newest";
  const searchPlaceholder =
    !query && status !== "all"
      ? `Search ${filteredForms.length.toLocaleString()} forms...`
      : "Search forms...";
  const statsItems = [
    {
      label: "Total forms",
      value: forms.length.toLocaleString(),
      icon: <FileText size={18} />,
      iconColor: "primary" as const,
    },
    {
      label: "Published forms",
      value: publishedCount.toLocaleString(),
      icon: <Globe size={18} />,
      iconColor: "success" as const,
    },
    {
      label: "Total submissions",
      value: totalSubmissions.toLocaleString(),
      icon: <Inbox size={18} />,
      iconColor: "warning" as const,
    },
    {
      label: "This month",
      value: (monthSubmissionsQuery.data ?? 0).toLocaleString(),
      icon: <TrendingUp size={18} />,
      iconColor: "neutral" as const,
    },
  ];

  const handleDelete = async () => {
    if (!confirmAction || confirmAction.kind !== "delete") {
      return;
    }

    setPendingFormId(confirmAction.form.id);
    try {
      await deleteForm(confirmAction.form.id);
      setConfirmAction(null);
    } finally {
      setPendingFormId(null);
    }
  };

  return (
    <PageContainer
      fullWidth
      sx={{ px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}
    >
      <Stack spacing={3} sx={{ pb: 4 }}>
        <JoyPageHeaderBand
          title="Forms"
          description="Build, publish, and track customer forms for lead capture, signups, and feedback."
          metadata={
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <JoyChip size="sm" variant="soft" color="neutral">
                {forms.length} forms
              </JoyChip>
              <JoyChip size="sm" variant="soft" color="success">
                {publishedCount} published
              </JoyChip>
              <JoyChip size="sm" variant="soft" color="warning">
                {draftCount} drafts
              </JoyChip>
            </Stack>
          }
          actions={
            <Stack direction="row" spacing={1}>
              <JoyTooltip title="Refresh forms">
                <IconButton
                  variant="plain"
                  color="neutral"
                  size="sm"
                  onClick={() => {
                    void Promise.all([
                      refetchForms(),
                      monthSubmissionsQuery.refetch(),
                    ]);
                  }}
                >
                  <RefreshCw size={16} />
                </IconButton>
              </JoyTooltip>
              <JoyButton
                size="sm"
                startDecorator={<Plus size={16} />}
                onClick={() => setTemplatesDialogOpen(true)}
              >
                New form
              </JoyButton>
            </Stack>
          }
          sx={{ px: 0, py: 0, borderRadius: 0, background: "transparent" }}
        />

        {isPageLoading ? (
          <CatalogStatsStripSkeleton />
        ) : (
          <CatalogStatsStrip items={statsItems} />
        )}

        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={1.25}
          alignItems={{ xs: "stretch", lg: "center" }}
          justifyContent="space-between"
        >
          <Box
            sx={{
              width: "100%",
              maxWidth: { lg: 340, xl: 400 },
              minWidth: 0,
            }}
          >
            <JoySearchInput
              value={query}
              placeholder={searchPlaceholder}
              onDebouncedChange={(value) =>
                updateSearchParams({ q: value || null })
              }
              onClear={() => updateSearchParams({ q: null })}
            />
          </Box>

          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            justifyContent={{ xs: "flex-start", lg: "flex-end" }}
            useFlexGap
            flexWrap="wrap"
            sx={{ minWidth: 0 }}
          >
            <JoySelect
              fullWidth={false}
              value={status}
              options={STATUS_OPTIONS}
              renderValue={() => statusFilterLabel}
              onValueChange={(value) =>
                updateSearchParams({
                  status: value === "all" ? null : value,
                })
              }
              formControlSx={{ width: "auto" }}
              slotProps={{
                button: {
                  sx: {
                    minWidth: 132,
                    justifyContent: "space-between",
                  },
                },
              }}
            />

            <JoySelect
              fullWidth={false}
              value={sort}
              options={SORT_OPTIONS}
              renderValue={() => sortFilterLabel}
              onValueChange={(value) =>
                updateSearchParams({
                  sort: value === "newest" ? null : value,
                })
              }
              formControlSx={{ width: "auto" }}
              slotProps={{
                button: {
                  sx: {
                    minWidth: 156,
                    justifyContent: "space-between",
                  },
                },
              }}
            />

            <Box
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.5,
                p: 0.375,
                borderRadius: "xl",
                border: "1px solid",
                borderColor: "neutral.200",
                backgroundColor: "background.level1",
              }}
            >
              <JoyTooltip title="Grid view">
                <IconButton
                  variant={view === "grid" ? "soft" : "plain"}
                  color="neutral"
                  size="sm"
                  aria-label="Grid view"
                  onClick={() => updateSearchParams({ view: null })}
                >
                  <LayoutGrid size={16} />
                </IconButton>
              </JoyTooltip>
              <JoyTooltip title="List view">
                <IconButton
                  variant={view === "list" ? "soft" : "plain"}
                  color="neutral"
                  size="sm"
                  aria-label="List view"
                  onClick={() => updateSearchParams({ view: "list" })}
                >
                  <List size={16} />
                </IconButton>
              </JoyTooltip>
            </Box>
          </Stack>
        </Stack>

        {error ? (
          <JoyCard>
            <JoyCardContent sx={{ pt: 4, gap: 1.5 }}>
              <Typography level="title-md">Unable to load forms</Typography>
              <Typography level="body-sm" color="neutral">
                {error instanceof Error ? error.message : "Unknown error"}
              </Typography>
              <Stack direction="row">
                <JoyButton
                  variant="plain"
                  color="primary"
                  onClick={() => {
                    void Promise.all([
                      refetchForms(),
                      monthSubmissionsQuery.refetch(),
                    ]);
                  }}
                >
                  Retry
                </JoyButton>
              </Stack>
            </JoyCardContent>
          </JoyCard>
        ) : null}

        {isPageLoading ? (
          view === "grid" ? (
            <CatalogGridSkeleton
              columns={GRID_COLUMNS}
              headingWidth={120}
              cardCount={8}
              minHeight={272}
            />
          ) : (
            <FormsTableSkeleton />
          )
        ) : hasNoForms ? (
          <FormsEmptyState
            filtered={false}
            onCreate={() => setTemplatesDialogOpen(true)}
          />
        ) : hasNoFilteredResults ? (
          <FormsEmptyState
            filtered
            onCreate={() => setTemplatesDialogOpen(true)}
          />
        ) : view === "grid" ? (
          <Box
            sx={{ display: "grid", gridTemplateColumns: GRID_COLUMNS, gap: 2 }}
          >
            <CreateFormCard onClick={() => setTemplatesDialogOpen(true)} />
            {filteredForms.map((form) => {
              const publicUrl = getPublicFormUrl(form.embed_key);
              const pending =
                pendingFormId === form.id && (isDeleting || isUpdating);

              return (
                <JoyCard
                  key={form.id}
                  interactive
                  onClick={() => navigate(`/crm/forms/${form.id}?tab=build`)}
                  sx={{
                    minHeight: 272,
                    borderColor: "neutral.200",
                    boxShadow: "var(--joy-shadow-xs)",
                    transition:
                      "transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease",
                    "&:hover": {
                      transform: "translateY(-2px)",
                      boxShadow: "var(--joy-shadow-md)",
                      borderColor: "neutral.300",
                    },
                  }}
                >
                  <JoyCardHeader
                    startDecorator={
                      <Avatar size="sm" variant="soft" color="neutral">
                        <FileText size={18} />
                      </Avatar>
                    }
                    title={form.name}
                    description={
                      form.settings_json.form_description ||
                      "No description added yet."
                    }
                    actions={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <JoyChip
                          size="sm"
                          variant="soft"
                          color={getStatusColor(form.status)}
                        >
                          {form.status.charAt(0).toUpperCase() +
                            form.status.slice(1)}
                        </JoyChip>
                        <JoyDropdownMenu>
                          <JoyDropdownMenuTrigger>
                            <MoreHorizontal size={16} />
                          </JoyDropdownMenuTrigger>
                          <JoyDropdownMenuContent>
                            <JoyDropdownMenuItem
                              startDecorator={<FileText size={16} />}
                              onClick={() =>
                                navigate(`/crm/forms/${form.id}?tab=build`)
                              }
                            >
                              Edit form
                            </JoyDropdownMenuItem>
                            <JoyDropdownMenuItem
                              startDecorator={<Eye size={16} />}
                              onClick={() => setPreviewForm(form)}
                            >
                              Preview
                            </JoyDropdownMenuItem>
                            <JoyDropdownMenuItem
                              startDecorator={<Inbox size={16} />}
                              onClick={() =>
                                navigate(
                                  `/crm/forms/${form.id}?tab=submissions`,
                                )
                              }
                            >
                              View submissions
                            </JoyDropdownMenuItem>
                            <JoyDropdownMenuItem
                              startDecorator={<Copy size={16} />}
                              onClick={() => void handleCopyPublicLink(form)}
                            >
                              Copy public link
                            </JoyDropdownMenuItem>
                            <JoyDropdownMenuItem
                              startDecorator={<Link2 size={16} />}
                              onClick={() =>
                                navigate(`/crm/forms/${form.id}?tab=publish`)
                              }
                            >
                              Get embed code
                            </JoyDropdownMenuItem>
                            <JoyDropdownMenuItem
                              startDecorator={<Copy size={16} />}
                              onClick={() => void handleDuplicate(form)}
                            >
                              Duplicate
                            </JoyDropdownMenuItem>
                            <JoyDropdownMenuSeparator />
                            <JoyDropdownMenuItem
                              startDecorator={<Archive size={16} />}
                              onClick={() => void handleArchiveToggle(form)}
                            >
                              {form.status === "archived"
                                ? "Unarchive"
                                : "Archive"}
                            </JoyDropdownMenuItem>
                            <JoyDropdownMenuItem
                              destructive
                              startDecorator={<Trash2 size={16} />}
                              onClick={() =>
                                setConfirmAction({ kind: "delete", form })
                              }
                            >
                              Delete
                            </JoyDropdownMenuItem>
                          </JoyDropdownMenuContent>
                        </JoyDropdownMenu>
                      </Stack>
                    }
                  />
                  <JoyCardContent
                    sx={{
                      pt: 3,
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                      mt: "auto",
                    }}
                  >
                    <Typography
                      level="body-sm"
                      color="neutral"
                      sx={{
                        display: "-webkit-box",
                        overflow: "hidden",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                        minHeight: 60,
                      }}
                    >
                      {form.settings_json.form_headline ||
                        form.settings_json.form_description ||
                        "No supporting copy has been added yet."}
                    </Typography>

                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                        gap: 1.5,
                      }}
                    >
                      <Box>
                        <Typography level="body-xs" color="neutral">
                          Submissions
                        </Typography>
                        <Typography level="title-sm">
                          {form.total_submissions.toLocaleString()}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography level="body-xs" color="neutral">
                          Updated
                        </Typography>
                        <Typography level="body-sm">
                          {formatDistanceToNow(new Date(form.updated_at), {
                            addSuffix: true,
                          })}
                        </Typography>
                      </Box>
                    </Box>

                    <Stack direction="row" spacing={1}>
                      <JoyButton
                        variant="soft"
                        color="neutral"
                        fullWidth
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(`/crm/forms/${form.id}?tab=build`);
                        }}
                      >
                        Edit form
                      </JoyButton>
                      <JoyButton
                        fullWidth
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(`/crm/forms/${form.id}?tab=submissions`);
                        }}
                        disabled={pending}
                      >
                        View submissions
                      </JoyButton>
                    </Stack>

                    {form.status === "published" ? (
                      <Typography level="body-xs" color="neutral">
                        Public URL: {publicUrl.replace(/^https?:\/\//, "")}
                      </Typography>
                    ) : null}
                  </JoyCardContent>
                </JoyCard>
              );
            })}
          </Box>
        ) : (
          <JoyCard>
            <JoyCardContent sx={{ pt: 0 }}>
              <JoyTable stickyHeader>
                <JoyTableHead>
                  <JoyTableRow>
                    <JoyTableHeaderCell>Form</JoyTableHeaderCell>
                    <JoyTableHeaderCell>Status</JoyTableHeaderCell>
                    <JoyTableHeaderCell align="right">
                      Submissions
                    </JoyTableHeaderCell>
                    <JoyTableHeaderCell>Updated</JoyTableHeaderCell>
                    <JoyTableHeaderCell align="right">
                      Actions
                    </JoyTableHeaderCell>
                  </JoyTableRow>
                </JoyTableHead>
                <JoyTableBody>
                  {filteredForms.map((form) => (
                    <JoyTableRow
                      key={form.id}
                      clickable
                      onClick={() =>
                        navigate(`/crm/forms/${form.id}?tab=build`)
                      }
                    >
                      <JoyTableCell>
                        <Stack spacing={0.5}>
                          <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                            {form.name}
                          </Typography>
                          <Typography level="body-xs" color="neutral">
                            {form.settings_json.form_description ||
                              "No description"}
                          </Typography>
                        </Stack>
                      </JoyTableCell>
                      <JoyTableCell>
                        <JoyChip
                          size="sm"
                          variant="soft"
                          color={getStatusColor(form.status)}
                        >
                          {form.status.charAt(0).toUpperCase() +
                            form.status.slice(1)}
                        </JoyChip>
                      </JoyTableCell>
                      <JoyTableCell align="right">
                        {form.total_submissions.toLocaleString()}
                      </JoyTableCell>
                      <JoyTableCell>
                        {formatDistanceToNow(new Date(form.updated_at), {
                          addSuffix: true,
                        })}
                      </JoyTableCell>
                      <JoyTableCell align="right">
                        <JoyDropdownMenu>
                          <JoyDropdownMenuTrigger>
                            <MoreHorizontal size={16} />
                          </JoyDropdownMenuTrigger>
                          <JoyDropdownMenuContent>
                            <JoyDropdownMenuItem
                              onClick={() =>
                                navigate(`/crm/forms/${form.id}?tab=build`)
                              }
                            >
                              Edit form
                            </JoyDropdownMenuItem>
                            <JoyDropdownMenuItem
                              onClick={() =>
                                navigate(
                                  `/crm/forms/${form.id}?tab=submissions`,
                                )
                              }
                            >
                              View submissions
                            </JoyDropdownMenuItem>
                            <JoyDropdownMenuItem
                              onClick={() => setPreviewForm(form)}
                            >
                              Preview
                            </JoyDropdownMenuItem>
                            <JoyDropdownMenuItem
                              onClick={() =>
                                navigate(`/crm/forms/${form.id}?tab=publish`)
                              }
                            >
                              Get embed code
                            </JoyDropdownMenuItem>
                            <JoyDropdownMenuSeparator />
                            <JoyDropdownMenuItem
                              onClick={() => void handleArchiveToggle(form)}
                            >
                              {form.status === "archived"
                                ? "Unarchive"
                                : "Archive"}
                            </JoyDropdownMenuItem>
                            <JoyDropdownMenuItem
                              destructive
                              onClick={() =>
                                setConfirmAction({ kind: "delete", form })
                              }
                            >
                              Delete
                            </JoyDropdownMenuItem>
                          </JoyDropdownMenuContent>
                        </JoyDropdownMenu>
                      </JoyTableCell>
                    </JoyTableRow>
                  ))}
                </JoyTableBody>
              </JoyTable>
            </JoyCardContent>
          </JoyCard>
        )}
      </Stack>

      <FormTemplatesDialog
        open={templatesDialogOpen}
        onOpenChange={handleTemplatesDialogOpenChange}
        isCreating={isCreating}
        onStartFromScratch={() => void handleStartFromScratch()}
        onSelect={(templateData) => void handleCreateFromPayload(templateData)}
      />

      <FormPreviewDialog
        open={Boolean(previewForm)}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewForm(null);
          }
        }}
        fields={previewForm?.fields_json ?? []}
        settings={previewForm?.settings_json ?? null}
        compliance={previewForm?.compliance_json ?? null}
        formName={previewForm?.name ?? ""}
        uploadEmbedKey={previewForm?.embed_key}
      />

      <JoyAlertDialog
        open={Boolean(confirmAction)}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => void handleDelete()}
        title={`Delete ${confirmAction?.form.name ?? "form"}?`}
        description="This permanently removes the form and its configuration. Existing submission records are not recoverable through the editor."
        confirmLabel="Delete form"
        loading={Boolean(
          confirmAction &&
          pendingFormId === confirmAction.form.id &&
          isDeleting,
        )}
        variant="danger"
      />
    </PageContainer>
  );
}
