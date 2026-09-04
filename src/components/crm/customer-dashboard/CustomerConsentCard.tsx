import * as React from "react";
import Divider from "@mui/joy/Divider";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { useQuery } from "@tanstack/react-query";
import { Mail, MessageSquareText, ShieldCheck } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyCard, JoyCardContent, JoyCardHeader } from "@/components/joy/JoyCard";
import { JoyChip } from "@/components/joy/JoyChip";
import {
  JoyDialog,
  JoyDialogActions,
  JoyDialogContent,
} from "@/components/joy/JoyDialog";
import { JoySelect } from "@/components/joy/JoySelect";
import { JoyTextarea } from "@/components/joy/JoyTextarea";
import {
  useCustomerMarketingConsent,
  type ConsentBasis,
  type MarketingChannel,
} from "@/hooks/useCustomerMarketingConsent";
import type { CustomerData } from "@/hooks/useCustomerDashboard";
import { supabase } from "@/integrations/supabase/client";

type ConsentEvent = {
  id: string;
  channel: MarketingChannel;
  event_type: string;
  source: string;
  consent_basis: string | null;
  created_at: string;
};

const SOURCE_OPTIONS = [
  { value: "in_store", label: "In-store conversation" },
  { value: "web_form", label: "Web form" },
  { value: "written_request", label: "Written request" },
  { value: "phone_request", label: "Phone request" },
  { value: "customer_service", label: "Customer service" },
  { value: "admin_correction", label: "Administrative correction" },
];

const BASIS_OPTIONS = [
  { value: "express", label: "Express consent" },
  { value: "implied", label: "Implied consent" },
];

const formatLabel = (value: string | null | undefined) =>
  value
    ? value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "Not documented";

const formatDate = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "No recorded date";

interface CustomerConsentCardProps {
  customer: CustomerData;
  customerLabel: string;
  onCustomerPatched: (patch: Partial<CustomerData>) => void;
  canManage?: boolean;
}

export function CustomerConsentCard({
  customer,
  customerLabel,
  onCustomerPatched,
  canManage = true,
}: CustomerConsentCardProps) {
  const mutation = useCustomerMarketingConsent();
  const [channel, setChannel] = React.useState<MarketingChannel | null>(null);
  const [source, setSource] = React.useState("");
  const [basis, setBasis] = React.useState<ConsentBasis | "">("");
  const [evidence, setEvidence] = React.useState("");

  const history = useQuery({
    queryKey: ["customer-consent-history", customer.id],
    queryFn: async () => {
      const [emailResult, smsResult] = await Promise.all([
        supabase
          .from("crm_email_consent_events")
          .select("id, event_type, source, consent_basis, created_at")
          .eq("customer_id", customer.id)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("crm_sms_consent_events")
          .select("id, event_type, source, consent_basis, created_at")
          .eq("customer_id", customer.id)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      if (emailResult.error) throw emailResult.error;
      if (smsResult.error) throw smsResult.error;

      return [
        ...(emailResult.data ?? []).map((event) => ({
          ...event,
          channel: "email" as const,
        })),
        ...(smsResult.data ?? []).map((event) => ({
          ...event,
          channel: "sms" as const,
        })),
      ]
        .sort(
          (left, right) =>
            new Date(right.created_at).getTime() -
            new Date(left.created_at).getTime(),
        )
        .slice(0, 5) as ConsentEvent[];
    },
  });

  const optedIn = channel
    ? channel === "email"
      ? customer.email_opt_in === true && customer.email_consent !== false
      : customer.sms_opt_in === true && customer.sms_consent !== false
    : false;

  const resetDialog = () => {
    setChannel(null);
    setSource("");
    setBasis("");
    setEvidence("");
  };

  const submit = async () => {
    if (!channel || !source || (!optedIn && (!basis || evidence.trim().length < 10))) {
      return;
    }

    const nextOptedIn = !optedIn;
    await mutation.mutateAsync({
      customerId: customer.id,
      tenantId: customer.tenant_id,
      customerLabel,
      channel,
      optedIn: nextOptedIn,
      source,
      consentBasis: nextOptedIn ? basis || undefined : undefined,
      evidence,
    });

    onCustomerPatched(
      channel === "email"
        ? {
            email_opt_in: nextOptedIn,
            email_consent: nextOptedIn,
            email_consent_source: source,
            email_opt_in_at: nextOptedIn ? new Date().toISOString() : customer.email_opt_in_at,
            email_opt_out_at: nextOptedIn ? null : new Date().toISOString(),
          }
        : {
            sms_opt_in: nextOptedIn,
            sms_consent: nextOptedIn,
            sms_consent_source: source,
            sms_opt_in_at: nextOptedIn ? new Date().toISOString() : customer.sms_opt_in_at,
            sms_opt_out_at: nextOptedIn ? null : new Date().toISOString(),
          },
    );
    resetDialog();
  };

  const channelRows = [
    {
      channel: "email" as const,
      label: "Email marketing",
      icon: Mail,
      optedIn:
        customer.email_opt_in === true && customer.email_consent !== false,
      source: customer.email_consent_source,
      date:
        customer.email_opt_in === true && customer.email_consent !== false
        ? customer.email_opt_in_at
        : customer.email_opt_out_at,
    },
    {
      channel: "sms" as const,
      label: "SMS marketing",
      icon: MessageSquareText,
      optedIn: customer.sms_opt_in === true && customer.sms_consent !== false,
      source: customer.sms_consent_source,
      date:
        customer.sms_opt_in === true && customer.sms_consent !== false
          ? customer.sms_opt_in_at
          : customer.sms_opt_out_at,
    },
  ];

  return (
    <>
      <JoyCard variant="outlined">
        <JoyCardHeader
          title="Consent & communication"
          description="Email and SMS are independent. Every staff change requires a source and is added to the audit history."
          startDecorator={<ShieldCheck size={18} />}
        />
        <JoyCardContent>
          <Stack spacing={1.5}>
            {channelRows.map((row, index) => {
              const Icon = row.icon;
              return (
                <React.Fragment key={row.channel}>
                  {index ? <Divider /> : null}
                  <Stack spacing={1}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Icon size={16} />
                        <Typography level="title-sm">{row.label}</Typography>
                      </Stack>
                      <JoyChip bloomVariant={row.optedIn ? "success" : "warning"}>
                        {row.optedIn ? "Opted in" : "Opted out"}
                      </JoyChip>
                    </Stack>
                    <Typography level="body-xs" color="neutral">
                      {formatLabel(row.source)} · {formatDate(row.date)}
                    </Typography>
                    {canManage ? <JoyButton
                      size="sm"
                      color={row.optedIn ? "danger" : "primary"}
                      variant="soft"
                      onClick={() => setChannel(row.channel)}
                    >
                      {row.optedIn ? "Record opt-out" : "Document opt-in"}
                    </JoyButton> : null}
                  </Stack>
                </React.Fragment>
              );
            })}

            <Divider />
            <Stack spacing={0.75}>
              <Typography level="title-sm">Recent consent history</Typography>
              {history.isError ? (
                <Typography level="body-xs" color="danger">
                  Consent history could not be loaded.
                </Typography>
              ) : history.data?.length ? (
                history.data.map((event) => (
                  <Stack key={`${event.channel}-${event.id}`} direction="row" justifyContent="space-between" spacing={1}>
                    <Typography level="body-xs">
                      {event.channel.toUpperCase()} {formatLabel(event.event_type)} · {formatLabel(event.source)}
                    </Typography>
                    <Typography level="body-xs" color="neutral">
                      {formatDate(event.created_at)}
                    </Typography>
                  </Stack>
                ))
              ) : (
                <Typography level="body-xs" color="neutral">
                  No audit events recorded yet.
                </Typography>
              )}
            </Stack>
          </Stack>
        </JoyCardContent>
      </JoyCard>

      {canManage ? <JoyDialog
        open={channel !== null}
        onClose={resetDialog}
        title={optedIn ? `Record ${channel?.toUpperCase()} opt-out` : `Document ${channel?.toUpperCase()} opt-in`}
        description={
          optedIn
            ? "This channel will be suppressed immediately. The other channel will not change."
            : "Only record an opt-in when the consent basis and evidence can be documented."
        }
        size="sm"
      >
        <JoyDialogContent>
          <Stack spacing={2}>
            <JoySelect
              label="Source"
              placeholder="Select where the request was received"
              value={source || null}
              options={SOURCE_OPTIONS}
              onValueChange={setSource}
              required
            />
            {!optedIn ? (
              <JoySelect
                label="Consent basis"
                placeholder="Select the lawful basis"
                value={basis || null}
                options={BASIS_OPTIONS}
                onValueChange={(value) => setBasis(value as ConsentBasis)}
                required
              />
            ) : null}
            <JoyTextarea
              label={optedIn ? "Reason or note (optional)" : "Evidence"}
              placeholder={
                optedIn
                  ? "Optional context for the opt-out"
                  : "Describe when and how the customer provided consent"
              }
              value={evidence}
              onValueChange={setEvidence}
              minRows={3}
              required={!optedIn}
              helperText={!optedIn ? "At least 10 characters are required." : undefined}
            />
          </Stack>
        </JoyDialogContent>
        <JoyDialogActions>
          <JoyButton color="neutral" bloomVariant="ghost" onClick={resetDialog} disabled={mutation.isPending}>
            Cancel
          </JoyButton>
          <JoyButton
            color={optedIn ? "danger" : "primary"}
            loading={mutation.isPending}
            disabled={!source || (!optedIn && (!basis || evidence.trim().length < 10))}
            onClick={() => void submit()}
          >
            {optedIn ? "Confirm opt-out" : "Save documented opt-in"}
          </JoyButton>
        </JoyDialogActions>
      </JoyDialog> : null}
    </>
  );
}
