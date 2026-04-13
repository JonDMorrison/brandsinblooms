import React, { useMemo, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  Archive,
  ArrowUpDown,
  Copy,
  FileText,
  Link2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FormTemplatesDialog } from "@/components/forms/FormTemplatesDialog";
import { useForms } from "@/hooks/useForms";
import { useToast } from "@/hooks/use-toast";
import { createStarterForm } from "@/lib/formTemplates";
import {
  FormCompliance,
  FormField,
  FormSettings,
  FormStatus,
  FormWithStats,
} from "@/types/formBuilder";

type StatusFilter = "all" | FormStatus;
type SortOption =
  | "recently-updated"
  | "recently-created"
  | "most-submissions"
  | "name-asc";

type ConfirmAction =
  | {
      kind: "archive";
      form: FormWithStats;
    }
  | {
      kind: "delete";
      form: FormWithStats;
    }
  | null;

interface FormCreatePayload {
  name: string;
  fields_json?: FormField[];
  settings_json?: FormSettings;
  compliance_json?: FormCompliance;
}

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
  { value: "archived", label: "Archived" },
];

const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: "recently-updated", label: "Recently Updated" },
  { value: "recently-created", label: "Recently Created" },
  { value: "most-submissions", label: "Most Submissions" },
  { value: "name-asc", label: "Name A-Z" },
];

export default function FormsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
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
  const [templatesDialogOpen, setTemplatesDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("recently-updated");
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [pendingFormId, setPendingFormId] = useState<string | null>(null);

  const hasForms = forms.length > 0;
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const allFormsArchived =
    hasForms && forms.every((form) => form.status === "archived");
  const showArchivedEmptyState =
    allFormsArchived && statusFilter === "all" && normalizedSearch.length === 0;

  const visibleForms = useMemo(() => {
    const filtered = forms.filter((form) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        form.name.toLowerCase().includes(normalizedSearch);
      const matchesStatus =
        statusFilter === "all" || form.status === statusFilter;

      return matchesSearch && matchesStatus;
    });

    return filtered.sort((left, right) => {
      switch (sortBy) {
        case "recently-created":
          return (
            new Date(right.created_at).getTime() -
            new Date(left.created_at).getTime()
          );
        case "most-submissions":
          return right.total_submissions - left.total_submissions;
        case "name-asc":
          return left.name.localeCompare(right.name);
        case "recently-updated":
        default:
          return (
            new Date(right.updated_at).getTime() -
            new Date(left.updated_at).getTime()
          );
      }
    });
  }, [forms, normalizedSearch, sortBy, statusFilter]);

  const currentSortLabel =
    SORT_OPTIONS.find((option) => option.value === sortBy)?.label ||
    SORT_OPTIONS[0].label;
  const errorMessage =
    error instanceof Error ? error.message : "Unable to load forms right now.";
  const confirmLoading =
    !!confirmAction &&
    pendingFormId === confirmAction.form.id &&
    (isDeleting || isUpdating);

  const handleCreateFromPayload = async (payload: FormCreatePayload) => {
    try {
      const newForm = await createForm(payload);
      if (newForm?.id) {
        setTemplatesDialogOpen(false);
        navigate(`/crm/forms/${newForm.id}`);
      }
    } catch {
      // Mutation toasts are handled in the hook.
    }
  };

  const handleStartFromScratch = async () => {
    const starterForm = createStarterForm();
    await handleCreateFromPayload({
      name: "Untitled Form",
      fields_json: starterForm.fields_json,
    });
  };

  const handleTemplateSelect = async (templateData: FormCreatePayload) => {
    await handleCreateFromPayload({
      name: templateData.name || "Untitled Form",
      fields_json: templateData.fields_json,
      settings_json: templateData.settings_json,
      compliance_json: templateData.compliance_json,
    });
  };

  const handleDuplicate = async (form: FormWithStats) => {
    try {
      const newForm = await createForm({
        name: `${form.name} (Copy)`,
        fields_json: form.fields_json,
        settings_json: form.settings_json,
        compliance_json: form.compliance_json,
      });

      if (newForm?.id) {
        toast({
          title: "Form duplicated",
          description: `"${form.name}" has been duplicated.`,
        });
        navigate(`/crm/forms/${newForm.id}`);
      }
    } catch {
      // Mutation toasts are handled in the hook.
    }
  };

  const handleCopyLink = async (form: FormWithStats) => {
    if (!form.embed_key) {
      toast({
        title: "Link unavailable",
        description: "This form does not have a public URL yet.",
        variant: "destructive",
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/f/${form.embed_key}`,
      );
      toast({
        title: "Link copied",
        description: "Public form URL copied to clipboard.",
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Unable to copy the public form URL. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleArchiveClick = (form: FormWithStats) => {
    setConfirmAction({ kind: "archive", form });
  };

  const handleDeleteClick = (form: FormWithStats) => {
    setConfirmAction({ kind: "delete", form });
  };

  const handleUnarchive = async (form: FormWithStats) => {
    setPendingFormId(form.id);

    try {
      await updateForm({ id: form.id, status: "draft" });
      toast({
        title: "Form restored",
        description: `"${form.name}" is back in draft status.`,
      });
    } catch {
      // Mutation toasts are handled in the hook.
    } finally {
      setPendingFormId(null);
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;

    setPendingFormId(confirmAction.form.id);

    try {
      if (confirmAction.kind === "archive") {
        await updateForm({ id: confirmAction.form.id, status: "archived" });
        toast({
          title: "Form archived",
          description: `"${confirmAction.form.name}" has been archived.`,
        });
      } else {
        await deleteForm(confirmAction.form.id);
      }

      setConfirmAction(null);
    } catch {
      // Mutation toasts are handled in the hook.
    } finally {
      setPendingFormId(null);
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-8 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Forms
            </h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              Create, manage, and track your customer-facing forms.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setTemplatesDialogOpen(true)}
            >
              <Sparkles className="h-4 w-4" />
              Browse Templates
            </Button>
            <Button
              className="gap-2"
              onClick={() => setTemplatesDialogOpen(true)}
              disabled={isCreating}
            >
              <Plus className="h-4 w-4" />
              Create Form
            </Button>
          </div>
        </div>

        {error && hasForms ? (
          <InlineErrorState
            message={errorMessage}
            isRetrying={isRefetching}
            onRetry={() => {
              void refetchForms();
            }}
          />
        ) : null}

        {hasForms ? (
          <Card className="bg-card shadow-sm">
            <CardContent className="space-y-4 p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative w-full lg:max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search forms by name..."
                    className="pl-9"
                  />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex flex-wrap gap-2">
                    {STATUS_FILTERS.map((filterOption) => (
                      <Button
                        key={filterOption.value}
                        type="button"
                        size="sm"
                        variant={
                          statusFilter === filterOption.value
                            ? "default"
                            : "outline"
                        }
                        onClick={() => setStatusFilter(filterOption.value)}
                      >
                        {filterOption.label}
                      </Button>
                    ))}
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="gap-2">
                        <ArrowUpDown className="h-4 w-4" />
                        {currentSortLabel}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>Sort forms</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuRadioGroup
                        value={sortBy}
                        onValueChange={(value) =>
                          setSortBy(value as SortOption)
                        }
                      >
                        {SORT_OPTIONS.map((option) => (
                          <DropdownMenuRadioItem
                            key={option.value}
                            value={option.value}
                          >
                            {option.label}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Showing {visibleForms.length} of {forms.length} forms
                </span>
                {normalizedSearch.length > 0 || statusFilter !== "all" ? (
                  <Button
                    variant="link"
                    className="h-auto p-0 text-sm"
                    onClick={() => {
                      setSearchQuery("");
                      setStatusFilter("all");
                    }}
                  >
                    Clear filters
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {[1, 2, 3, 4].map((cardIndex) => (
              <Card key={cardIndex} className="bg-card p-6 shadow-sm">
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <Skeleton className="h-6 w-48" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                    <Skeleton className="h-6 w-20" />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Skeleton className="h-14 rounded-lg" />
                    <Skeleton className="h-14 rounded-lg" />
                    <Skeleton className="h-14 rounded-lg" />
                  </div>
                  <Skeleton className="h-4 w-56" />
                  <div className="flex items-center justify-between border-t pt-4">
                    <div className="hidden gap-2 md:flex">
                      <Skeleton className="h-10 w-10 rounded-md" />
                      <Skeleton className="h-10 w-10 rounded-md" />
                      <Skeleton className="h-10 w-10 rounded-md" />
                    </div>
                    <Skeleton className="hidden h-10 w-10 rounded-md md:block" />
                    <Skeleton className="h-10 w-10 rounded-md md:hidden" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : error && !hasForms ? (
          <InlineErrorState
            message={errorMessage}
            isRetrying={isRefetching}
            onRetry={() => {
              void refetchForms();
            }}
          />
        ) : !hasForms ? (
          <FormsEmptyState
            icon={FileText}
            title="No forms yet"
            description="Create your first form to start collecting leads and customer data."
            primaryAction={{
              label: "Create Form",
              onClick: () => setTemplatesDialogOpen(true),
            }}
          />
        ) : showArchivedEmptyState ? (
          <FormsEmptyState
            icon={Archive}
            title="All your forms are archived"
            description="Create a new form or unarchive an existing one."
            primaryAction={{
              label: "Create Form",
              onClick: () => setTemplatesDialogOpen(true),
            }}
            secondaryAction={{
              label: "View Archived Forms",
              onClick: () => setStatusFilter("archived"),
            }}
          />
        ) : visibleForms.length === 0 ? (
          <FormsEmptyState
            icon={Search}
            title="No forms match your filters"
            description="Try adjusting your search or filter criteria."
            primaryAction={{
              label: "Clear Filters",
              onClick: () => {
                setSearchQuery("");
                setStatusFilter("all");
              },
            }}
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {visibleForms.map((form) => (
              <FormCard
                key={form.id}
                form={form}
                isBusy={
                  isCreating ||
                  ((isUpdating || isDeleting) && pendingFormId === form.id)
                }
                onEdit={() => navigate(`/crm/forms/${form.id}`)}
                onCopyLink={() => {
                  void handleCopyLink(form);
                }}
                onDuplicate={() => {
                  void handleDuplicate(form);
                }}
                onArchive={() => handleArchiveClick(form)}
                onUnarchive={() => {
                  void handleUnarchive(form);
                }}
                onDelete={() => handleDeleteClick(form)}
              />
            ))}
          </div>
        )}

        <ConfirmationDialog
          open={!!confirmAction}
          onOpenChange={(open) => {
            if (!open) {
              setConfirmAction(null);
            }
          }}
          title={
            confirmAction?.kind === "archive" ? "Archive Form" : "Delete Form"
          }
          description={
            confirmAction?.kind === "archive"
              ? `Archive "${confirmAction.form.name}"? You can unarchive it later from the forms dashboard.`
              : confirmAction?.form.status === "published"
                ? `Delete "${confirmAction?.form.name}"? This form is currently PUBLISHED — active submissions will be lost. This will permanently delete the form and all submissions. This action cannot be undone.`
                : `Delete "${confirmAction?.form.name}"? This will permanently delete the form and all submissions. This action cannot be undone.`
          }
          confirmText={confirmAction?.kind === "archive" ? "Archive" : "Delete"}
          cancelText="Cancel"
          onConfirm={handleConfirmAction}
          loading={confirmLoading}
        />

        <FormTemplatesDialog
          open={templatesDialogOpen}
          onOpenChange={setTemplatesDialogOpen}
          onStartFromScratch={handleStartFromScratch}
          onSelect={handleTemplateSelect}
          isCreating={isCreating}
        />
      </div>
    </TooltipProvider>
  );
}

function FormCard({
  form,
  isBusy,
  onEdit,
  onCopyLink,
  onDuplicate,
  onArchive,
  onUnarchive,
  onDelete,
}: {
  form: FormWithStats;
  isBusy: boolean;
  onEdit: () => void;
  onCopyLink: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
}) {
  const createdLabel = format(new Date(form.created_at), "MMM d");
  const updatedLabel = formatDistanceToNow(new Date(form.updated_at), {
    addSuffix: true,
  });
  const displayName = truncateFormName(form.name);
  const hasLongName = displayName !== form.name;

  return (
    <Card className="bg-card shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="space-y-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            {hasLongName ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onEdit}
                    className="truncate text-left text-lg font-semibold text-foreground transition-colors hover:text-primary"
                  >
                    {displayName}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{form.name}</TooltipContent>
              </Tooltip>
            ) : (
              <button
                type="button"
                onClick={onEdit}
                className="truncate text-left text-lg font-semibold text-foreground transition-colors hover:text-primary"
              >
                {displayName}
              </button>
            )}
            <div>{renderStatusBadge(form.status)}</div>
          </div>

          <div className="md:hidden">
            <FormCardMenu
              form={form}
              onEdit={onEdit}
              onCopyLink={onCopyLink}
              onDuplicate={onDuplicate}
              onArchive={onArchive}
              onUnarchive={onUnarchive}
              onDelete={onDelete}
              isBusy={isBusy}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatBlock
            label="Last 7 days"
            value={`${form.recent_submissions} submissions`}
          />
          <StatBlock
            label="All time"
            value={`${form.total_submissions} total`}
          />
          <StatBlock
            label="Last"
            value={
              form.last_submission_at
                ? formatDistanceToNow(new Date(form.last_submission_at), {
                    addSuffix: true,
                  })
                : "No submissions"
            }
          />
        </div>

        <p className="text-sm text-muted-foreground">
          Created {createdLabel} · Updated {updatedLabel}
        </p>

        <div className="flex items-center justify-between border-t pt-4">
          <div className="hidden items-center gap-2 md:flex">
            <IconActionButton label="Edit" onClick={onEdit} disabled={isBusy}>
              <Pencil className="h-4 w-4" />
            </IconActionButton>
            {form.status === "published" ? (
              <IconActionButton
                label="Copy Link"
                onClick={onCopyLink}
                disabled={isBusy}
              >
                <Link2 className="h-4 w-4" />
              </IconActionButton>
            ) : null}
            <IconActionButton
              label="Duplicate"
              onClick={onDuplicate}
              disabled={isBusy}
            >
              <Copy className="h-4 w-4" />
            </IconActionButton>
          </div>

          <div className="hidden md:block">
            <FormCardMenu
              form={form}
              onEdit={onEdit}
              onCopyLink={onCopyLink}
              onDuplicate={onDuplicate}
              onArchive={onArchive}
              onUnarchive={onUnarchive}
              onDelete={onDelete}
              isBusy={isBusy}
            />
          </div>

          <p className="text-xs text-muted-foreground md:hidden">
            Tap the menu for quick actions.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function FormCardMenu({
  form,
  onEdit,
  onCopyLink,
  onDuplicate,
  onArchive,
  onUnarchive,
  onDelete,
  isBusy,
}: {
  form: FormWithStats;
  onEdit: () => void;
  onCopyLink: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
  isBusy: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={isBusy}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel>Quick actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        {form.status === "published" ? (
          <DropdownMenuItem onSelect={onCopyLink}>
            <Link2 className="mr-2 h-4 w-4" />
            Copy Link
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={onDuplicate}>
          <Copy className="mr-2 h-4 w-4" />
          Duplicate
        </DropdownMenuItem>
        {form.status === "archived" ? (
          <DropdownMenuItem onSelect={onUnarchive}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Unarchive
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={onArchive}>
            <Archive className="mr-2 h-4 w-4" />
            Archive
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={onDelete}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete{form.status === "published" ? " (Published)" : ""}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function IconActionButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClick}
          disabled={disabled}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function InlineErrorState({
  message,
  isRetrying,
  onRetry,
}: {
  message: string;
  isRetrying: boolean;
  onRetry: () => void;
}) {
  return (
    <Card className="border-destructive/20 bg-destructive/5 shadow-sm">
      <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">Unable to load forms</p>
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>
        </div>
        <Button variant="outline" onClick={onRetry} disabled={isRetrying}>
          {isRetrying ? "Retrying..." : "Retry"}
        </Button>
      </CardContent>
    </Card>
  );
}

function FormsEmptyState({
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  primaryAction: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
}) {
  return (
    <Card className="bg-card shadow-sm">
      <CardContent className="flex flex-col items-center justify-center space-y-4 px-6 py-16 text-center">
        <div className="rounded-full border bg-muted/40 p-4 text-muted-foreground">
          <Icon className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          <p className="max-w-xl text-sm text-muted-foreground sm:text-base">
            {description}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button className="gap-2" onClick={primaryAction.onClick}>
            <Plus className="h-4 w-4" />
            {primaryAction.label}
          </Button>
          {secondaryAction ? (
            <Button variant="outline" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function renderStatusBadge(status: FormStatus) {
  switch (status) {
    case "published":
      return (
        <Badge className="border border-green-200 bg-green-50 text-green-700 hover:bg-green-50">
          Published
        </Badge>
      );
    case "archived":
      return <Badge variant="secondary">Archived</Badge>;
    case "draft":
    default:
      return (
        <Badge variant="outline" className="text-muted-foreground">
          Draft
        </Badge>
      );
  }
}

function truncateFormName(name: string, maxLength: number = 40) {
  if (name.length <= maxLength) {
    return name;
  }

  return `${name.slice(0, maxLength - 3)}...`;
}
