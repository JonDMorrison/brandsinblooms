import * as React from "react";
import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import FormControl from "@mui/joy/FormControl";
import FormHelperText from "@mui/joy/FormHelperText";
import FormLabel from "@mui/joy/FormLabel";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Switch from "@mui/joy/Switch";
import Textarea from "@mui/joy/Textarea";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import { AlertTriangle, Info, Mail } from "lucide-react";
import { JoyChip } from "@/components/joy/JoyChip";
import { JoyInput } from "@/components/joy/JoyInput";
import { isValidEmail } from "@/lib/sendTestEmail";
import { DEFAULT_FORM_COMPLIANCE, FormCompliance } from "@/types/formBuilder";

interface FormComplianceTabProps {
  compliance: FormCompliance;
  onComplianceChange: (compliance: FormCompliance) => void;
  hasPhoneField: boolean;
  hasEmailField?: boolean;
  notificationEmails: string[];
  onNotificationEmailsChange: (notificationEmails: string[]) => void;
}

function ComplianceSection(props: {
  title: string;
  description?: string;
  variant?: "outlined" | "soft";
  color?: "neutral" | "warning";
  children: React.ReactNode;
}) {
  return (
    <Sheet
      variant={props.variant ?? "outlined"}
      color={props.color}
      sx={{
        borderRadius: "var(--joy-radius-lg)",
        borderColor: props.variant === "outlined" ? "neutral.200" : undefined,
        backgroundColor:
          props.variant === "outlined" ? "background.surface" : undefined,
        p: { xs: 2, md: 2.5 },
      }}
    >
      <Stack spacing={2}>
        <Stack spacing={0.35}>
          <Typography level="title-md">{props.title}</Typography>
          {props.description ? (
            <Typography level="body-sm" color="neutral">
              {props.description}
            </Typography>
          ) : null}
        </Stack>
        {props.children}
      </Stack>
    </Sheet>
  );
}

function ComplianceSkeleton() {
  return (
    <Stack spacing={3}>
      <Sheet
        variant="outlined"
        sx={{
          borderRadius: "var(--joy-radius-lg)",
          borderColor: "neutral.200",
          backgroundColor: "background.surface",
          p: { xs: 2, md: 2.5 },
        }}
      >
        <Stack spacing={1.5}>
          <Skeleton variant="text" width={180} height={24} animation="wave" />
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton
              key={index}
              variant="rectangular"
              height={74}
              animation="wave"
              sx={{ borderRadius: "18px" }}
            />
          ))}
        </Stack>
      </Sheet>

      <Sheet
        variant="outlined"
        sx={{
          borderRadius: "var(--joy-radius-lg)",
          borderColor: "neutral.200",
          backgroundColor: "background.surface",
          p: { xs: 2, md: 2.5 },
        }}
      >
        <Stack spacing={1.5}>
          <Skeleton variant="text" width={210} height={24} animation="wave" />
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton
                key={index}
                variant="rectangular"
                width={index % 2 === 0 ? 130 : 110}
                height={30}
                animation="wave"
                sx={{ borderRadius: 999 }}
              />
            ))}
          </Stack>
          <Skeleton
            variant="rectangular"
            height={40}
            animation="wave"
            sx={{ borderRadius: "16px" }}
          />
        </Stack>
      </Sheet>
    </Stack>
  );
}

function UIOnlyChip() {
  return (
    <Tooltip title="This setting is saved but may not yet be fully enforced at runtime. It will be activated in a future release.">
      <Box component="span">
        <JoyChip size="sm" variant="outlined" color="neutral">
          UI only
        </JoyChip>
      </Box>
    </Tooltip>
  );
}

function ComplianceToggleRow(props: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  note?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <Sheet
      variant="soft"
      sx={{
        borderRadius: "var(--joy-radius-lg)",
        px: 1.5,
        py: 1.35,
        backgroundColor: "neutral.50",
      }}
    >
      <Stack
        direction="row"
        spacing={2}
        justifyContent="space-between"
        alignItems="flex-start"
      >
        <Stack spacing={0.6} sx={{ minWidth: 0, flex: 1 }}>
          <Stack
            direction="row"
            spacing={0.75}
            useFlexGap
            flexWrap="wrap"
            alignItems="center"
          >
            <Typography level="body-sm" sx={{ fontWeight: 700 }}>
              {props.title}
            </Typography>
            {props.badge}
          </Stack>
          <Typography level="body-sm" color="neutral">
            {props.description}
          </Typography>
          {props.note ? (
            <Typography level="body-xs" color="neutral">
              {props.note}
            </Typography>
          ) : null}
        </Stack>
        <Switch
          checked={props.checked}
          disabled={props.disabled}
          onChange={(event) => props.onChange(event.target.checked)}
        />
      </Stack>
    </Sheet>
  );
}

export function FormComplianceTab({
  compliance,
  onComplianceChange,
  hasPhoneField,
  hasEmailField = true,
  notificationEmails,
  onNotificationEmailsChange,
}: FormComplianceTabProps) {
  const [isBootstrapping, setIsBootstrapping] = React.useState(true);
  const [emailDraft, setEmailDraft] = React.useState("");
  const [emailError, setEmailError] = React.useState<string | null>(null);

  const resolvedCompliance = React.useMemo(
    () => ({ ...DEFAULT_FORM_COMPLIANCE, ...compliance }),
    [compliance],
  );

  React.useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setIsBootstrapping(false);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  const handleAddNotificationEmail = React.useCallback(() => {
    const trimmed = emailDraft.trim().toLowerCase();

    if (!trimmed) {
      setEmailError("Enter an email address first.");
      return;
    }

    if (!isValidEmail(trimmed)) {
      setEmailError("Enter a valid email address.");
      return;
    }

    if (notificationEmails.some((email) => email.toLowerCase() === trimmed)) {
      setEmailError("That email is already receiving notifications.");
      return;
    }

    onNotificationEmailsChange([...notificationEmails, trimmed]);
    setEmailDraft("");
    setEmailError(null);
  }, [emailDraft, notificationEmails, onNotificationEmailsChange]);

  if (isBootstrapping) {
    return <ComplianceSkeleton />;
  }

  return (
    <Stack spacing={3}>
      {!hasEmailField ? (
        <Alert
          size="sm"
          color="warning"
          variant="soft"
          startDecorator={<AlertTriangle size={16} />}
        >
          This form does not currently collect an email address. Email consent
          and notification settings will only be relevant after an email field
          is added.
        </Alert>
      ) : null}

      {!hasPhoneField ? (
        <Alert
          size="sm"
          color="neutral"
          variant="soft"
          startDecorator={<Info size={16} />}
        >
          SMS consent is available once a phone field is present on the form.
        </Alert>
      ) : null}

      <ComplianceSection title="Consent requirements">
        <Stack spacing={1.1}>
          <ComplianceToggleRow
            title="Email consent required"
            description="Require visitors to explicitly consent to email communications before submission is accepted."
            checked={resolvedCompliance.email_consent_required}
            disabled={!hasEmailField}
            note={
              hasEmailField
                ? undefined
                : "Add an email field in Build tab to enable email consent enforcement."
            }
            onChange={(email_consent_required) =>
              onComplianceChange({
                ...resolvedCompliance,
                email_consent_required,
              })
            }
          />

          <ComplianceToggleRow
            title="SMS consent required"
            description="Require explicit SMS/text message consent. Only applicable if the form collects a phone number."
            checked={resolvedCompliance.sms_consent_required}
            disabled={!hasPhoneField}
            note={
              hasPhoneField
                ? undefined
                : "Add a phone field in Build tab to enable SMS consent requirements."
            }
            onChange={(sms_consent_required) =>
              onComplianceChange({
                ...resolvedCompliance,
                sms_consent_required,
              })
            }
          />

          <ComplianceToggleRow
            title="Double opt-in"
            description="Send a confirmation email requiring visitors to verify their consent before it becomes active."
            checked={resolvedCompliance.double_opt_in}
            badge={<UIOnlyChip />}
            onChange={(double_opt_in) =>
              onComplianceChange({
                ...resolvedCompliance,
                double_opt_in,
              })
            }
          />

          <ComplianceToggleRow
            title="GDPR compliant mode"
            description="Enable strict data handling mode for EU visitors (data minimization, explicit consent, right to erasure)."
            checked={resolvedCompliance.gdpr_compliant}
            badge={<UIOnlyChip />}
            onChange={(gdpr_compliant) =>
              onComplianceChange({
                ...resolvedCompliance,
                gdpr_compliant,
              })
            }
          />
        </Stack>

        <Stack spacing={1.5}>
          <Stack spacing={0.35}>
            <Typography level="title-sm">Consent copy</Typography>
            <Typography level="body-sm" color="neutral">
              This text appears beside the relevant consent checkbox on the
              public form.
            </Typography>
          </Stack>

          <FormControl>
            <FormLabel>Email consent copy</FormLabel>
            <Textarea
              minRows={3}
              value={resolvedCompliance.email_consent_text}
              placeholder="I agree to receive marketing emails from your business."
              onChange={(event) =>
                onComplianceChange({
                  ...resolvedCompliance,
                  email_consent_text: event.target.value,
                })
              }
              sx={{
                borderRadius: "18px",
                backgroundColor: "background.surface",
              }}
            />
            <FormHelperText>
              Keep this explicit about what subscribers are opting into.
            </FormHelperText>
          </FormControl>

          <FormControl>
            <FormLabel>SMS consent copy</FormLabel>
            <Textarea
              minRows={3}
              value={resolvedCompliance.sms_consent_text}
              placeholder="I agree to receive text messages. Msg & data rates may apply."
              onChange={(event) =>
                onComplianceChange({
                  ...resolvedCompliance,
                  sms_consent_text: event.target.value,
                })
              }
              sx={{
                borderRadius: "18px",
                backgroundColor: "background.surface",
              }}
            />
            <FormHelperText>
              Use clear channel-specific wording whenever SMS consent is
              requested.
            </FormHelperText>
          </FormControl>
        </Stack>
      </ComplianceSection>

      <ComplianceSection
        title="Submission notifications"
        description="These email addresses receive a notification whenever a new submission is accepted."
      >
        <Stack spacing={1.5}>
          {notificationEmails.length > 0 ? (
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {notificationEmails.map((email) => (
                <JoyChip
                  key={email}
                  size="sm"
                  variant="outlined"
                  color="neutral"
                  onDelete={() =>
                    onNotificationEmailsChange(
                      notificationEmails.filter(
                        (recipient) => recipient !== email,
                      ),
                    )
                  }
                >
                  {email}
                </JoyChip>
              ))}
            </Stack>
          ) : (
            <Typography level="body-sm" color="neutral">
              No notification recipients configured. Submissions will only
              appear in the dashboard.
            </Typography>
          )}

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            alignItems={{ xs: "stretch", sm: "flex-start" }}
          >
            <JoyInput
              type="email"
              size="sm"
              label="Add recipient"
              placeholder="Enter email address"
              value={emailDraft}
              errorMessage={emailError ?? undefined}
              onValueChange={(value) => {
                setEmailDraft(value);
                if (emailError) {
                  setEmailError(null);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleAddNotificationEmail();
                }
              }}
              sx={{ flex: 1 }}
            />
            <Button
              size="sm"
              variant="solid"
              color="primary"
              startDecorator={<Mail size={15} />}
              onClick={handleAddNotificationEmail}
              sx={{ mt: { sm: 3.1 } }}
            >
              Add
            </Button>
          </Stack>
        </Stack>
      </ComplianceSection>

      <ComplianceSection title="Data handling" variant="soft" color="neutral">
        <Stack spacing={1.2}>
          {[
            "Submission data is stored securely and scoped to your store.",
            "File uploads are stored in your dedicated storage bucket.",
            "You can export and delete submissions from the Submissions tab.",
            "Rate limiting and honeypot protection are enabled automatically on all published forms.",
          ].map((item) => (
            <Stack
              key={item}
              direction="row"
              spacing={1.1}
              alignItems="flex-start"
            >
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  backgroundColor: "neutral.500",
                  mt: 0.75,
                  flexShrink: 0,
                }}
              />
              <Typography level="body-sm" color="neutral">
                {item}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </ComplianceSection>
    </Stack>
  );
}
