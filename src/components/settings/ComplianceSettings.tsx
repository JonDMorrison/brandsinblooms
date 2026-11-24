import React, { useEffect, useState } from "react";
import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import FormControl from "@mui/joy/FormControl";
import FormHelperText from "@mui/joy/FormHelperText";
import FormLabel from "@mui/joy/FormLabel";
import Input from "@mui/joy/Input";
import Option from "@mui/joy/Option";
import Select from "@mui/joy/Select";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Switch from "@mui/joy/Switch";
import Textarea from "@mui/joy/Textarea";
import Typography from "@mui/joy/Typography";
import { Clock, Database, FileText, MessageSquare, Shield } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyChip } from "@/components/joy/JoyChip";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/hooks/useTenant";
import { useTenantComplianceSettings } from "@/hooks/useTenantComplianceSettings";
import {
  COMPLIANCE_SETTING_ENFORCED,
  DEFAULT_COMPLIANCE_SETTINGS,
  applyEnforcement,
  type ComplianceSettingsState,
  type DataHandlingMode,
} from "@/lib/complianceSettings";
import { SettingsSectionCard } from "./SettingsSurface";

interface ComplianceSettingsProps {
  onUpdate?: () => void;
}

type ComplianceState = ComplianceSettingsState;

const NOT_AVAILABLE_NOTE =
  "Not available yet. Nothing in BloomSuite enforces this setting today, so it stays off.";

const NotAvailableChip = () => (
  <JoyChip size="sm" variant="soft" color="neutral">
    Not available yet
  </JoyChip>
);

const ToggleRow = ({
  title,
  description,
  checked,
  onChange,
  available,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  available: boolean;
}) => {
  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      spacing={2}
      justifyContent="space-between"
      alignItems={{ xs: "flex-start", md: "center" }}
    >
      <Stack spacing={0.5} sx={{ minWidth: 0 }}>
        <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
          <Typography level="title-sm">{title}</Typography>
          {available ? null : <NotAvailableChip />}
        </Stack>
        <Typography level="body-sm" sx={{ color: "text.secondary" }}>
          {description}
        </Typography>
        {available ? null : (
          <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
            {NOT_AVAILABLE_NOTE}
          </Typography>
        )}
      </Stack>
      <Switch
        checked={available ? checked : false}
        disabled={!available}
        onChange={(event) => onChange(event.target.checked)}
        slotProps={{ input: { "aria-label": title } }}
      />
    </Stack>
  );
};

export const ComplianceSettings = ({
  onUpdate,
}: ComplianceSettingsProps = {}) => {
  const { tenant, loading: tenantLoading } = useTenant();
  const tenantId = tenant?.id ?? null;
  const { query, mutation } = useTenantComplianceSettings(tenantId);
  const [settings, setSettings] = useState<ComplianceState>(
    DEFAULT_COMPLIANCE_SETTINGS,
  );

  // Load the saved settings once they arrive (and again after a tenant switch).
  useEffect(() => {
    if (query.data) {
      setSettings(query.data);
    }
  }, [query.data]);

  const isSaving = mutation.isPending;
  const isLoading = tenantLoading || (Boolean(tenantId) && query.isLoading);
  const enforced = COMPLIANCE_SETTING_ENFORCED;

  const { toast } = useToast();

  const handleSettingChange = <Key extends keyof ComplianceState>(
    key: Key,
    value: ComplianceState[Key],
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    try {
      const saved = await mutation.mutateAsync(applyEnforcement(settings));
      setSettings(saved);
      toast({
        title: "Settings saved",
        description: "Your compliance settings have been saved for this workspace.",
      });
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      toast({
        title: "Could not save settings",
        description:
          error instanceof Error && error.message
            ? error.message
            : "Please try again.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <Stack spacing={3} aria-busy="true">
        <Skeleton variant="text" width={240} />
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton
            key={index}
            variant="rectangular"
            height={140}
            sx={{ borderRadius: "var(--joy-radius-lg)" }}
          />
        ))}
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
      >
        <Stack spacing={0.75}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <Shield size={18} />
            <Typography level="title-lg">Compliance & Privacy</Typography>
          </Stack>
          <Typography level="body-sm" sx={{ color: "text.secondary", maxWidth: 760 }}>
            Configure messaging consent, quiet hours, retention defaults, and
            privacy copy for this workspace. Settings marked "Not available
            yet" are not enforced anywhere today, so they stay off.
          </Typography>
        </Stack>

        <JoyButton
          loading={isSaving}
          disabled={!tenantId}
          onClick={() => void handleSave()}
        >
          Save Changes
        </JoyButton>
      </Stack>

      {!tenantId ? (
        <Alert color="warning" variant="soft">
          Select a workspace before changing compliance settings.
        </Alert>
      ) : null}
      {query.isError ? (
        <Alert color="danger" variant="soft">
          Saved compliance settings could not be loaded. Showing defaults; saving
          will overwrite them.
        </Alert>
      ) : null}

      <SettingsSectionCard
        description="Define the consent rules required before sending customer communications."
        startDecorator={<MessageSquare size={18} />}
        title="Consent & Messaging"
      >
        <Stack spacing={2.5}>
          <ToggleRow
            available={enforced.doubleOptInRequired}
            checked={settings.doubleOptInRequired}
            description="Require customers to confirm consent before they can receive campaign messages."
            onChange={(checked) => handleSettingChange("doubleOptInRequired", checked)}
            title="Require double opt-in"
          />
          <ToggleRow
            available={enforced.ageVerificationRequired}
            checked={settings.ageVerificationRequired}
            description="Ask for age confirmation before collecting opt-in consent on promotional workflows."
            onChange={(checked) => handleSettingChange("ageVerificationRequired", checked)}
            title="Require age verification"
          />
          <ToggleRow
            available={enforced.includeOptOutInstructions}
            checked={settings.includeOptOutInstructions}
            description="Append opt-out instructions to outbound campaign messages by default."
            onChange={(checked) => handleSettingChange("includeOptOutInstructions", checked)}
            title="Include opt-out instructions"
          />

          {settings.includeOptOutInstructions ? (
            <FormControl disabled={!enforced.optOutInstructions}>
              <FormLabel>Opt-out instructions</FormLabel>
              <Textarea
                minRows={3}
                onChange={(event) =>
                  handleSettingChange("optOutInstructions", event.target.value)
                }
                placeholder="Reply STOP to unsubscribe."
                value={settings.optOutInstructions}
              />
              <FormHelperText>
                Saved with your workspace settings.
              </FormHelperText>
            </FormControl>
          ) : null}
        </Stack>
      </SettingsSectionCard>

      <SettingsSectionCard
        description="Pause outbound communication during protected sending windows."
        startDecorator={<Clock size={18} />}
        title="Quiet Hours"
      >
        <Stack spacing={2.5}>
          <ToggleRow
            available={enforced.quietHoursEnabled}
            checked={settings.quietHoursEnabled}
            description="Prevent messages from being sent during the configured quiet-hours window."
            onChange={(checked) => handleSettingChange("quietHoursEnabled", checked)}
            title="Enable quiet hours"
          />

          {settings.quietHoursEnabled ? (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "minmax(0, 1fr)",
                  md: "repeat(2, minmax(0, 1fr))",
                },
                gap: 2,
              }}
            >
              <FormControl>
                <FormLabel>Start time</FormLabel>
                <Input
                  onChange={(event) =>
                    handleSettingChange("quietHoursStart", event.target.value)
                  }
                  type="time"
                  value={settings.quietHoursStart}
                />
              </FormControl>
              <FormControl>
                <FormLabel>End time</FormLabel>
                <Input
                  onChange={(event) =>
                    handleSettingChange("quietHoursEnd", event.target.value)
                  }
                  type="time"
                  value={settings.quietHoursEnd}
                />
              </FormControl>
            </Box>
          ) : null}
        </Stack>
      </SettingsSectionCard>

      <SettingsSectionCard
        description="Choose how long data is retained and what happens after the retention window expires."
        startDecorator={<Database size={18} />}
        title="Data Handling"
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "minmax(0, 1fr)",
              md: "repeat(2, minmax(0, 1fr))",
            },
            gap: 2,
          }}
        >
          <FormControl disabled={!enforced.dataRetentionDays}>
            <FormLabel>Retention window (days)</FormLabel>
            <Input
              onChange={(event) =>
                handleSettingChange(
                  "dataRetentionDays",
                  Number.parseInt(event.target.value, 10) || 30,
                )
              }
              slotProps={{ input: { min: 30, max: 2555 } }}
              type="number"
              value={String(settings.dataRetentionDays)}
            />
            <FormHelperText>
              {enforced.dataRetentionDays
                ? "Keep customer messaging data for between 30 days and 7 years."
                : "Not available yet. No retention job uses this value today."}
            </FormHelperText>
          </FormControl>

          <FormControl disabled={!enforced.dataHandlingMode}>
            <FormLabel>Default handling after retention</FormLabel>
            <Select<DataHandlingMode>
              disabled={!enforced.dataHandlingMode}
              onChange={(_, value) => {
                if (value) {
                  handleSettingChange("dataHandlingMode", value);
                }
              }}
              value={settings.dataHandlingMode}
            >
              <Option value="anonymize">Anonymize after retention window</Option>
              <Option value="delete">Hard delete</Option>
              <Option value="archive">Archive for reporting only</Option>
            </Select>
            <FormHelperText>
              {enforced.dataHandlingMode
                ? "Applied when a record passes the retention window."
                : "Not available yet. Nothing removes or archives data on this schedule today."}
            </FormHelperText>
          </FormControl>
        </Box>
      </SettingsSectionCard>

      <SettingsSectionCard
        description="Maintain reusable privacy copy for forms, footers, or campaign references."
        startDecorator={<FileText size={18} />}
        title="Privacy Text"
      >
        <FormControl>
          <FormLabel>Custom privacy policy text</FormLabel>
          <Textarea
            minRows={5}
            onChange={(event) =>
              handleSettingChange("privacyPolicyText", event.target.value)
            }
            placeholder="Explain how customer data is collected, stored, and removed."
            value={settings.privacyPolicyText}
          />
          <FormHelperText>
            Reusable privacy copy for your team. Saved with your workspace
            settings; it is not added to emails or forms automatically.
          </FormHelperText>
        </FormControl>
      </SettingsSectionCard>
    </Stack>
  );
};
