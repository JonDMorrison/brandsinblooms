import React, { useEffect, useMemo, useState } from "react";
import Avatar from "@mui/joy/Avatar";
import AspectRatio from "@mui/joy/AspectRatio";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Chip from "@mui/joy/Chip";
import Divider from "@mui/joy/Divider";
import Drawer from "@mui/joy/Drawer";
import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import IconButton from "@mui/joy/IconButton";
import Input from "@mui/joy/Input";
import ListItemDecorator from "@mui/joy/ListItemDecorator";
import Option from "@mui/joy/Option";
import Select from "@mui/joy/Select";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Textarea from "@mui/joy/Textarea";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Clock,
  Eye,
  Facebook,
  ImagePlus,
  Instagram,
  Link as LinkIcon,
  Send,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { Link as RouterLink } from "react-router-dom";
import { SocialPostPreviewModal } from "./preview/SocialPostPreviewModal";
import { useToast } from "@/hooks/use-toast";
import { ImageSelectButton } from "@/components/image";
import {
  getMissingAccountError,
  getPlatformCharacterLimit,
  getPublishFieldValidation,
  validatePostForPlatform,
} from "@/utils/validatePost";
import type {
  Platform,
  PublishItem,
  PublishNowInput,
  ScheduleInput,
  ValidationResult,
} from "@/types/publish";

export type ComposerMode = "edit" | "publish" | "schedule";

export type ComposerDrawerProps = {
  open: boolean;
  mode: ComposerMode;
  item: PublishItem | null;
  accounts: Array<{
    platform: "facebook" | "instagram";
    accountId: string;
    accountName: string;
    pageId?: string | null;
    platformAccountName?: string | null;
    username?: string | null;
  }>;
  onClose: () => void;
  onSaveDraft: (
    taskId: string,
    partial: {
      caption?: string | null;
      mediaUrl?: string | null;
      firstComment?: string | null;
      accountId?: string | null;
      platform?: "facebook" | "instagram";
    },
  ) => Promise<PublishItem>;
  onCancelUntouched?: (taskId: string) => void;
  onPublishNow: (taskId: string, input: PublishNowInput) => Promise<void>;
  onSchedule: (taskId: string, input: ScheduleInput) => Promise<void>;
  validate?: (
    platform: "facebook" | "instagram",
    input: PublishNowInput,
  ) => ValidationResult;
};

type DraftSnapshot = {
  accountId: string;
  caption: string;
  firstComment: string;
  mediaUrl: string | null;
  platform: Platform;
};

const PLATFORM_OPTIONS = [
  {
    icon: Facebook,
    label: "Facebook",
    value: "facebook" as const,
  },
  {
    icon: Instagram,
    label: "Instagram",
    value: "instagram" as const,
  },
];

const PLATFORM_BRAND_STYLES = {
  facebook: {
    avatarBg: "#1877F2",
    avatarColor: "#FFFFFF",
    softAvatarBg: "#E8F1FF",
    softAvatarColor: "#1877F2",
  },
  instagram: {
    avatarBg: "#E4405F",
    avatarColor: "#FFFFFF",
    softAvatarBg: "#FDE8EF",
    softAvatarColor: "#E4405F",
  },
} as const;

const selectButtonSlotProps = {
  sx: {
    minHeight: 44,
    borderRadius: "lg",
    px: 1.5,
    bgcolor: "background.surface",
  },
} as const;

const selectListboxSlotProps = {
  disablePortal: false,
  sx: {
    zIndex: "calc(var(--joy-zIndex-modal, 1300) + 1)",
    p: 0.5,
    borderRadius: "lg",
    border: "1px solid",
    borderColor: "neutral.200",
    bgcolor: "background.surface",
    boxShadow: "lg",
    "--List-padding": "0px",
  },
} as const;

function getPlatformLabel(platform: Platform) {
  return platform === "instagram" ? "Instagram" : "Facebook";
}

function getAccountCountLabel(count: number) {
  return count === 1 ? "1 account" : `${count} accounts`;
}

function getInitials(name: string | null | undefined): string {
  if (!name) {
    return "?";
  }

  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() || "")
    .join("");

  return initials || "?";
}

function getPlatformInfoMessage(platform: Platform, characterLimit: number) {
  if (platform === "instagram") {
    return `Instagram · ${characterLimit.toLocaleString()} characters · Caption or image required. First comment supported.`;
  }

  return `Facebook · ${characterLimit.toLocaleString()} characters · Text or image required.`;
}

function resolveInitialMediaUrls(item: PublishItem): string[] {
  if (Array.isArray(item.mediaUrls) && item.mediaUrls.length > 0) {
    return item.mediaUrls.filter((url): url is string => Boolean(url));
  }

  return item.mediaUrl ? [item.mediaUrl] : [];
}

function resolveDrawerTitle(mode: ComposerMode, item: PublishItem): string {
  if (mode === "publish") {
    return "Publish Post";
  }

  if (mode === "schedule") {
    return "Schedule Post";
  }

  const hasExistingContent = Boolean(
    item.caption?.trim() ||
    item.mediaUrl ||
    (Array.isArray(item.mediaUrls) && item.mediaUrls.length > 0) ||
    item.accountId,
  );

  return hasExistingContent ? "Edit Post" : "Compose Post";
}

function combineScheduleDateTime(
  dateValue: string,
  timeValue: string,
): Date | null {
  if (!dateValue || !timeValue) {
    return null;
  }

  const combinedDateTime = new Date(`${dateValue}T${timeValue}`);

  if (Number.isNaN(combinedDateTime.getTime())) {
    return null;
  }

  return combinedDateTime;
}

function InlineMessage({
  message,
  tone = "danger",
}: {
  message?: string;
  tone?: "danger" | "warning";
}) {
  if (!message) {
    return null;
  }

  return (
    <Stack
      direction="row"
      spacing={0.75}
      alignItems="flex-start"
      sx={{
        color: tone === "danger" ? "danger.500" : "warning.600",
        mt: 0.75,
      }}
    >
      <AlertCircle size={12} style={{ flexShrink: 0, marginTop: 2 }} />
      <Typography level="body-xs" sx={{ color: "inherit" }}>
        {message}
      </Typography>
    </Stack>
  );
}

function SectionHeader({
  title,
  helperText,
}: {
  title: string;
  helperText?: string;
}) {
  return (
    <Stack spacing={0.5}>
      <Typography
        level="title-sm"
        sx={{ color: "text.secondary", fontWeight: "md" }}
      >
        {title}
      </Typography>
      {helperText ? (
        <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
          {helperText}
        </Typography>
      ) : null}
    </Stack>
  );
}

export default function ComposerDrawer({
  open,
  mode,
  item,
  accounts,
  onClose,
  onSaveDraft,
  onPublishNow,
  onSchedule,
  onCancelUntouched,
  validate = validatePostForPlatform,
}: ComposerDrawerProps) {
  const { toast } = useToast();
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const [localCaption, setLocalCaption] = useState("");
  const [localMediaUrls, setLocalMediaUrls] = useState<string[]>([]);
  const [localFirstComment, setLocalFirstComment] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [localPlatform, setLocalPlatform] = useState<Platform>("instagram");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [activeAction, setActiveAction] = useState<
    "publish" | "save" | "schedule" | null
  >(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPlatform, setPreviewPlatform] = useState<Platform>("instagram");
  const [savedSnapshot, setSavedSnapshot] = useState<DraftSnapshot | null>(
    null,
  );
  const [scheduleAttempted, setScheduleAttempted] = useState(false);

  useEffect(() => {
    if (!item) {
      return;
    }

    const initialMediaUrls = resolveInitialMediaUrls(item);
    const scheduledDateTime = item.scheduledFor
      ? new Date(item.scheduledFor)
      : null;

    setLocalCaption(item.caption ?? "");
    setLocalMediaUrls(initialMediaUrls);
    setLocalFirstComment(item.firstComment ?? "");
    setSelectedAccountId(item.accountId ?? "");
    setLocalPlatform(item.platform);
    setSelectedDate(
      scheduledDateTime && !Number.isNaN(scheduledDateTime.getTime())
        ? format(scheduledDateTime, "yyyy-MM-dd")
        : "",
    );
    setSelectedTime(
      scheduledDateTime && !Number.isNaN(scheduledDateTime.getTime())
        ? format(scheduledDateTime, "HH:mm")
        : "",
    );
    setActiveAction(null);
    setPreviewOpen(false);
    setPreviewPlatform(item.platform);
    setScheduleAttempted(false);
    setSavedSnapshot({
      accountId: item.accountId ?? "",
      caption: item.caption ?? "",
      firstComment: item.firstComment ?? "",
      mediaUrl: initialMediaUrls[0] ?? null,
      platform: item.platform,
    });
  }, [item, mode]);

  const platformAccounts = useMemo(
    () => accounts.filter((account) => account.platform === localPlatform),
    [accounts, localPlatform],
  );
  const platformAccountCounts = useMemo(
    () => ({
      facebook: accounts.filter((account) => account.platform === "facebook")
        .length,
      instagram: accounts.filter((account) => account.platform === "instagram")
        .length,
    }),
    [accounts],
  );

  useEffect(() => {
    if (platformAccounts.length === 0) {
      if (selectedAccountId !== "") {
        setSelectedAccountId("");
      }
      return;
    }

    if (
      platformAccounts.some(
        (account) => account.accountId === selectedAccountId,
      )
    ) {
      return;
    }

    if (platformAccounts.length === 1) {
      setSelectedAccountId(platformAccounts[0].accountId);
      return;
    }

    if (selectedAccountId !== "") {
      setSelectedAccountId("");
    }
  }, [platformAccounts, selectedAccountId]);

  useEffect(() => {
    if (!previewOpen) {
      setPreviewPlatform(localPlatform);
    }
  }, [localPlatform, previewOpen]);

  const primaryMediaUrl = localMediaUrls[0] ?? null;
  const currentSnapshot: DraftSnapshot = {
    accountId: selectedAccountId,
    caption: localCaption,
    firstComment: localFirstComment,
    mediaUrl: primaryMediaUrl,
    platform: localPlatform,
  };

  const currentInput: PublishNowInput = {
    accountId: selectedAccountId,
    caption: localCaption,
    firstComment: localFirstComment,
    isCarousel: localMediaUrls.length > 1,
    mediaUrl: primaryMediaUrl,
    mediaUrls: localMediaUrls.length > 1 ? localMediaUrls : undefined,
    platform: localPlatform,
  };

  const validation = useMemo(
    () => validate(localPlatform, currentInput),
    [currentInput, localPlatform, validate],
  );
  const fieldValidation = useMemo(
    () => getPublishFieldValidation(localPlatform, currentInput),
    [currentInput, localPlatform],
  );

  if (!item) {
    return null;
  }

  const platformLabel = getPlatformLabel(localPlatform);
  const platformIcon = localPlatform === "instagram" ? Instagram : Facebook;
  const PlatformIcon = platformIcon;
  const platformStyles = PLATFORM_BRAND_STYLES[localPlatform];
  const selectedAccount =
    platformAccounts.find(
      (account) => account.accountId === selectedAccountId,
    ) ?? null;
  const selectedAccountHandle = selectedAccount?.username
    ? `@${selectedAccount.username.replace(/^@/, "")}`
    : null;
  const selectedAccountPageLabel =
    selectedAccount?.platform === "facebook" && selectedAccount.pageId
      ? `Page: ${selectedAccount.platformAccountName ?? selectedAccount.accountName}`
      : null;
  const hasCaption = localCaption.trim().length > 0;
  const hasMedia = Boolean(primaryMediaUrl);
  const characterLimit = getPlatformCharacterLimit(localPlatform);
  const captionCounterColor =
    localCaption.length >= characterLimit
      ? "danger.500"
      : localCaption.length >= characterLimit * 0.9
        ? "warning.500"
        : "text.tertiary";
  const noConnectedAccounts = platformAccounts.length === 0;
  const accountError = noConnectedAccounts
    ? getMissingAccountError(localPlatform)
    : !selectedAccountId
      ? "Select an account"
      : undefined;
  const schedulePreview = combineScheduleDateTime(selectedDate, selectedTime);
  const scheduleDateError =
    scheduleAttempted && !selectedDate
      ? "Select a date to schedule"
      : scheduleAttempted &&
          selectedDate &&
          selectedTime &&
          schedulePreview &&
          schedulePreview.getTime() <= Date.now()
        ? "Scheduled time must be in the future"
        : undefined;
  const scheduleTimeError =
    scheduleAttempted && !selectedTime
      ? "Select a time to schedule"
      : undefined;
  const preconditionDisabledReason = accountError
    ? "Select a platform and account first"
    : !hasCaption && !hasMedia
      ? "Add a caption or image"
      : undefined;
  const hasChanges =
    savedSnapshot !== null &&
    (savedSnapshot.accountId !== currentSnapshot.accountId ||
      savedSnapshot.caption !== currentSnapshot.caption ||
      savedSnapshot.firstComment !== currentSnapshot.firstComment ||
      savedSnapshot.mediaUrl !== currentSnapshot.mediaUrl ||
      savedSnapshot.platform !== currentSnapshot.platform);
  const drawerTitle = resolveDrawerTitle(mode, item);

  const persistCurrentDraft = async () => {
    await onSaveDraft(item.taskId, {
      accountId: selectedAccountId || null,
      caption: localCaption,
      firstComment: localFirstComment,
      mediaUrl: primaryMediaUrl,
      platform: localPlatform,
    });

    setSavedSnapshot(currentSnapshot);
  };

  const handleCloseRequest = () => {
    if (!hasChanges) {
      onCancelUntouched?.(item.taskId);
    }

    onClose();
  };

  const handleImageSelect = async (imageUrl: string) => {
    const previousMediaUrls = localMediaUrls;
    setLocalMediaUrls([imageUrl]);

    try {
      await onSaveDraft(item.taskId, { mediaUrl: imageUrl });
      setSavedSnapshot((currentValue) =>
        currentValue
          ? {
              ...currentValue,
              mediaUrl: imageUrl,
            }
          : currentValue,
      );
    } catch (error: unknown) {
      setLocalMediaUrls(previousMediaUrls);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to save image",
        variant: "destructive",
      });
    }
  };

  const handleRemoveMedia = async () => {
    const previousMediaUrls = localMediaUrls;
    setLocalMediaUrls([]);

    try {
      await onSaveDraft(item.taskId, { mediaUrl: null });
      setSavedSnapshot((currentValue) =>
        currentValue
          ? {
              ...currentValue,
              mediaUrl: null,
            }
          : currentValue,
      );
    } catch (error: unknown) {
      setLocalMediaUrls(previousMediaUrls);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to remove image",
        variant: "destructive",
      });
    }
  };

  const handleSaveDraft = async () => {
    if (activeAction) {
      return;
    }

    if (!hasChanges) {
      onClose();
      return;
    }

    setActiveAction("save");

    try {
      await persistCurrentDraft();
      toast({
        title: "Saved",
        description: "Draft saved successfully",
      });
      onClose();
    } catch (error: unknown) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to save draft",
        variant: "destructive",
      });
    } finally {
      setActiveAction(null);
    }
  };

  const handlePublish = async () => {
    if (activeAction || preconditionDisabledReason || !validation.ok) {
      return;
    }

    setActiveAction("publish");

    try {
      if (hasChanges) {
        await persistCurrentDraft();
      }

      await onPublishNow(item.taskId, currentInput);

      toast({
        title: "Success!",
        description: "Published successfully",
      });
    } catch (error: unknown) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to publish",
        variant: "destructive",
      });
    } finally {
      setActiveAction(null);
    }
  };

  const handleSchedule = async () => {
    setScheduleAttempted(true);

    if (
      activeAction ||
      preconditionDisabledReason ||
      !validation.ok ||
      scheduleDateError ||
      scheduleTimeError ||
      !schedulePreview
    ) {
      return;
    }

    setActiveAction("schedule");

    try {
      if (hasChanges) {
        await persistCurrentDraft();
      }

      await onSchedule(item.taskId, {
        ...currentInput,
        publishAt: schedulePreview.toISOString(),
        timezone: userTimezone,
      });

      toast({
        title: "Scheduled!",
        description: `Scheduled for ${format(schedulePreview, "MMM d, h:mm a")}`,
      });
    } catch (error: unknown) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to schedule",
        variant: "destructive",
      });
    } finally {
      setActiveAction(null);
    }
  };

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={() => {
          if (!activeAction) {
            handleCloseRequest();
          }
        }}
        size="lg"
        sx={{
          "--Drawer-horizontalSize": "560px",
          "& .MuiDrawer-content": {
            borderRadius: 0,
            p: 0,
          },
        }}
        slotProps={{
          content: {
            sx: {
              width: { xs: "100vw", sm: "var(--Drawer-horizontalSize)" },
              maxWidth: "100vw",
              p: 0,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              bgcolor: "background.surface",
            },
          },
        }}
      >
        <Box
          sx={{
            p: 2.5,
            borderBottom: "1px solid",
            borderColor: "divider",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "sticky",
            top: 0,
            bgcolor: "background.surface",
            zIndex: 10,
            gap: 1.5,
          }}
        >
          <Stack direction="row" spacing={1.25} alignItems="center">
            <IconButton
              variant="plain"
              color="neutral"
              onClick={handleCloseRequest}
              disabled={Boolean(activeAction)}
            >
              <ArrowLeft size={16} />
            </IconButton>
            <Typography level="title-md" sx={{ fontWeight: "lg" }}>
              {drawerTitle}
            </Typography>
          </Stack>

          <Button
            variant="soft"
            color="neutral"
            size="sm"
            startDecorator={<Eye size={14} />}
            onClick={() => {
              setPreviewPlatform(localPlatform);
              setPreviewOpen(true);
            }}
            disabled={!hasCaption && !hasMedia}
          >
            Preview
          </Button>
        </Box>

        <Box sx={{ p: 3, overflowY: "auto", flex: 1 }}>
          <Stack spacing={3}>
            <Sheet
              variant="outlined"
              sx={{
                borderRadius: "xl",
                borderColor: "divider",
                p: 2.5,
              }}
            >
              <Stack spacing={2}>
                <SectionHeader title="Platform & Account" />

                <FormControl>
                  <FormLabel>Platform</FormLabel>
                  <Select
                    value={localPlatform}
                    slotProps={{
                      button: selectButtonSlotProps,
                      listbox: selectListboxSlotProps,
                    }}
                    renderValue={() => {
                      const SelectedPlatformIcon =
                        PLATFORM_OPTIONS.find(
                          (platformOption) =>
                            platformOption.value === localPlatform,
                        )?.icon ?? PlatformIcon;

                      return (
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                          sx={{ minWidth: 0 }}
                        >
                          <Avatar
                            size="sm"
                            sx={{
                              bgcolor: platformStyles.avatarBg,
                              color: platformStyles.avatarColor,
                              width: 24,
                              height: 24,
                            }}
                          >
                            <SelectedPlatformIcon size={14} />
                          </Avatar>
                          <Typography
                            level="body-sm"
                            sx={{ color: "text.primary", fontWeight: "md" }}
                          >
                            {platformLabel}
                          </Typography>
                        </Stack>
                      );
                    }}
                    onChange={(_event, value) => {
                      if (value && value !== localPlatform) {
                        setLocalPlatform(value as Platform);
                        setSelectedAccountId("");
                      }
                    }}
                    variant="outlined"
                    size="sm"
                  >
                    {PLATFORM_OPTIONS.map((platformOption) => {
                      const connectionCount =
                        platformAccountCounts[platformOption.value];
                      const PlatformOptionIcon = platformOption.icon;
                      const platformOptionStyles =
                        PLATFORM_BRAND_STYLES[platformOption.value];

                      return (
                        <Option
                          key={platformOption.value}
                          value={platformOption.value}
                          sx={{
                            py: 1.5,
                            px: 2,
                            borderRadius: "md",
                            alignItems: "center",
                            gap: 1.25,
                            "&:hover": {
                              bgcolor: "background.level1",
                            },
                            '&[aria-selected="true"]': {
                              bgcolor: "primary.50",
                            },
                          }}
                        >
                          <ListItemDecorator>
                            <Avatar
                              size="sm"
                              sx={{
                                bgcolor: platformOptionStyles.avatarBg,
                                color: platformOptionStyles.avatarColor,
                                width: 28,
                                height: 28,
                              }}
                            >
                              <PlatformOptionIcon size={16} />
                            </Avatar>
                          </ListItemDecorator>
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                            justifyContent="space-between"
                            sx={{ flex: 1, minWidth: 0 }}
                          >
                            <Typography
                              level="body-sm"
                              sx={{ fontWeight: "md" }}
                            >
                              {platformOption.label}
                            </Typography>
                            <Chip
                              variant="soft"
                              color={
                                connectionCount > 0 ? "success" : "neutral"
                              }
                              size="sm"
                            >
                              {connectionCount > 0
                                ? getAccountCountLabel(connectionCount)
                                : "Not connected"}
                            </Chip>
                          </Stack>
                        </Option>
                      );
                    })}
                  </Select>
                </FormControl>

                <FormControl
                  error={!noConnectedAccounts && Boolean(accountError)}
                >
                  <FormLabel>Account</FormLabel>
                  {noConnectedAccounts ? (
                    <Sheet
                      variant="soft"
                      color="neutral"
                      sx={{
                        borderRadius: "lg",
                        p: 2.5,
                        border: "1px solid",
                        borderColor: "neutral.200",
                      }}
                    >
                      <Stack
                        spacing={1.5}
                        alignItems="center"
                        textAlign="center"
                      >
                        <Avatar
                          size="lg"
                          sx={{
                            bgcolor: "background.surface",
                            color: "text.tertiary",
                            width: 44,
                            height: 44,
                          }}
                        >
                          <LinkIcon size={24} />
                        </Avatar>
                        <Stack spacing={0.5}>
                          <Typography level="body-sm" sx={{ fontWeight: "md" }}>
                            No {platformLabel} account connected
                          </Typography>
                          <Typography
                            level="body-xs"
                            sx={{ color: "text.tertiary" }}
                          >
                            Connect your account to start posting
                          </Typography>
                        </Stack>
                        <Button
                          component={RouterLink}
                          to="/social-accounts"
                          onClick={() => {
                            onClose();
                          }}
                          variant="soft"
                          color="primary"
                          size="sm"
                        >
                          Connect {platformLabel}
                        </Button>
                      </Stack>
                    </Sheet>
                  ) : (
                    <>
                      <Select
                        value={selectedAccountId || null}
                        placeholder="Choose a connected account"
                        slotProps={{
                          button: selectButtonSlotProps,
                          listbox: selectListboxSlotProps,
                        }}
                        renderValue={() =>
                          selectedAccount ? (
                            <Stack
                              direction="row"
                              spacing={1}
                              alignItems="center"
                              sx={{ minWidth: 0 }}
                            >
                              <Avatar
                                size="sm"
                                sx={{
                                  bgcolor: platformStyles.softAvatarBg,
                                  color: platformStyles.softAvatarColor,
                                  width: 24,
                                  height: 24,
                                  fontSize: "0.65rem",
                                  fontWeight: "lg",
                                }}
                              >
                                {getInitials(
                                  selectedAccount.platformAccountName ??
                                    selectedAccount.accountName,
                                )}
                              </Avatar>
                              <Typography
                                level="body-sm"
                                sx={{
                                  color: "text.primary",
                                  fontWeight: "md",
                                  minWidth: 0,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {selectedAccount.accountName}
                              </Typography>
                            </Stack>
                          ) : (
                            <Typography
                              level="body-sm"
                              sx={{ color: "text.tertiary" }}
                            >
                              Choose a connected account
                            </Typography>
                          )
                        }
                        onChange={(_event, value) => {
                          setSelectedAccountId(value ?? "");
                        }}
                        variant="outlined"
                        size="sm"
                      >
                        {platformAccounts.map((account) => {
                          const accountHandle = account.username
                            ? `@${account.username.replace(/^@/, "")}`
                            : null;
                          const accountPageLabel =
                            account.platform === "facebook" && account.pageId
                              ? `Page: ${account.platformAccountName ?? account.accountName}`
                              : null;

                          return (
                            <Option
                              key={account.accountId}
                              value={account.accountId}
                              sx={{
                                py: 1.5,
                                px: 2,
                                borderRadius: "md",
                                alignItems: "flex-start",
                                gap: 1.25,
                                "&:hover": {
                                  bgcolor: "background.level1",
                                },
                                '&[aria-selected="true"]': {
                                  bgcolor: "primary.50",
                                },
                              }}
                            >
                              <ListItemDecorator sx={{ mt: 0.125 }}>
                                <Avatar
                                  size="sm"
                                  sx={{
                                    bgcolor:
                                      PLATFORM_BRAND_STYLES[account.platform]
                                        .softAvatarBg,
                                    color:
                                      PLATFORM_BRAND_STYLES[account.platform]
                                        .softAvatarColor,
                                    width: 28,
                                    height: 28,
                                    fontSize: "0.7rem",
                                    fontWeight: "lg",
                                  }}
                                >
                                  {getInitials(
                                    account.platformAccountName ??
                                      account.accountName,
                                  )}
                                </Avatar>
                              </ListItemDecorator>
                              <Stack
                                direction="row"
                                spacing={1}
                                alignItems="flex-start"
                                justifyContent="space-between"
                                sx={{ flex: 1, minWidth: 0 }}
                              >
                                <Stack
                                  spacing={0.125}
                                  sx={{ minWidth: 0, flex: 1 }}
                                >
                                  <Typography
                                    level="body-sm"
                                    sx={{
                                      fontWeight: "md",
                                      minWidth: 0,
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {account.accountName}
                                  </Typography>
                                  {accountHandle ? (
                                    <Typography
                                      level="body-xs"
                                      sx={{ color: "text.tertiary" }}
                                    >
                                      {accountHandle}
                                    </Typography>
                                  ) : null}
                                  {accountPageLabel ? (
                                    <Typography
                                      level="body-xs"
                                      sx={{ color: "text.tertiary" }}
                                    >
                                      {accountPageLabel}
                                    </Typography>
                                  ) : null}
                                </Stack>
                                <Box
                                  sx={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: "50%",
                                    bgcolor: "success.400",
                                    mt: 0.75,
                                    ml: 1,
                                    flexShrink: 0,
                                  }}
                                />
                              </Stack>
                            </Option>
                          );
                        })}
                      </Select>
                      <InlineMessage message={accountError} />
                    </>
                  )}
                </FormControl>

                <Sheet
                  variant="soft"
                  color="primary"
                  sx={{
                    borderRadius: "md",
                    p: 1.5,
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                  }}
                >
                  <PlatformIcon size={16} />
                  <Typography level="body-xs" sx={{ color: "primary.700" }}>
                    {getPlatformInfoMessage(localPlatform, characterLimit)}
                  </Typography>
                </Sheet>
              </Stack>
            </Sheet>

            <Sheet
              variant="outlined"
              sx={{
                borderRadius: "xl",
                borderColor: "divider",
                p: 2.5,
              }}
            >
              <Stack spacing={1.5}>
                <SectionHeader title="Caption" />

                <FormControl error={Boolean(fieldValidation.contentError)}>
                  <FormLabel>Caption</FormLabel>
                  <Textarea
                    value={localCaption}
                    onChange={(event) => setLocalCaption(event.target.value)}
                    variant="outlined"
                    minRows={5}
                    maxRows={12}
                    placeholder="Write your caption here..."
                    sx={{ borderRadius: "md", fontSize: "sm" }}
                  />
                  <InlineMessage message={fieldValidation.contentError} />
                </FormControl>

                <Typography
                  level="body-xs"
                  sx={{
                    color: captionCounterColor,
                    fontWeight:
                      localCaption.length >= characterLimit ? "lg" : "md",
                    textAlign: "right",
                  }}
                >
                  {localCaption.length}/{characterLimit.toLocaleString()}{" "}
                  characters
                </Typography>

                <InlineMessage message={fieldValidation.captionError} />
              </Stack>
            </Sheet>

            <Sheet
              variant="outlined"
              sx={{
                borderRadius: "xl",
                borderColor: "divider",
                p: 2.5,
              }}
            >
              <Stack spacing={2}>
                <SectionHeader title="Media" />

                {hasMedia ? (
                  <Stack spacing={1.5}>
                    <Box sx={{ position: "relative" }}>
                      <AspectRatio
                        ratio="16/9"
                        sx={{ borderRadius: "lg", overflow: "hidden" }}
                      >
                        <Box
                          component="img"
                          src={primaryMediaUrl ?? undefined}
                          alt="Selected media"
                          sx={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      </AspectRatio>
                      <IconButton
                        variant="solid"
                        color="danger"
                        size="sm"
                        onClick={() => {
                          void handleRemoveMedia();
                        }}
                        sx={{ position: "absolute", top: 12, right: 12 }}
                      >
                        <X size={14} />
                      </IconButton>
                    </Box>

                    {localMediaUrls.length > 1 ? (
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ overflowX: "auto", pb: 0.5 }}
                      >
                        {localMediaUrls.map((mediaUrl) => (
                          <AspectRatio
                            key={mediaUrl}
                            ratio="1"
                            sx={{
                              width: 80,
                              flex: "0 0 auto",
                              borderRadius: "sm",
                              overflow: "hidden",
                            }}
                          >
                            <Box
                              component="img"
                              src={mediaUrl}
                              alt="Media thumbnail"
                              sx={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                              }}
                            />
                          </AspectRatio>
                        ))}
                      </Stack>
                    ) : null}

                    <ImageSelectButton
                      selectedImageUrl={primaryMediaUrl ?? undefined}
                      onImageSelect={(imageUrl) => {
                        void handleImageSelect(imageUrl);
                      }}
                      contentContext={localCaption || item.caption || ""}
                      mode="modal"
                      renderTrigger={({ openPicker }) => (
                        <Button
                          variant="plain"
                          color="neutral"
                          size="sm"
                          onClick={openPicker}
                          sx={{ alignSelf: "flex-start" }}
                        >
                          Change Image
                        </Button>
                      )}
                    />
                  </Stack>
                ) : (
                  <ImageSelectButton
                    selectedImageUrl={primaryMediaUrl ?? undefined}
                    onImageSelect={(imageUrl) => {
                      void handleImageSelect(imageUrl);
                    }}
                    contentContext={localCaption || item.caption || ""}
                    mode="modal"
                    renderTrigger={({ openPicker }) => (
                      <Sheet
                        variant="soft"
                        role="button"
                        tabIndex={0}
                        onClick={openPicker}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openPicker();
                          }
                        }}
                        sx={{
                          borderRadius: "lg",
                          border: "2px dashed",
                          borderColor: "neutral.300",
                          p: 4,
                          textAlign: "center",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                          "&:hover": {
                            borderColor: "primary.400",
                            bgcolor: "primary.50",
                          },
                        }}
                      >
                        <Stack spacing={1.25} alignItems="center">
                          <ImagePlus size={36} />
                          <Stack spacing={0.25}>
                            <Typography
                              level="body-sm"
                              sx={{ fontWeight: "md" }}
                            >
                              Drop image here or click to browse
                            </Typography>
                            <Typography
                              level="body-xs"
                              sx={{ color: "text.tertiary" }}
                            >
                              Supports JPG, PNG, WebP
                            </Typography>
                          </Stack>
                        </Stack>
                      </Sheet>
                    )}
                  />
                )}

                {validation.warnings.map((warning) => (
                  <InlineMessage
                    key={warning}
                    message={warning}
                    tone="warning"
                  />
                ))}
              </Stack>
            </Sheet>

            <Divider>
              <Chip variant="soft" color="neutral" size="sm">
                Additional Options
              </Chip>
            </Divider>

            {localPlatform === "instagram" ? (
              <Sheet
                variant="outlined"
                sx={{
                  borderRadius: "xl",
                  borderColor: "divider",
                  p: 2.5,
                }}
              >
                <Stack spacing={1.25}>
                  <SectionHeader
                    title="First Comment"
                    helperText="Add a comment that will be posted immediately after your post"
                  />
                  <Textarea
                    value={localFirstComment}
                    onChange={(event) =>
                      setLocalFirstComment(event.target.value)
                    }
                    variant="outlined"
                    minRows={2}
                    maxRows={4}
                    placeholder="Add a first comment..."
                  />
                </Stack>
              </Sheet>
            ) : null}

            <Sheet
              variant="outlined"
              sx={{
                borderRadius: "xl",
                borderColor: "divider",
                p: 2.5,
              }}
            >
              <Stack spacing={1.5}>
                <SectionHeader title="Schedule" />

                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <FormControl
                    error={Boolean(scheduleDateError)}
                    sx={{ flex: 1 }}
                  >
                    <FormLabel>Date</FormLabel>
                    <Input
                      type="date"
                      value={selectedDate}
                      onChange={(event) => setSelectedDate(event.target.value)}
                      variant="outlined"
                      size="sm"
                      startDecorator={<Calendar size={14} />}
                    />
                    <InlineMessage message={scheduleDateError} />
                  </FormControl>

                  <FormControl
                    error={Boolean(scheduleTimeError)}
                    sx={{ flex: 1 }}
                  >
                    <FormLabel>Time</FormLabel>
                    <Input
                      type="time"
                      value={selectedTime}
                      onChange={(event) => setSelectedTime(event.target.value)}
                      variant="outlined"
                      size="sm"
                      startDecorator={<Clock size={14} />}
                    />
                    <InlineMessage message={scheduleTimeError} />
                  </FormControl>
                </Stack>

                <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                  Timezone: {userTimezone}
                </Typography>

                {schedulePreview ? (
                  <Sheet
                    variant="soft"
                    color="neutral"
                    sx={{ borderRadius: "lg", p: 1.5 }}
                  >
                    <Typography
                      level="body-xs"
                      sx={{ color: "text.secondary" }}
                    >
                      Will publish
                    </Typography>
                    <Typography level="body-sm" sx={{ fontWeight: "md" }}>
                      {format(schedulePreview, "EEEE, MMM d • h:mm a")}
                    </Typography>
                  </Sheet>
                ) : null}
              </Stack>
            </Sheet>
          </Stack>
        </Box>

        <Box
          sx={{
            p: 2.5,
            borderTop: "1px solid",
            borderColor: "divider",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "sticky",
            bottom: 0,
            bgcolor: "background.surface",
            zIndex: 10,
            gap: 1.5,
            flexWrap: { xs: "wrap", sm: "nowrap" },
          }}
        >
          <Button
            variant="plain"
            color="neutral"
            size="sm"
            onClick={() => {
              void handleSaveDraft();
            }}
            loading={activeAction === "save"}
            disabled={Boolean(activeAction && activeAction !== "save")}
          >
            Save Draft
          </Button>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            sx={{
              ml: "auto",
              width: { xs: "100%", sm: "auto" },
            }}
          >
            <Tooltip
              title={preconditionDisabledReason ?? ""}
              disableHoverListener={!preconditionDisabledReason}
            >
              <Box
                sx={{
                  display: "inline-flex",
                  width: { xs: "100%", sm: "auto" },
                }}
              >
                <Button
                  variant="soft"
                  color="primary"
                  size="sm"
                  startDecorator={<Clock size={14} />}
                  onClick={() => {
                    void handleSchedule();
                  }}
                  loading={activeAction === "schedule"}
                  disabled={
                    Boolean(preconditionDisabledReason) ||
                    Boolean(activeAction && activeAction !== "schedule")
                  }
                  sx={{ width: { xs: "100%", sm: "auto" } }}
                >
                  Schedule
                </Button>
              </Box>
            </Tooltip>

            <Tooltip
              title={preconditionDisabledReason ?? ""}
              disableHoverListener={!preconditionDisabledReason}
            >
              <Box
                sx={{
                  display: "inline-flex",
                  width: { xs: "100%", sm: "auto" },
                }}
              >
                <Button
                  variant="solid"
                  color="primary"
                  size="sm"
                  startDecorator={<Send size={14} />}
                  onClick={() => {
                    void handlePublish();
                  }}
                  loading={activeAction === "publish"}
                  disabled={
                    Boolean(preconditionDisabledReason) ||
                    Boolean(activeAction && activeAction !== "publish")
                  }
                  sx={{ width: { xs: "100%", sm: "auto" } }}
                >
                  Publish Now
                </Button>
              </Box>
            </Tooltip>
          </Stack>
        </Box>
      </Drawer>

      <SocialPostPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        platform={previewPlatform}
        onPlatformChange={setPreviewPlatform}
        accountName={selectedAccount?.accountName || `${platformLabel} account`}
        caption={localCaption}
        mediaUrl={primaryMediaUrl ?? ""}
        mediaUrls={localMediaUrls.length > 1 ? localMediaUrls : undefined}
        isCarousel={localMediaUrls.length > 1}
        scheduledFor={schedulePreview ? schedulePreview.toISOString() : null}
      />
    </>
  );
}
