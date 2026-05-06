import Box from "@mui/joy/Box";
import Link from "@mui/joy/Link";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { JoyCard, JoyCardContent } from "@/components/joy/JoyCard";
import { JoyStatusChip } from "@/components/joy/JoyChip";
import {
  JoyTable,
  JoyTableBody,
  JoyTableCell,
  JoyTableHead,
  JoyTableHeaderCell,
  JoyTableRow,
} from "@/components/joy/JoyTable";
import {
  JoyDropdownMenu,
  JoyDropdownMenuContent,
  JoyDropdownMenuItem,
  JoyDropdownMenuTrigger,
} from "@/components/joy/JoyDropdownMenu";
import {
  Building2,
  CreditCard,
  Eye,
  Edit3,
  LogIn,
  Mail,
  MessageSquare,
  MoreHorizontal,
  PauseCircle,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

export interface AdminTenant {
  tenant_id: string;
  company_name: string;
  website: string;
  city: string;
  region: string;
  country: string;
  onboarding_completed_at: string | null;
  tenant_created_at: string;
  primary_contact_email: string;
  primary_contact_name: string;
  primary_contact_last_login: string | null;
  plan: string;
  subscription_status: string;
  trial_start: string | null;
  trial_end: string | null;
  current_period_end: string | null;
  last_activity_at: string | null;
  is_trialing: boolean;
  is_paid_active: boolean;
  trial_not_expired: boolean;
  is_active: boolean;
  health_score: number | null;
  onboarding_steps_done: number | null;
  onboarding_steps_total: number | null;
}

interface TenantTableProps {
  tenants: AdminTenant[];
  loading?: boolean;
  pageSize?: number;
  onViewTenant: (tenant: AdminTenant) => void;
  onExtendTrial: (tenantId: string, days: number) => void;
  onToggleActive: (tenantId: string, active: boolean) => void;
  onEmailManagement: (tenantId: string) => void;
  onChangePlan: (tenant: AdminTenant) => void;
  onOutreach: (tenant: AdminTenant) => void;
  onImpersonate: (tenant: AdminTenant) => void;
}

const getStatusChip = (tenant: AdminTenant) => {
  if (!tenant.is_active) {
    return { tone: "danger" as const, label: "Inactive" };
  }

  if (tenant.is_trialing) {
    return { tone: "warning" as const, label: "Trialing" };
  }

  if (tenant.is_paid_active) {
    return { tone: "success" as const, label: "Active" };
  }

  return { tone: "danger" as const, label: "Expired" };
};

const getHealthChip = (score: number | null) => {
  if (score == null) {
    return null;
  }

  if (score >= 80) {
    return { tone: "success" as const, label: `${score} Health` };
  }

  if (score >= 50) {
    return { tone: "warning" as const, label: `${score} Health` };
  }

  return { tone: "danger" as const, label: `${score} Health` };
};

const hasNoActivity = (dateStr: string | null): boolean => {
  if (!dateStr) return true;
  return new Date(dateStr).getFullYear() < 2000;
};

const getActivityColor = (lastActivity: string | null) => {
  if (hasNoActivity(lastActivity)) {
    return "neutral.400";
  }

  const hoursAgo =
    (Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60);

  if (hoursAgo < 24) {
    return "success.500";
  }

  if (hoursAgo < 168) {
    return "warning.500";
  }

  return "neutral.400";
};

const formatLocation = (city: string, region: string, country: string) => {
  const parts = [city, region, country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "—";
};

export const TenantTable = ({
  tenants,
  loading,
  pageSize = 10,
  onViewTenant,
  onExtendTrial,
  onToggleActive,
  onEmailManagement,
  onChangePlan,
  onOutreach,
  onImpersonate,
}: TenantTableProps) => {
  if (loading) {
    return (
      <JoyCard>
        <JoyCardContent sx={{ pt: 3 }}>
          <JoyTable stickyHeader containerSx={{ minWidth: 960 }}>
            <JoyTableHead>
              <JoyTableRow>
                <JoyTableHeaderCell>Tenant</JoyTableHeaderCell>
                <JoyTableHeaderCell>Domain</JoyTableHeaderCell>
                <JoyTableHeaderCell>Plan / Status</JoyTableHeaderCell>
                <JoyTableHeaderCell>Health</JoyTableHeaderCell>
                <JoyTableHeaderCell>Created</JoyTableHeaderCell>
                <JoyTableHeaderCell align="right">Actions</JoyTableHeaderCell>
              </JoyTableRow>
            </JoyTableHead>
            <JoyTableBody>
              {Array.from({ length: pageSize }).map((_, index) => (
                <JoyTableRow key={index}>
                  {Array.from({ length: 6 }).map((__, cellIndex) => (
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

  if (tenants.length === 0) {
    return (
      <JoyCard>
        <JoyCardContent sx={{ pt: 3 }}>
          <Stack spacing={0.75} alignItems="center" sx={{ py: 6 }}>
            <Building2
              size={22}
              style={{ color: "var(--joy-palette-neutral-400)" }}
            />
            <Typography level="title-sm">
              No tenants match your filters
            </Typography>
            <Typography level="body-sm" color="neutral" textAlign="center">
              Adjust the current filters or clear the current search to broaden
              the result set.
            </Typography>
          </Stack>
        </JoyCardContent>
      </JoyCard>
    );
  }

  return (
    <JoyCard>
      <JoyTable stickyHeader containerSx={{ minWidth: 960 }}>
        <JoyTableHead>
          <JoyTableRow>
            <JoyTableHeaderCell>Tenant</JoyTableHeaderCell>
            <JoyTableHeaderCell>Domain</JoyTableHeaderCell>
            <JoyTableHeaderCell>Plan / Status</JoyTableHeaderCell>
            <JoyTableHeaderCell>Health</JoyTableHeaderCell>
            <JoyTableHeaderCell>Created</JoyTableHeaderCell>
            <JoyTableHeaderCell align="right" sx={{ width: 100 }}>
              Actions
            </JoyTableHeaderCell>
          </JoyTableRow>
        </JoyTableHead>
        <JoyTableBody>
          {tenants.map((tenant) => {
            const statusChip = getStatusChip(tenant);
            const healthChip = getHealthChip(tenant.health_score);

            return (
              <JoyTableRow
                key={tenant.tenant_id}
                clickable
                onClick={() => onViewTenant(tenant)}
              >
                <JoyTableCell>
                  <Stack spacing={0.35}>
                    <Link
                      component="button"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onViewTenant(tenant);
                      }}
                      sx={{
                        color: "primary.700",
                        fontWeight: "var(--joy-fontWeight-semibold)",
                        textDecoration: "none",
                        textAlign: "left",
                        "&:hover": {
                          textDecoration: "underline",
                        },
                      }}
                    >
                      {tenant.company_name || "Unnamed Company"}
                    </Link>
                    {!tenant.onboarding_completed_at &&
                      new Date(tenant.tenant_created_at).getTime() <
                        Date.now() - 7 * 24 * 60 * 60 * 1000 && (
                        <Typography
                          level="body-xs"
                          sx={{
                            px: 0.75,
                            py: 0.25,
                            borderRadius: "4px",
                            backgroundColor: "warning.100",
                            color: "warning.700",
                            fontWeight: 600,
                            fontSize: "10px",
                            display: "inline-block",
                            width: "fit-content",
                          }}
                        >
                          Onboarding stalled
                        </Typography>
                      )}
                    <Typography level="body-sm" color="neutral">
                      {tenant.primary_contact_email || "No contact email"}
                    </Typography>
                  </Stack>
                </JoyTableCell>

                <JoyTableCell>
                  <Stack spacing={0.35}>
                    <Typography
                      level="body-sm"
                      sx={{ fontWeight: "var(--joy-fontWeight-md)" }}
                    >
                      {tenant.website || "No website"}
                    </Typography>
                    <Typography level="body-xs" color="neutral">
                      {formatLocation(
                        tenant.city,
                        tenant.region,
                        tenant.country,
                      )}
                    </Typography>
                  </Stack>
                </JoyTableCell>

                <JoyTableCell>
                  <Stack spacing={0.75}>
                    <Typography
                      level="body-sm"
                      sx={{
                        fontWeight: "var(--joy-fontWeight-md)",
                        textTransform: "capitalize",
                      }}
                    >
                      {tenant.plan || "Custom"}
                    </Typography>
                    <Stack
                      direction="row"
                      spacing={0.75}
                      useFlexGap
                      flexWrap="wrap"
                    >
                      <JoyStatusChip
                        label={statusChip.label}
                        status={statusChip.label}
                        tone={statusChip.tone}
                      />
                      {tenant.trial_end && tenant.is_trialing ? (
                        <Typography level="body-xs" color="neutral">
                          {formatDistanceToNow(new Date(tenant.trial_end), {
                            addSuffix: true,
                          })}
                        </Typography>
                      ) : null}
                    </Stack>
                  </Stack>
                </JoyTableCell>

                <JoyTableCell>
                  {healthChip ? (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Box
                        component="span"
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          backgroundColor:
                            healthChip.tone === "success"
                              ? "success.500"
                              : healthChip.tone === "warning"
                                ? "warning.500"
                                : "danger.500",
                          flexShrink: 0,
                        }}
                      />
                      <JoyStatusChip
                        label={healthChip.label}
                        status={healthChip.label}
                        tone={healthChip.tone}
                      />
                    </Stack>
                  ) : (
                    "—"
                  )}
                </JoyTableCell>

                <JoyTableCell sx={{ whiteSpace: "nowrap" }}>
                  <Stack spacing={0.35}>
                    <Typography level="body-sm">
                      {format(
                        new Date(tenant.tenant_created_at),
                        "MMM d, yyyy",
                      )}
                    </Typography>
                    <Typography level="body-xs" color="neutral">
                      {!hasNoActivity(tenant.last_activity_at)
                        ? `Last active ${formatDistanceToNow(new Date(tenant.last_activity_at!), { addSuffix: true })}`
                        : "No recent activity"}
                    </Typography>
                  </Stack>
                </JoyTableCell>

                <JoyTableCell
                  sx={{ textAlign: "right" }}
                  onClick={(event) => event.stopPropagation()}
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <JoyDropdownMenu>
                    <JoyDropdownMenuTrigger
                      aria-label={`Actions for ${tenant.company_name || "tenant"}`}
                      data-testid={`tenant-actions-${tenant.tenant_id}`}
                      onClick={(event) => event.stopPropagation()}
                      onPointerDown={(event) => event.stopPropagation()}
                      iconButtonSx={{ width: 32, height: 32, ml: "auto" }}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </JoyDropdownMenuTrigger>
                    <JoyDropdownMenuContent
                      placement="bottom-end"
                      sx={{ minWidth: 192 }}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <JoyDropdownMenuItem
                        startDecorator={<Eye className="h-4 w-4" />}
                        onClick={() => onViewTenant(tenant)}
                      >
                        View
                      </JoyDropdownMenuItem>
                      <JoyDropdownMenuItem
                        startDecorator={<Edit3 className="h-4 w-4" />}
                        onClick={() => onChangePlan(tenant)}
                      >
                        Edit Plan
                      </JoyDropdownMenuItem>
                      <JoyDropdownMenuItem
                        color="warning"
                        startDecorator={<LogIn className="h-4 w-4" />}
                        onClick={() => onImpersonate(tenant)}
                      >
                        Login as User
                      </JoyDropdownMenuItem>
                      <JoyDropdownMenuItem
                        startDecorator={<MessageSquare className="h-4 w-4" />}
                        onClick={() => onOutreach(tenant)}
                      >
                        Outreach
                      </JoyDropdownMenuItem>
                      <JoyDropdownMenuItem
                        startDecorator={<Mail className="h-4 w-4" />}
                        onClick={() => onEmailManagement(tenant.tenant_id)}
                      >
                        Email Management
                      </JoyDropdownMenuItem>
                      <JoyDropdownMenuItem
                        color="warning"
                        startDecorator={<PauseCircle className="h-4 w-4" />}
                        onClick={() =>
                          onToggleActive(tenant.tenant_id, !tenant.is_active)
                        }
                      >
                        {tenant.is_active ? "Suspend" : "Reactivate"}
                      </JoyDropdownMenuItem>
                      {tenant.is_trialing ? (
                        <JoyDropdownMenuItem
                          startDecorator={<CreditCard className="h-4 w-4" />}
                          onClick={() => onExtendTrial(tenant.tenant_id, 7)}
                        >
                          Extend Trial (+7 days)
                        </JoyDropdownMenuItem>
                      ) : null}
                    </JoyDropdownMenuContent>
                  </JoyDropdownMenu>
                </JoyTableCell>
              </JoyTableRow>
            );
          })}
        </JoyTableBody>
      </JoyTable>
    </JoyCard>
  );
};
