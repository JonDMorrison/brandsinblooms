import React, { useState } from "react";
import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Clock, Database, MessageSquare, Shield } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyFormSection } from "@/components/joy/JoyFormSection";
import { JoyInput } from "@/components/joy/JoyInput";
import { JoySwitch } from "@/components/joy/JoySwitch";
import { JoyTextarea } from "@/components/joy/JoyTextarea";
import { useToast } from "@/hooks/use-toast";

interface ComplianceSettingsProps {
  onUpdate?: () => void;
}

export const ComplianceSettings = ({
  onUpdate,
}: ComplianceSettingsProps = {}) => {
  const [settings, setSettings] = useState({
    smsOptIn: true,
    quietHoursEnabled: true,
    quietHoursStart: "22:00",
    quietHoursEnd: "08:00",
    dataRetentionDays: 365,
    unsubscribeText: "Reply STOP to unsubscribe",
    complianceFooter: "Msg&data rates may apply. Msg frequency varies.",
  });

  const { toast } = useToast();

  const handleSettingChange = (key: string, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    toast({
      title: "Settings Saved",
      description: "Your compliance settings have been updated.",
    });
    if (onUpdate) onUpdate();
  };

  return (
    <Stack spacing={3}>
      <JoyFormSection
        title="Compliance & Privacy"
        description="Configure SMS compliance, quiet hours, and retention policies for this tenant."
        headerActions={
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: "14px",
              display: "grid",
              placeItems: "center",
              backgroundColor: "primary.50",
              color: "primary.700",
            }}
          >
            <Shield className="h-5 w-5" />
          </Box>
        }
        actions={
          <JoyButton onClick={handleSave}>Save Compliance Settings</JoyButton>
        }
      >
        <JoyFormSection
          title="SMS Compliance"
          description="Set consent and required footer copy for outgoing SMS messages."
          headerActions={<MessageSquare className="h-4 w-4" />}
          cardProps={{ variant: "plain" }}
          sx={{
            boxShadow: "none",
            borderColor: "neutral.200",
            backgroundColor: "neutral.50",
          }}
        >
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", md: "center" }}
          >
            <Stack spacing={0.5}>
              <Typography level="title-sm">Require SMS opt-in</Typography>
              <Typography level="body-sm" color="neutral">
                Require explicit consent before sending SMS messages.
              </Typography>
            </Stack>
            <JoySwitch
              checked={settings.smsOptIn}
              onCheckedChange={(checked) =>
                handleSettingChange("smsOptIn", checked)
              }
            />
          </Stack>

          <JoyInput
            label="Unsubscribe Instructions"
            value={settings.unsubscribeText}
            onChange={(event) =>
              handleSettingChange("unsubscribeText", event.target.value)
            }
            placeholder="Reply STOP to unsubscribe"
          />

          <JoyTextarea
            label="Compliance Footer"
            value={settings.complianceFooter}
            onChange={(event) =>
              handleSettingChange("complianceFooter", event.target.value)
            }
            placeholder="Msg&data rates may apply. Msg frequency varies."
            rows={2}
          />
        </JoyFormSection>

        <JoyFormSection
          title="Quiet Hours"
          description="Prevent messages from being sent during specific hours."
          headerActions={<Clock className="h-4 w-4" />}
          cardProps={{ variant: "plain" }}
          sx={{
            boxShadow: "none",
            borderColor: "neutral.200",
            backgroundColor: "neutral.50",
          }}
        >
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", md: "center" }}
          >
            <Stack spacing={0.5}>
              <Typography level="title-sm">Enable quiet hours</Typography>
              <Typography level="body-sm" color="neutral">
                Pause outbound messages during protected time windows.
              </Typography>
            </Stack>
            <JoySwitch
              checked={settings.quietHoursEnabled}
              onCheckedChange={(checked) =>
                handleSettingChange("quietHoursEnabled", checked)
              }
            />
          </Stack>

          {settings.quietHoursEnabled && (
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
              <JoyInput
                label="Start Time"
                type="time"
                value={settings.quietHoursStart}
                onChange={(event) =>
                  handleSettingChange("quietHoursStart", event.target.value)
                }
              />
              <JoyInput
                label="End Time"
                type="time"
                value={settings.quietHoursEnd}
                onChange={(event) =>
                  handleSettingChange("quietHoursEnd", event.target.value)
                }
              />
            </Box>
          )}
        </JoyFormSection>

        <JoyFormSection
          title="Data Retention"
          description="Control how long customer data and messaging logs stay available."
          headerActions={<Database className="h-4 w-4" />}
          cardProps={{ variant: "plain" }}
          sx={{
            boxShadow: "none",
            borderColor: "neutral.200",
            backgroundColor: "neutral.50",
          }}
        >
          <JoyInput
            label="Data Retention Period (Days)"
            type="number"
            value={String(settings.dataRetentionDays)}
            onChange={(event) =>
              handleSettingChange(
                "dataRetentionDays",
                Number.parseInt(event.target.value, 10) || 30,
              )
            }
            helperText="Keep customer data and interaction logs for between 30 days and 7 years."
            slotProps={{
              input: {
                min: 30,
                max: 2555,
              },
            }}
          />
        </JoyFormSection>
      </JoyFormSection>
    </Stack>
  );
};
