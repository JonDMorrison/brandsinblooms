import * as React from "react";
import Avatar from "@mui/joy/Avatar";
import Box from "@mui/joy/Box";
import CircularProgress from "@mui/joy/CircularProgress";
import Divider from "@mui/joy/Divider";
import Dropdown from "@mui/joy/Dropdown";
import IconButton from "@mui/joy/IconButton";
import ListItemDecorator from "@mui/joy/ListItemDecorator";
import Menu from "@mui/joy/Menu";
import MenuButton from "@mui/joy/MenuButton";
import MenuItem from "@mui/joy/MenuItem";
import Modal from "@mui/joy/Modal";
import ModalDialog from "@mui/joy/ModalDialog";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Tab from "@mui/joy/Tab";
import TabList from "@mui/joy/TabList";
import TabPanel from "@mui/joy/TabPanel";
import Tabs from "@mui/joy/Tabs";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  Pencil,
  Rocket,
} from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
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

const FORM_EDITOR_TAB_LABELS: Record<FormEditorTab, string> = {
  analytics: "Analytics",
  audience: "Audience",
  build: "Build",
  compliance: "Compliance",
  design: "Design",
  publish: "Publish",
  submissions: "Submissions",
};

function isFormEditorTab(value: string | null): value is FormEditorTab {
  return value !== null && FORM_EDITOR_TABS.includes(value as FormEditorTab);
}

function SaveStatusIndicator({
  saveStatus,
  hasUnsavedChanges,
}: {
  hasUnsavedChanges: boolean;
  saveStatus: "saved" | "pending" | "saving" | "error";
}) {
  const [showSavedFlash, setShowSavedFlash] = React.useState(false);
  const previousStatusRef = React.useRef(saveStatus);

  React.useEffect(() => {
    if (saveStatus === "saved" && previousStatusRef.current !== "saved") {
      setShowSavedFlash(true);
      const timeoutId = window.setTimeout(() => {
        setShowSavedFlash(false);
      }, 1200);

      previousStatusRef.current = saveStatus;
      return () => window.clearTimeout(timeoutId);
    }

    previousStatusRef.current = saveStatus;
    return undefined;
  }, [saveStatus]);

  if (saveStatus === "error") {
    return (
      <Stack
        direction="row"
        spacing={0.75}
        alignItems="center"
        sx={{ color: "danger.600" }}
      >
        <AlertCircle size={14} />
        <Typography level="body-xs" sx={{ fontWeight: 500 }}>
          Save failed
        </Typography>
      </Stack>
    );
  }

  if (saveStatus === "saving") {
    return (
      <Stack
        direction="row"
        spacing={0.75}
        alignItems="center"
        sx={{ color: "neutral.600" }}
      >
        <CircularProgress size="sm" thickness={4} />
        <Typography level="body-xs" sx={{ fontWeight: 500 }}>
          Saving...
        </Typography>
      </Stack>
    );
  }

  if (hasUnsavedChanges || saveStatus === "pending") {
    return (
      <Stack
        direction="row"
        spacing={0.75}
        alignItems="center"
        sx={{ color: "neutral.600" }}
      >
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: "warning.500",
          }}
        />
        <Typography level="body-xs" sx={{ fontWeight: 500 }}>
          Unsaved changes
        </Typography>
      </Stack>
    );
  }

  return (
    <Stack
      direction="row"
      spacing={0.75}
      alignItems="center"
      sx={{
        color: showSavedFlash ? "success.700" : "neutral.500",
        opacity: showSavedFlash ? 1 : 0.8,
        transition: "color 180ms ease, opacity 180ms ease",
      }}
    >
      <CheckCircle2 size={14} />
      <Typography level="body-xs" sx={{ fontWeight: 500 }}>
        Saved
      </Typography>
    </Stack>
  );
}

function FormEditorShellSkeleton() {
  return (
    <PageContainer
      fullWidth
      sx={{ px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}
    >
      <Stack spacing={3}>
        <Sheet
          variant="outlined"
          sx={{
            borderRadius: "xl",
            overflow: "hidden",
            backgroundColor: "background.surface",
          }}
        >
          <Box sx={{ px: { xs: 1.25, md: 1.75 }, py: 1.25 }}>
            <Stack
              direction="row"
              spacing={1.5}
              alignItems="center"
              justifyContent="space-between"
              useFlexGap
              flexWrap="wrap"
            >
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{ minWidth: 0, flex: 1 }}
              >
                <Skeleton variant="circular" width={32} height={32} />
                <Skeleton variant="text" width={220} height={28} />
                <Skeleton
                  variant="rectangular"
                  width={84}
                  height={24}
                  sx={{ borderRadius: 999 }}
                />
              </Stack>

              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                useFlexGap
                flexWrap="wrap"
              >
                <Skeleton variant="text" width={96} height={18} />
                <Skeleton
                  variant="rectangular"
                  width={76}
                  height={24}
                  sx={{ borderRadius: 999 }}
                />
                <Skeleton
                  variant="rectangular"
                  width={72}
                  height={24}
                  sx={{ borderRadius: 999 }}
                />
                <Skeleton
                  variant="rectangular"
                  width={36}
                  height={36}
                  sx={{ borderRadius: "sm" }}
                />
                <Skeleton
                  variant="rectangular"
                  width={76}
                  height={36}
                  sx={{ borderRadius: "sm" }}
                />
                <Skeleton
                  variant="rectangular"
                  width={92}
                  height={36}
                  sx={{ borderRadius: "sm" }}
                />
              </Stack>
            </Stack>
          </Box>

          <Divider />

          <Box sx={{ px: { xs: 1, md: 1.5 }, py: 0.75 }}>
            <Stack direction="row" spacing={1} sx={{ overflow: "hidden" }}>
              {Array.from({ length: 7 }).map((_, index) => (
                <Skeleton
                  key={index}
                  variant="rectangular"
                  width={88}
                  height={32}
                  sx={{ borderRadius: 999, flexShrink: 0 }}
                />
              ))}
            </Stack>
          </Box>
        </Sheet>

        <Stack spacing={1.5}>
          <Skeleton variant="text" width="24%" height={18} />
          <Skeleton
            variant="rectangular"
            height={520}
            sx={{ borderRadius: "xl" }}
          />
        </Stack>
      </Stack>
    </PageContainer>
  );
}

export default function FormEditorPage() {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);
  const [isPublishing, setIsPublishing] = React.useState(false);
  const [isNameEditing, setIsNameEditing] = React.useState(false);
  const [isPublishValidationOpen, setIsPublishValidationOpen] =
    React.useState(false);
  const [isPublishSuccessOpen, setIsPublishSuccessOpen] = React.useState(false);
  const [isUnpublishConfirmOpen, setIsUnpublishConfirmOpen] =
    React.useState(false);
  const [highlightedPublishIssue, setHighlightedPublishIssue] =
    React.useState<PublishValidationIssue | null>(null);
  const nameInputRef = React.useRef<HTMLInputElement | null>(null);
  const exitFlushRequestedRef = React.useRef(false);

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
  const saveNowRef = React.useRef(saveNow);
  const shouldPersistOnExitRef = React.useRef(false);

  const rawTab = searchParams.get("tab");
  const activeTab: FormEditorTab = isFormEditorTab(rawTab) ? rawTab : "build";
  const publishValidationIssues = React.useMemo(
    () => validateFormForPublish({ name, fields, settings }),
    [fields, name, settings],
  );
  const publicFormUrl = React.useMemo(
    () => (form ? getPublicFormUrl(form.embed_key) : ""),
    [form],
  );
  const configuredStepCount = settings.steps?.length
    ? settings.steps.length
    : 1;
  const shouldPersistOnExit =
    hasUnsavedChanges || saveStatus === "pending" || saveStatus === "saving";
  const shouldFlushEditorState = shouldPersistOnExit || saveStatus === "error";
  const statusChipColor = form?.status === "published" ? "success" : "neutral";
  const statusChipLabel =
    form?.status === "published"
      ? "Published"
      : form?.status === "archived"
        ? "Archived"
        : "Draft";

  React.useEffect(() => {
    if (rawTab === activeTab) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", activeTab);
    setSearchParams(nextParams, { replace: true });
  }, [activeTab, rawTab, searchParams, setSearchParams]);

  React.useEffect(() => {
    saveNowRef.current = saveNow;
    shouldPersistOnExitRef.current = shouldPersistOnExit;
  }, [saveNow, shouldPersistOnExit]);

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
    return () => {
      if (exitFlushRequestedRef.current || !shouldPersistOnExitRef.current) {
        return;
      }

      void saveNowRef.current({ force: true });
    };
  }, []);

  const handleTabChange = (nextTab: string | number | null) => {
    if (!isFormEditorTab(String(nextTab))) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", String(nextTab));
    setSearchParams(nextParams, { replace: true });
  };

  const handleOpenPublishTab = React.useCallback(() => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", "publish");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleBackToForms = React.useCallback(() => {
    if (shouldFlushEditorState) {
      exitFlushRequestedRef.current = true;
      void saveNow({ force: true });
    }

    navigate("/crm/forms");
  }, [navigate, saveNow, shouldFlushEditorState]);

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

    if (shouldFlushEditorState) {
      const saved = await saveNow({ force: true });
      if (!saved) {
        return;
      }
    }

    setIsPublishing(true);
    const nextForm = await updateStatus("published");
    setIsPublishing(false);

    if (nextForm) {
      setIsPublishSuccessOpen(true);
      handleOpenPublishTab();
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

  const handleNameSave = React.useCallback(async () => {
    setIsNameEditing(false);
    await saveNow({ force: true });
  }, [saveNow]);

  if (isLoading) {
    return <FormEditorShellSkeleton />;
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
              onClick={() => navigate("/crm/forms")}
            >
              Back to forms
            </JoyButton>
          </JoyCardContent>
        </JoyCard>
      </PageContainer>
    );
  }

  return (
    <Tabs
      value={activeTab}
      onChange={(_, nextTab) => handleTabChange(nextTab)}
      sx={{ width: "100%" }}
    >
      <Box
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 4,
          py: { xs: 2, md: 3 },
          backgroundColor: "background.body",
        }}
      >
        <PageContainer fullWidth sx={{ px: { xs: 2, md: 3 }, py: 0 }}>
          <Sheet
            variant="outlined"
            sx={{
              borderRadius: "xl",
              overflow: "hidden",
              backgroundColor: "background.surface",
              boxShadow: "var(--joy-shadow-sm)",
            }}
          >
            <Box sx={{ px: { xs: 1.25, md: 1.75 }, py: 1.25 }}>
              <Stack
                direction="row"
                spacing={1.5}
                alignItems="center"
                justifyContent="space-between"
                useFlexGap
                flexWrap="wrap"
              >
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  sx={{ minWidth: 0, flex: 1 }}
                >
                  <Tooltip title="Back to forms">
                    <IconButton
                      size="sm"
                      variant="plain"
                      color="neutral"
                      onClick={handleBackToForms}
                    >
                      <ArrowLeft size={16} />
                    </IconButton>
                  </Tooltip>

                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    useFlexGap
                    flexWrap="wrap"
                    sx={{ minWidth: 0 }}
                  >
                    {isNameEditing ? (
                      <Stack
                        direction="row"
                        spacing={0.5}
                        alignItems="center"
                        sx={{ minWidth: 0 }}
                      >
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
                              return;
                            }

                            if (event.key === "Escape") {
                              event.preventDefault();
                              setName(form.name);
                              setIsNameEditing(false);
                            }
                          }}
                          placeholder="Form name"
                          variant="plain"
                          sx={{
                            minWidth: { xs: 220, sm: 280 },
                            maxWidth: { xs: "100%", md: 520 },
                            "--Input-minHeight": "34px",
                            px: 0.5,
                            fontSize: "1rem",
                            fontWeight: 600,
                            borderRadius: "md",
                            backgroundColor: "background.surface",
                            boxShadow:
                              highlightedPublishIssue?.target === "header:name"
                                ? "0 0 0 2px rgba(var(--joy-palette-primary-mainChannel) / 0.24)"
                                : "none",
                          }}
                        />
                        <IconButton
                          size="sm"
                          variant="plain"
                          color="neutral"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            void handleNameSave();
                          }}
                        >
                          <Check size={16} />
                        </IconButton>
                      </Stack>
                    ) : (
                      <Box
                        onClick={() => setIsNameEditing(true)}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 0.5,
                          minWidth: 0,
                          px: 0.25,
                          py: 0.25,
                          borderRadius: "md",
                          cursor: "text",
                          boxShadow:
                            highlightedPublishIssue?.target === "header:name"
                              ? "0 0 0 2px rgba(var(--joy-palette-primary-mainChannel) / 0.24)"
                              : "none",
                          "&:hover .form-name-edit": {
                            opacity: 1,
                            transform: "translateX(0)",
                          },
                        }}
                      >
                        <Typography
                          level="title-md"
                          noWrap
                          sx={{
                            fontWeight: 600,
                            letterSpacing: "-0.01em",
                            minWidth: 0,
                          }}
                        >
                          {name || "Untitled form"}
                        </Typography>
                        <IconButton
                          className="form-name-edit"
                          size="sm"
                          variant="plain"
                          color="neutral"
                          sx={{
                            opacity: 0,
                            transform: "translateX(-2px)",
                            transition:
                              "opacity 160ms ease, transform 160ms ease",
                            flexShrink: 0,
                          }}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => setIsNameEditing(true)}
                        >
                          <Pencil size={14} />
                        </IconButton>
                      </Box>
                    )}

                    <JoyChip size="sm" variant="soft" color={statusChipColor}>
                      {statusChipLabel}
                    </JoyChip>
                  </Stack>
                </Stack>

                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  justifyContent="flex-end"
                  useFlexGap
                  flexWrap="wrap"
                >
                  <SaveStatusIndicator
                    saveStatus={saveStatus}
                    hasUnsavedChanges={hasUnsavedChanges}
                  />
                  {saveStatus === "error" ? (
                    <JoyButton
                      size="sm"
                      bloomVariant="ghost"
                      color="danger"
                      onClick={() => void retrySave()}
                    >
                      Retry
                    </JoyButton>
                  ) : null}
                  <JoyChip size="sm" variant="soft" color="neutral">
                    {fields.length} field{fields.length === 1 ? "" : "s"}
                  </JoyChip>
                  <JoyChip size="sm" variant="soft" color="neutral">
                    {configuredStepCount} step
                    {configuredStepCount === 1 ? "" : "s"}
                  </JoyChip>
                  <Divider
                    orientation="vertical"
                    sx={{ height: 24, display: { xs: "none", md: "block" } }}
                  />
                  <Tooltip title="Preview form">
                    <IconButton
                      size="sm"
                      variant="plain"
                      color="neutral"
                      onClick={() => setIsPreviewOpen(true)}
                    >
                      <Eye size={16} />
                    </IconButton>
                  </Tooltip>
                  <Dropdown>
                    <MenuButton
                      size="sm"
                      variant="plain"
                      color="neutral"
                      endDecorator={<ChevronDown size={14} />}
                    >
                      Tools
                    </MenuButton>
                    <Menu placement="bottom-end">
                      <MenuItem onClick={handleOpenPublishTab}>
                        <ListItemDecorator>
                          <Rocket size={16} />
                        </ListItemDecorator>
                        Open publish tab
                      </MenuItem>
                      <MenuItem onClick={() => void copyPublicFormUrl()}>
                        <ListItemDecorator>
                          <Copy size={16} />
                        </ListItemDecorator>
                        Copy public URL
                      </MenuItem>
                      <MenuItem
                        disabled={!publicFormUrl}
                        onClick={() => {
                          window.open(
                            publicFormUrl,
                            "_blank",
                            "noopener,noreferrer",
                          );
                        }}
                      >
                        <ListItemDecorator>
                          <ExternalLink size={16} />
                        </ListItemDecorator>
                        Open public form
                      </MenuItem>
                      <MenuItem
                        onClick={() => navigate(`/crm/forms/${form.id}/docs`)}
                      >
                        <ListItemDecorator>
                          <FileText size={16} />
                        </ListItemDecorator>
                        Open docs
                      </MenuItem>
                    </Menu>
                  </Dropdown>
                  <JoyButton
                    size="sm"
                    onClick={() => void handlePublishToggle()}
                    disabled={isPublishing || isStatusUpdating}
                  >
                    {form.status === "published" ? "Unpublish" : "Publish"}
                  </JoyButton>
                </Stack>
              </Stack>
            </Box>

            <Divider />

            <Box sx={{ px: { xs: 1, md: 1.5 } }}>
              <TabList
                variant="plain"
                sx={{
                  gap: 0,
                  minHeight: 44,
                  py: 0,
                  backgroundColor: "background.surface",
                  borderRadius: 0,
                  overflowX: "auto",
                  overflowY: "hidden",
                  flexWrap: "nowrap",
                  scrollbarWidth: "none",
                  maskImage: {
                    xs: "linear-gradient(to right, black 0%, black calc(100% - 28px), transparent 100%)",
                    lg: "none",
                  },
                  WebkitMaskImage: {
                    xs: "linear-gradient(to right, black 0%, black calc(100% - 28px), transparent 100%)",
                    lg: "none",
                  },
                  "&::-webkit-scrollbar": {
                    display: "none",
                  },
                }}
              >
                {FORM_EDITOR_TABS.map((tab) => (
                  <Tab
                    key={tab}
                    value={tab}
                    disableIndicator
                    sx={{
                      flex: "0 0 auto",
                      minHeight: 44,
                      px: 1.5,
                      borderRadius: 0,
                      backgroundColor: "transparent",
                      color: "neutral.500",
                      borderBottom: "2px solid transparent",
                      fontSize: "0.875rem",
                      fontWeight: 500,
                      "&:hover": {
                        backgroundColor: "transparent",
                        color: "neutral.700",
                      },
                      "&.Mui-selected": {
                        backgroundColor: "transparent",
                        color: "primary.700",
                        borderBottomColor: "primary.500",
                        fontWeight: 600,
                      },
                    }}
                  >
                    {FORM_EDITOR_TAB_LABELS[tab]}
                  </Tab>
                ))}
              </TabList>
            </Box>
          </Sheet>
        </PageContainer>
      </Box>

      <PageContainer
        fullWidth
        sx={{
          px: { xs: 2, md: 3 },
          pt: { xs: 2, md: 3 },
          pb: { xs: 3, md: 4 },
        }}
      >
        <TabPanel value="build" sx={{ px: 0, pt: 0, pb: 0 }}>
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
        </TabPanel>

        <TabPanel value="design" sx={{ px: 0, pt: 0, pb: 0 }}>
          <FormDesignTab
            settings={settings}
            onSettingsChange={setSettings}
            fields={fields}
            compliance={compliance}
            formName={name}
            uploadEmbedKey={form.embed_key}
          />
        </TabPanel>

        <TabPanel value="submissions" sx={{ px: 0, pt: 0, pb: 0 }}>
          <FormSubmissionsTab
            form={form}
            tenantId={tenantId}
            onOpenPublishTab={handleOpenPublishTab}
          />
        </TabPanel>

        <TabPanel value="analytics" sx={{ px: 0, pt: 0, pb: 0 }}>
          <FormAnalyticsTab
            formId={form.id}
            tenantId={tenantId}
            isPublished={form.status === "published"}
            onOpenShare={handleOpenPublishTab}
          />
        </TabPanel>

        <TabPanel value="audience" sx={{ px: 0, pt: 0, pb: 0 }}>
          <FormAudienceTab audience={audience} onAudienceChange={setAudience} />
        </TabPanel>

        <TabPanel value="compliance" sx={{ px: 0, pt: 0, pb: 0 }}>
          <FormComplianceTab
            compliance={compliance}
            onComplianceChange={setCompliance}
            hasPhoneField={fields.some((field) => field.type === "phone")}
            hasEmailField={fields.some((field) => field.type === "email")}
            notificationEmails={settings.notification_emails || []}
            onNotificationEmailsChange={(notification_emails) =>
              setSettings({
                ...settings,
                notification_emails,
              })
            }
          />
        </TabPanel>

        <TabPanel value="publish" sx={{ px: 0, pt: 0, pb: 0 }}>
          <FormPublishTab
            form={form}
            isActive={activeTab === "publish"}
            publishValidationIssues={publishValidationIssues}
            onPublish={handlePublishToggle}
            onUnpublish={() => {
              setIsUnpublishConfirmOpen(true);
            }}
            isStatusUpdating={isPublishing || isStatusUpdating}
          />
        </TabPanel>
      </PageContainer>

      <Modal
        open={isPublishValidationOpen}
        onClose={() => setIsPublishValidationOpen(false)}
      >
        <ModalDialog
          variant="outlined"
          sx={{
            width: "min(100%, 560px)",
            maxWidth: 560,
            borderRadius: "var(--joy-radius-lg)",
            p: 0,
            overflow: "hidden",
            backgroundColor: "background.surface",
          }}
        >
          <Stack spacing={0}>
            <Box sx={{ p: 2.5 }}>
              <Stack spacing={0.75}>
                <Typography level="title-lg">
                  Resolve publish blockers
                </Typography>
                <Typography level="body-sm" color="neutral">
                  Publishing stays disabled until each issue below is fixed.
                </Typography>
              </Stack>
            </Box>

            <Divider />

            <Stack spacing={1.25} sx={{ p: 2.5 }}>
              {publishValidationIssues.map((issue) => (
                <Sheet
                  key={issue.id}
                  variant="soft"
                  color="warning"
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
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="flex-start"
                      sx={{ minWidth: 0, flex: 1 }}
                    >
                      <AlertCircle size={16} />
                      <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                        <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                          {issue.description}
                        </Typography>
                        <Typography level="body-sm" color="neutral">
                          {issue.fixHint}
                        </Typography>
                      </Stack>
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

            <Divider />

            <Box
              sx={{
                p: 2,
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <JoyButton
                bloomVariant="ghost"
                color="neutral"
                onClick={() => setIsPublishValidationOpen(false)}
              >
                Close
              </JoyButton>
            </Box>
          </Stack>
        </ModalDialog>
      </Modal>

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
            <FormPublishTab
              form={form}
              analyticsSurface="publish-success"
              isActive={isPublishSuccessOpen}
              publishValidationIssues={publishValidationIssues}
              onPublish={handlePublishToggle}
              onUnpublish={() => {
                setIsUnpublishConfirmOpen(true);
              }}
              isStatusUpdating={isPublishing || isStatusUpdating}
            />
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
        isPublished={form.status === "published"}
        publicUrl={publicFormUrl || undefined}
      />

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
    </Tabs>
  );
}
