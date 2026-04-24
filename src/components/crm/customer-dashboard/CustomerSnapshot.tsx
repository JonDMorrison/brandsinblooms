import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Compass, MapPin, Store, UserCircle2, Zap } from "lucide-react";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoyChip } from "@/components/joy/JoyChip";
import type { SnapshotMetrics } from "@/lib/customerDashboardTransformers";
import {
  formatAccountAge,
  getScoreColor,
  humanizeChannel,
} from "./customerDashboardUtils";

interface CustomerSnapshotProps {
  customer: {
    name: string;
    email: string;
    city?: string | null;
    stateRegion?: string | null;
    countryCode?: string | null;
    signupSource?: string | null;
    storeName?: string | null;
    engagementTier?: string | null;
  };
  metrics: SnapshotMetrics;
}

const factRows = (
  customer: CustomerSnapshotProps["customer"],
  metrics: SnapshotMetrics,
) => [
  {
    icon: Compass,
    label: "Preferred Channel",
    value: humanizeChannel(metrics.preferredChannel),
  },
  {
    icon: Zap,
    label: "Intent Level",
    value:
      metrics.intentLevel === "unknown"
        ? "Data not available"
        : humanizeChannel(metrics.intentLevel),
  },
  {
    icon: MapPin,
    label: "Location",
    value:
      [customer.city, customer.stateRegion, customer.countryCode]
        .filter(Boolean)
        .join(", ") || "Data not available",
  },
  {
    icon: Store,
    label: "Store",
    value: customer.storeName || "Data not available",
  },
  {
    icon: UserCircle2,
    label: "Signup Source",
    value: customer.signupSource || "Data not available",
  },
  {
    icon: Compass,
    label: "Account Age",
    value: formatAccountAge(metrics.accountAgeDays),
  },
];

export function CustomerSnapshot({ customer, metrics }: CustomerSnapshotProps) {
  const engagementColor = getScoreColor(
    metrics.engagementHealthScore ?? undefined,
  );

  return (
    <JoyCard variant="outlined">
      <JoyCardHeader
        title="Profile summary"
        description="A concise read on channel preference, intent, and customer context."
      />
      <JoyCardContent>
        <Stack spacing={2.5}>
          <Sheet
            variant="soft"
            color="primary"
            sx={{ borderRadius: "xl", p: 2.5 }}
          >
            <Stack spacing={1.25}>
              <Typography
                level="body-xs"
                textTransform="uppercase"
                fontWeight="lg"
              >
                Customer story
              </Typography>
              <Typography level="title-lg">
                {customer.name} is most reachable through{" "}
                {humanizeChannel(metrics.preferredChannel).toLowerCase()} and
                currently shows{" "}
                {metrics.intentLevel === "unknown"
                  ? "an emerging intent profile"
                  : `${metrics.intentLevel.toLowerCase()} commercial intent`}
                .
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                <JoyChip color={engagementColor} variant="solid" size="sm">
                  Engagement {metrics.engagementHealthScore ?? "--"}
                </JoyChip>
                <JoyChip color="primary" variant="soft" size="sm">
                  Intent {metrics.intentScore ?? "--"}
                </JoyChip>
                <JoyChip color="neutral" variant="soft" size="sm">
                  {customer.engagementTier || "Tier unavailable"}
                </JoyChip>
              </Stack>
            </Stack>
          </Sheet>

          <Stack spacing={1.25}>
            {factRows(customer, metrics).map((fact) => {
              const Icon = fact.icon;

              return (
                <Stack
                  key={fact.label}
                  direction="row"
                  spacing={1.5}
                  alignItems="flex-start"
                  sx={{
                    px: 1.25,
                    py: 1,
                    borderRadius: "lg",
                    backgroundColor: "background.level1",
                  }}
                >
                  <Sheet
                    variant="soft"
                    color="neutral"
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: "md",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={16} />
                  </Sheet>
                  <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                    <Typography level="body-xs" color="neutral">
                      {fact.label}
                    </Typography>
                    <Typography level="body-sm">{fact.value}</Typography>
                  </Stack>
                </Stack>
              );
            })}
          </Stack>
        </Stack>
      </JoyCardContent>
    </JoyCard>
  );
}

export default CustomerSnapshot;
