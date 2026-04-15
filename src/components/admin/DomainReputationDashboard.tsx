import Box from "@mui/joy/Box";
import Chip from "@mui/joy/Chip";
import Skeleton from "@mui/joy/Skeleton";
import { useDomainStats, DomainStats } from "@/hooks/useDomainStats";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import {
  JoyTable,
  JoyTableBody,
  JoyTableCell,
  JoyTableHead,
  JoyTableHeaderCell,
  JoyTableRow,
} from "@/components/joy/JoyTable";
import { AlertTriangle, XCircle, Clock } from "lucide-react";

interface DomainReputationDashboardProps {
  tenantId?: string;
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case "active":
    case "warming_up":
      return (
        <Chip color="success" size="sm" variant="soft">
          Active
        </Chip>
      );
    case "verifying":
      return (
        <Chip color="info" size="sm" variant="soft">
          Verifying
        </Chip>
      );
    case "pending_dns":
      return (
        <Chip color="warning" size="sm" variant="soft">
          Pending DNS
        </Chip>
      );
    case "paused":
      return (
        <Chip color="danger" size="sm" variant="soft">
          Paused
        </Chip>
      );
    case "blocked":
      return (
        <Chip color="danger" size="sm" variant="soft">
          Blocked
        </Chip>
      );
    default:
      return (
        <Chip color="neutral" size="sm" variant="soft">
          {status}
        </Chip>
      );
  }
};

const getRateDisplay = (rate: number, type: "good" | "warning" | "danger") => {
  const color = {
    good: "success.700",
    warning: "warning.700",
    danger: "danger.700",
  }[type];

  return (
    <Typography
      component="span"
      level="body-sm"
      sx={{ color, fontWeight: "var(--joy-fontWeight-semibold)" }}
    >
      {rate.toFixed(2)}%
    </Typography>
  );
};

const getOpenClickRateStatus = (
  rate: number,
): "good" | "warning" | "danger" => {
  if (rate >= 20) return "good";
  if (rate >= 10) return "warning";
  return "danger";
};

const getBounceRateStatus = (rate: number): "good" | "warning" | "danger" => {
  if (rate <= 2) return "good";
  if (rate <= 5) return "warning";
  return "danger";
};

const getComplaintRateStatus = (
  rate: number,
): "good" | "warning" | "danger" => {
  if (rate <= 0.1) return "good";
  if (rate <= 0.2) return "warning";
  return "danger";
};

const DomainRow = ({ domain }: { domain: DomainStats }) => {
  const bounceStatus = getBounceRateStatus(domain.bounce_rate_30d);
  const complaintStatus = getComplaintRateStatus(domain.complaint_rate_30d);
  const hasWarning = bounceStatus !== "good" || complaintStatus !== "good";

  return (
    <JoyTableRow
      sx={
        hasWarning
          ? {
              "& > td": {
                backgroundColor: "warning.50",
              },
            }
          : undefined
      }
    >
      <JoyTableCell sx={{ fontWeight: "var(--joy-fontWeight-md)" }}>
        <Stack direction="row" spacing={1} alignItems="center">
          {hasWarning ? (
            <AlertTriangle
              className="h-4 w-4"
              style={{ color: "var(--joy-palette-warning-600)" }}
            />
          ) : null}
          {domain.domain_name}
        </Stack>
      </JoyTableCell>
      <JoyTableCell>{getStatusBadge(domain.verification_status)}</JoyTableCell>
      <JoyTableCell sx={{ textAlign: "right" }}>
        {domain.emails_sent_30d.toLocaleString()}
      </JoyTableCell>
      <JoyTableCell sx={{ textAlign: "right" }}>
        {domain.emails_delivered_30d.toLocaleString()}
      </JoyTableCell>
      <JoyTableCell sx={{ textAlign: "right" }}>
        {getRateDisplay(
          domain.open_rate_30d,
          getOpenClickRateStatus(domain.open_rate_30d),
        )}
      </JoyTableCell>
      <JoyTableCell sx={{ textAlign: "right" }}>
        {getRateDisplay(
          domain.click_rate_30d,
          getOpenClickRateStatus(domain.click_rate_30d),
        )}
      </JoyTableCell>
      <JoyTableCell sx={{ textAlign: "right" }}>
        {getRateDisplay(domain.bounce_rate_30d, bounceStatus)}
      </JoyTableCell>
      <JoyTableCell sx={{ textAlign: "right" }}>
        {getRateDisplay(domain.complaint_rate_30d, complaintStatus)}
      </JoyTableCell>
    </JoyTableRow>
  );
};

export const DomainReputationDashboard = ({
  tenantId,
}: DomainReputationDashboardProps) => {
  const { data: domains, isLoading, error } = useDomainStats(tenantId);

  if (isLoading) {
    return (
      <JoyCard>
        <JoyCardHeader title="Domain Reputation (30-Day)" />
        <JoyCardContent>
          <JoyTable containerSx={{ minWidth: 920 }}>
            <JoyTableHead>
              <JoyTableRow>
                <JoyTableHeaderCell>Domain</JoyTableHeaderCell>
                <JoyTableHeaderCell>Status</JoyTableHeaderCell>
                <JoyTableHeaderCell align="right">Sent</JoyTableHeaderCell>
                <JoyTableHeaderCell align="right">Delivered</JoyTableHeaderCell>
                <JoyTableHeaderCell align="right">Open Rate</JoyTableHeaderCell>
                <JoyTableHeaderCell align="right">
                  Click Rate
                </JoyTableHeaderCell>
                <JoyTableHeaderCell align="right">
                  Bounce Rate
                </JoyTableHeaderCell>
                <JoyTableHeaderCell align="right">
                  Complaint Rate
                </JoyTableHeaderCell>
              </JoyTableRow>
            </JoyTableHead>
            <JoyTableBody>
              {Array.from({ length: 4 }).map((_, index) => (
                <JoyTableRow key={index}>
                  {Array.from({ length: 8 }).map((__, cellIndex) => (
                    <JoyTableCell key={cellIndex}>
                      <Skeleton sx={{ height: 20, width: "100%" }} />
                    </JoyTableCell>
                  ))}
                </JoyTableRow>
              ))}
            </JoyTableBody>
          </JoyTable>
        </JoyCardContent>
      </JoyCard>
    );
  }

  if (error) {
    return (
      <JoyCard>
        <JoyCardHeader title="Domain Reputation (30-Day)" />
        <JoyCardContent>
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ color: "danger.600" }}
          >
            <XCircle className="h-5 w-5" />
            <span>Failed to load domain stats</span>
          </Stack>
        </JoyCardContent>
      </JoyCard>
    );
  }

  if (!domains || domains.length === 0) {
    return (
      <JoyCard>
        <JoyCardHeader title="Domain Reputation (30-Day)" />
        <JoyCardContent>
          <Stack spacing={0.75} alignItems="center" sx={{ py: 4 }}>
            <Clock
              className="h-5 w-5"
              style={{ color: "var(--joy-palette-neutral-400)" }}
            />
            <Typography level="title-sm">
              No sending domains configured
            </Typography>
            <Typography level="body-sm" color="neutral" textAlign="center">
              Add and verify a sending domain before reviewing reputation
              metrics.
            </Typography>
          </Stack>
        </JoyCardContent>
      </JoyCard>
    );
  }

  const domainsWithIssues = domains.filter(
    (d) =>
      getBounceRateStatus(d.bounce_rate_30d) !== "good" ||
      getComplaintRateStatus(d.complaint_rate_30d) !== "good",
  );

  return (
    <JoyCard>
      <JoyCardHeader
        title={
          <Stack direction="row" spacing={1} alignItems="center">
            <span>Domain Reputation (30-Day)</span>
            {domainsWithIssues.length > 0 ? (
              <Chip color="danger" size="sm" variant="soft">
                {domainsWithIssues.length} Issue(s)
              </Chip>
            ) : null}
          </Stack>
        }
        actions={
          <Stack direction="row" spacing={2} alignItems="center">
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Box
                component="span"
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  backgroundColor: "success.500",
                }}
              />
              <Typography level="body-xs" color="neutral">
                Good
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Box
                component="span"
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  backgroundColor: "warning.500",
                }}
              />
              <Typography level="body-xs" color="neutral">
                Warning
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Box
                component="span"
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  backgroundColor: "danger.500",
                }}
              />
              <Typography level="body-xs" color="neutral">
                Danger
              </Typography>
            </Stack>
          </Stack>
        }
      />
      <JoyCardContent>
        <Sheet variant="outlined" sx={{ borderRadius: "var(--joy-radius-lg)" }}>
          <JoyTable containerSx={{ minWidth: 920 }}>
            <JoyTableHead>
              <JoyTableRow>
                <JoyTableHeaderCell>Domain</JoyTableHeaderCell>
                <JoyTableHeaderCell>Status</JoyTableHeaderCell>
                <JoyTableHeaderCell align="right">Sent</JoyTableHeaderCell>
                <JoyTableHeaderCell align="right">Delivered</JoyTableHeaderCell>
                <JoyTableHeaderCell align="right">Open Rate</JoyTableHeaderCell>
                <JoyTableHeaderCell align="right">
                  Click Rate
                </JoyTableHeaderCell>
                <JoyTableHeaderCell align="right">
                  Bounce Rate
                </JoyTableHeaderCell>
                <JoyTableHeaderCell align="right">
                  Complaint Rate
                </JoyTableHeaderCell>
              </JoyTableRow>
            </JoyTableHead>
            <JoyTableBody>
              {domains.map((domain) => (
                <DomainRow key={domain.domain_id} domain={domain} />
              ))}
            </JoyTableBody>
          </JoyTable>
        </Sheet>
        <Typography level="body-xs" color="neutral" sx={{ mt: 2 }}>
          <strong>Thresholds:</strong> Bounce rate &gt;2% = warning, &gt;5% =
          danger. Complaint rate &gt;0.1% = warning, &gt;0.2% = danger.
        </Typography>
      </JoyCardContent>
    </JoyCard>
  );
};
