import { useCallback, useEffect, useMemo, useState } from "react";
import Alert from "@mui/joy/Alert";
import Avatar from "@mui/joy/Avatar";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Card from "@mui/joy/Card";
import Chip from "@mui/joy/Chip";
import IconButton from "@mui/joy/IconButton";
import Input from "@mui/joy/Input";
import Option from "@mui/joy/Option";
import Select from "@mui/joy/Select";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Switch from "@mui/joy/Switch";
import Typography from "@mui/joy/Typography";
import { format, parse } from "date-fns";
import { Plus, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui-legacy/popover";
import {
  getPlatformConfig,
  resolvePlatformKey,
  type PlatformKey,
} from "@/utils/platformConfig";

type SchedulingPreference =
  Database["public"]["Tables"]["scheduling_preferences"]["Row"];
type SchedulingPreferenceInsert =
  Database["public"]["Tables"]["scheduling_preferences"]["Insert"];

type PostgrestLikeError = {
  code?: string;
};

const DISPLAY_PLATFORM_ORDER: PlatformKey[] = ["facebook", "instagram"];
const DEFAULT_OPTIMAL_TIMES = ["12:00", "18:00"];
const DEFAULT_PENDING_TIME = "09:00";
const SAVE_SUCCESS_RESET_MS = 2000;

const FREQUENCY_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly", label: "Monthly" },
] as const;

const buildStorageKey = (userId: string) => `scheduling_preferences_${userId}`;

const createDefaultPreference = (
  userId: string,
  platform: PlatformKey,
): SchedulingPreference => {
  const timestamp = new Date().toISOString();

  return {
    id: `${platform}_${userId}`,
    user_id: userId,
    platform,
    enabled: false,
    optimal_times: [...DEFAULT_OPTIMAL_TIMES],
    frequency: "daily",
    created_at: timestamp,
    updated_at: timestamp,
  };
};

const createDefaultPreferences = (userId: string) => [
  createDefaultPreference(userId, "facebook"),
  createDefaultPreference(userId, "instagram"),
  createDefaultPreference(userId, "google_my_business"),
];

const normalizeFrequency = (value?: string | null) => {
  const normalized = value?.trim().toLowerCase();

  switch (normalized) {
    case "weekly":
    case "biweekly":
    case "monthly":
    case "daily":
      return normalized;
    case "bi_weekly":
      return "biweekly";
    case "every_other_day":
      return "daily";
    default:
      return "daily";
  }
};

const normalizeTimes = (value?: string[] | null) => {
  if (!Array.isArray(value) || value.length === 0) {
    return [...DEFAULT_OPTIMAL_TIMES];
  }

  return Array.from(new Set(value.filter(Boolean))).sort((left, right) =>
    left.localeCompare(right),
  );
};

const normalizePreference = (
  preference: Partial<SchedulingPreference>,
  userId: string,
): SchedulingPreference => {
  const resolvedPlatform =
    resolvePlatformKey(preference.platform ?? "") ?? "facebook";
  const timestamp = new Date().toISOString();

  return {
    id: preference.id ?? `${resolvedPlatform}_${userId}`,
    user_id: preference.user_id ?? userId,
    platform: resolvedPlatform,
    enabled: Boolean(preference.enabled),
    optimal_times: normalizeTimes(preference.optimal_times),
    frequency: normalizeFrequency(preference.frequency),
    created_at: preference.created_at ?? timestamp,
    updated_at: preference.updated_at ?? timestamp,
  };
};

const ensurePlatformCoverage = (
  userId: string,
  preferences: SchedulingPreference[],
) => {
  const preferencesByPlatform = new Map(
    preferences.map((preference) => [preference.platform, preference]),
  );

  return ["facebook", "instagram", "google_my_business"].map(
    (platform) =>
      preferencesByPlatform.get(platform) ??
      createDefaultPreference(userId, platform as PlatformKey),
  );
};

const readStoredPreferences = (userId: string) => {
  const storedPreferences = localStorage.getItem(buildStorageKey(userId));

  if (!storedPreferences) {
    return null;
  }

  try {
    const parsed = JSON.parse(storedPreferences) as SchedulingPreference[];

    return ensurePlatformCoverage(
      userId,
      parsed.map((preference) => normalizePreference(preference, userId)),
    );
  } catch (error) {
    console.error("Error parsing stored scheduling preferences:", error);
    return null;
  }
};

const persistPreferences = (
  userId: string,
  preferences: SchedulingPreference[],
) => {
  localStorage.setItem(buildStorageKey(userId), JSON.stringify(preferences));
};

const toSchedulingPreferenceUpsert = (
  preference: SchedulingPreference,
  userId: string,
): SchedulingPreferenceInsert => ({
  user_id: userId,
  platform: resolvePlatformKey(preference.platform) ?? preference.platform,
  enabled: Boolean(preference.enabled),
  optimal_times: normalizeTimes(preference.optimal_times),
  frequency: normalizeFrequency(preference.frequency),
});

const formatTimeSlot = (timeValue: string) => {
  try {
    return format(parse(timeValue, "HH:mm", new Date()), "h:mm a");
  } catch {
    return timeValue;
  }
};

const isMissingSchedulingPreferencesRelation = (error: unknown) => {
  if (!error || typeof error !== "object") {
    return false;
  }

  return (error as PostgrestLikeError).code === "42P01";
};

const SchedulerSkeletonCard = () => {
  return (
    <Card variant="outlined" sx={{ borderRadius: "lg", p: 3 }}>
      <Stack spacing={2.5}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Skeleton variant="circular" width={32} height={32} />
            <Skeleton variant="text" width={120} />
          </Stack>
          <Skeleton variant="rectangular" width={38} height={22} />
        </Stack>
        <Stack spacing={1.5}>
          <Skeleton variant="text" width={150} />
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Skeleton variant="rectangular" width={92} height={32} />
            <Skeleton variant="rectangular" width={92} height={32} />
            <Skeleton variant="rectangular" width={92} height={32} />
          </Stack>
          <Skeleton variant="rectangular" width={180} height={36} />
        </Stack>
      </Stack>
    </Card>
  );
};

export const AutoScheduler: React.FC = () => {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<SchedulingPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [isGeneratingSchedule, setIsGeneratingSchedule] = useState(false);
  const [saveSucceeded, setSaveSucceeded] = useState(false);
  const [timePopoverPlatform, setTimePopoverPlatform] =
    useState<PlatformKey | null>(null);
  const [pendingTime, setPendingTime] = useState(DEFAULT_PENDING_TIME);

  useEffect(() => {
    if (!saveSucceeded) {
      return;
    }

    const timer = window.setTimeout(() => {
      setSaveSucceeded(false);
    }, SAVE_SUCCESS_RESET_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [saveSucceeded]);

  const fetchPreferences = useCallback(async () => {
    if (!user?.id) {
      setPreferences([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("scheduling_preferences")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        const remotePreferences = ensurePlatformCoverage(
          user.id,
          data.map((preference) => normalizePreference(preference, user.id)),
        );

        persistPreferences(user.id, remotePreferences);
        setPreferences(remotePreferences);
        return;
      }

      const storedPreferences = readStoredPreferences(user.id);

      if (storedPreferences) {
        setPreferences(storedPreferences);
        return;
      }

      const defaultPreferences = createDefaultPreferences(user.id);
      persistPreferences(user.id, defaultPreferences);
      setPreferences(defaultPreferences);
    } catch (error) {
      if (!isMissingSchedulingPreferencesRelation(error)) {
        console.error("Error fetching scheduling preferences:", error);
      }

      const storedPreferences = readStoredPreferences(user.id);

      if (storedPreferences) {
        setPreferences(storedPreferences);
      } else {
        const defaultPreferences = createDefaultPreferences(user.id);
        persistPreferences(user.id, defaultPreferences);
        setPreferences(defaultPreferences);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void fetchPreferences();
  }, [fetchPreferences]);

  const normalizedPreferences = useMemo(() => {
    if (!user?.id) {
      return preferences;
    }

    return ensurePlatformCoverage(
      user.id,
      preferences.map((preference) =>
        normalizePreference(
          {
            ...preference,
            optimal_times: normalizeTimes(preference.optimal_times),
            updated_at: preference.updated_at ?? new Date().toISOString(),
          },
          user.id,
        ),
      ),
    );
  }, [preferences, user]);

  const visiblePreferences = useMemo(() => {
    const orderIndex = new Map(
      DISPLAY_PLATFORM_ORDER.map((platform, index) => [platform, index]),
    );

    return normalizedPreferences
      .filter((preference) => {
        const platformKey = resolvePlatformKey(preference.platform);
        return platformKey === "facebook" || platformKey === "instagram";
      })
      .sort((left, right) => {
        if (left.enabled !== right.enabled) {
          return left.enabled ? -1 : 1;
        }

        const leftKey = resolvePlatformKey(left.platform) ?? "facebook";
        const rightKey = resolvePlatformKey(right.platform) ?? "facebook";

        return (orderIndex.get(leftKey) ?? 0) - (orderIndex.get(rightKey) ?? 0);
      });
  }, [normalizedPreferences]);

  const hasEnabledVisiblePlatform = visiblePreferences.some(
    (preference) => preference.enabled,
  );

  const updatePreference = useCallback(
    (
      platform: string,
      updater: (preference: SchedulingPreference) => SchedulingPreference,
    ) => {
      setPreferences((currentValue) =>
        currentValue.map((preference) =>
          preference.platform === platform
            ? {
                ...updater(preference),
                updated_at: new Date().toISOString(),
              }
            : preference,
        ),
      );
      setSaveSucceeded(false);
    },
    [],
  );

  const handleToggleEnabled = useCallback(
    (platform: string, enabled: boolean) => {
      updatePreference(platform, (preference) => ({
        ...preference,
        enabled,
      }));
    },
    [updatePreference],
  );

  const handleFrequencyChange = useCallback(
    (platform: string, frequency: string) => {
      updatePreference(platform, (preference) => ({
        ...preference,
        frequency: normalizeFrequency(frequency),
      }));
    },
    [updatePreference],
  );

  const handleRemoveTime = useCallback(
    (platform: string, timeValue: string) => {
      updatePreference(platform, (preference) => {
        if ((preference.optimal_times?.length ?? 0) <= 1) {
          return preference;
        }

        return {
          ...preference,
          optimal_times: preference.optimal_times.filter(
            (currentValue) => currentValue !== timeValue,
          ),
        };
      });
    },
    [updatePreference],
  );

  const handleCloseAddTime = useCallback(() => {
    setTimePopoverPlatform(null);
    setPendingTime(DEFAULT_PENDING_TIME);
  }, []);

  const handleAddTime = useCallback(() => {
    if (!timePopoverPlatform || !pendingTime) {
      return;
    }

    updatePreference(timePopoverPlatform, (preference) => ({
      ...preference,
      optimal_times: Array.from(
        new Set([...(preference.optimal_times ?? []), pendingTime]),
      ).sort((left, right) => left.localeCompare(right)),
    }));

    handleCloseAddTime();
  }, [handleCloseAddTime, pendingTime, timePopoverPlatform, updatePreference]);

  const handleSavePreferences = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    try {
      setIsSavingPreferences(true);
      setSaveSucceeded(false);

      const upsertPayload = normalizedPreferences.map((preference) =>
        toSchedulingPreferenceUpsert(preference, user.id),
      );

      const { data, error } = await supabase
        .from("scheduling_preferences")
        .upsert(upsertPayload, { onConflict: "user_id,platform" })
        .select("*");

      if (error) {
        throw error;
      }

      const persistedPreferences =
        data && data.length > 0
          ? ensurePlatformCoverage(
              user.id,
              data.map((preference) =>
                normalizePreference(preference, user.id),
              ),
            )
          : normalizedPreferences;

      persistPreferences(user.id, persistedPreferences);
      setPreferences(persistedPreferences);
      setSaveSucceeded(true);
    } catch (error) {
      console.error("Error saving scheduling preferences:", error);
      persistPreferences(user.id, normalizedPreferences);
      setPreferences(normalizedPreferences);
      toast.error("Saved locally, but failed to sync preferences.");
    } finally {
      setIsSavingPreferences(false);
    }
  }, [normalizedPreferences, user]);

  const scheduleOptimalPosts = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    try {
      setIsGeneratingSchedule(true);

      const { error } = await supabase.functions.invoke(
        "schedule-optimal-posts",
        {
          body: {
            userId: user.id,
            preferences: normalizedPreferences.map((preference) => ({
              ...preference,
              optimal_times: normalizeTimes(preference.optimal_times),
              frequency: normalizeFrequency(preference.frequency),
            })),
          },
        },
      );

      if (error) {
        throw error;
      }

      toast.success("Posts scheduled for optimal times.");
    } catch (error) {
      console.error("Error scheduling optimal posts:", error);
      toast.error("Failed to schedule posts.");
    } finally {
      setIsGeneratingSchedule(false);
    }
  }, [normalizedPreferences, user]);

  const createDefaultsAndHydrate = useCallback(() => {
    if (!user?.id) {
      return;
    }

    const defaultPreferences = createDefaultPreferences(user.id);
    persistPreferences(user.id, defaultPreferences);
    setPreferences(defaultPreferences);
  }, [user]);

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        alignItems={{ xs: "flex-start", sm: "center" }}
        justifyContent="space-between"
      >
        <Stack spacing={0.5} sx={{ maxWidth: 720 }}>
          <Typography level="title-lg" sx={{ fontWeight: "lg" }}>
            Auto-Scheduling
          </Typography>
          <Typography level="body-sm" sx={{ color: "text.secondary" }}>
            Configure when BloomSuite automatically publishes your scheduled
            posts for optimal engagement.
          </Typography>
        </Stack>

        <Button
          variant="soft"
          color="neutral"
          size="sm"
          startDecorator={<Sparkles size={14} />}
          loading={isGeneratingSchedule}
          onClick={() => {
            void scheduleOptimalPosts();
          }}
        >
          Generate Schedule
        </Button>
      </Stack>

      {loading ? (
        <Stack spacing={2}>
          {DISPLAY_PLATFORM_ORDER.map((platform) => (
            <SchedulerSkeletonCard key={platform} />
          ))}
        </Stack>
      ) : visiblePreferences.length === 0 ? (
        <Sheet
          variant="outlined"
          sx={{
            borderRadius: "xl",
            borderColor: "divider",
            bgcolor: "background.surface",
            px: 3,
            py: 5,
          }}
        >
          <Stack spacing={2} alignItems="center" textAlign="center">
            <Typography level="title-md">No scheduling preferences</Typography>
            <Typography level="body-sm" sx={{ color: "text.secondary" }}>
              Configure your posting schedule for Facebook and Instagram.
            </Typography>
            <Button
              variant="solid"
              color="primary"
              onClick={createDefaultsAndHydrate}
            >
              Configure Scheduling
            </Button>
          </Stack>
        </Sheet>
      ) : (
        <>
          <Stack spacing={2}>
            {visiblePreferences.map((preference) => {
              const resolvedPlatform = resolvePlatformKey(preference.platform);

              if (
                resolvedPlatform !== "facebook" &&
                resolvedPlatform !== "instagram"
              ) {
                return null;
              }

              const platform = getPlatformConfig(preference.platform);
              const PlatformIcon = platform.icon;
              const timeSlots = normalizeTimes(preference.optimal_times);

              return (
                <Card
                  key={preference.platform}
                  variant="outlined"
                  sx={{
                    borderRadius: "lg",
                    p: 3,
                    borderColor: "divider",
                    boxShadow: "sm",
                    bgcolor: "background.surface",
                  }}
                >
                  <Stack spacing={2.5}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1.5}
                      justifyContent="space-between"
                      alignItems={{ xs: "flex-start", sm: "center" }}
                    >
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Avatar
                          size="sm"
                          sx={{ bgcolor: platform.color, color: "#FFFFFF" }}
                        >
                          <PlatformIcon size={16} />
                        </Avatar>
                        <Typography level="title-md" sx={{ fontWeight: "lg" }}>
                          {platform.label}
                        </Typography>
                      </Stack>

                      <Stack
                        direction="row"
                        spacing={2}
                        alignItems="center"
                        justifyContent="space-between"
                        sx={{ width: { xs: "100%", sm: "auto" } }}
                      >
                        <Typography level="body-sm">
                          Enable auto-scheduling
                        </Typography>
                        <Switch
                          size="sm"
                          checked={preference.enabled}
                          onChange={(event) => {
                            handleToggleEnabled(
                              preference.platform,
                              event.target.checked,
                            );
                          }}
                        />
                      </Stack>
                    </Stack>

                    {preference.enabled ? (
                      <Stack spacing={2.5}>
                        <Stack spacing={1.25}>
                          <Typography level="title-sm" sx={{ mt: 0.5 }}>
                            Optimal Posting Times
                          </Typography>
                          <Stack
                            direction="row"
                            spacing={1}
                            useFlexGap
                            flexWrap="wrap"
                          >
                            {timeSlots.map((timeValue) => (
                              <Chip
                                key={`${preference.platform}-${timeValue}`}
                                variant="soft"
                                color="primary"
                                size="md"
                                endDecorator={
                                  <IconButton
                                    size="sm"
                                    variant="plain"
                                    color="primary"
                                    disabled={timeSlots.length <= 1}
                                    onClick={() => {
                                      handleRemoveTime(
                                        preference.platform,
                                        timeValue,
                                      );
                                    }}
                                  >
                                    <X size={12} />
                                  </IconButton>
                                }
                                sx={{ borderRadius: "999px" }}
                              >
                                {formatTimeSlot(timeValue)}
                              </Chip>
                            ))}
                          </Stack>
                          <Popover
                            open={timePopoverPlatform === resolvedPlatform}
                            onOpenChange={(open) => {
                              if (open) {
                                setPendingTime(DEFAULT_PENDING_TIME);
                                setTimePopoverPlatform(resolvedPlatform);
                                return;
                              }

                              if (timePopoverPlatform === resolvedPlatform) {
                                handleCloseAddTime();
                              }
                            }}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                variant="plain"
                                color="primary"
                                size="sm"
                                startDecorator={<Plus size={14} />}
                                sx={{ alignSelf: "flex-start", px: 0 }}
                              >
                                Add time
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              align="start"
                              className="w-[240px] p-0"
                            >
                              <Stack spacing={1.5} sx={{ p: 1.5 }}>
                                <Typography level="title-sm">
                                  Add posting time
                                </Typography>
                                <Input
                                  type="time"
                                  value={pendingTime}
                                  onChange={(event) =>
                                    setPendingTime(event.target.value)
                                  }
                                  size="sm"
                                />
                                <Stack
                                  direction="row"
                                  spacing={1}
                                  justifyContent="flex-end"
                                >
                                  <Button
                                    variant="plain"
                                    color="neutral"
                                    size="sm"
                                    onClick={handleCloseAddTime}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    variant="solid"
                                    color="primary"
                                    size="sm"
                                    onClick={handleAddTime}
                                  >
                                    Add
                                  </Button>
                                </Stack>
                              </Stack>
                            </PopoverContent>
                          </Popover>
                        </Stack>

                        <Stack spacing={1}>
                          <Typography level="title-sm" sx={{ mt: 0.5 }}>
                            Frequency
                          </Typography>
                          <Select
                            variant="outlined"
                            size="sm"
                            value={preference.frequency}
                            onChange={(_event, value) => {
                              if (!value) {
                                return;
                              }

                              handleFrequencyChange(preference.platform, value);
                            }}
                            sx={{ maxWidth: 240 }}
                          >
                            {FREQUENCY_OPTIONS.map((option) => (
                              <Option key={option.value} value={option.value}>
                                {option.label}
                              </Option>
                            ))}
                          </Select>
                          <Typography
                            level="body-xs"
                            sx={{ color: "text.tertiary" }}
                          >
                            How often to auto-publish for this platform.
                          </Typography>
                        </Stack>
                      </Stack>
                    ) : null}
                  </Stack>
                </Card>
              );
            })}
          </Stack>

          {!hasEnabledVisiblePlatform ? (
            <Alert variant="soft" color="neutral" size="sm">
              Enable auto-scheduling for at least one platform to automatically
              publish your scheduled content at optimal times.
            </Alert>
          ) : null}

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", sm: "center" }}
          >
            <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
              Preferences sync to your account and stay cached in this browser
              for fallback.
            </Typography>

            <Button
              variant="solid"
              color="primary"
              size="md"
              loading={isSavingPreferences}
              onClick={() => {
                void handleSavePreferences();
              }}
              sx={{ width: { xs: "100%", sm: "auto" }, mt: { xs: 1, sm: 0 } }}
            >
              {saveSucceeded ? "Saved ✓" : "Save Preferences"}
            </Button>
          </Stack>
        </>
      )}
    </Stack>
  );
};

export default AutoScheduler;
