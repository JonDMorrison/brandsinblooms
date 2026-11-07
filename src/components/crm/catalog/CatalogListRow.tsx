import type { ReactNode } from "react";
import Avatar from "@mui/joy/Avatar";
import Link from "@mui/joy/Link";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Link as RouterLink } from "react-router-dom";
import Button from "@mui/joy/Button";
import { JoyChip } from "@/components/joy/JoyChip";

interface CatalogListRowProps {
  name: string;
  description?: string | null;
  icon: ReactNode;
  isCustom: boolean;
  detailHref: string;
  campaignHref: string;
  metrics: Array<{ label: string; value: ReactNode }>;
  actions: ReactNode;
}

export function CatalogListRow({
  name, description, icon, isCustom, detailHref, campaignHref, metrics, actions,
}: CatalogListRowProps) {
  return (
    <Sheet
      component="article"
      aria-label={name}
      variant="outlined"
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(0, 1.2fr) minmax(0, 1fr) auto" },
        alignItems: "center",
        gap: 2,
        p: { xs: 2, md: 2.5 },
        minWidth: 0,
        borderRadius: "lg",
        borderColor: "neutral.200",
        backgroundColor: "background.surface",
      }}
    >
      <Stack direction="row" spacing={1.5} sx={{ minWidth: 0 }}>
        <Avatar variant="soft" color={isCustom ? "primary" : "neutral"} sx={{ "--Avatar-size": "36px" }}>
          {icon}
        </Avatar>
        <Stack spacing={0.5} sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
            <Link component={RouterLink} to={detailHref} level="title-sm" color="neutral" sx={{ overflowWrap: "anywhere" }}>
              {name}
            </Link>
            <JoyChip size="sm" variant="outlined" color="neutral">{isCustom ? "Custom" : "System"}</JoyChip>
          </Stack>
          {description ? (
            <Typography level="body-sm" color="neutral" sx={{ overflowWrap: "anywhere" }}>{description}</Typography>
          ) : null}
        </Stack>
      </Stack>
      <Stack component="dl" direction="row" spacing={2} useFlexGap flexWrap="wrap" sx={{ m: 0, minWidth: 0 }}>
        {metrics.map(({ label, value }) => (
          <Stack key={label} spacing={0.35} sx={{ minWidth: 80, flex: "1 1 80px" }}>
            <Typography component="dt" level="body-xs" color="neutral">{label}</Typography>
            <Typography component="dd" level="body-sm" sx={{ m: 0, fontWeight: 600, overflowWrap: "anywhere" }}>{value}</Typography>
          </Stack>
        ))}
      </Stack>
      <Stack direction="row" spacing={0.75} alignItems="center" useFlexGap flexWrap="wrap">
        <Button component={RouterLink} to={detailHref} size="sm" variant="plain" color="neutral" sx={{ minHeight: 40 }}>
          View details
        </Button>
        <Button component={RouterLink} to={campaignHref} size="sm" variant="soft" color="primary" sx={{ minHeight: 40 }}>
          Create campaign
        </Button>
        {actions}
      </Stack>
    </Sheet>
  );
}
