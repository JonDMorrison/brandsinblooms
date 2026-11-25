import { useCallback, useEffect, useState } from "react";
import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Checkbox from "@mui/joy/Checkbox";
import Chip from "@mui/joy/Chip";
import FormControl from "@mui/joy/FormControl";
import FormHelperText from "@mui/joy/FormHelperText";
import FormLabel from "@mui/joy/FormLabel";
import Input from "@mui/joy/Input";
import Option from "@mui/joy/Option";
import Select from "@mui/joy/Select";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Copy, MailPlus, RotateCw, X } from "lucide-react";
import { toast } from "sonner";
import {
  CRM_ROLES,
  CRM_ROLE_DESCRIPTIONS,
  CRM_ROLE_LABELS,
  isLocationScopedCrmRole,
  type CrmRole,
} from "@/lib/auth/crmAccess";
import {
  listPendingInvitations,
  resendTeamInvitation,
  revokeTeamInvitation,
  sendTeamInvitation,
  TeamInvitationError,
  type InvitationDelivery,
  type PendingInvitation,
} from "@/lib/team/teamInvitations";

interface InvitationLocation {
  id: string;
  name: string;
}

interface TeamInvitationsPanelProps {
  tenantId: string;
  activeLocations: InvitationLocation[];
}

const DEFAULT_ROLE: CrmRole = "marketing";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

const messageFor = (error: unknown) =>
  error instanceof TeamInvitationError ? error.message : "Something went wrong. Try again.";

async function copyLink(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Invite link copied");
  } catch {
    toast.error("Could not copy the link. Select it and copy it instead.");
  }
}

/** Invite form and pending invitations for owners and admins. */
export const TeamInvitationsPanel = ({ tenantId, activeLocations }: TeamInvitationsPanelProps) => {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<CrmRole>(DEFAULT_ROLE);
  const [locationIds, setLocationIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingInvitation[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  // A link to share by hand when the email could not be sent.
  const [unsentLink, setUnsentLink] = useState<{ email: string; url: string } | null>(null);

  const scoped = isLocationScopedCrmRole(role);

  const loadPending = useCallback(async () => {
    try {
      setListError(null);
      setPending(await listPendingInvitations(tenantId));
    } catch (error) {
      setListError(messageFor(error));
      setPending([]);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadPending();
  }, [loadPending]);

  const reportDelivery = (to: string, delivery: InvitationDelivery, verb: string) => {
    if (delivery.emailed) {
      setUnsentLink(null);
      toast.success(`Invitation ${verb} to ${to}`);
    } else {
      setUnsentLink({ email: to, url: delivery.inviteUrl });
      toast.warning(`The email to ${to} could not be sent. Copy the link below and send it yourself.`);
    }
  };

  const handleSend = async () => {
    const to = email.trim();
    setSending(true);
    try {
      const delivery = await sendTeamInvitation(to, role, scoped ? locationIds : []);
      reportDelivery(to, delivery, "sent");
      setEmail("");
      setLocationIds([]);
      await loadPending();
    } catch (error) {
      toast.error(messageFor(error));
    } finally {
      setSending(false);
    }
  };

  const handleResend = async (invitation: PendingInvitation) => {
    setBusyId(invitation.id);
    try {
      reportDelivery(invitation.email, await resendTeamInvitation(invitation.id), "resent");
      await loadPending();
    } catch (error) {
      toast.error(messageFor(error));
    } finally {
      setBusyId(null);
    }
  };

  const handleRevoke = async (invitation: PendingInvitation) => {
    setBusyId(invitation.id);
    try {
      await revokeTeamInvitation(invitation.id);
      if (unsentLink?.email === invitation.email) setUnsentLink(null);
      toast.success(`Invitation to ${invitation.email} cancelled`);
      await loadPending();
    } catch (error) {
      toast.error(messageFor(error));
    } finally {
      setBusyId(null);
    }
  };

  const locationName = (id: string) => activeLocations.find((location) => location.id === id)?.name;

  return (
    <Stack spacing={2}>
      <Sheet variant="soft" sx={{ p: 2, borderRadius: "md" }}>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} alignItems="center">
            <MailPlus size={16} />
            <Typography level="title-sm">Invite a teammate</Typography>
          </Stack>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.25} alignItems={{ md: "flex-end" }}>
            <FormControl sx={{ flex: 2 }}>
              <FormLabel>Email</FormLabel>
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@yourgardencentre.com"
                slotProps={{ input: { "aria-label": "Teammate email" } }}
              />
            </FormControl>
            <FormControl sx={{ flex: 1, minWidth: 200 }}>
              <FormLabel>Role</FormLabel>
              <Select
                value={role}
                onChange={(_, value) => {
                  if (!value) return;
                  setRole(value);
                  if (!isLocationScopedCrmRole(value)) setLocationIds([]);
                }}
              >
                {CRM_ROLES.map((option) => (
                  <Option key={option} value={option}>{CRM_ROLE_LABELS[option]}</Option>
                ))}
              </Select>
            </FormControl>
            <Button
              startDecorator={<MailPlus size={16} />}
              loading={sending}
              disabled={!email.trim() || (scoped && locationIds.length === 0)}
              onClick={() => void handleSend()}
            >
              Send invite
            </Button>
          </Stack>
          <Typography level="body-xs" sx={{ color: "text.secondary" }}>
            {CRM_ROLE_DESCRIPTIONS[role]}
          </Typography>
          {scoped ? (
            activeLocations.length === 0 ? (
              <Alert color="warning" size="sm">
                Add an active store above before inviting a {CRM_ROLE_LABELS[role]}.
              </Alert>
            ) : (
              <FormControl>
                <FormLabel>Stores</FormLabel>
                <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                  {activeLocations.map((location) => (
                    <Checkbox
                      key={location.id}
                      label={location.name}
                      checked={locationIds.includes(location.id)}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setLocationIds((current) =>
                          checked
                            ? [...new Set([...current, location.id])]
                            : current.filter((id) => id !== location.id),
                        );
                      }}
                    />
                  ))}
                </Stack>
                <FormHelperText>This role only sees the stores you choose.</FormHelperText>
              </FormControl>
            )
          ) : null}
          {unsentLink ? (
            <Alert color="warning" variant="soft">
              <Stack spacing={1} sx={{ minWidth: 0, width: "100%" }}>
                <Typography level="body-sm">
                  Send this link to {unsentLink.email} yourself. It works for 7 days.
                </Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <Input
                    readOnly
                    value={unsentLink.url}
                    sx={{ flex: 1, minWidth: 0 }}
                    slotProps={{ input: { "aria-label": "Invite link" } }}
                  />
                  <Button
                    variant="outlined"
                    startDecorator={<Copy size={15} />}
                    onClick={() => void copyLink(unsentLink.url)}
                  >
                    Copy link
                  </Button>
                </Stack>
              </Stack>
            </Alert>
          ) : null}
        </Stack>
      </Sheet>

      <Stack spacing={1}>
        <Typography level="title-sm">Pending invitations</Typography>
        {pending === null ? (
          <Skeleton variant="rectangular" height={56} sx={{ borderRadius: "md" }} />
        ) : listError ? (
          <Alert color="danger" size="sm">Could not load invitations: {listError}</Alert>
        ) : pending.length === 0 ? (
          <Typography level="body-sm" sx={{ color: "text.secondary" }}>
            No invitations waiting.
          </Typography>
        ) : (
          pending.map((invitation) => {
            const expired = new Date(invitation.expires_at).getTime() <= Date.now();
            const stores = invitation.location_ids.map(locationName).filter(Boolean);
            return (
              <Stack
                key={invitation.id}
                direction={{ xs: "column", md: "row" }}
                spacing={1.5}
                alignItems={{ md: "center" }}
                justifyContent="space-between"
                sx={{ p: 1.5, borderRadius: "md", bgcolor: "background.level1" }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography level="title-sm" sx={{ wordBreak: "break-all" }}>
                      {invitation.email}
                    </Typography>
                    <Chip size="sm" variant="soft">{CRM_ROLE_LABELS[invitation.role]}</Chip>
                    {expired ? <Chip size="sm" color="warning">Expired</Chip> : null}
                  </Stack>
                  <Typography level="body-xs" sx={{ color: "text.secondary" }}>
                    Sent {formatDate(invitation.last_sent_at)}
                    {expired ? "" : ` · expires ${formatDate(invitation.expires_at)}`}
                    {stores.length > 0 ? ` · ${stores.join(", ")}` : ""}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                  <Button
                    size="sm"
                    variant="outlined"
                    startDecorator={<RotateCw size={14} />}
                    loading={busyId === invitation.id}
                    onClick={() => void handleResend(invitation)}
                  >
                    Resend
                  </Button>
                  <Button
                    size="sm"
                    variant="plain"
                    color="danger"
                    startDecorator={<X size={14} />}
                    disabled={busyId === invitation.id}
                    onClick={() => void handleRevoke(invitation)}
                  >
                    Cancel invite
                  </Button>
                </Stack>
              </Stack>
            );
          })
        )}
      </Stack>
    </Stack>
  );
};
