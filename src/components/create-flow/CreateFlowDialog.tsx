import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ElementType,
  type KeyboardEvent,
} from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Card from "@mui/joy/Card";
import Chip from "@mui/joy/Chip";
import Checkbox from "@mui/joy/Checkbox";
import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import Input from "@mui/joy/Input";
import Modal from "@mui/joy/Modal";
import ModalClose from "@mui/joy/ModalClose";
import ModalDialog from "@mui/joy/ModalDialog";
import Option from "@mui/joy/Option";
import Select from "@mui/joy/Select";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Textarea from "@mui/joy/Textarea";
import Typography from "@mui/joy/Typography";
import { differenceInDays } from "date-fns";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  Clapperboard,
  Facebook,
  FileText,
  Images,
  Instagram,
  Leaf,
  Loader2,
  Mail,
  Pencil,
  RotateCcw,
  Search,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useDebounce } from "@/hooks/useDebounce";
import { supabase } from "@/integrations/supabase/client";
import { useSeasonalHolidays } from "@/hooks/useSeasonalHolidays";
import { useContentGenerationOrchestrator } from "@/hooks/useContentGenerationOrchestrator";
import { useCreateFlow } from "@/state/useCreateFlow";
import {
  getCurrentSeasonalTemplate,
  getSeasonalTemplates,
  type SeasonalTemplate,
} from "@/utils/seasonalTemplateService";
import { getCurrentWeekNumber } from "@/utils/dateUtils";
import { sanitizeCampaignTitle } from "@/utils/weekNumberSanitizer";
import { GeneratedContentModal } from "./GeneratedContentModal";
import { GenerationProgressDialog } from "./GenerationProgressDialog";
import type { CreateFlowRetryDraft } from "./createFlowTypes";
import type { ImageTaskState } from "@/hooks/useContentGenerationOrchestrator";

const PAGE_SIZE = 12;

type Mode = "seasonal" | "holiday" | "custom";
type Goal = "traffic" | "sales" | "awareness" | "none";
type WizardStep = "category" | "topic" | "channels";
type WizardAction = "back" | "continue" | "cancel" | "escape";
type TransitionOutcome = WizardStep | "close" | "submit";
type ChannelKey =
  | "newsletter"
  | "instagram"
  | "facebook"
  | "video"
  | "blog"
  | "instagram_carousel"
  | "facebook_carousel";

interface CreateFlowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDraft?: CreateFlowRetryDraft | null;
}

interface CategoryOption {
  key: Mode;
  title: string;
  description: string;
  icon: ElementType;
}

interface StepCopy {
  position: 1 | 2 | 3;
  label: string;
  heading: string;
  description: string;
}

interface ChannelOption {
  key: ChannelKey;
  title: string;
  description: string;
  icon: ElementType;
  platform?: "instagram" | "facebook";
}

const CATEGORY_OPTIONS: CategoryOption[] = [
  {
    key: "seasonal",
    title: "Seasonal Themes & Care Tips",
    description: "Choose from weekly themes and practical care-focused ideas.",
    icon: Leaf,
  },
  {
    key: "holiday",
    title: "Holidays",
    description: "Build timely content around upcoming seasonal moments.",
    icon: CalendarDays,
  },
  {
    key: "custom",
    title: "Custom Idea",
    description: "Start from your own brief and shape the campaign yourself.",
    icon: Pencil,
  },
];

const CUSTOM_IDEA_SUGGESTIONS = [
  "Spring planting guide",
  "Pest control tips",
  "Container gardening basics",
  "Indoor herb garden guide",
  "Pollinator-friendly planting ideas",
];

const CHANNEL_OPTIONS: ChannelOption[] = [
  {
    key: "instagram",
    title: "Instagram",
    description: "Generates an image-forward caption and post-ready draft.",
    icon: Instagram,
    platform: "instagram",
  },
  {
    key: "facebook",
    title: "Facebook",
    description: "Creates a social post tailored for longer-form engagement.",
    icon: Facebook,
    platform: "facebook",
  },
  {
    key: "blog",
    title: "Blog",
    description: "Builds an educational article draft with structured copy.",
    icon: FileText,
  },
  {
    key: "newsletter",
    title: "Newsletter",
    description: "Prepares a newsletter section ready for review and edits.",
    icon: Mail,
  },
  {
    key: "instagram_carousel",
    title: "Instagram Carousel",
    description:
      "Opens the carousel composer with a multi-image Instagram draft.",
    icon: Images,
    platform: "instagram",
  },
  {
    key: "facebook_carousel",
    title: "Facebook Carousel",
    description:
      "Opens the carousel composer with a multi-image Facebook draft.",
    icon: Images,
    platform: "facebook",
  },
  {
    key: "video",
    title: "Video",
    description:
      "Creates a short-form video script with a clear creative hook.",
    icon: Clapperboard,
  },
];

const STEP_TRANSITIONS: Record<
  WizardStep,
  Record<WizardAction, TransitionOutcome>
> = {
  category: {
    back: "close",
    continue: "topic",
    cancel: "close",
    escape: "close",
  },
  topic: {
    back: "category",
    continue: "channels",
    cancel: "close",
    escape: "close",
  },
  channels: {
    back: "topic",
    continue: "submit",
    cancel: "close",
    escape: "close",
  },
};

const SELECT_ALL_CHANNELS: Record<ChannelKey, boolean> = {
  newsletter: true,
  instagram: true,
  facebook: true,
  video: true,
  blog: true,
  instagram_carousel: true,
  facebook_carousel: true,
};

const DESELECT_ALL_CHANNELS: Record<ChannelKey, boolean> = {
  newsletter: false,
  instagram: false,
  facebook: false,
  video: false,
  blog: false,
  instagram_carousel: false,
  facebook_carousel: false,
};

const IMAGE_GENERATION_CHANNEL_KEYS = new Set<ChannelKey>([
  "newsletter",
  "instagram",
  "facebook",
  "blog",
]);

const fmtLocalDate = (dateValue?: string) => {
  if (!dateValue) return "";
  try {
    return new Date(dateValue).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return String(dateValue);
  }
};

const getThemeSubtitle = (theme: SeasonalTemplate) =>
  theme.seasonal_focus || theme.theme || "Seasonal theme";

const getThemeDescription = (theme: SeasonalTemplate) =>
  theme.content_ideas || theme.theme || "No description available.";

const formatHolidayProximity = (holidayDate: string) => {
  const daysUntil = differenceInDays(new Date(holidayDate), new Date());
  if (daysUntil <= 0) return "Today";
  if (daysUntil === 1) return "Tomorrow";
  if (daysUntil >= 7 && daysUntil <= 13) return "Next week";
  return `In ${daysUntil} days`;
};

const getSelectedChannels = (channelState: Record<ChannelKey, boolean>) =>
  Object.entries(channelState)
    .filter(([, isSelected]) => isSelected)
    .map(([channel]) => channel as ChannelKey);

const getStepCopy = (step: WizardStep, selectedPath: Mode | null): StepCopy => {
  if (step === "category") {
    return {
      position: 1,
      label: "Choose a category",
      heading: "Start with the right kind of brief",
      description:
        "Pick the kind of content request you want to shape, then refine the topic in the next step.",
    };
  }

  if (step === "topic" && selectedPath === "seasonal") {
    return {
      position: 2,
      label: "Choose a weekly theme",
      heading: "Select the seasonal direction",
      description:
        "Choose one of the current weekly themes and care ideas to anchor the campaign.",
    };
  }

  if (step === "topic" && selectedPath === "holiday") {
    return {
      position: 2,
      label: "Choose a holiday",
      heading: "Pick the upcoming moment",
      description:
        "Choose a holiday the content should revolve around. The generator will adapt the campaign framing from there.",
    };
  }

  if (step === "topic") {
    return {
      position: 2,
      label: "Describe your idea",
      heading: "Give the campaign its brief",
      description:
        "Set the title, goal, and tone so the next step starts with a clear creative direction.",
    };
  }

  return {
    position: 3,
    label: "Choose your channels",
    heading: "Select the deliverables",
    description:
      "Choose which formats to generate. Every selected channel becomes part of the content bundle.",
  };
};

export function CreateFlowDialog({
  open,
  onOpenChange,
  initialDraft = null,
}: CreateFlowDialogProps) {
  const navigate = useNavigate();
  const { data: dashboardData, isLoading: socialConnectionsLoading } =
    useDashboardData();
  const {
    selectedPath,
    setSelectedPath,
    selectedSourceId,
    setSelectedSourceId,
    setBundleIds,
    channels,
    setChannels,
    reset,
  } = useCreateFlow();

  const [step, setStep] = useState<WizardStep>("category");
  const [activeTransition, setActiveTransition] = useState<WizardAction | null>(
    null,
  );
  const [contentVisible, setContentVisible] = useState(false);
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState<Goal>("traffic");
  const [tone, setTone] = useState("");
  const [notes, setNotes] = useState("");
  const [weeklyThemes, setWeeklyThemes] = useState<SeasonalTemplate[]>([]);
  const [seasonalLoading, setSeasonalLoading] = useState(false);
  const [seasonalError, setSeasonalError] = useState<string | null>(null);
  const [currentSeasonalWeek, setCurrentSeasonalWeek] = useState<number | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [visibleWeeklyThemes, setVisibleWeeklyThemes] = useState(PAGE_SIZE);
  const [visibleHolidays, setVisibleHolidays] = useState(PAGE_SIZE);
  const [generationErrorMessage, setGenerationErrorMessage] = useState<
    string | null
  >(null);

  const debouncedSearch = useDebounce(search, 200);
  const {
    allHolidays,
    loading: holidaysLoading,
    error: holidaysError,
    refetch: refetchHolidays,
  } = useSeasonalHolidays();
  const orchestrator = useContentGenerationOrchestrator();
  const mountedRef = useRef(true);
  const transitionLockRef = useRef(false);
  const categoryCardRefs = useRef<Array<HTMLElement | null>>([]);
  const [progressDialogOpen, setProgressDialogOpen] = useState(false);
  const [progressChannels, setProgressChannels] = useState<string[]>([]);
  const [progressTopicTitle, setProgressTopicTitle] = useState("");
  const [reviewModalOpen, setReviewModalOpen] = useState(false);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setContentVisible(false);
      return;
    }

    setContentVisible(false);
    const frameId = window.requestAnimationFrame(() => {
      if (mountedRef.current) {
        setContentVisible(true);
      }
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !initialDraft) {
      return;
    }

    setSelectedPath(initialDraft.path);
    setSelectedSourceId(initialDraft.sourceId);
    setChannels(() => initialDraft.channels);
    setTitle(initialDraft.title);
    setGoal(initialDraft.goal ?? "traffic");
    setTone(initialDraft.tone ?? "");
    setNotes(initialDraft.notes ?? "");
    setSearch("");
    setGenerationErrorMessage(null);
    setStep("channels");
  }, [initialDraft, open, setChannels, setSelectedPath, setSelectedSourceId]);

  useEffect(() => {
    if (!open || step !== "topic" || selectedPath !== "seasonal") {
      return;
    }

    let cancelled = false;

    const loadWeeklyThemes = async () => {
      setSeasonalLoading(true);
      setSeasonalError(null);

      try {
        const [themes, currentTemplate] = await Promise.all([
          getSeasonalTemplates(),
          getCurrentSeasonalTemplate().catch(() => null),
        ]);
        if (cancelled) return;

        const uniqueThemes = new Map<string, SeasonalTemplate>();
        themes.forEach((theme) => {
          const uniqueKey = theme.title.trim().toLowerCase();
          if (!uniqueThemes.has(uniqueKey)) {
            uniqueThemes.set(uniqueKey, theme);
          }
        });

        const sortedThemes = Array.from(uniqueThemes.values()).sort(
          (left, right) => left.week_number - right.week_number,
        );

        setWeeklyThemes(sortedThemes);
        setCurrentSeasonalWeek(
          currentTemplate?.week_number ?? getCurrentWeekNumber(),
        );
      } catch (error) {
        console.error("[CreateFlowDialog] Failed to load weekly themes", error);
        if (!cancelled) {
          setSeasonalError(
            error instanceof Error
              ? error.message
              : "Unable to load weekly themes right now.",
          );
          setWeeklyThemes([]);
          setCurrentSeasonalWeek(getCurrentWeekNumber());
        }
      } finally {
        if (!cancelled) {
          setSeasonalLoading(false);
        }
      }
    };

    void loadWeeklyThemes();

    return () => {
      cancelled = true;
    };
  }, [open, selectedPath, step]);

  useEffect(() => {
    setVisibleWeeklyThemes(PAGE_SIZE);
    setVisibleHolidays(PAGE_SIZE);
  }, [search, selectedPath, step]);

  const filteredWeeklyThemes = useMemo(() => {
    const searchTerm = debouncedSearch.toLowerCase();
    return weeklyThemes.filter((theme) => {
      if (!searchTerm) return true;

      const subtitle = getThemeSubtitle(theme).toLowerCase();
      const description = getThemeDescription(theme).toLowerCase();

      return (
        theme.title.toLowerCase().includes(searchTerm) ||
        subtitle.includes(searchTerm) ||
        description.includes(searchTerm)
      );
    });
  }, [debouncedSearch, weeklyThemes]);

  const orderedWeeklyThemes = useMemo(() => {
    if (!currentSeasonalWeek) {
      return filteredWeeklyThemes;
    }

    const thisWeekThemes = filteredWeeklyThemes.filter(
      (theme) => theme.week_number === currentSeasonalWeek,
    );
    const remainingThemes = filteredWeeklyThemes.filter(
      (theme) => theme.week_number !== currentSeasonalWeek,
    );

    return [...thisWeekThemes, ...remainingThemes];
  }, [currentSeasonalWeek, filteredWeeklyThemes]);

  const filteredHolidays = useMemo(() => {
    const searchTerm = debouncedSearch.toLowerCase();
    const now = new Date();
    const thirtyDaysFromNow = new Date(now);
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    return allHolidays
      .filter((holiday) => {
        const holidayDate = new Date(holiday.holiday_date);
        return holidayDate >= now && holidayDate <= thirtyDaysFromNow;
      })
      .filter((holiday) => {
        if (!searchTerm) return true;
        return (
          holiday.holiday_name.toLowerCase().includes(searchTerm) ||
          (holiday.description || "").toLowerCase().includes(searchTerm) ||
          (holiday.garden_relevance || "").toLowerCase().includes(searchTerm)
        );
      })
      .sort(
        (left, right) =>
          new Date(left.holiday_date).getTime() -
          new Date(right.holiday_date).getTime(),
      );
  }, [allHolidays, debouncedSearch]);

  const selectedChannelNames = useMemo(
    () => getSelectedChannels(channels as Record<ChannelKey, boolean>),
    [channels],
  );

  const canContinueFromTopic = useMemo(() => {
    if (selectedPath === "custom") {
      return title.trim().length >= 10;
    }

    return Boolean(selectedSourceId);
  }, [selectedPath, selectedSourceId, title]);

  const canContinue = useMemo(() => {
    switch (step) {
      case "category":
        return selectedPath !== null;
      case "topic":
        return canContinueFromTopic;
      case "channels":
        return canContinueFromTopic && selectedChannelNames.length > 0;
      default:
        return false;
    }
  }, [canContinueFromTopic, selectedChannelNames.length, selectedPath, step]);

  const stepCopy = useMemo(
    () => getStepCopy(step, selectedPath),
    [selectedPath, step],
  );
  const hasCarousel = selectedChannelNames.some(
    (channel) =>
      channel === "instagram_carousel" || channel === "facebook_carousel",
  );
  const hasOnlyCarousel =
    selectedChannelNames.length > 0 &&
    selectedChannelNames.every(
      (channel) =>
        channel === "instagram_carousel" || channel === "facebook_carousel",
    );
  const continueLabel =
    step !== "channels"
      ? "Continue"
      : hasOnlyCarousel
        ? "Open Carousel Builder"
        : hasCarousel
          ? "Generate & Open Carousel"
          : "Generate Content";

  const resetLocalState = useCallback(() => {
    setStep("category");
    setTitle("");
    setGoal("traffic");
    setTone("");
    setNotes("");
    setWeeklyThemes([]);
    setSeasonalLoading(false);
    setSeasonalError(null);
    setCurrentSeasonalWeek(null);
    setSearch("");
    setVisibleWeeklyThemes(PAGE_SIZE);
    setVisibleHolidays(PAGE_SIZE);
    setGenerationErrorMessage(null);
    setContentVisible(false);
    transitionLockRef.current = false;
    if (mountedRef.current) {
      setActiveTransition(null);
    }
  }, []);

  useEffect(() => {
    if (!open && !progressDialogOpen && !reviewModalOpen) {
      reset();
      resetLocalState();
    }
  }, [open, progressDialogOpen, reset, resetLocalState, reviewModalOpen]);

  const dismissWizard = () => {
    orchestrator.reset();
    setProgressDialogOpen(false);
    reset();
    resetLocalState();
    onOpenChange(false);
  };

  const beginTransition = (action: WizardAction) => {
    if (transitionLockRef.current) {
      return false;
    }

    transitionLockRef.current = true;
    if (mountedRef.current) {
      setActiveTransition(action);
    }
    return true;
  };

  const finishTransition = () => {
    transitionLockRef.current = false;
    if (mountedRef.current) {
      setActiveTransition(null);
    }
  };

  const handleCategorySelect = (path: Mode) => {
    setSelectedPath(path);
    setSelectedSourceId(null);
    setSearch("");
    setGenerationErrorMessage(null);
  };

  const socialPlatforms = useMemo(
    () =>
      new Set(
        (dashboardData?.socialConnections || [])
          .filter((connection) => connection.is_active)
          .map((connection) => connection.platform as "instagram" | "facebook"),
      ),
    [dashboardData?.socialConnections],
  );

  const handleCategoryKeyDown = (
    event: KeyboardEvent<HTMLElement>,
    index: number,
    path: Mode,
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleCategorySelect(path);
      return;
    }

    const forwardKeys = ["ArrowRight", "ArrowDown"];
    const backwardKeys = ["ArrowLeft", "ArrowUp"];

    if (!forwardKeys.includes(event.key) && !backwardKeys.includes(event.key)) {
      return;
    }

    event.preventDefault();
    const direction = forwardKeys.includes(event.key) ? 1 : -1;
    const nextIndex =
      (index + direction + CATEGORY_OPTIONS.length) % CATEGORY_OPTIONS.length;
    categoryCardRefs.current[nextIndex]?.focus();
  };

  const classifyGenerationError = (error: unknown) => {
    const message =
      error instanceof Error ? error.message : "Generation failed to start.";
    const status =
      typeof error === "object" && error !== null && "status" in error
        ? Number((error as { status?: number }).status)
        : undefined;

    if (
      (error instanceof Error && error.name === "FunctionsFetchError") ||
      message.includes("Failed to fetch")
    ) {
      return "We couldn't reach the generator. Check your connection and try again.";
    }

    if (
      message.toLowerCase().includes("timed out") ||
      (error instanceof Error && error.name === "AbortError")
    ) {
      return "Generation is taking longer than expected. Try again or check your Content Library later.";
    }

    if (status === 401 || status === 403) {
      return "Authorization required. Please sign in again and retry.";
    }

    if (status === 404) {
      return "The content generator is unavailable right now. Please contact support if this continues.";
    }

    return message || "Generation failed to start. Please try again.";
  };

  const startGenerate = async () => {
    if (!selectedPath) {
      return;
    }

    setGenerationErrorMessage(null);

    const currentPath = selectedPath;
    const currentSourceId = selectedSourceId;
    const currentChannels = { ...(channels as Record<ChannelKey, boolean>) };
    const selectedChannels = getSelectedChannels(currentChannels);
    const currentTitle = title.trim();
    const currentTone = tone.trim();
    const currentNotes = notes.trim();
    const currentGoal = goal;
    const currentWeeklyThemes = [...weeklyThemes];
    const currentHolidays = [...allHolidays];
    const includesCarousel = selectedChannels.some(
      (channel) =>
        channel === "instagram_carousel" || channel === "facebook_carousel",
    );
    const onlyCarouselChannels =
      selectedChannels.length > 0 &&
      selectedChannels.every(
        (channel) =>
          channel === "instagram_carousel" || channel === "facebook_carousel",
      );

    let topicTitle: string | undefined;
    let topicDescription: string | undefined;

    if (currentPath === "custom") {
      topicTitle = currentTitle || undefined;
      topicDescription = currentNotes || currentTone || undefined;
    }

    if (currentPath === "seasonal" && currentSourceId) {
      const pickedTheme = currentWeeklyThemes.find(
        (theme) => theme.id === currentSourceId,
      );
      if (pickedTheme) {
        topicTitle = `Week ${pickedTheme.week_number}: ${pickedTheme.title}`;
        topicDescription = pickedTheme.theme || pickedTheme.content_ideas || "";
      }
    }

    if (currentPath === "holiday" && currentSourceId) {
      const pickedHoliday = currentHolidays.find(
        (holiday) => holiday.id === currentSourceId,
      );
      if (pickedHoliday) {
        topicTitle = pickedHoliday.holiday_name;
        topicDescription =
          pickedHoliday.garden_relevance || pickedHoliday.description || "";
      }
    }

    if (onlyCarouselChannels && includesCarousel) {
      const platform = currentChannels.instagram_carousel
        ? "instagram"
        : "facebook";
      const queryParams = new URLSearchParams({ platform });
      if (topicTitle) {
        queryParams.set("topicTitle", topicTitle);
      }
      if (topicDescription) {
        queryParams.set("topicDescription", topicDescription);
      }
      dismissWizard();
      navigate(`/carousel/composer?${queryParams.toString()}`);
      return;
    }

    let generationChannels = selectedChannels;
    if (includesCarousel) {
      generationChannels = selectedChannels.filter(
        (channel) =>
          channel !== "instagram_carousel" && channel !== "facebook_carousel",
      );
      if (generationChannels.length === 0) {
        return;
      }
    }

    try {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      if (!currentUser) {
        throw new Error("User not authenticated");
      }

      const { data: currentUserRow, error: userError } = await supabase
        .from("users")
        .select("tenant_id")
        .eq("id", currentUser.id)
        .single();

      if (userError) {
        console.error("Failed to get user tenant info:", userError);
        throw new Error("Failed to get user workspace information");
      }

      const workspaceId = currentUserRow?.tenant_id || currentUser.id;
      const resolvedTopicTitle =
        topicTitle || currentTitle || "Untitled Content";
      const resolvedTopicDescription =
        topicDescription || currentNotes || currentTone || "";
      const generationContext = {
        selectedChannels,
        hasMixedCarousel: includesCarousel,
        carouselPlatform: includesCarousel
          ? currentChannels.instagram_carousel
            ? "instagram"
            : "facebook"
          : null,
      };
      const userIdea =
        currentPath === "custom"
          ? {
              title: currentTitle,
              goal: currentGoal === "none" ? undefined : currentGoal,
              tone: currentTone || undefined,
              notes: currentNotes || undefined,
            }
          : undefined;

      setProgressChannels(generationChannels);
      setProgressTopicTitle(resolvedTopicTitle);
      setProgressDialogOpen(true);

      void orchestrator
        .startGeneration({
          mode: currentPath,
          sourceId: currentSourceId || undefined,
          topicTitle: resolvedTopicTitle,
          topicDescription: resolvedTopicDescription,
          channels: generationChannels,
          workspaceId,
          userId: currentUser.id,
          userIdea,
          generationContext,
        })
        .catch((error) => {
          console.error("Content generation orchestration error:", error);
        });
    } catch (error: unknown) {
      console.error("Content generation error:", error);
      setGenerationErrorMessage(classifyGenerationError(error));
    }
  };

  const performTransition = async (action: WizardAction) => {
    if (!beginTransition(action)) {
      return;
    }

    const outcome = STEP_TRANSITIONS[step][action];

    if (action === "continue" && !canContinue) {
      finishTransition();
      return;
    }

    if (outcome === "close") {
      setGenerationErrorMessage(null);
      finishTransition();
      dismissWizard();
      return;
    }

    if (outcome === "submit") {
      try {
        await startGenerate();
      } finally {
        finishTransition();
      }
      return;
    }

    setGenerationErrorMessage(null);
    setStep(outcome);
    finishTransition();
  };

  const handleModalClose = (_event: unknown, reason: string) => {
    if (reason === "escapeKeyDown") {
      void performTransition("escape");
      return;
    }

    void performTransition("cancel");
  };

  const handleProgressReviewContent = () => {
    if (!orchestrator.bundleId) {
      return;
    }

    setReviewModalOpen(true);
    setProgressDialogOpen(false);
    resetLocalState();
    onOpenChange(false);
    setBundleIds(orchestrator.bundleId, orchestrator.snapshotId);
  };

  const handleProgressGoToLibrary = () => {
    const targetUrl = orchestrator.bundleId
      ? `/content/library?from=generation&doc_id=${orchestrator.bundleId}`
      : "/content/library";

    setProgressDialogOpen(false);
    orchestrator.reset();
    reset();
    resetLocalState();
    onOpenChange(false);
    navigate(targetUrl);
  };

  const handleProgressClose = () => {
    if (orchestrator.contentStatus === "failed") {
      setProgressDialogOpen(false);
      orchestrator.reset();
      return;
    }

    handleProgressGoToLibrary();
  };

  const handleProgressRetry = () => {
    void orchestrator.retry();
  };

  const handleReviewModalOpenChange = (nextOpen: boolean) => {
    setReviewModalOpen(nextOpen);

    if (!nextOpen) {
      orchestrator.reset();
      reset();
      resetLocalState();
    }
  };

  const progressDialogContentStatus =
    progressDialogOpen && orchestrator.contentStatus === "idle"
      ? "generating"
      : orchestrator.contentStatus;
  const progressDialogPhase =
    progressDialogOpen && orchestrator.phase === "idle"
      ? "content"
      : orchestrator.phase;
  const progressDialogImageTasks = useMemo(
    () =>
      progressChannels.reduce<Record<string, ImageTaskState>>(
        (tasks, channel) => ({
          ...tasks,
          [channel]: {
            status: IMAGE_GENERATION_CHANNEL_KEYS.has(channel as ChannelKey)
              ? "waiting"
              : "skipped",
            imageQuery: "",
            imageUrl: null,
            thumbnailUrl: null,
            error: null,
          },
        }),
        {},
      ),
    [progressChannels],
  );

  const renderTopicSelection = () => {
    if (selectedPath === "custom") {
      return (
        <Stack spacing={2.5}>
          <FormControl>
            <FormLabel>Describe your idea</FormLabel>
            <Textarea
              minRows={3}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Describe what you'd like to create — e.g., 'A guide to indoor herb gardens for beginners'"
            />
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mt: 1,
              }}
            >
              <Typography level="body-xs" sx={{ color: "text.secondary" }}>
                Minimum 10 characters
              </Typography>
              <Typography level="body-xs" sx={{ color: "text.secondary" }}>
                {title.trim().length} characters
              </Typography>
            </Box>
          </FormControl>

          <Box>
            <Typography
              level="body-sm"
              sx={{ color: "text.secondary", mb: 1.25 }}
            >
              Try one of these starting points
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              {CUSTOM_IDEA_SUGGESTIONS.map((suggestion) => (
                <Chip
                  key={suggestion}
                  variant="outlined"
                  size="sm"
                  onClick={() => setTitle(suggestion)}
                  sx={{ cursor: "pointer" }}
                >
                  {suggestion}
                </Chip>
              ))}
            </Box>
          </Box>
        </Stack>
      );
    }

    const isHolidayStep = selectedPath === "holiday";
    const options = isHolidayStep
      ? filteredHolidays.slice(0, visibleHolidays)
      : orderedWeeklyThemes.slice(0, visibleWeeklyThemes);

    if (!isHolidayStep && seasonalLoading) {
      return (
        <Stack spacing={1.5}>
          <FormControl>
            <FormLabel>Search weekly themes</FormLabel>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search weekly themes"
              startDecorator={<Search size={16} />}
            />
          </FormControl>
          <Typography level="body-sm" sx={{ color: "text.secondary" }}>
            52 weekly themes available
          </Typography>
          {[0, 1, 2, 3].map((index) => (
            <Card key={index} variant="outlined" sx={{ p: 2.5, gap: 1.25 }}>
              <Skeleton variant="text" width="45%" height={24} />
              <Skeleton variant="text" width="60%" height={18} />
              <Skeleton variant="text" width="90%" height={18} />
              <Skeleton variant="text" width="72%" height={18} />
            </Card>
          ))}
        </Stack>
      );
    }

    if (!isHolidayStep && seasonalError) {
      return (
        <Card variant="outlined" sx={{ p: 3, gap: 1.5 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              color: "danger.700",
            }}
          >
            <AlertCircle size={18} />
            <Typography level="title-sm">
              Unable to load seasonal themes
            </Typography>
          </Box>
          <Typography level="body-sm" sx={{ color: "text.secondary" }}>
            {seasonalError}
          </Typography>
          <Box>
            <Button
              variant="outlined"
              color="neutral"
              startDecorator={<RotateCcw size={16} />}
              onClick={() => {
                setSeasonalError(null);
                setWeeklyThemes([]);
                setCurrentSeasonalWeek(null);
                setStep("category");
                window.setTimeout(() => setStep("topic"), 0);
              }}
            >
              Retry
            </Button>
          </Box>
        </Card>
      );
    }

    return (
      <Stack spacing={2.5} sx={{ minHeight: 0 }}>
        <FormControl>
          <FormLabel>
            {isHolidayStep ? "Search holidays" : "Search weekly themes"}
          </FormLabel>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={
              isHolidayStep ? "Search holidays" : "Search weekly themes"
            }
            startDecorator={<Search size={16} />}
          />
        </FormControl>

        <Typography level="body-sm" sx={{ color: "text.secondary" }}>
          {isHolidayStep
            ? `Upcoming holidays in the next 30 days (${filteredHolidays.length} shown)`
            : `52 weekly themes available (${orderedWeeklyThemes.length} shown)`}
        </Typography>

        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 1.5,
            maxHeight: 380,
            overflowY: "auto",
            pr: 0.5,
          }}
        >
          {options.map((option) => {
            const isSelected = selectedSourceId === option.id;

            if (isHolidayStep) {
              const holiday = option;
              const daysUntil = differenceInDays(
                new Date(holiday.holiday_date),
                new Date(),
              );

              return (
                <Card
                  key={holiday.id}
                  component="button"
                  variant="outlined"
                  onClick={() => setSelectedSourceId(holiday.id)}
                  sx={{
                    p: 2.25,
                    alignItems: "stretch",
                    textAlign: "left",
                    cursor: "pointer",
                    borderColor: isSelected ? "primary.500" : undefined,
                    boxShadow: isSelected ? "sm" : "none",
                    transition:
                      "border-color 160ms ease, box-shadow 160ms ease",
                    "&:hover": {
                      borderColor: isSelected ? "primary.500" : "neutral.300",
                    },
                    "&:focus-visible": {
                      outline: "2px solid",
                      outlineColor: "var(--joy-palette-primary-500)",
                      outlineOffset: "3px",
                    },
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={1.5}
                    justifyContent="space-between"
                    sx={{ flexWrap: "wrap", alignItems: "flex-start" }}
                  >
                    <Box>
                      <Typography level="title-sm">
                        {holiday.holiday_name}
                      </Typography>
                      {holiday.garden_relevance ? (
                        <Typography
                          level="body-sm"
                          sx={{ color: "text.secondary", mt: 0.75 }}
                        >
                          {holiday.garden_relevance}
                        </Typography>
                      ) : null}
                    </Box>
                    <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                      <Typography
                        level="body-xs"
                        sx={{ color: "text.secondary" }}
                      >
                        {fmtLocalDate(holiday.holiday_date)}
                      </Typography>
                      <Typography
                        level="body-xs"
                        sx={{ color: "primary.600", mt: 0.5 }}
                      >
                        {formatHolidayProximity(holiday.holiday_date)}
                      </Typography>
                    </Box>
                  </Stack>
                </Card>
              );
            }

            const theme = option;
            return (
              <Card
                key={theme.id}
                component="button"
                variant="outlined"
                onClick={() => setSelectedSourceId(theme.id)}
                sx={{
                  p: 2.25,
                  alignItems: "stretch",
                  textAlign: "left",
                  cursor: "pointer",
                  borderColor: isSelected ? "primary.500" : undefined,
                  boxShadow: isSelected ? "sm" : "none",
                  transition: "border-color 160ms ease, box-shadow 160ms ease",
                  "&:hover": {
                    borderColor: isSelected ? "primary.500" : "neutral.300",
                  },
                  "&:focus-visible": {
                    outline: "2px solid",
                    outlineColor: "var(--joy-palette-primary-500)",
                    outlineOffset: "3px",
                  },
                }}
              >
                <Stack spacing={1.25}>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 1.5,
                    }}
                  >
                    <Typography level="title-md">
                      {sanitizeCampaignTitle(theme.title)}
                    </Typography>
                    {theme.week_number === currentSeasonalWeek ? (
                      <Chip color="primary" variant="soft" size="sm">
                        This week
                      </Chip>
                    ) : null}
                  </Box>
                  <Typography level="body-sm" sx={{ color: "neutral.500" }}>
                    {getThemeSubtitle(theme)}
                  </Typography>
                  <Typography level="body-sm" sx={{ color: "text.secondary" }}>
                    {getThemeDescription(theme)}
                  </Typography>
                </Stack>
              </Card>
            );
          })}

          {isHolidayStep && holidaysError ? (
            <Card variant="outlined" sx={{ p: 3, gap: 1.25 }}>
              <Typography level="title-sm">Unable to load holidays</Typography>
              <Typography level="body-sm" sx={{ color: "text.secondary" }}>
                {holidaysError}
              </Typography>
              <Box>
                <Button
                  variant="outlined"
                  color="neutral"
                  startDecorator={<RotateCcw size={16} />}
                  onClick={() => {
                    void refetchHolidays();
                  }}
                >
                  Retry
                </Button>
              </Box>
            </Card>
          ) : null}

          {isHolidayStep &&
          !holidaysLoading &&
          !holidaysError &&
          !search &&
          filteredHolidays.length === 0 ? (
            <Card
              variant="outlined"
              sx={{
                p: 3.5,
                alignItems: "center",
                textAlign: "center",
                gap: 1.5,
                borderStyle: "dashed",
              }}
            >
              <CalendarDays size={30} strokeWidth={1.8} />
              <Typography level="title-md">
                No holidays coming up in the next 30 days
              </Typography>
              <Typography
                level="body-sm"
                sx={{ color: "text.secondary", maxWidth: 420 }}
              >
                Keep momentum going by switching to a seasonal theme or starting
                a custom content brief instead.
              </Typography>
              <Box
                sx={{
                  display: "flex",
                  gap: 1,
                  flexWrap: "wrap",
                  justifyContent: "center",
                }}
              >
                <Button
                  variant="outlined"
                  color="neutral"
                  onClick={() => handleCategorySelect("seasonal")}
                >
                  Try a seasonal theme
                </Button>
                <Button onClick={() => handleCategorySelect("custom")}>
                  Write a custom idea
                </Button>
              </Box>
            </Card>
          ) : null}

          {isHolidayStep && search && filteredHolidays.length === 0 ? (
            <Typography level="body-sm" sx={{ color: "text.secondary" }}>
              No holidays match your search.
            </Typography>
          ) : null}

          {!isHolidayStep && filteredWeeklyThemes.length === 0 ? (
            <Typography level="body-sm" sx={{ color: "text.secondary" }}>
              {search
                ? "No results for your search."
                : "No weekly themes available. Try Custom Idea instead."}
            </Typography>
          ) : null}
        </Box>

        {isHolidayStep && filteredHolidays.length > visibleHolidays ? (
          <Box>
            <Button
              variant="outlined"
              color="neutral"
              onClick={() =>
                setVisibleHolidays((currentCount) => currentCount + PAGE_SIZE)
              }
            >
              Load more
            </Button>
          </Box>
        ) : null}

        {!isHolidayStep && filteredWeeklyThemes.length > visibleWeeklyThemes ? (
          <Box>
            <Button
              variant="outlined"
              color="neutral"
              onClick={() =>
                setVisibleWeeklyThemes(
                  (currentCount) => currentCount + PAGE_SIZE,
                )
              }
            >
              Load more
            </Button>
          </Box>
        ) : null}
      </Stack>
    );
  };

  const renderChannelSelection = () => {
    const toggleChannel = (channelKey: ChannelKey, disabled: boolean) => {
      if (disabled) {
        return;
      }

      setChannels((currentChannels) => ({
        ...currentChannels,
        [channelKey]: !currentChannels[channelKey],
      }));
    };

    return (
      <Stack spacing={2.5}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 1.5,
          }}
        >
          <Typography level="body-sm" sx={{ color: "text.secondary" }}>
            Select the formats you want the generator to prepare.
          </Typography>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              size="sm"
              variant="outlined"
              color="neutral"
              onClick={() => setChannels({ ...SELECT_ALL_CHANNELS })}
            >
              Select all
            </Button>
            <Button
              size="sm"
              variant="outlined"
              color="neutral"
              onClick={() => setChannels({ ...DESELECT_ALL_CHANNELS })}
            >
              Clear all
            </Button>
          </Box>
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 2,
          }}
        >
          {CHANNEL_OPTIONS.map((channel) => {
            const Icon = channel.icon;
            const isSelected = channels[channel.key];
            const isSocialChannel = Boolean(channel.platform);
            const isDisabled =
              isSocialChannel &&
              (socialConnectionsLoading ||
                !socialPlatforms.has(channel.platform!));

            return (
              <Card
                key={channel.key}
                component="button"
                variant="outlined"
                disabled={isDisabled}
                onClick={() => toggleChannel(channel.key, isDisabled)}
                sx={{
                  p: 2.5,
                  textAlign: "left",
                  alignItems: "stretch",
                  gap: 1.5,
                  position: "relative",
                  cursor: isDisabled ? "not-allowed" : "pointer",
                  borderColor: isSelected ? "primary.500" : undefined,
                  boxShadow: isSelected ? "sm" : "none",
                  opacity: isDisabled ? 0.6 : 1,
                  transition:
                    "border-color 160ms ease, box-shadow 160ms ease, opacity 160ms ease",
                  "&:hover": {
                    borderColor: isSelected ? "primary.500" : "neutral.300",
                  },
                  "&:focus-visible": {
                    outline: "2px solid",
                    outlineColor: "var(--joy-palette-primary-500)",
                    outlineOffset: "3px",
                  },
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 1.5,
                  }}
                >
                  <Icon size={22} strokeWidth={1.8} />
                  <Checkbox
                    checked={isSelected}
                    readOnly
                    disabled={isDisabled}
                    sx={{ pointerEvents: "none" }}
                  />
                </Box>
                <Box>
                  <Typography level="title-sm">{channel.title}</Typography>
                  <Typography
                    level="body-sm"
                    sx={{ color: "text.secondary", mt: 0.75 }}
                  >
                    {channel.description}
                  </Typography>
                </Box>
                {isDisabled ? (
                  <Typography level="body-xs" sx={{ color: "text.secondary" }}>
                    {socialConnectionsLoading
                      ? "Checking account connection"
                      : "Connect account first"}
                  </Typography>
                ) : null}
              </Card>
            );
          })}
        </Box>

        {selectedChannelNames.length === 0 ? (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              color: "warning.700",
            }}
          >
            <AlertCircle size={16} />
            <Typography level="body-sm">
              Select at least one channel to continue.
            </Typography>
          </Box>
        ) : null}
      </Stack>
    );
  };

  return (
    <>
      <Modal open={open} onClose={handleModalClose}>
        <ModalDialog
          layout="center"
          aria-modal="true"
          sx={{
            width: "min(calc(100vw - 24px), 920px)",
            maxWidth: 920,
            maxHeight: "min(calc(100dvh - 24px), 860px)",
            borderRadius: "24px",
            borderColor: "neutral.200",
            bgcolor: "background.surface",
            backgroundImage: "none",
            boxShadow: "lg",
            p: 3,
            overflow: "hidden",
          }}
        >
          <ModalClose
            aria-label="Close create content dialog"
            sx={{ m: 1.5 }}
          />

          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              height: "100%",
              opacity: contentVisible ? 1 : 0,
              transform: contentVisible ? "translateY(0)" : "translateY(12px)",
              transition: "opacity 220ms ease, transform 220ms ease",
            }}
          >
            <Stack spacing={1.5} sx={{ pr: 5 }}>
              <Typography
                level="body-xs"
                sx={{
                  color: "text.secondary",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Create Any Content
              </Typography>
              <Typography level="title-lg">
                Step {stepCopy.position} of 3 · {stepCopy.label}
              </Typography>
              <Typography level="h2">{stepCopy.heading}</Typography>
              <Typography
                level="body-md"
                sx={{ color: "text.secondary", maxWidth: 620 }}
              >
                {stepCopy.description}
              </Typography>
            </Stack>

            <Box
              sx={{
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                mt: 4,
                pr: 0,
              }}
            >
              {step === "category" ? (
                <Box
                  role="radiogroup"
                  aria-label="Choose a content category"
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 2,
                  }}
                >
                  {CATEGORY_OPTIONS.map((option, index) => {
                    const Icon = option.icon;
                    const isSelected = selectedPath === option.key;

                    return (
                      <Card
                        key={option.key}
                        component="button"
                        variant="outlined"
                        role="radio"
                        aria-checked={isSelected}
                        tabIndex={0}
                        onClick={() => handleCategorySelect(option.key)}
                        onKeyDown={(event) =>
                          handleCategoryKeyDown(event, index, option.key)
                        }
                        ref={(element) => {
                          categoryCardRefs.current[index] = element;
                        }}
                        sx={{
                          p: 3,
                          minHeight: 220,
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          textAlign: "left",
                          cursor: "pointer",
                          borderColor: isSelected ? "primary.500" : undefined,
                          boxShadow: isSelected ? "sm" : "none",
                          transition:
                            "border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease",
                          "&:hover": {
                            borderColor: isSelected
                              ? "primary.500"
                              : "neutral.300",
                            boxShadow: isSelected ? "sm" : "xs",
                          },
                          "&:focus-visible": {
                            outline: "2px solid",
                            outlineColor: "var(--joy-palette-primary-500)",
                            outlineOffset: "3px",
                          },
                        }}
                      >
                        <Stack
                          spacing={2.5}
                          sx={{
                            height: "100%",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                          }}
                        >
                          <Icon size={28} strokeWidth={1.8} />
                          <Box>
                            <Typography level="title-md">
                              {option.title}
                            </Typography>
                            <Typography
                              level="body-sm"
                              sx={{
                                color: "text.secondary",
                                mt: 1.25,
                                lineHeight: 1.6,
                              }}
                            >
                              {option.description}
                            </Typography>
                          </Box>
                        </Stack>
                      </Card>
                    );
                  })}
                </Box>
              ) : null}

              {step === "topic" ? renderTopicSelection() : null}
              {step === "channels" ? renderChannelSelection() : null}

              {generationErrorMessage ? (
                <Card
                  variant="soft"
                  color="danger"
                  sx={{ mt: 3, p: 2.5, gap: 1.5 }}
                >
                  <Typography level="title-sm">
                    Generation couldn't start
                  </Typography>
                  <Typography level="body-sm">
                    {generationErrorMessage}
                  </Typography>
                  <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                    <Button
                      color="danger"
                      disabled={activeTransition !== null}
                      onClick={() => {
                        setGenerationErrorMessage(null);
                        void performTransition("continue");
                      }}
                    >
                      Try again
                    </Button>
                    <Button
                      variant="plain"
                      color="neutral"
                      disabled={activeTransition !== null}
                      onClick={() => setGenerationErrorMessage(null)}
                    >
                      Dismiss
                    </Button>
                  </Box>
                </Card>
              ) : null}
            </Box>

            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 1.5,
                pt: 3,
                mt: 3,
                borderTop: "1px solid",
                borderColor: "divider",
              }}
            >
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                {step !== "category" ? (
                  <Button
                    variant="plain"
                    color="neutral"
                    startDecorator={<ChevronLeft size={16} />}
                    disabled={activeTransition !== null}
                    onClick={() => {
                      void performTransition("back");
                    }}
                  >
                    Back
                  </Button>
                ) : null}
                <Button
                  variant="plain"
                  color="neutral"
                  disabled={activeTransition !== null}
                  onClick={() => {
                    void performTransition("cancel");
                  }}
                >
                  Cancel
                </Button>
              </Box>

              <Button
                size="lg"
                endDecorator={
                  activeTransition === "continue" && step === "channels" ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : step === "channels" ? null : (
                    <ArrowRight size={16} />
                  )
                }
                disabled={!canContinue || activeTransition !== null}
                onClick={() => {
                  void performTransition("continue");
                }}
              >
                {continueLabel}
              </Button>
            </Box>
          </Box>
        </ModalDialog>
      </Modal>

      <GenerationProgressDialog
        open={progressDialogOpen}
        bundleId={orchestrator.bundleId}
        channels={progressChannels}
        topicTitle={progressTopicTitle}
        phase={progressDialogPhase}
        contentStatus={progressDialogContentStatus}
        imageTasks={{
          ...progressDialogImageTasks,
          ...orchestrator.imageTasks,
        }}
        onReviewContent={handleProgressReviewContent}
        onGoToLibrary={handleProgressGoToLibrary}
        onRetry={handleProgressRetry}
        onClose={handleProgressClose}
      />

      <GeneratedContentModal
        open={reviewModalOpen}
        onOpenChange={handleReviewModalOpenChange}
      />
    </>
  );
}
