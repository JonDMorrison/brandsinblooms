import React, { useState } from "react";
import Box from "@mui/joy/Box";
import FormControl from "@mui/joy/FormControl";
import FormHelperText from "@mui/joy/FormHelperText";
import FormLabel from "@mui/joy/FormLabel";
import Input from "@mui/joy/Input";
import Option from "@mui/joy/Option";
import Select from "@mui/joy/Select";
import Stack from "@mui/joy/Stack";
import Switch from "@mui/joy/Switch";
import Textarea from "@mui/joy/Textarea";
import Typography from "@mui/joy/Typography";
import { Clock, Database, FileText, MessageSquare, Shield } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import { useToast } from "@/hooks/use-toast";
import { SettingsSectionCard } from "./SettingsSurface";

interface ComplianceSettingsProps {
  onUpdate?: () => void;
}

type DataHandlingMode = "anonymize" | "delete" | "archive";

interface ComplianceState {
  doubleOptInRequired: boolean;
  ageVerificationRequired: boolean;
  includeOptOutInstructions: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  dataRetentionDays: number;
  dataHandlingMode: DataHandlingMode;
  optOutInstructions: string;
  privacyPolicyText: string;
}

const ToggleRow = ({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) => {
  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      spacing={2}
      justifyContent="space-between"
      alignItems={{ xs: "flex-start", md: "center" }}
    >
      <Stack spacing={0.5} sx={{ minWidth: 0 }}>
        <Typography level="title-sm">{title}</Typography>
        <Typography level="body-sm" sx={{ color: "text.secondary" }}>
          {description}
        </Typography>
      </Stack>
      <Switch checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </Stack>
  );
};

export const ComplianceSettings = ({
  onUpdate,
}: ComplianceSettingsProps = {}) => {
  const [settings, setSettings] = useState<ComplianceState>({
    doubleOptInRequired: true,
    ageVerificationRequired: false,
    includeOptOutInstructions: true,
    quietHoursEnabled: true,
    quietHoursStart: "22:00",
    quietHoursEnd: "08:00",
    dataRetentionDays: 365,
    dataHandlingMode: "anonymize",
    optOutInstructions: "Reply STOP to unsubscribe.",
    privacyPolicyText:
      "Customer consent and message preference data is retained only for the period required to operate campaigns and satisfy compliance obligations.",
  });
  const [isSaving, setIsSaving] = useState(false);

  const { toast } = useToast();

  const handleSettingChange = <Key extends keyof ComplianceState>(
    key: Key,
    value: ComplianceState[Key],
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);

    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 350);
    });

    toast({
      title: "Settings Saved",
      description: "Your compliance settings have been updated.",
    });

    setIsSaving(false);
    if (onUpdate) {
      onUpdate();
    }
  };

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
            local privacy copy for this tenant.
          </Typography>
        </Stack>

        <JoyButton loading={isSaving} onClick={() => void handleSave()}>
          Save Changes
        </JoyButton>
      </Stack>

      <SettingsSectionCard
        description="Define the consent rules required before sending customer communications."
        startDecorator={<MessageSquare size={18} />}
        title="Consent & Messaging"
      >
        <Stack spacing={2.5}>
          <ToggleRow
            checked={settings.doubleOptInRequired}
            description="Require customers to confirm consent before they can receive campaign messages."
            onChange={(checked) => handleSettingChange("doubleOptInRequired", checked)}
            title="Require double opt-in"
          />
          <ToggleRow
            checked={settings.ageVerificationRequired}
            description="Ask for age confirmation before collecting opt-in consent on promotional workflows."
            onChange={(checked) => handleSettingChange("ageVerificationRequired", checked)}
            title="Require age verification"
          />
          <ToggleRow
            checked={settings.includeOptOutInstructions}
            description="Append opt-out instructions to outbound campaign messages by default."
            onChange={(checked) => handleSettingChange("includeOptOutInstructions", checked)}
            title="Include opt-out instructions"
          />

          {settings.includeOptOutInstructions ? (
            <FormControl>
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
                This text stays local to the settings UI until you save.
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
          <FormControl>
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
              Keep customer messaging data for between 30 days and 7 years.
            </FormHelperText>
          </FormControl>

          <FormControl>
            <FormLabel>Default handling after retention</FormLabel>
            <Select<DataHandlingMode>
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
              This is a local preference until the form is saved.
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
            Use this field for the reusable privacy copy your team needs most often.
          </FormHelperText>
        </FormControl>
      </SettingsSectionCard>
    </Stack>
  );
};
