import Box from "@mui/joy/Box";
import Chip from "@mui/joy/Chip";
import Divider from "@mui/joy/Divider";
import LinearProgress from "@mui/joy/LinearProgress";
import List from "@mui/joy/List";
import ListItem from "@mui/joy/ListItem";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Activity, DollarSign, Users } from "lucide-react";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import type { SegmentPreviewResult } from "@/hooks/useSegmentPreview";

function MetricBlock({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <Box sx={{ flex: 1 }}>
      <Typography level="body-xs" color="neutral">
        {label}
      </Typography>
      <Typography level="title-lg">{value}</Typography>
      {helper ? (
        <Typography level="body-xs" color="neutral">
          {helper}
        </Typography>
      ) : null}
    </Box>
  );
}

export function SegmentLivePreview({
  preview,
  loading,
}: {
  preview: SegmentPreviewResult;
  loading?: boolean;
}) {
  return (
    <JoyCard>
      <JoyCardHeader
        description="Debounced against live tenant customer data for fast audience validation."
        title="Live preview"
      />
      <JoyCardContent
        sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: 3 }}
      >
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          useFlexGap
          flexWrap="wrap"
        >
          <Chip
            color="primary"
            size="sm"
            startDecorator={<Users size={14} />}
            variant="soft"
          >
            {preview.countLabel} customers
          </Chip>
          <Chip color="neutral" size="sm" variant="outlined">
            {preview.percentage}% of tenant audience
          </Chip>
          <Stack
            direction="row"
            spacing={0.5}
            alignItems="center"
            sx={{ color: "neutral.500" }}
          >
            <Activity size={14} />
            <Typography level="body-xs" color="neutral">
              {loading ? "Updating..." : preview.updatedLabel}
            </Typography>
          </Stack>
        </Stack>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <MetricBlock
            helper="Average across matched customers"
            label="Average LTV"
            value={`$${preview.averageLifetimeValue.toFixed(0)}`}
          />
          <MetricBlock
            helper={
              preview.averageLifetimeValueDelta >= 0
                ? "Above tenant average"
                : "Below tenant average"
            }
            label="LTV delta"
            value={`${preview.averageLifetimeValueDelta >= 0 ? "+" : ""}$${preview.averageLifetimeValueDelta.toFixed(0)}`}
          />
        </Stack>

        <Divider />

        <Stack spacing={1.25}>
          <Typography level="title-sm">Lifecycle distribution</Typography>
          {preview.lifecycleBreakdown.length ? (
            preview.lifecycleBreakdown.map((item) => (
              <Stack key={item.label} spacing={0.5}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  spacing={1}
                >
                  <Typography level="body-sm">{item.label}</Typography>
                  <Typography level="body-sm" color="neutral">
                    {item.count} · {item.percentage}%
                  </Typography>
                </Stack>
                <LinearProgress
                  determinate
                  size="sm"
                  value={Math.min(item.percentage, 100)}
                />
              </Stack>
            ))
          ) : (
            <Typography level="body-sm" color="neutral">
              No matching customers yet.
            </Typography>
          )}
        </Stack>

        <Divider />

        <Stack spacing={1.25}>
          <Typography level="title-sm">Sample members</Typography>
          <List sx={{ gap: 1, "--List-padding": "0px" }}>
            {preview.sampleMembers.length ? (
              preview.sampleMembers.map((member) => (
                <ListItem key={member.id} sx={{ px: 0, py: 0.5 }}>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    spacing={2}
                    sx={{ width: "100%" }}
                  >
                    <Box>
                      <Typography level="body-sm">{member.name}</Typography>
                      <Typography level="body-xs" color="neutral">
                        {member.email}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip size="sm" variant="outlined">
                        {member.lifecycleStage}
                      </Chip>
                      <Chip
                        size="sm"
                        startDecorator={<DollarSign size={14} />}
                        variant="soft"
                      >
                        {member.preferredChannel || "none"}
                      </Chip>
                    </Stack>
                  </Stack>
                </ListItem>
              ))
            ) : (
              <ListItem sx={{ px: 0 }}>
                <Typography level="body-sm" color="neutral">
                  Add valid rules to preview the first matching customers.
                </Typography>
              </ListItem>
            )}
          </List>
        </Stack>
      </JoyCardContent>
    </JoyCard>
  );
}
