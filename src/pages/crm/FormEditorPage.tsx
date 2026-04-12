import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  Globe,
  Loader2,
  Pencil,
  Share2,
} from "lucide-react";
import { FormAnalyticsTab } from "@/components/forms/FormAnalyticsTab";
import { FormAudienceTab } from "@/components/forms/FormAudienceTab";
import { FormBuildTab } from "@/components/forms/FormBuildTab";
import { FormComplianceTab } from "@/components/forms/FormComplianceTab";
import { FormDesignTab } from "@/components/forms/FormDesignTab";
import { FormPublishTab } from "@/components/forms/FormPublishTab";
import { FormShareDialog } from "@/components/forms/FormShareDialog";
import { FormSubmissionsTab } from "@/components/forms/FormSubmissionsTab";
import { FormPreviewDialog } from "@/components/forms/preview/FormPreviewDialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useBeforeUnload } from "@/hooks/useBeforeUnload";
import { useFormEditor } from "@/hooks/useFormEditor";
import {
  PublishValidationIssue,
  validateFormForPublish,
} from "@/lib/forms/publish";
import { getPublicFormUrl } from "@/lib/forms/share";
import { cn } from "@/lib/utils";

const FORM_EDITOR_TABS = [
  "build",
  "design",
  "audience",
  "compliance",
  "submissions",
  "analytics",
] as const;

type FormEditorTab = (typeof FORM_EDITOR_TABS)[number];

const FORM_EDITOR_TAB_COPY: Record<
  FormEditorTab,
  { description: string; label: string }
> = {
  analytics: {
    label: "Analytics",
    description:
      "Track conversion signals, referrers, and performance over time.",
  },
  audience: {
    label: "Audience",
    description:
      "Control who should see the form and how targeting is applied.",
  },
  build: {
    label: "Build",
    description:
      "Shape the visitor journey, step structure, and field hierarchy.",
  },
  compliance: {
    label: "Compliance",
    description: "Configure consent language and operational safeguards.",
  },
  design: {
    label: "Design",
    description: "Tune typography, layout, and visual styling before launch.",
  },
  submissions: {
    label: "Submissions",
    description:
      "Review captured leads, diagnostics, and live submission activity.",
  },
};

interface PendingNavigation {
  replace?: boolean;
  to: string;
}

function isFormEditorTab(value: string | null): value is FormEditorTab {
  return value !== null && FORM_EDITOR_TABS.includes(value as FormEditorTab);
}

export default function FormEditorPage() {
  const { formId } = useParams<{ formId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isExitSaving, setIsExitSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isNameEditing, setIsNameEditing] = useState(false);
  const [isPublishValidationOpen, setIsPublishValidationOpen] = useState(false);
  const [isPublishSuccessOpen, setIsPublishSuccessOpen] = useState(false);
  const [isUnpublishConfirmOpen, setIsUnpublishConfirmOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] =
    useState<PendingNavigation | null>(null);
  const [highlightedPublishIssue, setHighlightedPublishIssue] =
    useState<PublishValidationIssue | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const currentPathRef = useRef("");
  const pendingNavigationRef = useRef<PendingNavigation | null>(null);

  const {
    tenantId,
    form,
    name,
    setName,
    fields,
    setFields,
    settings,
    setSettings,
    compliance,
    setCompliance,
    audience,
    setAudience,
    applyTemplate,
    hasUnsavedChanges,
    saveStatus,
    isStatusUpdating,
    isLoading,
    loadError,
    saveNow,
    retrySave,
    updateStatus,
  } = useFormEditor(formId);

  const rawTab = searchParams.get("tab");
  const activeTab: FormEditorTab = isFormEditorTab(rawTab) ? rawTab : "build";
  const tabMeta = FORM_EDITOR_TAB_COPY[activeTab];
  const publishValidationIssues = useMemo(
    () => validateFormForPublish({ name, fields, settings }),
    [fields, name, settings],
  );
  const publicFormUrl = useMemo(
    () => (form ? getPublicFormUrl(form.embed_key) : ""),
    [form],
  );
  const currentPath = `${location.pathname}${location.search}${location.hash}`;
  const configuredStepCount = settings.steps?.length
    ? settings.steps.length
    : 1;

  useBeforeUnload({ when: hasUnsavedChanges });

  const guardedNavigate = useCallback(
    (to: string, options?: { replace?: boolean }) => {
      if (hasUnsavedChanges) {
        setPendingNavigation({
          to,
          replace: options?.replace,
        });
        return;
      }

      navigate(to, options);
    },
    [hasUnsavedChanges, navigate],
  );

  useEffect(() => {
    if (rawTab === activeTab) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", activeTab);
    setSearchParams(nextParams, { replace: true });
  }, [activeTab, rawTab, searchParams, setSearchParams]);

  useEffect(() => {
    if (form?.status !== "published") {
      setIsShareDialogOpen(false);
      setIsPublishSuccessOpen(false);
    }
  }, [form?.status]);

  useEffect(() => {
    if (isPublishValidationOpen && publishValidationIssues.length === 0) {
      setIsPublishValidationOpen(false);
    }
  }, [isPublishValidationOpen, publishValidationIssues.length]);

  useEffect(() => {
    currentPathRef.current = currentPath;
  }, [currentPath]);

  useEffect(() => {
    pendingNavigationRef.current = pendingNavigation;
  }, [pendingNavigation]);

  useEffect(() => {
    if (!highlightedPublishIssue) {
      return;
    }

    if (highlightedPublishIssue.target === "header:name") {
      setIsNameEditing(true);
    }

    const timeoutId = window.setTimeout(() => {
      setHighlightedPublishIssue(null);
    }, 2500);

    return () => window.clearTimeout(timeoutId);
  }, [highlightedPublishIssue]);

  useEffect(() => {
    if (!isNameEditing) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
      nameInputRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [isNameEditing]);

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }

    const handlePopState = () => {
      const attemptedPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;

      if (attemptedPath === currentPathRef.current) {
        return;
      }

      if (!pendingNavigationRef.current) {
        setPendingNavigation({
          to: attemptedPath || "/crm/forms",
          replace: true,
        });
      }

      navigate(currentPathRef.current, { replace: true });
    };

    window.addEventListener("popstate", handlePopState);

    return () => window.removeEventListener("popstate", handlePopState);
  }, [hasUnsavedChanges, navigate]);

  const handleTabChange = (nextTab: string) => {
    if (!isFormEditorTab(nextTab)) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", nextTab);
    setSearchParams(nextParams, { replace: true });
  };

  const handlePublishToggle = async () => {
    if (!form) {
      return;
    }

    if (form.status === "published") {
      setIsUnpublishConfirmOpen(true);
      return;
    }

    if (publishValidationIssues.length > 0) {
      setIsPublishValidationOpen(true);
      return;
    }

    if (hasUnsavedChanges) {
      const saved = await saveNow();
      if (!saved) {
        return;
      }
    }

    setIsPublishing(true);
    const nextForm = await updateStatus("published");
    setIsPublishing(false);

    if (nextForm) {
      setIsPublishSuccessOpen(true);
    }
  };

  const handleFixPublishIssue = (issue: PublishValidationIssue) => {
    setIsPublishValidationOpen(false);
    setHighlightedPublishIssue(issue);

    if (issue.targetTab === "build") {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set("tab", "build");
      setSearchParams(nextParams, { replace: true });
    }
  };

  const handleConfirmUnpublish = async () => {
    setIsPublishing(true);
    const nextForm = await updateStatus("draft");
    setIsPublishing(false);

    if (nextForm) {
      setIsUnpublishConfirmOpen(false);
      toast({
        title: "Form unpublished",
        description:
          "Your form is now a draft and no longer accepting submissions.",
      });
    }
  };

  const copyPublicFormUrl = async () => {
    if (!publicFormUrl) {
      return;
    }

    await navigator.clipboard.writeText(publicFormUrl);
    toast({
      title: "Copied",
      description: "The public form URL was copied to your clipboard.",
    });
  };

  const handleDiscardAndLeave = useCallback(() => {
    if (!pendingNavigationRef.current) {
      return;
    }

    const destination = pendingNavigationRef.current;
    setPendingNavigation(null);
    setIsExitSaving(false);
    navigate(
      destination.to,
      destination.replace ? { replace: true } : undefined,
    );
  }, [navigate]);

  const handleCancelLeave = useCallback(() => {
    setPendingNavigation(null);
    setIsExitSaving(false);
  }, []);

  const handleSaveAndLeave = useCallback(async () => {
    if (!pendingNavigationRef.current) {
      return;
    }

    setIsExitSaving(true);
    const saved = await saveNow({ force: true });

    if (saved) {
      const destination = pendingNavigationRef.current;
      setPendingNavigation(null);
      setIsExitSaving(false);
      navigate(
        destination.to,
        destination.replace ? { replace: true } : undefined,
      );
      return;
    }

    setIsExitSaving(false);
  }, [navigate, saveNow]);

  const handleManualSave = useCallback(async () => {
    const saved = await saveNow({ force: true });

    if (saved) {
      toast({
        title: "Form saved",
        description: "Your latest form changes were saved.",
      });
    }
  }, [saveNow, toast]);

  const handleNameEditStart = useCallback(() => {
    setIsNameEditing(true);
  }, []);

  const handleNameSave = useCallback(async () => {
    setIsNameEditing(false);
    await saveNow({ force: true });
  }, [saveNow]);

  const handleNameBlur = useCallback(async () => {
    await handleNameSave();
  }, [handleNameSave]);

  const isManualSaveDisabled =
    saveStatus === "saving" ||
    isStatusUpdating ||
    (!hasUnsavedChanges && saveStatus !== "error");

  const saveIndicator =
    saveStatus === "error" ? (
      <div className="inline-flex items-center gap-2 rounded-full border border-destructive/20 bg-destructive/5 px-3 py-1.5 text-sm text-destructive">
        <AlertCircle className="h-4 w-4" />
        <span>Error saving</span>
      </div>
    ) : saveStatus === "saved" ? (
      <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/80 px-3 py-1.5 text-sm text-muted-foreground">
        <CheckCircle2 className="h-4 w-4 text-primary" />
        <span>All changes saved</span>
      </div>
    ) : (
      <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/80 px-3 py-1.5 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Saving changes</span>
      </div>
    );

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (loadError || !form) {
    const errorMessage =
      typeof loadError === "string"
        ? loadError
        : loadError instanceof Error
          ? loadError.message
          : "This form may have been deleted.";

    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-2">Form not found</h2>
          <p className="text-muted-foreground mb-4">{errorMessage}</p>
          <Button
            variant="outline"
            onClick={() => guardedNavigate("/crm/forms")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Forms
          </Button>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-background">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-72 overflow-hidden">
          <div className="absolute left-[8%] top-[-5rem] h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute right-[12%] top-8 h-48 w-48 rounded-full bg-accent/60 blur-3xl" />
        </div>

        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="relative flex min-h-0 flex-1 flex-col"
        >
          <div className="border-b border-border/70 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
            <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
              <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="rounded-full"
                          onClick={() => guardedNavigate("/crm/forms")}
                          aria-label="Back to forms"
                        >
                          <ArrowLeft className="h-5 w-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Back to forms</TooltipContent>
                    </Tooltip>

                    <Badge
                      variant="outline"
                      className="rounded-full bg-background/80 px-3 py-1"
                    >
                      Form Builder
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-full px-3 py-1",
                        form.status === "published"
                          ? "border-primary/20 bg-primary/10 text-primary"
                          : "bg-background/80 text-muted-foreground",
                      )}
                    >
                      {form.status === "published" ? "Published" : "Draft"}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <div className="relative max-w-3xl">
                      <Input
                        ref={nameInputRef}
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        onBlur={() => void handleNameBlur()}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            event.currentTarget.blur();
                          }
                        }}
                        readOnly={!isNameEditing}
                        className={cn(
                          "h-auto border-none bg-transparent px-0 pr-14 text-3xl font-semibold tracking-tight shadow-none focus-visible:ring-0 sm:text-4xl",
                          !isNameEditing && "cursor-default",
                          highlightedPublishIssue?.target === "header:name" &&
                            "rounded-xl ring-2 ring-primary/30 ring-offset-2",
                        )}
                        placeholder="Form name"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full text-muted-foreground hover:text-foreground"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          if (isNameEditing) {
                            void handleNameSave();
                            return;
                          }

                          handleNameEditStart();
                        }}
                        aria-label={
                          isNameEditing ? "Save form name" : "Edit form name"
                        }
                      >
                        {isNameEditing ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Pencil className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
                      Build the visitor journey, refine the visual system, and
                      validate the live experience from one workspace.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {saveIndicator}
                    <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/80 px-3 py-1.5 text-sm text-muted-foreground">
                      <span>
                        {fields.length} field{fields.length === 1 ? "" : "s"}
                      </span>
                      <span className="text-border">•</span>
                      <span>
                        {configuredStepCount} step
                        {configuredStepCount === 1 ? "" : "s"}
                      </span>
                    </div>
                    {saveStatus === "error" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={() => void retrySave()}
                      >
                        Retry Save
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-3 xl:items-end">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={() => void handleManualSave()}
                      disabled={isManualSaveDisabled}
                    >
                      {saveStatus === "saving" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Save
                    </Button>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full"
                          onClick={() => setIsPreviewOpen(true)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Preview
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Open the full-screen preview workspace
                      </TooltipContent>
                    </Tooltip>

                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={() => setIsShareDialogOpen(true)}
                    >
                      <Share2 className="mr-2 h-4 w-4" />
                      Share
                    </Button>

                    <Button
                      size="sm"
                      className="rounded-full px-4"
                      onClick={() => void handlePublishToggle()}
                      disabled={isPublishing || isStatusUpdating}
                    >
                      {isPublishing || isStatusUpdating ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Globe className="mr-2 h-4 w-4" />
                      )}
                      {form.status === "published" ? "Unpublish" : "Publish"}
                    </Button>
                  </div>

                  <div className="max-w-xl rounded-[24px] border border-border/80 bg-card/80 px-4 py-3 text-sm text-muted-foreground shadow-sm">
                    <p className="font-medium text-foreground">
                      {tabMeta.label}
                    </p>
                    <p className="mt-1">{tabMeta.description}</p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <TabsList className="inline-flex h-auto min-w-max gap-6 rounded-none bg-transparent p-0">
                  {FORM_EDITOR_TABS.map((tab) => (
                    <TabsTrigger
                      key={tab}
                      value={tab}
                      className="relative rounded-none bg-transparent px-0 pb-4 pt-1 text-sm font-medium text-muted-foreground shadow-none transition data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:rounded-full after:bg-primary after:opacity-0 after:transition-opacity data-[state=active]:after:opacity-100"
                    >
                      {FORM_EDITOR_TAB_COPY[tab].label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-x-visible overflow-y-auto">
            <div className="mx-auto flex w-full max-w-[1400px] flex-col px-4 py-6 sm:px-6 lg:px-8">
              <div className="mx-auto w-full max-w-[1180px]">
                <TabsContent value="build" className="mt-0">
                  <FormBuildTab
                    fields={fields}
                    updateFields={setFields}
                    settings={settings}
                    updateSettings={setSettings}
                    compliance={compliance}
                    updateCompliance={setCompliance}
                    onApplyTemplate={applyTemplate}
                    publishValidationIssue={highlightedPublishIssue}
                  />
                </TabsContent>

                <TabsContent value="design" className="mt-0">
                  <FormDesignTab
                    settings={settings}
                    onSettingsChange={setSettings}
                  />
                </TabsContent>

                <TabsContent value="audience" className="mt-0">
                  <FormAudienceTab
                    audience={audience}
                    onAudienceChange={setAudience}
                  />
                </TabsContent>

                <TabsContent value="compliance" className="mt-0">
                  <FormComplianceTab
                    compliance={compliance}
                    onComplianceChange={setCompliance}
                    hasPhoneField={fields.some(
                      (field) => field.type === "phone",
                    )}
                    hasEmailField={fields.some(
                      (field) => field.type === "email",
                    )}
                  />
                </TabsContent>

                <TabsContent value="submissions" className="mt-0">
                  <FormSubmissionsTab form={form} tenantId={tenantId} />
                </TabsContent>

                <TabsContent value="analytics" className="mt-0">
                  <FormAnalyticsTab
                    formId={form.id}
                    tenantId={tenantId}
                    isPublished={form.status === "published"}
                    onOpenShare={() => setIsShareDialogOpen(true)}
                  />
                </TabsContent>
              </div>
            </div>
          </div>
        </Tabs>

        <FormShareDialog
          form={form}
          open={isShareDialogOpen}
          onOpenChange={setIsShareDialogOpen}
        />

        <Dialog
          open={isPublishValidationOpen}
          onOpenChange={setIsPublishValidationOpen}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Resolve publish issues</DialogTitle>
              <DialogDescription>
                Publish is blocked until every issue below is fixed.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              {publishValidationIssues.map((issue) => (
                <div
                  key={issue.id}
                  className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-start"
                >
                  <div className="flex h-5 w-5 items-center justify-center rounded border border-border bg-muted/40">
                    <span className="h-2.5 w-2.5 rounded-sm bg-primary" />
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {issue.description}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {issue.fixHint}
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleFixPublishIssue(issue)}
                  >
                    Fix
                  </Button>
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsPublishValidationOpen(false)}
              >
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={isPublishSuccessOpen}
          onOpenChange={setIsPublishSuccessOpen}
        >
          <DialogContent className="max-w-5xl">
            <DialogHeader>
              <DialogTitle>Form published</DialogTitle>
              <DialogDescription>
                Your form is live. Share the direct link or copy one of the
                embed snippets below.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    Public form URL
                  </p>
                  <Input
                    value={publicFormUrl}
                    readOnly
                    className="bg-background font-mono text-sm"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => void copyPublicFormUrl()}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy URL
                  </Button>
                  <Button variant="outline" asChild>
                    <a
                      href={publicFormUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open Form
                    </a>
                  </Button>
                </div>
              </div>
            </div>

            <FormPublishTab form={form} analyticsSurface="publish-success" />

            <DialogFooter>
              <Button onClick={() => setIsPublishSuccessOpen(false)}>
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <FormPreviewDialog
          open={isPreviewOpen}
          onOpenChange={setIsPreviewOpen}
          fields={fields}
          settings={settings}
          compliance={compliance}
          formName={name}
          uploadEmbedKey={form?.embed_key}
        />

        <AlertDialog
          open={pendingNavigation !== null}
          onOpenChange={(open) => {
            if (!open) {
              handleCancelLeave();
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
              <AlertDialogDescription>
                You have unsaved changes. Do you want to save before leaving
                this form?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button
                onClick={() => void handleSaveAndLeave()}
                disabled={isExitSaving}
              >
                {isExitSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Save & Leave
              </Button>
              <Button
                variant="outline"
                onClick={handleDiscardAndLeave}
                disabled={isExitSaving}
              >
                Discard & Leave
              </Button>
              <Button
                variant="outline"
                onClick={handleCancelLeave}
                disabled={isExitSaving}
              >
                Cancel
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          open={isUnpublishConfirmOpen}
          onOpenChange={setIsUnpublishConfirmOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Unpublish this form?</AlertDialogTitle>
              <AlertDialogDescription>
                Unpublishing this form will make it inaccessible to visitors.
                Existing embed codes will stop working. Submissions already
                collected remain intact.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsUnpublishConfirmOpen(false)}
                disabled={isPublishing}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void handleConfirmUnpublish()}
                disabled={isPublishing}
              >
                {isPublishing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Unpublish
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
