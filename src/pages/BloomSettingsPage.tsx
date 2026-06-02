import * as React from "react";
import Box from "@mui/joy/Box";
import CircularProgress from "@mui/joy/CircularProgress";
import Divider from "@mui/joy/Divider";
import IconButton from "@mui/joy/IconButton";
import List from "@mui/joy/List";
import ListItem from "@mui/joy/ListItem";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  ArrowRight,
  Check,
  Layers,
  Mail,
  Package,
  Users,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
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
import { JoySelect } from "@/components/joy/JoySelect";
import { JoySwitch } from "@/components/joy/JoySwitch";
import { JoyTextarea } from "@/components/joy/JoyTextarea";
import { JoyTooltip } from "@/components/joy/JoyTooltip";
import { useBloomConversations } from "@/hooks/bloom/useBloomConversations";
import { useBloomKnowledgeDocuments } from "@/hooks/bloom/useBloomKnowledgeDocuments";
import { useBloomOnboarding } from "@/hooks/bloom/useBloomOnboarding";
import { useBloomProfile } from "@/hooks/bloom/useBloomProfile";
import { useBloomProfileMutations } from "@/hooks/bloom/useBloomProfileMutations";
import {
  DEFAULT_BLOOM_PREFERENCES,
  isBloomDefaultModePreference,
  isBloomModelPreference,
  isBloomResponseDensityPreference,
  type BloomDefaultModePreference,
  type BloomModelPreference,
  type BloomPreferences,
  type BloomResponseDensityPreference,
} from "@/hooks/bloom/types";
import {
  MAX_PINNED_CONTEXT_ITEMS,
  normalizeBloomWorkspaceMemory,
} from "@/hooks/bloom/workspaceMemory";
import { useTenant } from "@/hooks/useTenant";

const SAVE_SUCCESS_TIMEOUT_MS = 1_500;
const TEXTAREA_BLUR_DEBOUNCE_MS = 300;
const CHARACTER_WARNING_THRESHOLD = 450;
const MAX_PREFERENCE_CHARACTERS = 500;

const numberFormatter = new Intl.NumberFormat("en-US");

const densityOptions = [
  { value: "concise", label: "Concise" },
  { value: "balanced", label: "Balanced" },
  { value: "detailed", label: "Detailed" },
] as const satisfies ReadonlyArray<{
  value: BloomResponseDensityPreference;
  label: string;
}>;

const defaultModeOptions = [
  { value: "standard", label: "Standard" },
  { value: "reasoning", label: "Reasoning" },
  { value: "research", label: "Research" },
] as const satisfies ReadonlyArray<{
  value: BloomDefaultModePreference;
  label: string;
}>;

const modelOptions = [
  { value: "auto", label: "Auto (recommended)" },
  { value: "standard", label: "Standard (faster)" },
  { value: "pro", label: "Pro (smarter)" },
] as const satisfies ReadonlyArray<{
  value: BloomModelPreference;
  label: string;
}>;

const pinnedEntityMeta = {
  campaign: { Icon: Mail, label: "Campaign" },
  customer: { Icon: Users, label: "Customer" },
  product: { Icon: Package, label: "Product" },
  segment: { Icon: Layers, label: "Segment" },
} as const;

type PreferenceFieldKey =
  | "density"
  | "default_mode"
  | "about_me"
  | "response_style"
  | "default_model";

type TextPreferenceFieldKey = Extract<
  PreferenceFieldKey,
  "about_me" | "response_style"
>;

type SaveState = "idle" | "saving" | "saved" | "error";

type SaveStateMap = Record<PreferenceFieldKey, SaveState>;

const initialSaveState: SaveStateMap = {
  density: "idle",
  default_mode: "idle",
  about_me: "idle",
  response_style: "idle",
  default_model: "idle",
};

const formatCount = (value: number, singular: string, plural: string) =>
  `${numberFormatter.format(value)} ${value === 1 ? singular : plural}`;

function SaveIndicator({ state }: { state: SaveState }) {
  return (
    <Box
      component="span"
      sx={{
        width: 16,
        height: 16,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        opacity: state === "idle" ? 0 : 1,
        transition: "opacity 180ms ease",
      }}
    >
      {state === "saving" ? (
        <CircularProgress
          size="sm"
          sx={{
            color: "neutral.500",
            "--CircularProgress-size": "12px",
          }}
        />
      ) : null}
      {state === "saved" ? (
        <Box component="span" sx={{ color: "success.600", lineHeight: 0 }}>
          <Check size={12} strokeWidth={2.2} />
        </Box>
      ) : null}
      {state === "error" ? (
        <Box component="span" sx={{ color: "danger.600", lineHeight: 0 }}>
          <X size={12} strokeWidth={2.2} />
        </Box>
      ) : null}
    </Box>
  );
}

function FieldLabel({ label, state }: { label: string; state: SaveState }) {
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.75,
        minWidth: 0,
      }}
    >
      <Box component="span">{label}</Box>
      <SaveIndicator state={state} />
    </Box>
  );
}

function ConfirmationDialog({
  body,
  confirmLabel,
  confirmValue,
  confirmWord,
  onClose,
  onConfirm,
  onConfirmValueChange,
  open,
  pending,
  title,
}: {
  body: React.ReactNode;
  confirmLabel: string;
  confirmValue: string;
  confirmWord: string;
  onClose: () => void;
  onConfirm: () => void;
  onConfirmValueChange: (value: string) => void;
  open: boolean;
  pending: boolean;
  title: string;
}) {
  const isConfirmed = confirmValue.trim().toUpperCase() === confirmWord;

  return (
    <JoyDialog
      open={open}
      onClose={() => {
        if (!pending) {
          onClose();
        }
      }}
      title={title}
      hideCloseButton
      disableClose={pending}
      size="sm"
    >
      <JoyDialogContent>
        <Stack spacing={2}>
          <Typography level="body-sm" sx={{ color: "neutral.700" }}>
            {body}
          </Typography>
          <JoyInput
            label={`Type ${confirmWord} to confirm`}
            placeholder={`Type ${confirmWord} to confirm`}
            value={confirmValue}
            onValueChange={onConfirmValueChange}
          />
        </Stack>
      </JoyDialogContent>
      <JoyDialogActions>
        <JoyButton
          variant="plain"
          color="neutral"
          disabled={pending}
          onClick={onClose}
        >
          Cancel
        </JoyButton>
        <JoyButton
          variant="solid"
          color="danger"
          disabled={!isConfirmed}
          loading={pending}
          onClick={onConfirm}
        >
          {confirmLabel}
        </JoyButton>
      </JoyDialogActions>
    </JoyDialog>
  );
}

function SettingsSkeletonCard({
  fieldRows,
  includeParagraph = false,
  includeButton = false,
}: {
  fieldRows: number;
  includeParagraph?: boolean;
  includeButton?: boolean;
}) {
  return (
    <JoyCard variant="outlined">
      <JoyCardHeader
        title={<Skeleton variant="text" animation="wave" sx={{ width: 140 }} />}
        titleProps={{ level: "title-sm" }}
      />
      <JoyCardContent>
        <Stack spacing={2}>
          {Array.from({ length: fieldRows }).map((_, index) => (
            <Stack key={index} spacing={0.75}>
              <Skeleton
                variant="text"
                animation="wave"
                sx={{ width: `${36 + index * 12}%` }}
              />
              <Skeleton
                variant="rectangular"
                animation="wave"
                sx={{ height: 38, borderRadius: "var(--joy-radius-lg)" }}
              />
              <Skeleton
                variant="text"
                animation="wave"
                sx={{ width: `${54 + index * 10}%` }}
              />
            </Stack>
          ))}
          {includeParagraph ? (
            <Stack spacing={0.75}>
              <Skeleton
                variant="rectangular"
                animation="wave"
                sx={{ height: 96, borderRadius: "var(--joy-radius-lg)" }}
              />
              <Skeleton variant="text" animation="wave" sx={{ width: "22%" }} />
              <Skeleton
                variant="rectangular"
                animation="wave"
                sx={{ height: 96, borderRadius: "var(--joy-radius-lg)" }}
              />
              <Skeleton variant="text" animation="wave" sx={{ width: "22%" }} />
            </Stack>
          ) : null}
          {includeButton ? (
            <Stack spacing={1.25}>
              <Skeleton
                variant="rectangular"
                animation="wave"
                sx={{ height: 64, borderRadius: "var(--joy-radius-lg)" }}
              />
              <Skeleton
                variant="rectangular"
                animation="wave"
                sx={{ height: 64, borderRadius: "var(--joy-radius-lg)" }}
              />
            </Stack>
          ) : null}
        </Stack>
      </JoyCardContent>
    </JoyCard>
  );
}

function BloomSettingsSkeleton() {
  return (
    <PageContainer sx={{ px: { xs: 2, md: 3 }, py: { xs: 3, md: 4 } }}>
      <Stack spacing={2.5}>
        <Stack spacing={0.75}>
          <Skeleton
            variant="text"
            animation="wave"
            sx={{ width: 170, height: 30 }}
          />
          <Skeleton variant="text" animation="wave" sx={{ width: "38%" }} />
        </Stack>
        <SettingsSkeletonCard fieldRows={2} />
        <SettingsSkeletonCard fieldRows={0} includeParagraph />
        <SettingsSkeletonCard fieldRows={1} />
        <SettingsSkeletonCard fieldRows={0} includeButton />
        <SettingsSkeletonCard fieldRows={1} />
      </Stack>
    </PageContainer>
  );
}

function ActionRow({
  action,
  description,
  title,
}: {
  action: React.ReactNode;
  description: React.ReactNode;
  title: string;
}) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1.5}
      justifyContent="space-between"
      alignItems={{ xs: "flex-start", sm: "center" }}
    >
      <Stack spacing={0.35} sx={{ minWidth: 0, flex: 1 }}>
        <Typography level="title-sm" sx={{ color: "neutral.900" }}>
          {title}
        </Typography>
        <Typography level="body-sm" sx={{ color: "neutral.500" }}>
          {description}
        </Typography>
      </Stack>
      <Box sx={{ flexShrink: 0 }}>{action}</Box>
    </Stack>
  );
}

function buildTextPreferencePatch(
  field: TextPreferenceFieldKey,
  value: string,
): Partial<BloomPreferences> {
  return field === "about_me" ? { about_me: value } : { response_style: value };
}

function BloomSettingsContent() {
  const navigate = useNavigate();
  const { tenant } = useTenant();
  const { stage } = useBloomOnboarding();
  const tenantId = tenant?.id ?? null;
  const profileQuery = useBloomProfile();
  const conversationsQuery = useBloomConversations({ includeArchived: true });
  const documentsQuery = useBloomKnowledgeDocuments(tenantId);
  const {
    clearAllConversations,
    deleteBloomProfile,
    unpinEntity,
    unlockAllFeatures,
    updatePreferences,
    isClearingConversations,
    isDeletingProfile,
    isUnlockingAllFeatures,
    isUnpinningEntity,
  } = useBloomProfileMutations();

  const preferences =
    profileQuery.data?.preferences ?? DEFAULT_BLOOM_PREFERENCES;
  const [aboutMeDraft, setAboutMeDraft] = React.useState(preferences.about_me);
  const [responseStyleDraft, setResponseStyleDraft] = React.useState(
    preferences.response_style,
  );
  const [clearDialogOpen, setClearDialogOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [clearConfirmation, setClearConfirmation] = React.useState("");
  const [deleteConfirmation, setDeleteConfirmation] = React.useState("");
  const [unlockRequested, setUnlockRequested] = React.useState(false);
  const [saveStates, setSaveStates] =
    React.useState<SaveStateMap>(initialSaveState);

  const blurTimersRef = React.useRef<
    Partial<Record<TextPreferenceFieldKey, number>>
  >({});
  const successTimersRef = React.useRef<
    Partial<Record<PreferenceFieldKey, number>>
  >({});
  const saveSequenceRef = React.useRef<Record<PreferenceFieldKey, number>>({
    density: 0,
    default_mode: 0,
    about_me: 0,
    response_style: 0,
    default_model: 0,
  });
  const aboutMeFocusedRef = React.useRef(false);
  const responseStyleFocusedRef = React.useRef(false);

  const documents = documentsQuery.data ?? [];
  const pinnedContext = React.useMemo(
    () =>
      normalizeBloomWorkspaceMemory(profileQuery.data?.workspaceMemory)
        .pinnedContext,
    [profileQuery.data?.workspaceMemory],
  );
  const conversationCount = conversationsQuery.data?.length ?? 0;
  const documentCount = documents.length;
  const totalChunkCount = React.useMemo(
    () => documents.reduce((total, document) => total + document.chunkCount, 0),
    [documents],
  );

  const handlePinnedContextUnpin = React.useCallback(
    (
      entityType: (typeof pinnedContext)[number]["entityType"],
      entityId: string,
    ) => {
      void unpinEntity(entityType, entityId).catch(() => undefined);
    },
    [unpinEntity],
  );

  React.useEffect(() => {
    if (!aboutMeFocusedRef.current) {
      setAboutMeDraft(preferences.about_me);
    }
  }, [preferences.about_me]);

  React.useEffect(() => {
    if (!responseStyleFocusedRef.current) {
      setResponseStyleDraft(preferences.response_style);
    }
  }, [preferences.response_style]);

  React.useEffect(
    () => () => {
      Object.values(blurTimersRef.current).forEach((timerId) => {
        if (timerId !== undefined) {
          window.clearTimeout(timerId);
        }
      });
      Object.values(successTimersRef.current).forEach((timerId) => {
        if (timerId !== undefined) {
          window.clearTimeout(timerId);
        }
      });
    },
    [],
  );

  React.useEffect(() => {
    if (!clearDialogOpen) {
      setClearConfirmation("");
    }
  }, [clearDialogOpen]);

  React.useEffect(() => {
    if (!deleteDialogOpen) {
      setDeleteConfirmation("");
    }
  }, [deleteDialogOpen]);

  React.useEffect(() => {
    if (stage >= 3) {
      setUnlockRequested(false);
    }
  }, [stage]);

  const clearBlurTimer = React.useCallback((field: TextPreferenceFieldKey) => {
    const timerId = blurTimersRef.current[field];
    if (timerId !== undefined) {
      window.clearTimeout(timerId);
      delete blurTimersRef.current[field];
    }
  }, []);

  const clearSuccessTimer = React.useCallback((field: PreferenceFieldKey) => {
    const timerId = successTimersRef.current[field];
    if (timerId !== undefined) {
      window.clearTimeout(timerId);
      delete successTimersRef.current[field];
    }
  }, []);

  const setFieldState = React.useCallback(
    (field: PreferenceFieldKey, state: SaveState) => {
      setSaveStates((current) =>
        current[field] === state ? current : { ...current, [field]: state },
      );
    },
    [],
  );

  const resetFieldState = React.useCallback(
    (field: PreferenceFieldKey) => {
      clearSuccessTimer(field);
      setFieldState(field, "idle");
    },
    [clearSuccessTimer, setFieldState],
  );

  const invalidateFieldSave = React.useCallback(
    (field: PreferenceFieldKey) => {
      clearSuccessTimer(field);
      saveSequenceRef.current[field] += 1;
      setFieldState(field, "idle");
    },
    [clearSuccessTimer, setFieldState],
  );

  const markFieldSaved = React.useCallback(
    (field: PreferenceFieldKey, sequence: number) => {
      clearSuccessTimer(field);
      setFieldState(field, "saved");
      successTimersRef.current[field] = window.setTimeout(() => {
        if (saveSequenceRef.current[field] === sequence) {
          setFieldState(field, "idle");
        }
      }, SAVE_SUCCESS_TIMEOUT_MS);
    },
    [clearSuccessTimer, setFieldState],
  );

  const runPreferenceSave = React.useCallback(
    async (field: PreferenceFieldKey, patch: Partial<BloomPreferences>) => {
      clearSuccessTimer(field);
      const sequence = saveSequenceRef.current[field] + 1;
      saveSequenceRef.current[field] = sequence;
      setFieldState(field, "saving");

      try {
        await updatePreferences(patch);
        if (saveSequenceRef.current[field] !== sequence) {
          return;
        }
        markFieldSaved(field, sequence);
      } catch {
        if (saveSequenceRef.current[field] !== sequence) {
          return;
        }
        setFieldState(field, "error");
      }
    },
    [clearSuccessTimer, markFieldSaved, setFieldState, updatePreferences],
  );

  const handleDensityChange = React.useCallback(
    (value: string) => {
      if (!isBloomResponseDensityPreference(value)) {
        return;
      }

      if (value === preferences.density) {
        return;
      }

      void runPreferenceSave("density", { density: value });
    },
    [preferences.density, runPreferenceSave],
  );

  const handleDefaultModeChange = React.useCallback(
    (value: string) => {
      if (!isBloomDefaultModePreference(value)) {
        return;
      }

      if (value === preferences.default_mode) {
        return;
      }

      void runPreferenceSave("default_mode", { default_mode: value });
    },
    [preferences.default_mode, runPreferenceSave],
  );

  const handleModelChange = React.useCallback(
    (value: string) => {
      if (!isBloomModelPreference(value)) {
        return;
      }

      if (value === preferences.default_model) {
        return;
      }

      void runPreferenceSave("default_model", { default_model: value });
    },
    [preferences.default_model, runPreferenceSave],
  );

  const handleUnlockAllFeaturesChange = React.useCallback(
    (checked: boolean) => {
      if (!checked || stage >= 3 || unlockRequested) {
        return;
      }

      setUnlockRequested(true);
      void unlockAllFeatures()
        .then(() => {
          toast.success("All features unlocked!");
        })
        .catch(() => {
          setUnlockRequested(false);
        });
    },
    [stage, unlockAllFeatures, unlockRequested],
  );

  const scheduleTextPreferenceSave = React.useCallback(
    (field: TextPreferenceFieldKey, value: string, persistedValue: string) => {
      const normalizedValue = value.trim().slice(0, MAX_PREFERENCE_CHARACTERS);
      const normalizedPersistedValue = persistedValue.trim();

      clearBlurTimer(field);

      if (field === "about_me" && value !== normalizedValue) {
        setAboutMeDraft(normalizedValue);
      }

      if (field === "response_style" && value !== normalizedValue) {
        setResponseStyleDraft(normalizedValue);
      }

      if (normalizedValue === normalizedPersistedValue) {
        resetFieldState(field);
        return;
      }

      blurTimersRef.current[field] = window.setTimeout(() => {
        void runPreferenceSave(
          field,
          buildTextPreferencePatch(field, normalizedValue),
        );
      }, TEXTAREA_BLUR_DEBOUNCE_MS);
    },
    [clearBlurTimer, resetFieldState, runPreferenceSave],
  );

  const pageIsLoading =
    profileQuery.isLoading && profileQuery.data === undefined;

  if (pageIsLoading) {
    return <BloomSettingsSkeleton />;
  }

  return (
    <PageContainer sx={{ px: { xs: 2, md: 3 }, py: { xs: 3, md: 4 } }}>
      <Stack spacing={2.5}>
        <Stack spacing={0.75}>
          <Typography level="h1">Bloom Settings</Typography>
          <Typography
            level="body-sm"
            sx={{ color: "neutral.500", maxWidth: 640 }}
          >
            Set Bloom&apos;s default response behavior, tailor its instructions,
            and manage your data footprint.
          </Typography>
        </Stack>

        <JoyCard variant="outlined">
          <JoyCardHeader
            title="Response Style"
            titleProps={{ level: "title-sm" }}
          />
          <JoyCardContent>
            <Stack spacing={2}>
              <JoySelect
                label={
                  <FieldLabel
                    label="Response density"
                    state={saveStates.density}
                  />
                }
                helperText="Controls how verbose Bloom's responses are."
                value={preferences.density}
                onValueChange={handleDensityChange}
                options={densityOptions.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
              />
              <JoySelect
                label={
                  <FieldLabel
                    label="Default mode"
                    state={saveStates.default_mode}
                  />
                }
                helperText="The mode Bloom starts in for new conversations."
                value={preferences.default_mode}
                onValueChange={handleDefaultModeChange}
                options={defaultModeOptions.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
              />
              {stage < 3 ? (
                <Box
                  sx={{
                    pt: 1,
                    borderTop: "1px solid",
                    borderColor: "neutral.100",
                  }}
                >
                  <ActionRow
                    title="Unlock all features"
                    description="Show all features immediately (skip progressive introduction)"
                    action={
                      <JoySwitch
                        checked={unlockRequested}
                        disabled={isUnlockingAllFeatures}
                        onCheckedChange={handleUnlockAllFeaturesChange}
                      />
                    }
                  />
                </Box>
              ) : null}
            </Stack>
          </JoyCardContent>
        </JoyCard>

        <JoyCard variant="outlined">
          <JoyCardHeader
            title="Custom Instructions"
            titleProps={{ level: "title-sm" }}
          />
          <JoyCardContent>
            <Stack spacing={2}>
              <Stack spacing={0.75}>
                <JoyTextarea
                  label={
                    <FieldLabel
                      label="About me and my business"
                      state={saveStates.about_me}
                    />
                  }
                  minRows={3}
                  maxRows={6}
                  placeholder="Tell Bloom about yourself, your role, and your business (e.g., 'I'm the marketing manager at a garden centre in London')"
                  value={aboutMeDraft}
                  onFocus={() => {
                    aboutMeFocusedRef.current = true;
                    clearBlurTimer("about_me");
                  }}
                  onBlur={() => {
                    aboutMeFocusedRef.current = false;
                    scheduleTextPreferenceSave(
                      "about_me",
                      aboutMeDraft,
                      preferences.about_me,
                    );
                  }}
                  onValueChange={(value) => {
                    setAboutMeDraft(value);
                    invalidateFieldSave("about_me");
                  }}
                  slotProps={{
                    textarea: {
                      maxLength: MAX_PREFERENCE_CHARACTERS,
                    },
                  }}
                />
                <Typography
                  level="body-xs"
                  sx={{
                    alignSelf: "flex-end",
                    color:
                      aboutMeDraft.length >= CHARACTER_WARNING_THRESHOLD
                        ? "danger.500"
                        : "neutral.400",
                  }}
                >
                  {aboutMeDraft.length}/{MAX_PREFERENCE_CHARACTERS} characters
                </Typography>
              </Stack>

              <Stack spacing={0.75}>
                <JoyTextarea
                  label={
                    <FieldLabel
                      label="How should Bloom respond"
                      state={saveStates.response_style}
                    />
                  }
                  minRows={3}
                  maxRows={6}
                  placeholder="Specify tone, format, or language preferences (e.g., 'Use British English, be concise, avoid technical jargon')"
                  value={responseStyleDraft}
                  onFocus={() => {
                    responseStyleFocusedRef.current = true;
                    clearBlurTimer("response_style");
                  }}
                  onBlur={() => {
                    responseStyleFocusedRef.current = false;
                    scheduleTextPreferenceSave(
                      "response_style",
                      responseStyleDraft,
                      preferences.response_style,
                    );
                  }}
                  onValueChange={(value) => {
                    setResponseStyleDraft(value);
                    invalidateFieldSave("response_style");
                  }}
                  slotProps={{
                    textarea: {
                      maxLength: MAX_PREFERENCE_CHARACTERS,
                    },
                  }}
                />
                <Typography
                  level="body-xs"
                  sx={{
                    alignSelf: "flex-end",
                    color:
                      responseStyleDraft.length >= CHARACTER_WARNING_THRESHOLD
                        ? "danger.500"
                        : "neutral.400",
                  }}
                >
                  {responseStyleDraft.length}/{MAX_PREFERENCE_CHARACTERS}{" "}
                  characters
                </Typography>
              </Stack>
            </Stack>
          </JoyCardContent>
        </JoyCard>

        <JoyCard variant="outlined">
          <JoyCardHeader
            title="Model Preference"
            titleProps={{ level: "title-sm" }}
          />
          <JoyCardContent>
            <JoySelect
              label={
                <FieldLabel
                  label="Default model"
                  state={saveStates.default_model}
                />
              }
              value={preferences.default_model}
              onValueChange={handleModelChange}
              options={modelOptions.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
            />
          </JoyCardContent>
        </JoyCard>

        <JoyCard variant="outlined">
          <JoyCardHeader
            title="Data & Privacy"
            titleProps={{ level: "title-sm" }}
          />
          <JoyCardContent>
            <Stack spacing={2} divider={<Divider />}>
              <ActionRow
                title="Clear all conversations"
                description={
                  conversationsQuery.isLoading
                    ? "Loading conversation count..."
                    : formatCount(
                        conversationCount,
                        "conversation",
                        "conversations",
                      )
                }
                action={
                  <JoyButton
                    variant="outlined"
                    color="danger"
                    size="sm"
                    disabled={
                      conversationCount === 0 || conversationsQuery.isLoading
                    }
                    onClick={() => setClearDialogOpen(true)}
                  >
                    Clear all conversations
                  </JoyButton>
                }
              />
              <ActionRow
                title="Export conversation data"
                description="Coming soon"
                action={
                  <JoyTooltip title="Coming soon">
                    <Box component="span">
                      <JoyButton
                        variant="outlined"
                        color="neutral"
                        size="sm"
                        disabled
                      >
                        Export conversation data
                      </JoyButton>
                    </Box>
                  </JoyTooltip>
                }
              />
              <ActionRow
                title="Delete Bloom profile"
                description="This resets everything — preferences, conversations, and memory."
                action={
                  <JoyButton
                    variant="outlined"
                    color="danger"
                    size="sm"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    Delete Bloom profile
                  </JoyButton>
                }
              />
            </Stack>
          </JoyCardContent>
        </JoyCard>

        <JoyCard variant="outlined">
          <JoyCardHeader
            title="Pinned Context"
            description="You can pin up to 3 entities for persistent context. Pinned items are always included when Bloom processes your messages."
            titleProps={{ level: "title-sm" }}
            descriptionProps={{
              level: "body-sm",
              sx: { color: "neutral.500", maxWidth: 680 },
            }}
            actions={
              <JoyChip color="neutral" size="sm" variant="outlined">
                {pinnedContext.length}/{MAX_PINNED_CONTEXT_ITEMS} pinned
              </JoyChip>
            }
          />
          <JoyCardContent>
            {pinnedContext.length > 0 ? (
              <List
                sx={{
                  "--List-gap": "0.75rem",
                  "--List-padding": 0,
                }}
              >
                {pinnedContext.map((entry) => {
                  const meta = pinnedEntityMeta[entry.entityType];
                  return (
                    <ListItem
                      key={`${entry.entityType}:${entry.entityId}`}
                      sx={{ p: 0 }}
                    >
                      <Stack
                        direction="row"
                        spacing={1.25}
                        alignItems="center"
                        justifyContent="space-between"
                        sx={{
                          width: "100%",
                          px: 1.5,
                          py: 1.25,
                          border: "1px solid",
                          borderColor: "neutral.200",
                          borderRadius: "var(--joy-radius-lg)",
                          backgroundColor: "background.surface",
                        }}
                      >
                        <Stack
                          direction="row"
                          spacing={1.25}
                          alignItems="center"
                          sx={{ minWidth: 0, flex: 1 }}
                        >
                          <Box
                            aria-hidden="true"
                            sx={{
                              display: "inline-flex",
                              color: "neutral.600",
                              flexShrink: 0,
                            }}
                          >
                            <meta.Icon size={16} strokeWidth={1.9} />
                          </Box>
                          <Stack spacing={0.35} sx={{ minWidth: 0 }}>
                            <Typography
                              level="title-sm"
                              sx={{ color: "neutral.900" }}
                            >
                              {entry.displayName}
                            </Typography>
                            <Typography
                              level="body-xs"
                              sx={{ color: "neutral.500" }}
                            >
                              Always included when Bloom builds context.
                            </Typography>
                          </Stack>
                        </Stack>
                        <Stack
                          direction="row"
                          spacing={0.75}
                          alignItems="center"
                        >
                          <JoyChip color="neutral" size="sm" variant="outlined">
                            {meta.label}
                          </JoyChip>
                          <IconButton
                            aria-label={`Unpin ${entry.displayName}`}
                            color="neutral"
                            size="sm"
                            variant="plain"
                            disabled={isUnpinningEntity}
                            onClick={() =>
                              handlePinnedContextUnpin(
                                entry.entityType,
                                entry.entityId,
                              )
                            }
                          >
                            <X size={14} strokeWidth={1.9} />
                          </IconButton>
                        </Stack>
                      </Stack>
                    </ListItem>
                  );
                })}
              </List>
            ) : (
              <Typography level="body-sm" sx={{ color: "neutral.500" }}>
                No pinned entities yet.
              </Typography>
            )}
          </JoyCardContent>
        </JoyCard>

        <JoyCard variant="outlined">
          <JoyCardHeader
            title="Knowledge Base"
            titleProps={{ level: "title-sm" }}
          />
          <JoyCardContent>
            <Stack spacing={1.5}>
              {documentsQuery.isLoading ? (
                <Stack spacing={0.75}>
                  <Skeleton
                    variant="text"
                    animation="wave"
                    sx={{ width: "34%" }}
                  />
                  <Skeleton
                    variant="text"
                    animation="wave"
                    sx={{ width: "58%" }}
                  />
                </Stack>
              ) : documentCount > 0 ? (
                <Typography level="body-sm" sx={{ color: "neutral.600" }}>
                  {formatCount(documentCount, "document", "documents")} uploaded
                  ·{" "}
                  {formatCount(
                    totalChunkCount,
                    "knowledge chunk",
                    "knowledge chunks",
                  )}
                </Typography>
              ) : (
                <Typography level="body-sm" sx={{ color: "neutral.500" }}>
                  No documents uploaded yet. Upload store policies and guides to
                  help Bloom answer questions.
                </Typography>
              )}
              <Box>
                <JoyButton
                  variant="plain"
                  color="neutral"
                  endDecorator={<ArrowRight size={16} strokeWidth={1.9} />}
                  onClick={() => navigate("/bloom/knowledge")}
                  sx={{
                    px: 0,
                    minHeight: "auto",
                    color: "neutral.800",
                    fontWeight: "var(--joy-fontWeight-medium)",
                    "&:hover": {
                      backgroundColor: "transparent",
                      color: "neutral.900",
                    },
                  }}
                >
                  Manage Knowledge Base
                </JoyButton>
              </Box>
            </Stack>
          </JoyCardContent>
        </JoyCard>
      </Stack>

      <ConfirmationDialog
        open={clearDialogOpen}
        onClose={() => setClearDialogOpen(false)}
        title="Clear all conversations?"
        body={`This will remove ${formatCount(conversationCount, "conversation", "conversations")} from your sidebar. Messages will be retained for audit purposes. This action cannot be undone.`}
        confirmWord="DELETE"
        confirmValue={clearConfirmation}
        onConfirmValueChange={setClearConfirmation}
        pending={isClearingConversations}
        confirmLabel="Clear"
        onConfirm={() => {
          void clearAllConversations()
            .then(() => {
              setClearDialogOpen(false);
            })
            .catch(() => undefined);
        }}
      />

      <ConfirmationDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        title="Delete your Bloom profile?"
        body="This will permanently delete your Bloom profile, clear all conversations, and reset all preferences. A new profile will be created when you next use Bloom."
        confirmWord="RESET"
        confirmValue={deleteConfirmation}
        onConfirmValueChange={setDeleteConfirmation}
        pending={isDeletingProfile}
        confirmLabel="Delete Profile"
        onConfirm={() => {
          void deleteBloomProfile()
            .then(() => {
              setDeleteDialogOpen(false);
            })
            .catch(() => undefined);
        }}
      />
    </PageContainer>
  );
}

export default function BloomSettingsPage() {
  return <BloomSettingsContent />;
}
