import { useCallback, useEffect, useMemo, useState } from "react";
import Box from "@mui/joy/Box";
import Option from "@mui/joy/Option";
import Select from "@mui/joy/Select";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Switch from "@mui/joy/Switch";
import Typography from "@mui/joy/Typography";
import { format, parse } from "date-fns";
import { Calendar, Clock3, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyChip } from "@/components/joy/JoyChip";
import { JoyEmptyState } from "@/components/joy/JoyEmptyState";
import { supabase } from "@/integrations/supabase/client";
import {
  PLATFORM_ORDER,
  getPlatformConfig,
  resolvePlatformKey,
  type PlatformKey,
} from "@/utils/platformConfig";

interface SchedulingPreference {
  id: string;
  user_id: string;
  platform: string;
  enabled: boolean;
  optimal_times: string[];
  frequency: string;
  created_at: string;
  updated_at: string;
}

type PreferenceField = "enabled" | "frequency";
type SavingContext = "preferences" | "schedule" | null;
type PostgrestLikeError = {
  code?: string;
};

type UntypedSupabaseClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string,
      ) => {
        order: (
          column: string,
          options: { ascending: boolean },
        ) => Promise<{ data: SchedulingPreference[] | null; error: unknown }>;
      };
    };
  };
};

const DEFAULT_OPTIMAL_TIMES = ["12:00", "18:00"];

const FREQUENCY_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly", label: "Monthly" },
];

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

const createDefaultPreferences = (userId: string) =>
  PLATFORM_ORDER.map((platform) => createDefaultPreference(userId, platform));

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
    optimal_times:
      Array.isArray(preference.optimal_times) &&
      preference.optimal_times.length > 0
        ? preference.optimal_times
        : [...DEFAULT_OPTIMAL_TIMES],
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

  return PLATFORM_ORDER.map(
    (platform) =>
      preferencesByPlatform.get(platform) ??
      createDefaultPreference(userId, platform),
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

const waitForNextFrame = () =>
  new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
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

const shimmerSx = {
  position: "relative",
  overflow: "hidden",
  bgcolor: "background.surface",
  "&::after": {
    content: '""',
    position: "absolute",
    inset: 0,
    transform: "translateX(-100%)",
    background:
      "linear-gradient(90deg, rgba(var(--joy-palette-neutral-mainChannel) / 0.04) 0%, rgba(var(--joy-palette-neutral-mainChannel) / 0.12) 50%, rgba(var(--joy-palette-neutral-mainChannel) / 0.04) 100%)",
    animation: "autoSchedulerShimmer 1.35s ease-in-out infinite",
  },
  "@keyframes autoSchedulerShimmer": {
    to: {
      transform: "translateX(100%)",
    },
  },
} as const;

const blockSx = {
  borderRadius: "sm",
  bgcolor: "rgba(var(--joy-palette-neutral-mainChannel) / 0.08)",
} as const;

const SchedulerSkeletonCard = () => {
  return (
    <Sheet
      variant="outlined"
      sx={{
        ...shimmerSx,
        borderRadius: "md",
        p: 2,
      }}
    >
      <Stack spacing={2}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Stack direction="row" spacing={1.25} alignItems="center">
            <Box
              sx={{ ...blockSx, width: 20, height: 20, borderRadius: 999 }}
            />
            <Box sx={{ ...blockSx, width: 120, height: 14 }} />
          </Stack>
          <Box sx={{ ...blockSx, width: 36, height: 20, borderRadius: 999 }} />
        </Stack>
        <Stack spacing={1.5}>
          <Stack spacing={0.75}>
            <Box sx={{ ...blockSx, width: 110, height: 12 }} />
            <Box
              sx={{ ...blockSx, width: 160, height: 34, borderRadius: "md" }}
            />
          </Stack>
          <Stack spacing={0.75}>
            <Box sx={{ ...blockSx, width: 80, height: 12 }} />
            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
              <Box
                sx={{ ...blockSx, width: 88, height: 26, borderRadius: 999 }}
              />
              <Box
                sx={{ ...blockSx, width: 88, height: 26, borderRadius: 999 }}
              />
            </Stack>
          </Stack>
        </Stack>
      </Stack>
    </Sheet>
  );
};

export const AutoScheduler: React.FC = () => {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<SchedulingPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingContext, setSavingContext] = useState<SavingContext>(null);

  const fetchPreferences = useCallback(async () => {
    if (!user?.id) {
      setPreferences([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const remoteClient = supabase as unknown as UntypedSupabaseClient;
      const { data, error } = await remoteClient
        .from("scheduling_preferences")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        setPreferences(
          ensurePlatformCoverage(
            user.id,
            data.map((preference) => normalizePreference(preference, user.id)),
          ),
        );
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

  const updatePreference = useCallback(
    async (
      platform: string,
      field: PreferenceField,
      value: boolean | string,
    ) => {
      if (!user?.id) {
        return;
      }

      setSaving(true);
      setSavingContext("preferences");

      try {
        await waitForNextFrame();

        const updatedPreferences = preferences.map((preference) =>
          preference.platform === platform
            ? {
                ...preference,
                [field]: value,
                updated_at: new Date().toISOString(),
              }
            : preference,
        );

        persistPreferences(user.id, updatedPreferences);
        setPreferences(updatedPreferences);
        toast.success("Scheduling preferences updated.");
      } catch (error) {
        console.error("Error updating scheduling preference:", error);
        toast.error("Failed to update preferences.");
      } finally {
        window.setTimeout(() => {
          setSaving(false);
          setSavingContext(null);
        }, 180);
      }
    },
    [preferences, user],
  );

  const scheduleOptimalPosts = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    setSaving(true);
    setSavingContext("schedule");

    try {
      const { error } = await supabase.functions.invoke(
        "schedule-optimal-posts",
        {
          body: {
            userId: user.id,
            preferences,
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
      setSaving(false);
      setSavingContext(null);
    }
  }, [preferences, user]);

  const sortedPreferences = useMemo(() => {
    const orderIndex = new Map(
      PLATFORM_ORDER.map((platform, index) => [platform, index]),
    );

    return [...preferences].sort((left, right) => {
      if (left.enabled !== right.enabled) {
        return left.enabled ? -1 : 1;
      }

      const leftKey = resolvePlatformKey(left.platform) ?? "facebook";
      const rightKey = resolvePlatformKey(right.platform) ?? "facebook";

      return (orderIndex.get(leftKey) ?? 0) - (orderIndex.get(rightKey) ?? 0);
    });
  }, [preferences]);

  const createDefaultsAndHydrate = useCallback(() => {
    if (!user?.id) {
      return;
    }

    const defaultPreferences = createDefaultPreferences(user.id);
    persistPreferences(user.id, defaultPreferences);
    setPreferences(defaultPreferences);
  }, [user]);

  const isPreferenceSaving = saving && savingContext === "preferences";
  const isGeneratingSchedule = saving && savingContext === "schedule";

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", lg: "row" }}
        spacing={2}
        alignItems={{ xs: "flex-start", lg: "center" }}
        justifyContent="space-between"
      >
        <Stack spacing={0.5}>
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            useFlexGap
            flexWrap="wrap"
          >
            <Typography level="title-md">Auto-Scheduling</Typography>
            <JoyChip
              color="neutral"
              size="sm"
              variant="soft"
              sx={{
                opacity: isPreferenceSaving ? 1 : 0,
                transform: isPreferenceSaving
                  ? "translateY(0)"
                  : "translateY(-2px)",
                transition: "opacity 160ms ease, transform 160ms ease",
                pointerEvents: "none",
              }}
            >
              Saving...
            </JoyChip>
          </Stack>
          <Typography level="body-sm" sx={{ color: "text.secondary" }}>
            Set posting schedules and let BloomSuite optimize delivery.
          </Typography>
        </Stack>

        <JoyButton
          color="primary"
          loading={isGeneratingSchedule}
          loadingPosition="start"
          size="sm"
          startDecorator={<Sparkles size={14} />}
          variant="solid"
          onClick={() => {
            void scheduleOptimalPosts();
          }}
        >
          Generate Schedule
        </JoyButton>
      </Stack>

      {loading ? (
        <Stack spacing={1.5}>
          {PLATFORM_ORDER.map((platformKey) => (
            <SchedulerSkeletonCard key={platformKey} />
          ))}
        </Stack>
      ) : sortedPreferences.length === 0 ? (
        <Sheet
          variant="outlined"
          sx={{ borderRadius: "md", bgcolor: "background.surface" }}
        >
          <JoyEmptyState
            icon={
              <Box
                sx={{
                  color: "text.tertiary",
                  display: "inline-flex",
                  "& > .lucide": {
                    width: 32,
                    height: 32,
                  },
                }}
              >
                <Calendar />
              </Box>
            }
            title="No scheduling preferences"
            description="Configure your posting schedule."
            primaryAction={{
              label: "Configure Scheduling",
              size: "sm",
              variant: "solid",
              onClick: createDefaultsAndHydrate,
            }}
          />
        </Sheet>
      ) : (
        <Stack spacing={1.5}>
          {sortedPreferences.map((preference) => {
            const platform = getPlatformConfig(preference.platform);
            const PlatformIcon = platform.icon;

            return (
              <Sheet
                key={preference.platform}
                variant="outlined"
                sx={{
                  borderRadius: "md",
                  p: 2,
                  bgcolor: "background.surface",
                  boxShadow: "none",
                }}
              >
                <Stack spacing={1.5}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 2,
                    }}
                  >
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <Box
                        sx={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: platform.color,
                          flexShrink: 0,
                        }}
                      >
                        <PlatformIcon size={20} strokeWidth={1.9} />
                      </Box>
                      <Typography level="title-sm">{platform.label}</Typography>
                    </Stack>

                    <Switch
                      checked={preference.enabled}
                      disabled={saving}
                      size="sm"
                      onChange={(event) => {
                        void updatePreference(
                          preference.platform,
                          "enabled",
                          event.target.checked,
                        );
                      }}
                    />
                  </Box>

                  <Box
                    sx={{
                      mt: 0.25,
                      opacity: preference.enabled ? 1 : 0.4,
                      pointerEvents: preference.enabled ? "auto" : "none",
                      transition: "opacity 180ms ease",
                    }}
                  >
                    <Stack spacing={1.5}>
                      <Box
                        sx={{
                          display: "flex",
                          flexDirection: { xs: "column", sm: "row" },
                          alignItems: { sm: "center" },
                          justifyContent: "space-between",
                          gap: 1,
                        }}
                      >
                        <Typography
                          level="body-xs"
                          sx={{ color: "text.secondary" }}
                        >
                          Posting frequency
                        </Typography>
                        <Select
                          disabled={!preference.enabled || saving}
                          size="sm"
                          value={preference.frequency}
                          variant="outlined"
                          sx={{ minWidth: 140 }}
                          onChange={(_event, value) => {
                            if (!value) {
                              return;
                            }

                            void updatePreference(
                              preference.platform,
                              "frequency",
                              value,
                            );
                          }}
                        >
                          {FREQUENCY_OPTIONS.map((option) => (
                            <Option key={option.value} value={option.value}>
                              {option.label}
                            </Option>
                          ))}
                        </Select>
                      </Box>

                      <Stack spacing={0.75}>
                        <Typography
                          level="body-xs"
                          sx={{ color: "text.secondary" }}
                        >
                          Optimal times
                        </Typography>
                        <Box
                          sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}
                        >
                          {(preference.optimal_times?.length
                            ? preference.optimal_times
                            : DEFAULT_OPTIMAL_TIMES
                          ).map((timeValue) => (
                            <JoyChip
                              key={`${preference.platform}-${timeValue}`}
                              color="neutral"
                              size="sm"
                              startDecorator={<Clock3 size={12} />}
                              variant="outlined"
                            >
                              {formatTimeSlot(timeValue)}
                            </JoyChip>
                          ))}
                        </Box>
                      </Stack>
                    </Stack>
                  </Box>
                </Stack>
              </Sheet>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
};

export default AutoScheduler;
