import * as React from "react";
import Avatar from "@mui/joy/Avatar";
import Box from "@mui/joy/Box";
import CircularProgress from "@mui/joy/CircularProgress";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ExternalLink,
  Eye,
  FileText,
  Globe,
  Pencil,
  Rocket,
} from "lucide-react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { toast } from "sonner";
import { FormAnalyticsTab } from "@/components/forms/FormAnalyticsTab";
import { FormAudienceTab } from "@/components/forms/FormAudienceTab";
import { FormBuildTab } from "@/components/forms/FormBuildTab";
import { FormComplianceTab } from "@/components/forms/FormComplianceTab";
import { FormDesignTab } from "@/components/forms/FormDesignTab";
import { FormPublishTab } from "@/components/forms/FormPublishTab";
import { FormSubmissionsTab } from "@/components/forms/FormSubmissionsTab";
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
  JoyDialog,
  JoyDialogActions,
  JoyDialogContent,
} from "@/components/joy/JoyDialog";
import { JoyInput } from "@/components/joy/JoyInput";
import { PageContainer } from "@/components/joy/PageContainer";
import {
  JoyTabs,
  JoyTabsContent,
  JoyTabsList,
  JoyTabsTrigger,
} from "@/components/joy/JoyTabs";
import { useBeforeUnload } from "@/hooks/useBeforeUnload";
import { useFormEditor } from "@/hooks/useFormEditor";
import {
  type PublishValidationIssue,
  validateFormForPublish,
} from "@/lib/forms/publish";
import { getPublicFormUrl } from "@/lib/forms/share";

const FORM_EDITOR_TABS = [
  "build",
  "design",
  "submissions",
  "analytics",
  "audience",
  "compliance",
  "publish",
] as const;

type FormEditorTab = (typeof FORM_EDITOR_TABS)[number];

const FORM_EDITOR_TAB_COPY: Record<
  FormEditorTab,
  { description: string; label: string }
> = {
  analytics: {
    label: "Analytics",
    description:
      "Track submission performance, rejection reasons, and referrers.",
  },
  audience: {
    label: "Audience",
    description:
      "Attach personas and tags that should follow accepted submissions.",
  },
  build: {
    label: "Build",
    description:
      "Shape the field canvas, step order, and conditional visibility rules.",
  },
  compliance: {
    label: "Compliance",
    description: "Control consent language and honest operational flags.",
  },
  design: {
    label: "Design",
    description: "Tune content, spacing, color, and live runtime presentation.",
  },
  publish: {
    label: "Publish",
    description:
      "Copy the hosted URL, embed snippets, QR code, and developer endpoints.",
  },
  submissions: {
    label: "Submissions",
    description:
      "Inspect captured leads, export the queue, and manage records.",
  },
};

interface PendingNavigation {
  replace?: boolean;
  to: string;
}

function isFormEditorTab(value: string | null): value is FormEditorTab {
  return value !== null && FORM_EDITOR_TABS.includes(value as FormEditorTab);
}

function SaveIndicator({
  saveStatus,
}: {
  saveStatus: "saved" | "pending" | "saving" | "error";
}) {
  if (saveStatus === "error") {
    return (
      <JoyChip
        size="sm"
        variant="soft"
        color="danger"
        startDecorator={<AlertCircle size={14} />}
      >
        Save failed
      </JoyChip>
    );
  }

  if (saveStatus === "saved") {
    return (
      <JoyChip
        size="sm"
        variant="soft"
        color="success"
        startDecorator={<CheckCircle2 size={14} />}
      >
        All changes saved
      </JoyChip>
    );
  }

  return (
    <JoyChip
      size="sm"
      variant="soft"
      color="neutral"
      startDecorator={<CircularProgress size="sm" thickness={4} />}
    >
      {saveStatus === "saving" ? "Saving" : "Unsaved changes"}
    </JoyChip>
  );
}

export default function FormEditorPage() {
  const { formId } = useParams<{ formId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);
  const [isExitSaving, setIsExitSaving] = React.useState(false);
  const [isPublishing, setIsPublishing] = React.useState(false);
  const [isNameEditing, setIsNameEditing] = React.useState(false);
  const [isPublishValidationOpen, setIsPublishValidationOpen] =
    React.useState(false);
  const [isPublishSuccessOpen, setIsPublishSuccessOpen] = React.useState(false);
  const [isUnpublishConfirmOpen, setIsUnpublishConfirmOpen] =
    React.useState(false);
  const [pendingNavigation, setPendingNavigation] =
    React.useState<PendingNavigation | null>(null);
  const [highlightedPublishIssue, setHighlightedPublishIssue] =
    React.useState<PublishValidationIssue | null>(null);
  const nameInputRef = React.useRef<HTMLInputElement | null>(null);
  const currentPathRef = React.useRef("");
  const pendingNavigationRef = React.useRef<PendingNavigation | null>(null);

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
  const publishValidationIssues = React.useMemo(
    () => validateFormForPublish({ name, fields, settings }),
    [fields, name, settings],
  );
  const publicFormUrl = React.useMemo(
    () => (form ? getPublicFormUrl(form.embed_key) : ""),
    [form],
  );
  const currentPath = `${location.pathname}${location.search}${location.hash}`;
  const configuredStepCount = settings.steps?.length
    ? settings.steps.length
    : 1;

  useBeforeUnload({ when: hasUnsavedChanges });

  const guardedNavigate = React.useCallback(
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

  React.useEffect(() => {
    if (rawTab === activeTab) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", activeTab);
    setSearchParams(nextParams, { replace: true });
  }, [activeTab, rawTab, searchParams, setSearchParams]);

  React.useEffect(() => {
    currentPathRef.current = currentPath;
  }, [currentPath]);

  React.useEffect(() => {
    pendingNavigationRef.current = pendingNavigation;
  }, [pendingNavigation]);

  React.useEffect(() => {
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

  React.useEffect(() => {
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

  React.useEffect(() => {
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

  const handleTabChange = (nextTab: string | number | null) => {
    if (!isFormEditorTab(String(nextTab))) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", String(nextTab));
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
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set("tab", "publish");
      setSearchParams(nextParams, { replace: true });
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
      toast.success("Form unpublished");
    }
  };

  const copyPublicFormUrl = async () => {
    if (!publicFormUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(publicFormUrl);
      toast.success("Public form URL copied");
    } catch {
      toast.error("Unable to copy the public form URL");
    }
  };

  const handleDiscardAndLeave = React.useCallback(() => {
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

  const handleCancelLeave = React.useCallback(() => {
    setPendingNavigation(null);
    setIsExitSaving(false);
  }, []);

  const handleSaveAndLeave = React.useCallback(async () => {
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

  const handleManualSave = React.useCallback(async () => {
    const saved = await saveNow({ force: true });

    if (saved) {
      toast.success("Form saved");
    }
  }, [saveNow]);

  const handleNameSave = React.useCallback(async () => {
    setIsNameEditing(false);
    await saveNow({ force: true });
  }, [saveNow]);

  const isManualSaveDisabled =
    saveStatus === "saving" ||
    isStatusUpdating ||
    (!hasUnsavedChanges && saveStatus !== "error");

  if (isLoading) {
    return (
      <PageContainer
        fullWidth
        sx={{ px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}
      >
        <Stack spacing={3}>
          <Skeleton
            variant="rectangular"
            height={192}
            animation="wave"
            sx={{ borderRadius: "lg" }}
          />
          <Skeleton
            variant="rectangular"
            height={56}
            animation="wave"
            sx={{ borderRadius: "lg" }}
          />
          <Skeleton
            variant="rectangular"
            height={640}
            animation="wave"
            sx={{ borderRadius: "lg" }}
          />
        </Stack>
      </PageContainer>
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
      <PageContainer
        fullWidth
        sx={{ px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}
      >
        <JoyCard>
          <JoyCardContent
            sx={{ pt: 5, gap: 1.5, textAlign: "center", alignItems: "center" }}
          >
            <Avatar size="lg" variant="soft" color="neutral">
              <FileText size={24} />
            </Avatar>
            <Typography level="title-md">Form not found</Typography>
            <Typography level="body-sm" color="neutral">
              {errorMessage}
            </Typography>
            <JoyButton
              bloomVariant="ghost"
              color="neutral"
              startDecorator={<ArrowLeft size={16} />}
              onClick={() => guardedNavigate("/crm/forms")}
            >
              Back to forms
            </JoyButton>
          </JoyCardContent>
        </JoyCard>
      </PageContainer>
    );
  }

  return (
    <JoyTabs value={activeTab} onValueChange={handleTabChange}>
      <Sheet
        variant="plain"
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 5,
          borderBottom: "1px solid",
          borderColor: "neutral.200",
          backgroundColor: "rgba(255,255,255,0.9)",
          backdropFilter: "blur(12px)",
        }}
      >
        <PageContainer
          fullWidth
          sx={{ px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}
        >
          <Stack spacing={3}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  xl: "minmax(0, 1.1fr) 360px",
                },
                gap: 2,
                alignItems: "start",
              }}
            >
              <Stack spacing={2.25} sx={{ minWidth: 0 }}>
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  useFlexGap
                  flexWrap="wrap"
                >
                  <JoyButton
                    bloomVariant="ghost"
                    color="neutral"
                    startDecorator={<ArrowLeft size={16} />}
                    onClick={() => guardedNavigate("/crm/forms")}
                  >
                    Back to forms
                  </JoyButton>
                  <JoyChip size="sm" variant="soft" color="neutral">
                    Form builder
                  </JoyChip>
                  <JoyChip
                    size="sm"
                    variant="soft"
                    color={
                      form.status === "published"
                        ? "success"
                        : form.status === "archived"
                          ? "neutral"
                          : "warning"
                    }
                  >
                    {form.status.charAt(0).toUpperCase() + form.status.slice(1)}
                  </JoyChip>
                </Stack>

                <Box sx={{ position: "relative", maxWidth: 860 }}>
                  <JoyInput
                    ref={nameInputRef}
                    value={name}
                    onValueChange={setName}
                    onBlur={() => {
                      void handleNameSave();
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void handleNameSave();
                      }
                    }}
                    readOnly={!isNameEditing}
                    placeholder="Form name"
                    variant="plain"
                    sx={{
                      minHeight: "auto",
                      px: 0,
                      pr: 6,
                      fontSize: { xs: "2rem", md: "2.75rem" },
                      fontWeight: 700,
                      lineHeight: 1.1,
                      border: "none",
                      backgroundColor: "transparent",
                      boxShadow: "none",
                      ...(highlightedPublishIssue?.target === "header:name"
                        ? {
                            borderRadius: "lg",
                            boxShadow:
                              "0 0 0 2px rgba(var(--joy-palette-primary-mainChannel) / 0.18)",
                            px: 1,
                          }
                        : null),
                    }}
                  />
                  <IconButton
                    color="neutral"
                    variant="plain"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      if (isNameEditing) {
                        void handleNameSave();
                        return;
                      }

                      setIsNameEditing(true);
                    }}
                    sx={{
                      position: "absolute",
                      right: 0,
                      top: "50%",
                      transform: "translateY(-50%)",
                    }}
                  >
                    {isNameEditing ? <Check size={16} /> : <Pencil size={16} />}
                  </IconButton>
                </Box>

                <Typography
                  level="body-md"
                  color="neutral"
                  sx={{ maxWidth: 760 }}
                >
                  Build the visitor journey, refine the public presentation,
                  inspect submissions, and ship the final embed from one
                  workspace.
                </Typography>

                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  <SaveIndicator saveStatus={saveStatus} />
                  <JoyChip size="sm" variant="soft" color="neutral">
                    {fields.length} field{fields.length === 1 ? "" : "s"}
                  </JoyChip>
                  <JoyChip size="sm" variant="soft" color="neutral">
                    {configuredStepCount} step
                    {configuredStepCount === 1 ? "" : "s"}
                  </JoyChip>
                  {saveStatus === "error" ? (
                    <JoyButton
                      bloomVariant="ghost"
                      color="danger"
                      onClick={() => void retrySave()}
                    >
                      Retry save
                    </JoyButton>
                  ) : null}
                </Stack>
              </Stack>

              <Stack spacing={1.5}>
                <Stack
                  direction="row"
                  spacing={1}
                  useFlexGap
                  flexWrap="wrap"
                  justifyContent={{ xs: "flex-start", xl: "flex-end" }}
                >
                  <JoyButton
                    bloomVariant="ghost"
                    color="neutral"
                    onClick={() => void handleManualSave()}
                    disabled={isManualSaveDisabled}
                  >
                    Save
                  </JoyButton>
                  <JoyButton
                    bloomVariant="ghost"
                    color="neutral"
                    startDecorator={<Eye size={16} />}
                    onClick={() => setIsPreviewOpen(true)}
                  >
                    Preview
                  </JoyButton>
                  <JoyButton
                    bloomVariant="ghost"
                    color="neutral"
                    startDecorator={<Rocket size={16} />}
                    onClick={() => {
                      const nextParams = new URLSearchParams(searchParams);
                      nextParams.set("tab", "publish");
                      setSearchParams(nextParams, { replace: true });
                    }}
                  >
                    Publish tools
                  </JoyButton>
                  <JoyButton
                    startDecorator={<Globe size={16} />}
                    onClick={() => void handlePublishToggle()}
                    disabled={isPublishing || isStatusUpdating}
                  >
                    {form.status === "published" ? "Unpublish" : "Publish"}
                  </JoyButton>
                </Stack>

                <JoyCard>
                  <JoyCardHeader
                    title={tabMeta.label}
                    description={tabMeta.description}
                  />
                  <JoyCardContent sx={{ pt: 2, gap: 1 }}>
                    <Typography level="body-xs" color="neutral">
                      Tabs persist in the URL, so you can share or reload this
                      editor without losing your place.
                    </Typography>
                  </JoyCardContent>
                </JoyCard>
              </Stack>
            </Box>

            <JoyTabsList
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "repeat(2, minmax(0, 1fr))",
                  md: "repeat(4, minmax(0, 1fr))",
                  xl: "repeat(7, minmax(0, 1fr))",
                },
              }}
            >
              {FORM_EDITOR_TABS.map((tab) => (
                <JoyTabsTrigger
                  key={tab}
                  value={tab}
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    justifyContent: "flex-start",
                    minWidth: 0,
                    py: 1.5,
                    textAlign: "left",
                  }}
                >
                  <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                    {FORM_EDITOR_TAB_COPY[tab].label}
                  </Typography>
                  <Typography level="body-xs" color="neutral">
                    {FORM_EDITOR_TAB_COPY[tab].description}
                  </Typography>
                </JoyTabsTrigger>
              ))}
            </JoyTabsList>
          </Stack>
        </PageContainer>
      </Sheet>

      <PageContainer
        fullWidth
        sx={{ px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}
      >
        <JoyTabsContent value="build">
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
        </JoyTabsContent>

        <JoyTabsContent value="design">
          <FormDesignTab
            settings={settings}
            onSettingsChange={setSettings}
            fields={fields}
            compliance={compliance}
            formName={name}
            uploadEmbedKey={form.embed_key}
          />
        </JoyTabsContent>

        <JoyTabsContent value="submissions">
          <FormSubmissionsTab form={form} tenantId={tenantId} />
        </JoyTabsContent>

        <JoyTabsContent value="analytics">
          <FormAnalyticsTab
            formId={form.id}
            tenantId={tenantId}
            isPublished={form.status === "published"}
            onOpenShare={() => {
              const nextParams = new URLSearchParams(searchParams);
              nextParams.set("tab", "publish");
              setSearchParams(nextParams, { replace: true });
            }}
          />
        </JoyTabsContent>

        <JoyTabsContent value="audience">
          <FormAudienceTab audience={audience} onAudienceChange={setAudience} />
        </JoyTabsContent>

        <JoyTabsContent value="compliance">
          <FormComplianceTab
            compliance={compliance}
            onComplianceChange={setCompliance}
            hasPhoneField={fields.some((field) => field.type === "phone")}
            hasEmailField={fields.some((field) => field.type === "email")}
          />
        </JoyTabsContent>

        <JoyTabsContent value="publish">
          <FormPublishTab form={form} />
        </JoyTabsContent>
      </PageContainer>

      <JoyDialog
        open={isPublishValidationOpen}
        onClose={() => setIsPublishValidationOpen(false)}
        title="Resolve publish blockers"
        description="Publishing stays disabled until each issue below is fixed."
      >
        <JoyDialogContent sx={{ pt: 0 }}>
          <Stack spacing={1.25}>
            {publishValidationIssues.map((issue) => (
              <Sheet
                key={issue.id}
                variant="soft"
                sx={{
                  borderRadius: "lg",
                  p: 2,
                }}
              >
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={2}
                  justifyContent="space-between"
                  alignItems={{ xs: "flex-start", sm: "center" }}
                >
                  <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
                    <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                      {issue.description}
                    </Typography>
                    <Typography level="body-sm" color="neutral">
                      {issue.fixHint}
                    </Typography>
                  </Stack>
                  <JoyButton
                    bloomVariant="ghost"
                    color="primary"
                    onClick={() => handleFixPublishIssue(issue)}
                  >
                    Fix
                  </JoyButton>
                </Stack>
              </Sheet>
            ))}
          </Stack>
        </JoyDialogContent>
        <JoyDialogActions>
          <JoyButton
            bloomVariant="ghost"
            color="neutral"
            onClick={() => setIsPublishValidationOpen(false)}
          >
            Close
          </JoyButton>
        </JoyDialogActions>
      </JoyDialog>

      <JoyDialog
        open={isPublishSuccessOpen}
        onClose={() => setIsPublishSuccessOpen(false)}
        size="xl"
        title="Form published"
        description="The form is live. Copy the hosted URL or ship one of the embed snippets below."
      >
        <JoyDialogContent sx={{ pt: 0 }}>
          <Stack spacing={2}>
            <JoyCard>
              <JoyCardHeader title="Public URL" />
              <JoyCardContent sx={{ pt: 2, gap: 2 }}>
                <JoyInput value={publicFormUrl} readOnly />
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <JoyButton
                    startDecorator={<Check size={16} />}
                    onClick={() => void copyPublicFormUrl()}
                  >
                    Copy URL
                  </JoyButton>
                  <JoyButton
                    bloomVariant="ghost"
                    color="neutral"
                    startDecorator={<ExternalLink size={16} />}
                    component="a"
                    href={publicFormUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open form
                  </JoyButton>
                </Stack>
              </JoyCardContent>
            </JoyCard>
            <FormPublishTab form={form} analyticsSurface="publish-success" />
          </Stack>
        </JoyDialogContent>
        <JoyDialogActions>
          <JoyButton onClick={() => setIsPublishSuccessOpen(false)}>
            Done
          </JoyButton>
        </JoyDialogActions>
      </JoyDialog>

      <FormPreviewDialog
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        fields={fields}
        settings={settings}
        compliance={compliance}
        formName={name}
        uploadEmbedKey={form.embed_key}
      />

      <JoyDialog
        open={pendingNavigation !== null}
        onClose={() => {
          if (!isExitSaving) {
            handleCancelLeave();
          }
        }}
        title="Unsaved changes"
        description="You have unsaved changes. Save before leaving this form or discard them."
      >
        <JoyDialogActions>
          <JoyButton
            onClick={() => void handleSaveAndLeave()}
            disabled={isExitSaving}
          >
            {isExitSaving ? "Saving..." : "Save and leave"}
          </JoyButton>
          <JoyButton
            bloomVariant="ghost"
            color="danger"
            onClick={handleDiscardAndLeave}
            disabled={isExitSaving}
          >
            Discard
          </JoyButton>
          <JoyButton
            bloomVariant="ghost"
            color="neutral"
            onClick={handleCancelLeave}
            disabled={isExitSaving}
          >
            Cancel
          </JoyButton>
        </JoyDialogActions>
      </JoyDialog>

      <JoyAlertDialog
        open={isUnpublishConfirmOpen}
        onClose={() => setIsUnpublishConfirmOpen(false)}
        onConfirm={() => void handleConfirmUnpublish()}
        title="Unpublish this form?"
        description="Existing hosted links and embeds stop working immediately, but collected submissions remain intact."
        confirmLabel="Unpublish"
        loading={isPublishing}
        variant="warning"
      />
    </JoyTabs>
  );
}
