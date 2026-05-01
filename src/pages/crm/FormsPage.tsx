import * as React from "react";
import Checkbox from "@mui/joy/Checkbox";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Divider from "@mui/joy/Divider";
import IconButton from "@mui/joy/IconButton";
import Modal from "@mui/joy/Modal";
import ModalClose from "@mui/joy/ModalClose";
import ModalDialog from "@mui/joy/ModalDialog";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { formatDistanceToNow } from "date-fns";
import {
  Archive,
  Copy,
  Eye,
  FileText,
  LayoutGrid,
  Link2,
  List,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  Link as RouterLink,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { toast } from "sonner";
import { FormListToolbar } from "@/components/forms/FormListToolbar";
import { FormTemplatesDialog } from "@/components/forms/FormTemplatesDialog";
import { FormPreviewDialog } from "@/components/forms/preview/FormPreviewDialog";
import { JoyAlertDialog } from "@/components/joy/JoyAlertDialog";
import { JoyChip } from "@/components/joy/JoyChip";
import {
  JoyDropdownMenu,
  JoyDropdownMenuContent,
  JoyDropdownMenuItem,
  JoyDropdownMenuTrigger,
} from "@/components/joy/JoyDropdownMenu";
import { JoyTooltip } from "@/components/joy/JoyTooltip";
import { PageContainer } from "@/components/joy/PageContainer";
import { useForms } from "@/hooks/useForms";
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
  | "updated-desc"
  | "name-asc"
  | "name-desc"
  | "submissions-desc"
  | "newest"
  | "oldest";
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

interface EmptyStateProps {
  title: string;
  description: string;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  loading?: boolean;
}

interface QuickActionsProps {
  form: FormWithStats;
  busy: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onCopyLink: () => void;
  onPreview: () => void;
  onArchiveToggle: () => void;
  onDelete: () => void;
}

interface GridCardProps extends QuickActionsProps {
  selected: boolean;
  onToggleSelected: () => void;
}

interface ListRowProps extends QuickActionsProps {
  index: number;
  selected: boolean;
  onToggleSelected: () => void;
}

const GRID_COLUMNS = {
  xs: "1fr",
  md: "repeat(2, minmax(0, 1fr))",
  xl: "repeat(3, minmax(0, 1fr))",
} as const;

const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: "updated-desc", label: "Last modified" },
  { value: "name-asc", label: "Name A-Z" },
  { value: "name-desc", label: "Name Z-A" },
  { value: "submissions-desc", label: "Most submissions" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
];

const isStatusFilter = (value: string | null): value is StatusFilter =>
  value === "all" ||
  value === "draft" ||
  value === "published" ||
  value === "archived";

const isSortOption = (value: string | null): value is SortOption =>
  SORT_OPTIONS.some((option) => option.value === value);

const isViewMode = (value: string | null): value is ViewMode =>
  value === "grid" || value === "list";

function formatStatusLabel(status: FormStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function getStatusColor(status: FormStatus): string {
  switch (status) {
    case "published":
      return "success.500";
    case "archived":
      return "neutral.400";
    case "draft":
    default:
      return "neutral.500";
  }
}

function getStepCount(form: FormWithStats): number {
  return Math.max(1, form.settings_json.steps?.length || 0);
}

function getSubmissionSummary(form: FormWithStats): {
  primary: string;
  secondary?: string;
} {
  if (form.total_submissions === 0) {
    return {
      primary: "No submissions yet",
    };
  }

  const recentTotal = form.recent_accepted + form.recent_rejected;

  if (recentTotal > 0) {
    const acceptedRate = Math.round((form.recent_accepted / recentTotal) * 100);

    return {
      primary: `${form.total_submissions.toLocaleString()} submissions · ${acceptedRate}% accepted recently`,
      secondary: `${form.recent_submissions.toLocaleString()} in the last 7 days`,
    };
  }

  return {
    primary: `${form.total_submissions.toLocaleString()} submissions · No recent activity`,
  };
}

function getModifiedLabel(updatedAt: string): string {
  return `Modified ${formatDistanceToNow(new Date(updatedAt), {
    addSuffix: true,
  })}`;
}

function StatusChip({ status }: { status: FormStatus }) {
  if (status === "published") {
    return (
      <JoyChip size="sm" variant="soft" color="success">
        Published
      </JoyChip>
    );
  }

  if (status === "archived") {
    return (
      <JoyChip size="sm" variant="outlined" color="neutral">
        <Box component="span" sx={{ textDecoration: "line-through" }}>
          Archived
        </Box>
      </JoyChip>
    );
  }

  return (
    <JoyChip size="sm" variant="soft" color="neutral">
      Draft
    </JoyChip>
  );
}

function CompactMeta({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <Box sx={{ color: "neutral.500", display: "inline-flex" }}>{icon}</Box>
      <Typography level="body-xs" color="neutral">
        {label}
      </Typography>
    </Stack>
  );
}

function FormsToolbarSkeleton() {
  return (
    <Stack spacing={2}>
      <Stack spacing={0.5}>
        <Skeleton variant="text" width={100} height={32} animation="wave" />
        <Skeleton variant="text" width={84} height={20} animation="wave" />
      </Stack>

      <Sheet
        variant="outlined"
        sx={{
          borderRadius: "var(--joy-radius-lg)",
          borderColor: "neutral.200",
          backgroundColor: "background.surface",
          p: 1.5,
          display: "flex",
          flexWrap: "wrap",
          gap: 1.5,
          alignItems: "center",
        }}
      >
        <Skeleton
          variant="rectangular"
          height={32}
          animation="wave"
          sx={{
            flex: { xs: "1 1 100%", lg: "1 1 auto" },
            minWidth: 180,
            maxWidth: 320,
            borderRadius: "6px",
          }}
        />
        <Skeleton
          variant="rectangular"
          height={32}
          animation="wave"
          sx={{
            width: 280,
            borderRadius: "6px",
            display: { xs: "none", sm: "block" },
          }}
        />
        <Skeleton
          variant="circular"
          width={32}
          height={32}
          animation="wave"
          sx={{ display: { xs: "none", sm: "block" } }}
        />
        <Skeleton
          variant="rectangular"
          height={32}
          animation="wave"
          sx={{
            width: 100,
            borderRadius: "6px",
            display: { xs: "none", sm: "block" },
          }}
        />
        <Skeleton variant="circular" width={32} height={32} animation="wave" />
        <Skeleton
          variant="rectangular"
          height={32}
          animation="wave"
          sx={{
            width: 32,
            borderRadius: "6px",
            flex: { xs: "0 0 auto", sm: "0 0 auto" },
            ml: { xs: "auto" },
          }}
        />
      </Sheet>

      <Skeleton variant="text" width={120} height={18} animation="wave" />
    </Stack>
  );
}

function FormsHeaderSkeleton() {
  return <FormsToolbarSkeleton />;
}

function FormGridCardSkeleton() {
  return (
    <Sheet
      variant="outlined"
      sx={{
        borderRadius: "var(--joy-radius-lg)",
        borderColor: "neutral.200",
        backgroundColor: "background.surface",
        p: 2.25,
      }}
    >
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" spacing={1}>
          <Stack direction="row" spacing={1.25} sx={{ flex: 1 }}>
            <Skeleton
              variant="rectangular"
              width={18}
              height={18}
              animation="wave"
              sx={{ borderRadius: 6 }}
            />
            <Skeleton variant="text" width="62%" height={24} animation="wave" />
          </Stack>
          <Skeleton
            variant="rectangular"
            width={86}
            height={24}
            animation="wave"
            sx={{ borderRadius: 999 }}
          />
        </Stack>
        <Stack direction="row" spacing={1.5}>
          <Skeleton variant="text" width={78} height={18} animation="wave" />
          <Skeleton variant="text" width={72} height={18} animation="wave" />
        </Stack>
        <Skeleton variant="text" width="80%" height={18} animation="wave" />
        <Skeleton variant="text" width={140} height={16} animation="wave" />
        <Stack direction="row" spacing={0.75}>
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton
              key={index}
              variant="rectangular"
              width={32}
              height={32}
              animation="wave"
              sx={{ borderRadius: 999 }}
            />
          ))}
        </Stack>
      </Stack>
    </Sheet>
  );
}

function FormsGridSkeleton() {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: GRID_COLUMNS, gap: 2 }}>
      {Array.from({ length: 6 }).map((_, index) => (
        <FormGridCardSkeleton key={index} />
      ))}
    </Box>
  );
}

function FormsListSkeleton() {
  return (
    <Sheet
      variant="outlined"
      sx={{
        borderRadius: "var(--joy-radius-lg)",
        borderColor: "neutral.200",
        backgroundColor: "background.surface",
        overflow: "hidden",
      }}
    >
      <Stack spacing={0}>
        {Array.from({ length: 8 }).map((_, index) => (
          <Box
            key={index}
            sx={{
              px: 2,
              py: 1.5,
              borderBottom: index === 7 ? "none" : "1px solid",
              borderColor: "neutral.100",
            }}
          >
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1.25}
              alignItems={{ xs: "stretch", md: "center" }}
            >
              <Skeleton
                variant="rectangular"
                width={18}
                height={18}
                animation="wave"
                sx={{ borderRadius: 6 }}
              />
              <Skeleton
                variant="text"
                width={90}
                height={18}
                animation="wave"
              />
              <Skeleton
                variant="text"
                width={220}
                height={20}
                animation="wave"
                sx={{ flex: 1 }}
              />
              <Skeleton
                variant="text"
                width={100}
                height={18}
                animation="wave"
              />
              <Skeleton
                variant="text"
                width={160}
                height={18}
                animation="wave"
              />
              <Skeleton
                variant="text"
                width={120}
                height={18}
                animation="wave"
              />
              <Stack direction="row" spacing={0.75}>
                {Array.from({ length: 4 }).map((__, actionIndex) => (
                  <Skeleton
                    key={actionIndex}
                    variant="rectangular"
                    width={28}
                    height={28}
                    animation="wave"
                    sx={{ borderRadius: 999 }}
                  />
                ))}
              </Stack>
            </Stack>
          </Box>
        ))}
      </Stack>
    </Sheet>
  );
}

function EmptyState({
  title,
  description,
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
  loading = false,
}: EmptyStateProps) {
  return (
    <Sheet
      variant="outlined"
      sx={{
        borderRadius: "28px",
        borderColor: "neutral.200",
        backgroundColor: "background.surface",
        px: 3,
        py: 6,
        textAlign: "center",
      }}
    >
      <Stack spacing={1.5} alignItems="center">
        <Typography level="title-lg">{title}</Typography>
        <Typography level="body-sm" color="neutral" sx={{ maxWidth: 520 }}>
          {description}
        </Typography>
        {primaryActionLabel || secondaryActionLabel ? (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            {primaryActionLabel && onPrimaryAction ? (
              <Button loading={loading} onClick={onPrimaryAction}>
                {primaryActionLabel}
              </Button>
            ) : null}
            {secondaryActionLabel && onSecondaryAction ? (
              <Button
                variant="outlined"
                color="neutral"
                onClick={onSecondaryAction}
              >
                {secondaryActionLabel}
              </Button>
            ) : null}
          </Stack>
        ) : null}
      </Stack>
    </Sheet>
  );
}

function FormQuickActions({
  form,
  busy,
  onEdit,
  onDuplicate,
  onCopyLink,
  onPreview,
  onArchiveToggle,
  onDelete,
}: QuickActionsProps) {
  return (
    <Box
      onClick={(event) => event.stopPropagation()}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.25,
      }}
      className="form-action-cluster"
    >
      <JoyTooltip title="Edit form">
        <IconButton
          size="sm"
          variant="plain"
          color="neutral"
          disabled={busy}
          onClick={onEdit}
        >
          <Pencil size={16} />
        </IconButton>
      </JoyTooltip>
      <JoyTooltip title="Duplicate form">
        <IconButton
          size="sm"
          variant="plain"
          color="neutral"
          disabled={busy}
          onClick={onDuplicate}
        >
          <Copy size={16} />
        </IconButton>
      </JoyTooltip>
      {form.status === "published" ? (
        <JoyTooltip title="Copy public link">
          <IconButton
            size="sm"
            variant="plain"
            color="neutral"
            disabled={busy}
            onClick={onCopyLink}
          >
            <Link2 size={16} />
          </IconButton>
        </JoyTooltip>
      ) : null}
      <JoyTooltip title="Preview form">
        <IconButton
          size="sm"
          variant="plain"
          color="neutral"
          disabled={busy}
          onClick={onPreview}
        >
          <Eye size={16} />
        </IconButton>
      </JoyTooltip>
      <JoyDropdownMenu>
        <JoyDropdownMenuTrigger disabled={busy}>
          <MoreHorizontal size={16} />
        </JoyDropdownMenuTrigger>
        <JoyDropdownMenuContent>
          <JoyDropdownMenuItem
            startDecorator={<Archive size={16} />}
            onClick={onArchiveToggle}
          >
            {form.status === "archived" ? "Restore" : "Archive"}
          </JoyDropdownMenuItem>
          <JoyDropdownMenuItem
            destructive
            startDecorator={<Trash2 size={16} />}
            onClick={onDelete}
          >
            Delete
          </JoyDropdownMenuItem>
        </JoyDropdownMenuContent>
      </JoyDropdownMenu>
    </Box>
  );
}

function FormsGridCard({
  form,
  selected,
  onToggleSelected,
  busy,
  onEdit,
  onDuplicate,
  onCopyLink,
  onPreview,
  onArchiveToggle,
  onDelete,
}: GridCardProps) {
  const stepCount = getStepCount(form);
  const submissionSummary = getSubmissionSummary(form);

  return (
    <Sheet
      variant="outlined"
      onClick={onEdit}
      sx={{
        borderRadius: "var(--joy-radius-lg)",
        borderColor: "neutral.200",
        backgroundColor: "background.surface",
        p: 2.25,
        cursor: "pointer",
        transition:
          "border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease",
        boxShadow: "var(--joy-shadow-xs)",
        "& .form-action-cluster": {
          opacity: 0.6,
          transition: "opacity 180ms ease",
        },
        "&:hover": {
          borderColor: "neutral.300",
          boxShadow: "var(--joy-shadow-md)",
          transform: "translateY(-1px)",
        },
        "&:hover .form-action-cluster": {
          opacity: 1,
        },
      }}
    >
      <Stack spacing={2}>
        <Stack
          direction="row"
          justifyContent="space-between"
          spacing={1.5}
          alignItems="flex-start"
        >
          <Stack
            direction="row"
            spacing={1}
            alignItems="flex-start"
            sx={{ minWidth: 0, flex: 1 }}
          >
            <Box onClick={(event) => event.stopPropagation()}>
              <Checkbox
                size="sm"
                checked={selected}
                onChange={onToggleSelected}
              />
            </Box>

            <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                component={RouterLink}
                to={`/crm/forms/${form.id}?tab=build`}
                level="title-sm"
                onClick={(event) => event.stopPropagation()}
                sx={{
                  fontWeight: "lg",
                  color: "text.primary",
                  textDecoration: "none",
                  display: "block",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  ...(form.status === "archived"
                    ? { textDecoration: "line-through", color: "neutral.500" }
                    : null),
                }}
              >
                {form.name}
              </Typography>
            </Stack>
          </Stack>

          <StatusChip status={form.status} />
        </Stack>

        <Stack direction="row" spacing={1.5} useFlexGap flexWrap="wrap">
          <CompactMeta
            icon={<FileText size={14} />}
            label={`${form.fields_json.length} fields`}
          />
          <CompactMeta icon={<List size={14} />} label={`${stepCount} steps`} />
        </Stack>

        <Stack spacing={0.4}>
          <Typography level="body-sm" color="neutral">
            {submissionSummary.primary}
          </Typography>
          {submissionSummary.secondary ? (
            <Typography level="body-xs" color="neutral">
              {submissionSummary.secondary}
            </Typography>
          ) : null}
        </Stack>

        <Typography level="body-xs" color="neutral">
          {getModifiedLabel(form.updated_at)}
        </Typography>

        <FormQuickActions
          form={form}
          busy={busy}
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onCopyLink={onCopyLink}
          onPreview={onPreview}
          onArchiveToggle={onArchiveToggle}
          onDelete={onDelete}
        />
      </Stack>
    </Sheet>
  );
}

function ListStatusIndicator({ status }: { status: FormStatus }) {
  return (
    <Stack
      direction="row"
      spacing={0.6}
      alignItems="center"
      sx={{ minWidth: 100 }}
    >
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: 999,
          bgcolor: getStatusColor(status),
          flexShrink: 0,
        }}
      />
      <Typography
        level="body-sm"
        sx={
          status === "archived"
            ? { color: "neutral.500", textDecoration: "line-through" }
            : undefined
        }
      >
        {formatStatusLabel(status)}
      </Typography>
    </Stack>
  );
}

function FormsListHeader() {
  return (
    <Box
      sx={{
        display: { xs: "none", md: "flex" },
        alignItems: "center",
        gap: 1.25,
        px: 2,
        py: 1.25,
        borderBottom: "1px solid",
        borderColor: "neutral.100",
        bgcolor: "background.level1",
      }}
    >
      <Box sx={{ width: 28 }} />
      <Box sx={{ width: 104 }}>
        <Typography level="body-xs" color="neutral">
          Status
        </Typography>
      </Box>
      <Box sx={{ minWidth: 0, flex: 1.8 }}>
        <Typography level="body-xs" color="neutral">
          Form
        </Typography>
      </Box>
      <Box sx={{ width: 140 }}>
        <Typography level="body-xs" color="neutral">
          Fields / steps
        </Typography>
      </Box>
      <Box sx={{ width: 220 }}>
        <Typography level="body-xs" color="neutral">
          Submissions
        </Typography>
      </Box>
      <Box sx={{ width: 150 }}>
        <Typography level="body-xs" color="neutral">
          Last modified
        </Typography>
      </Box>
      <Box sx={{ width: 164, textAlign: "right" }}>
        <Typography level="body-xs" color="neutral">
          Actions
        </Typography>
      </Box>
    </Box>
  );
}

function FormsListRow({
  form,
  index,
  selected,
  onToggleSelected,
  busy,
  onEdit,
  onDuplicate,
  onCopyLink,
  onPreview,
  onArchiveToggle,
  onDelete,
}: ListRowProps) {
  const stepCount = getStepCount(form);
  const submissionSummary = getSubmissionSummary(form);

  return (
    <Box
      sx={{
        px: 2,
        py: 1.5,
        borderBottom: "1px solid",
        borderColor: "neutral.100",
        bgcolor: index % 2 === 0 ? "background.surface" : "background.level1",
        transition: "background-color 180ms ease, border-color 180ms ease",
        "& .form-action-cluster": {
          opacity: 0.6,
          transition: "opacity 180ms ease",
        },
        "&:hover": {
          bgcolor: "background.level1",
          borderColor: "neutral.200",
        },
        "&:hover .form-action-cluster": {
          opacity: 1,
        },
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1.25}
        alignItems={{ xs: "stretch", md: "center" }}
      >
        <Box
          onClick={(event) => event.stopPropagation()}
          sx={{ width: { md: 28 } }}
        >
          <Checkbox size="sm" checked={selected} onChange={onToggleSelected} />
        </Box>

        <ListStatusIndicator status={form.status} />

        <Stack spacing={0.25} sx={{ minWidth: 0, flex: 1.8 }}>
          <Typography
            component={RouterLink}
            to={`/crm/forms/${form.id}?tab=build`}
            level="body-sm"
            sx={{
              fontWeight: 600,
              color: "text.primary",
              textDecoration: "none",
              ...(form.status === "archived"
                ? { textDecoration: "line-through", color: "neutral.500" }
                : null),
            }}
          >
            {form.name}
          </Typography>
          <Typography
            level="body-xs"
            color="neutral"
            sx={{ display: { md: "none" } }}
          >
            {submissionSummary.primary}
          </Typography>
        </Stack>

        <Typography level="body-sm" color="neutral" sx={{ width: { md: 140 } }}>
          {form.fields_json.length} fields · {stepCount} steps
        </Typography>

        <Stack spacing={0.2} sx={{ width: { md: 220 } }}>
          <Typography level="body-sm" color="neutral">
            {submissionSummary.primary}
          </Typography>
          {submissionSummary.secondary ? (
            <Typography level="body-xs" color="neutral">
              {submissionSummary.secondary}
            </Typography>
          ) : null}
        </Stack>

        <Typography level="body-sm" color="neutral" sx={{ width: { md: 150 } }}>
          {getModifiedLabel(form.updated_at)}
        </Typography>

        <Box
          sx={{
            display: "flex",
            justifyContent: { md: "flex-end" },
            width: { md: 164 },
          }}
        >
          <FormQuickActions
            form={form}
            busy={busy}
            onEdit={onEdit}
            onDuplicate={onDuplicate}
            onCopyLink={onCopyLink}
            onPreview={onPreview}
            onArchiveToggle={onArchiveToggle}
            onDelete={onDelete}
          />
        </Box>
      </Stack>
    </Box>
  );
}

function BulkSelectionBar({
  selectedCount,
  onArchive,
  onDelete,
}: {
  selectedCount: number;
  onArchive: () => void;
  onDelete: () => void;
}) {
  return (
    <Sheet
      variant="outlined"
      sx={{
        position: "fixed",
        left: "50%",
        bottom: 24,
        transform: "translateX(-50%)",
        width: { xs: "calc(100% - 24px)", sm: "auto" },
        maxWidth: 560,
        borderRadius: "999px",
        borderColor: "neutral.200",
        backgroundColor: "background.surface",
        boxShadow: "var(--joy-shadow-lg)",
        px: 1.25,
        py: 1,
        zIndex: 1400,
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        justifyContent="space-between"
      >
        <Typography level="body-sm" sx={{ fontWeight: 600 }}>
          {selectedCount} selected
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            size="sm"
            variant="outlined"
            color="neutral"
            onClick={onArchive}
          >
            Bulk Archive
          </Button>
          <Button
            size="sm"
            variant="outlined"
            color="danger"
            onClick={onDelete}
          >
            Bulk Delete
          </Button>
        </Stack>
      </Stack>
    </Sheet>
  );
}

export default function FormsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const handledTemplateRef = React.useRef<string | null>(null);
  const {
    forms,
    isLoading,
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
  const [selectedFormIds, setSelectedFormIds] = React.useState<string[]>([]);

  const query = searchParams.get("q") ?? "";
  const status: StatusFilter = isStatusFilter(searchParams.get("status"))
    ? (searchParams.get("status") as StatusFilter)
    : "all";
  const sort: SortOption = isSortOption(searchParams.get("sort"))
    ? (searchParams.get("sort") as SortOption)
    : "updated-desc";
  const view: ViewMode = isViewMode(searchParams.get("view"))
    ? (searchParams.get("view") as ViewMode)
    : "grid";

  const [searchDraft, setSearchDraft] = React.useState(query);

  React.useEffect(() => {
    setSearchDraft(query);
  }, [query]);

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

  React.useEffect(() => {
    const normalizedDraft = searchDraft.trim();
    const normalizedQuery = query.trim();

    if (normalizedDraft === normalizedQuery) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      updateSearchParams({ q: normalizedDraft || null });
    }, 220);

    return () => window.clearTimeout(timeoutId);
  }, [query, searchDraft, updateSearchParams]);

  const handleCreateFromPayload = React.useCallback(
    async (payload: FormCreatePayload) => {
      try {
        const newForm = await createForm(payload);
        if (newForm?.id) {
          setTemplatesDialogOpen(false);
          navigate(`/crm/forms/${newForm.id}?tab=build`);
        }
      } catch {
        // Mutation toasts are already handled in the hook.
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
        // Mutation toasts are already handled in the hook.
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
      if (form.status !== "published") {
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
        // Mutation toasts are already handled in the hook.
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
          case "name-asc":
            return left.name.localeCompare(right.name);
          case "name-desc":
            return right.name.localeCompare(left.name);
          case "submissions-desc":
            return right.total_submissions - left.total_submissions;
          case "newest":
            return (
              new Date(right.created_at).getTime() -
              new Date(left.created_at).getTime()
            );
          case "oldest":
            return (
              new Date(left.created_at).getTime() -
              new Date(right.created_at).getTime()
            );
          case "updated-desc":
          default:
            return (
              new Date(right.updated_at).getTime() -
              new Date(left.updated_at).getTime()
            );
        }
      });
  }, [forms, query, sort, status]);

  React.useEffect(() => {
    const validIds = new Set(filteredForms.map((form) => form.id));

    setSelectedFormIds((current) => {
      const next = current.filter((id) => validIds.has(id));
      return next.length === current.length ? current : next;
    });
  }, [filteredForms]);

  const statusCounts = React.useMemo(
    () => ({
      all: forms.length,
      draft: forms.filter((form) => form.status === "draft").length,
      published: forms.filter((form) => form.status === "published").length,
      archived: forms.filter((form) => form.status === "archived").length,
    }),
    [forms],
  );

  const statusOptions = React.useMemo(
    () => [
      { value: "all" as const, label: `All (${statusCounts.all})` },
      { value: "draft" as const, label: `Draft (${statusCounts.draft})` },
      {
        value: "published" as const,
        label: `Published (${statusCounts.published})`,
      },
      {
        value: "archived" as const,
        label: `Archived (${statusCounts.archived})`,
      },
    ],
    [statusCounts],
  );

  const isPageLoading = isLoading;
  const hasNoForms = !isPageLoading && forms.length === 0;
  const hasNoFilteredResults =
    !isPageLoading && forms.length > 0 && filteredForms.length === 0;
  const hasActiveFilters =
    Boolean(query.trim()) || status !== "all" || sort !== "updated-desc";
  const selectedCount = selectedFormIds.length;

  const clearFilters = React.useCallback(() => {
    updateSearchParams({ q: null, status: null, sort: null });
  }, [updateSearchParams]);

  const toggleSelectedForm = React.useCallback((formId: string) => {
    setSelectedFormIds((current) =>
      current.includes(formId)
        ? current.filter((id) => id !== formId)
        : [...current, formId],
    );
  }, []);

  const handleDelete = React.useCallback(async () => {
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
  }, [confirmAction, deleteForm]);

  const handleBulkAction = React.useCallback(() => {
    toast("Bulk actions coming soon");
  }, []);

  const renderGrid = () => (
    <Box sx={{ display: "grid", gridTemplateColumns: GRID_COLUMNS, gap: 2 }}>
      {filteredForms.map((form) => {
        const busy = pendingFormId === form.id && (isDeleting || isUpdating);

        return (
          <FormsGridCard
            key={form.id}
            form={form}
            selected={selectedFormIds.includes(form.id)}
            onToggleSelected={() => toggleSelectedForm(form.id)}
            busy={busy}
            onEdit={() => navigate(`/crm/forms/${form.id}?tab=build`)}
            onDuplicate={() => void handleDuplicate(form)}
            onCopyLink={() => void handleCopyPublicLink(form)}
            onPreview={() => setPreviewForm(form)}
            onArchiveToggle={() => void handleArchiveToggle(form)}
            onDelete={() => setConfirmAction({ kind: "delete", form })}
          />
        );
      })}
    </Box>
  );

  const renderList = () => (
    <Sheet
      variant="outlined"
      sx={{
        borderRadius: "var(--joy-radius-lg)",
        borderColor: "neutral.200",
        backgroundColor: "background.surface",
        overflow: "hidden",
      }}
    >
      <FormsListHeader />
      <Stack spacing={0}>
        {filteredForms.map((form, index) => {
          const busy = pendingFormId === form.id && (isDeleting || isUpdating);

          return (
            <FormsListRow
              key={form.id}
              form={form}
              index={index}
              selected={selectedFormIds.includes(form.id)}
              onToggleSelected={() => toggleSelectedForm(form.id)}
              busy={busy}
              onEdit={() => navigate(`/crm/forms/${form.id}?tab=build`)}
              onDuplicate={() => void handleDuplicate(form)}
              onCopyLink={() => void handleCopyPublicLink(form)}
              onPreview={() => setPreviewForm(form)}
              onArchiveToggle={() => void handleArchiveToggle(form)}
              onDelete={() => setConfirmAction({ kind: "delete", form })}
            />
          );
        })}
      </Stack>
    </Sheet>
  );

  return (
    <PageContainer
      fullWidth
      sx={{ px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}
    >
      <Stack spacing={3} sx={{ pb: 8 }}>
        {isPageLoading ? <FormsHeaderSkeleton /> : null}

        {!isPageLoading ? (
          <Stack spacing={2}>
            <Box>
              <Stack spacing={0.35}>
                <Typography level="h4">Forms</Typography>
                <Typography level="body-sm" color="neutral">
                  {forms.length.toLocaleString()}{" "}
                  {forms.length === 1 ? "form" : "forms"}
                </Typography>
              </Stack>
            </Box>

            <FormListToolbar
              searchValue={searchDraft}
              onSearchChange={setSearchDraft}
              statusFilter={status}
              onStatusChange={(value) => {
                updateSearchParams({ status: value === "all" ? null : value });
              }}
              sortValue={sort}
              onSortChange={(value) => {
                updateSearchParams({
                  sort: value === "updated-desc" ? null : value,
                });
              }}
              viewMode={view}
              onViewModeChange={(nextView) => {
                updateSearchParams({
                  view: nextView === "grid" ? null : nextView,
                });
              }}
              onNewForm={() => setTemplatesDialogOpen(true)}
              onClearFilters={clearFilters}
              statusCounts={statusCounts}
              sortOptions={SORT_OPTIONS}
              isLoading={isPageLoading}
              formCount={forms.length}
              filteredFormCount={filteredForms.length}
            />
          </Stack>
        ) : null}

        {error ? (
          <Sheet
            variant="outlined"
            sx={{
              borderRadius: "24px",
              borderColor: "danger.200",
              backgroundColor: "background.surface",
              p: 2.5,
            }}
          >
            <Stack spacing={1.25}>
              <Typography level="title-md">Unable to load forms</Typography>
              <Typography level="body-sm" color="neutral">
                {error instanceof Error ? error.message : "Unknown error"}
              </Typography>
              <Stack direction="row">
                <Button
                  size="sm"
                  variant="outlined"
                  color="neutral"
                  onClick={() => {
                    void refetchForms();
                  }}
                >
                  Retry
                </Button>
              </Stack>
            </Stack>
          </Sheet>
        ) : null}

        {isPageLoading ? (
          view === "grid" ? (
            <FormsGridSkeleton />
          ) : (
            <FormsListSkeleton />
          )
        ) : hasNoForms ? (
          <EmptyState
            title="No forms yet"
            description="Create your first form to start collecting information from your visitors."
            primaryActionLabel="Create form"
            onPrimaryAction={() => {
              void handleStartFromScratch();
            }}
            secondaryActionLabel="Browse templates"
            onSecondaryAction={() => setTemplatesDialogOpen(true)}
            loading={isCreating}
          />
        ) : hasNoFilteredResults ? (
          status === "archived" && !query.trim() ? (
            <EmptyState
              title="No archived forms"
              description="Archived forms can be restored from the archive."
              primaryActionLabel="Clear filters"
              onPrimaryAction={clearFilters}
            />
          ) : (
            <EmptyState
              title="No forms match your criteria"
              description="Try adjusting your search or filters."
              primaryActionLabel="Clear filters"
              onPrimaryAction={clearFilters}
            />
          )
        ) : view === "grid" ? (
          renderGrid()
        ) : (
          renderList()
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
        isPublished={previewForm?.status === "published"}
        publicUrl={
          previewForm?.status === "published"
            ? getPublicFormUrl(previewForm.embed_key)
            : undefined
        }
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

      {selectedCount > 0 ? (
        <BulkSelectionBar
          selectedCount={selectedCount}
          onArchive={handleBulkAction}
          onDelete={handleBulkAction}
        />
      ) : null}
    </PageContainer>
  );
}
