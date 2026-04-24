import * as React from "react";
import Alert from "@mui/joy/Alert";
import Avatar from "@mui/joy/Avatar";
import Box from "@mui/joy/Box";
import FormControl from "@mui/joy/FormControl";
import FormHelperText from "@mui/joy/FormHelperText";
import FormLabel from "@mui/joy/FormLabel";
import Stack from "@mui/joy/Stack";
import Switch from "@mui/joy/Switch";
import Textarea from "@mui/joy/Textarea";
import Typography from "@mui/joy/Typography";
import { AlertTriangle, Info, Mail, MessageSquare, Shield } from "lucide-react";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoyChip } from "@/components/joy/JoyChip";
import { DEFAULT_FORM_COMPLIANCE, FormCompliance } from "@/types/formBuilder";

interface FormComplianceTabProps {
  compliance: FormCompliance;
  onComplianceChange: (compliance: FormCompliance) => void;
  hasPhoneField: boolean;
  hasEmailField?: boolean;
}

function ConsentSection({
  title,
  description,
  placeholder,
  helperText,
  icon,
  required,
  consentText,
  onRequiredChange,
  onTextChange,
}: {
  title: string;
  description: string;
  placeholder: string;
  helperText: string;
  icon: React.ReactNode;
  required: boolean;
  consentText: string;
  onRequiredChange: (checked: boolean) => void;
  onTextChange: (value: string) => void;
}) {
  return (
    <JoyCard>
      <JoyCardHeader
        startDecorator={
          <Avatar size="sm" variant="soft" color="neutral">
            {icon}
          </Avatar>
        }
        title={title}
        description={description}
      />
      <JoyCardContent sx={{ pt: 3, gap: 2.5 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 2,
            border: "1px solid",
            borderColor: "neutral.200",
            borderRadius: "lg",
            p: 2,
          }}
        >
          <Stack spacing={0.75} sx={{ minWidth: 0, flex: 1 }}>
            <Typography level="body-sm" sx={{ fontWeight: 600 }}>
              Require consent
            </Typography>
            <Typography level="body-sm" color="neutral">
              {helperText}
            </Typography>
          </Stack>
          <Switch
            checked={required}
            onChange={(event) => onRequiredChange(event.target.checked)}
          />
        </Box>

        <FormControl>
          <FormLabel>Consent copy</FormLabel>
          <Textarea
            minRows={3}
            value={consentText}
            placeholder={placeholder}
            onChange={(event) => onTextChange(event.target.value)}
            sx={{ borderRadius: "lg" }}
          />
          <FormHelperText>
            This text is displayed beside the consent checkbox on the public
            form.
          </FormHelperText>
        </FormControl>
      </JoyCardContent>
    </JoyCard>
  );
}

function ComplianceToggle({
  title,
  description,
  note,
  checked,
  disabled = false,
  badge,
  onChange,
}: {
  title: string;
  description: string;
  note?: string;
  checked: boolean;
  disabled?: boolean;
  badge?: React.ReactNode;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 2,
        border: "1px solid",
        borderColor: "neutral.200",
        borderRadius: "lg",
        p: 2,
      }}
    >
      <Stack spacing={0.75} sx={{ minWidth: 0, flex: 1 }}>
        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          flexWrap="wrap"
          alignItems="center"
        >
          <Typography level="body-sm" sx={{ fontWeight: 600 }}>
            {title}
          </Typography>
          {badge}
        </Stack>
        <Typography level="body-sm" color="neutral">
          {description}
        </Typography>
        {note ? (
          <Typography level="body-xs" color="neutral">
            {note}
          </Typography>
        ) : null}
      </Stack>
      <Switch
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
    </Box>
  );
}

export function FormComplianceTab({
  compliance,
  onComplianceChange,
  hasPhoneField,
  hasEmailField = true,
}: FormComplianceTabProps) {
  const resolvedCompliance = React.useMemo(
    () => ({ ...DEFAULT_FORM_COMPLIANCE, ...compliance }),
    [compliance],
  );

  return (
    <Stack spacing={3}>
      {hasPhoneField && !resolvedCompliance.sms_consent_required ? (
        <Alert
          color="warning"
          variant="soft"
          startDecorator={<AlertTriangle size={18} />}
        >
          This form collects phone numbers, but SMS consent is not marked as
          required. If this form supports marketing texts, the compliance copy
          should make that explicit.
        </Alert>
      ) : null}

      {hasEmailField && !resolvedCompliance.email_consent_required ? (
        <Alert
          color="neutral"
          variant="soft"
          startDecorator={<Info size={18} />}
        >
          Enable required email consent when this form is intended to capture
          marketing subscribers rather than operational replies.
        </Alert>
      ) : null}

      <ConsentSection
        title="Email consent"
        description="Configure the email marketing consent checkbox shown on the form."
        placeholder="I agree to receive marketing emails from BloomSuite."
        helperText="When enabled, the checkbox must be checked before the submission can succeed."
        icon={<Mail size={18} />}
        required={resolvedCompliance.email_consent_required}
        consentText={resolvedCompliance.email_consent_text}
        onRequiredChange={(email_consent_required) =>
          onComplianceChange({
            ...resolvedCompliance,
            email_consent_required,
          })
        }
        onTextChange={(email_consent_text) =>
          onComplianceChange({
            ...resolvedCompliance,
            email_consent_text,
          })
        }
      />

      <ConsentSection
        title="SMS consent"
        description="Configure the SMS consent checkbox shown on the form."
        placeholder="I agree to receive SMS messages. Msg & data rates may apply."
        helperText="When enabled, the checkbox must be checked before the submission can succeed."
        icon={<MessageSquare size={18} />}
        required={resolvedCompliance.sms_consent_required}
        consentText={resolvedCompliance.sms_consent_text}
        onRequiredChange={(sms_consent_required) =>
          onComplianceChange({
            ...resolvedCompliance,
            sms_consent_required,
          })
        }
        onTextChange={(sms_consent_text) =>
          onComplianceChange({
            ...resolvedCompliance,
            sms_consent_text,
          })
        }
      />

      <JoyCard>
        <JoyCardHeader
          startDecorator={
            <Avatar size="sm" variant="soft" color="primary">
              <Shield size={18} />
            </Avatar>
          }
          title="Operational flags"
          description="These settings are stored with the form, but not every flag has live runtime enforcement yet."
        />
        <JoyCardContent sx={{ pt: 3, gap: 2 }}>
          <ComplianceToggle
            title="Double opt-in"
            description="Confirmation-based consent is planned, but the activation workflow is not live yet."
            note="This toggle is intentionally disabled until the backend confirmation flow exists."
            checked={resolvedCompliance.double_opt_in}
            disabled
            badge={
              <JoyChip size="sm" variant="outlined" color="warning">
                Coming soon
              </JoyChip>
            }
            onChange={() => undefined}
          />

          <ComplianceToggle
            title="Show GDPR-ready messaging"
            description="Use this to mark the form as using GDPR-oriented language and presentation. It does not change server-side retention or deletion behavior on its own."
            checked={resolvedCompliance.gdpr_compliant}
            onChange={(gdpr_compliant) =>
              onComplianceChange({
                ...resolvedCompliance,
                gdpr_compliant,
              })
            }
          />
        </JoyCardContent>
      </JoyCard>
    </Stack>
  );
}
