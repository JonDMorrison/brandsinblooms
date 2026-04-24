import { useCallback, useEffect, useState } from "react";
import Box from "@mui/joy/Box";
import Divider from "@mui/joy/Divider";
import FormControl from "@mui/joy/FormControl";
import FormHelperText from "@mui/joy/FormHelperText";
import FormLabel from "@mui/joy/FormLabel";
import Option from "@mui/joy/Option";
import Select from "@mui/joy/Select";
import Skeleton from "@mui/joy/Skeleton";
import Slider from "@mui/joy/Slider";
import Stack from "@mui/joy/Stack";
import Switch from "@mui/joy/Switch";
import Typography from "@mui/joy/Typography";
import { Bell, Mail, MessageSquare, RefreshCw, Shield } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyCard } from "@/components/joy/JoyCard";
import { JoyChip } from "@/components/joy/JoyChip";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { SettingsInlineError } from "./SettingsSurface";

interface UsageAlertSettingsState {
  email_warning_threshold: number;
  email_critical_threshold: number;
  sms_warning_threshold: number;
  sms_critical_threshold: number;
  email_notifications_enabled: boolean;
  in_app_notifications_enabled: boolean;
  auto_pause_at_limit: boolean;
  pos_sync_frequency: string;
}

const defaultSettings: UsageAlertSettingsState = {
  email_warning_threshold: 80,
  email_critical_threshold: 100,
  sms_warning_threshold: 80,
  sms_critical_threshold: 100,
  email_notifications_enabled: true,
  in_app_notifications_enabled: true,
  auto_pause_at_limit: false,
  pos_sync_frequency: "auto",
};

const settingsCardSx = {
  p: 3,
  gap: 2.5,
  boxShadow: "none",
  bgcolor: "background.surface",
};

const sliderMarks = [
  { value: 50, label: "50%" },
  { value: 75, label: "75%" },
  { value: 100, label: "100%" },
];

const getSliderValue = (value: number | number[]) =>
  Array.isArray(value) ? value[0] : value;

const LoadingState = () => {
  return (
    <Stack spacing={3}>
      {[120, 200, 100].map((height, index) => (
        <JoyCard key={index} sx={settingsCardSx} variant="outlined">
          <Skeleton animation="wave" sx={{ height, borderRadius: "18px" }} variant="rectangular" />
        </JoyCard>
      ))}
    </Stack>
  );
};

const SwitchRow = ({
  title,
  helper,
  checked,
  onChange,
}: {
  title: string;
  helper: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) => {
  return (
    <Stack spacing={1.25}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
      >
        <Stack spacing={0.5} sx={{ minWidth: 0 }}>
          <Typography level="title-sm">{title}</Typography>
          <Typography level="body-sm" sx={{ color: "text.secondary" }}>
            {helper}
          </Typography>
        </Stack>
        <Switch checked={checked} onChange={(event) => onChange(event.target.checked)} />
      </Stack>
    </Stack>
  );
};

const ThresholdSliderField = ({
  label,
  helper,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  helper: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) => {
  return (
    <FormControl>
      <Stack direction="row" justifyContent="space-between" spacing={2} alignItems="center">
        <FormLabel>{label}</FormLabel>
        <JoyChip color="neutral" size="sm" variant="soft">
          {value}%
        </JoyChip>
      </Stack>
      <Slider
        color="neutral"
        marks={sliderMarks}
        max={max}
        min={min}
        onChange={(_, nextValue) => onChange(getSliderValue(nextValue))}
        size="sm"
        step={5}
        value={value}
        valueLabelDisplay="off"
      />
      <FormHelperText>{helper}</FormHelperText>
    </FormControl>
  );
};

export function UsageAlertSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<UsageAlertSettingsState>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      const { data, error } = await supabase
        .from("usage_alert_settings")
        .select("*")
        .eq("user_id", user?.id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (data) {
        setSettings({
          email_warning_threshold: data.email_warning_threshold,
          email_critical_threshold: data.email_critical_threshold,
          sms_warning_threshold: data.sms_warning_threshold,
          sms_critical_threshold: data.sms_critical_threshold,
          email_notifications_enabled: data.email_notifications_enabled,
          in_app_notifications_enabled: data.in_app_notifications_enabled,
          auto_pause_at_limit: data.auto_pause_at_limit,
          pos_sync_frequency: data.pos_sync_frequency,
        });
      } else {
        setSettings(defaultSettings);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
      setLoadError("Failed to load alert settings.");
      setSettings(defaultSettings);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const updateSettings = <Key extends keyof UsageAlertSettingsState>(
    key: Key,
    value: UsageAlertSettingsState[Key],
  ) => {
    setSettings((previous) => ({ ...previous, [key]: value }));
  };

  const handleEmailWarningChange = (value: number) => {
    setSettings((previous) => ({
      ...previous,
      email_warning_threshold: value,
      email_critical_threshold: Math.max(previous.email_critical_threshold, value),
    }));
  };

  const handleEmailCriticalChange = (value: number) => {
    setSettings((previous) => ({
      ...previous,
      email_critical_threshold: Math.max(value, previous.email_warning_threshold),
    }));
  };

  const handleSmsWarningChange = (value: number) => {
    setSettings((previous) => ({
      ...previous,
      sms_warning_threshold: value,
      sms_critical_threshold: Math.max(previous.sms_critical_threshold, value),
    }));
  };

  const handleSmsCriticalChange = (value: number) => {
    setSettings((previous) => ({
      ...previous,
      sms_critical_threshold: Math.max(value, previous.sms_warning_threshold),
    }));
  };

  const saveSettings = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      // Get tenant_id from users table
      const { data: userData } = await supabase
        .from("users")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      const { error } = await supabase
        .from("usage_alert_settings")
        .upsert({
          user_id: user.id,
          tenant_id: userData?.tenant_id,
          ...settings,
        }, { 
          onConflict: "tenant_id,user_id" 
        });

      if (error) throw error;
      toast.success("Alert settings saved");
    } catch (error: unknown) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save alert settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState />;
  }

  return (
    <Stack spacing={3}>
      {loadError ? (
        <SettingsInlineError message={loadError} onRetry={() => void loadSettings()} />
      ) : null}

      <JoyCard sx={settingsCardSx} variant="outlined">
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: "14px",
              display: "grid",
              placeItems: "center",
              bgcolor: "background.level1",
              color: "text.secondary",
            }}
          >
            <Bell size={18} />
          </Box>
          <Typography fontWeight={600} level="title-md">
            Notifications
          </Typography>
        </Stack>

        <SwitchRow
          checked={settings.email_notifications_enabled}
          helper="Receive email alerts when usage approaches thresholds"
          onChange={(checked) => updateSettings("email_notifications_enabled", checked)}
          title="Email notifications"
        />
        <Divider />
        <SwitchRow
          checked={settings.in_app_notifications_enabled}
          helper="Show banner alerts inside the dashboard"
          onChange={(checked) => updateSettings("in_app_notifications_enabled", checked)}
          title="In-app notifications"
        />
      </JoyCard>

      <JoyCard sx={settingsCardSx} variant="outlined">
        <Typography fontWeight={600} level="title-md">
          Alert Thresholds
        </Typography>

        <Stack spacing={2.5}>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1.25} alignItems="center">
              <Mail size={18} />
              <Typography level="title-sm">Email Usage</Typography>
            </Stack>
            <ThresholdSliderField
              helper="Send a warning when email usage reaches this percentage of the current plan limit."
              label="Warning at"
              max={100}
              min={50}
              onChange={handleEmailWarningChange}
              value={settings.email_warning_threshold}
            />
            <ThresholdSliderField
              helper="Critical alerts are always kept at or above the warning threshold."
              label="Critical at"
              max={100}
              min={80}
              onChange={handleEmailCriticalChange}
              value={settings.email_critical_threshold}
            />
          </Stack>

          <Divider />

          <Stack spacing={2}>
            <Stack direction="row" spacing={1.25} alignItems="center">
              <MessageSquare size={18} />
              <Typography level="title-sm">SMS Usage</Typography>
            </Stack>
            <ThresholdSliderField
              helper="Send a warning when SMS usage reaches this percentage of the current plan limit."
              label="Warning at"
              max={100}
              min={50}
              onChange={handleSmsWarningChange}
              value={settings.sms_warning_threshold}
            />
            <ThresholdSliderField
              helper="Critical alerts are always kept at or above the warning threshold."
              label="Critical at"
              max={100}
              min={80}
              onChange={handleSmsCriticalChange}
              value={settings.sms_critical_threshold}
            />
          </Stack>
        </Stack>
      </JoyCard>

      <JoyCard sx={settingsCardSx} variant="outlined">
        <Typography fontWeight={600} level="title-md">
          Sync & Budget Controls
        </Typography>

        <Stack spacing={2.5}>
          <FormControl>
            <FormLabel>POS sync frequency</FormLabel>
            <Select
              onChange={(_, value) => {
                if (value) {
                  updateSettings("pos_sync_frequency", value);
                }
              }}
              value={settings.pos_sync_frequency}
            >
              <Option value="auto">Auto</Option>
              <Option value="realtime">Real-time</Option>
              <Option value="hourly">Hourly</Option>
              <Option value="daily">Daily</Option>
              <Option value="manual">Manual</Option>
            </Select>
            <FormHelperText>
              How often BloomSuite syncs with your POS system.
            </FormHelperText>
          </FormControl>

          <Divider />

          <SwitchRow
            checked={settings.auto_pause_at_limit}
            helper="Automatically pause sending when usage reaches 100% to prevent overage charges"
            onChange={(checked) => updateSettings("auto_pause_at_limit", checked)}
            title="Auto-pause at limit"
          />
        </Stack>
      </JoyCard>

      <JoyButton
        disabled={!user}
        fullWidth
        loading={saving}
        onClick={() => void saveSettings()}
        size="md"
        variant="solid"
      >
        Save Alert Settings
      </JoyButton>
    </Stack>
  );
}
