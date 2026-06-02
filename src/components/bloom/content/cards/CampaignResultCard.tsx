import Box from "@mui/joy/Box";
import Divider from "@mui/joy/Divider";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Megaphone } from "lucide-react";
import { ResultCardShell } from "@/components/bloom/content/cards/ResultCardShell";
import {
  formatDate,
  formatLabel,
  formatNumber,
  formatPercent,
  getValue,
  readString,
  type NormalizedToolResult,
  visibleRows,
} from "@/components/bloom/content/cards/cardUtils";

function MetricGrid({
  metrics,
}: {
  metrics: Array<{ label: string; value: string }>;
}) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "repeat(2, minmax(0, 1fr))",
          sm: "repeat(4, minmax(0, 1fr))",
        },
        mt: 1,
        border: "1px solid",
        borderColor: "neutral.outlinedBorder",
        borderRadius: "var(--joy-radius-md)",
        overflow: "hidden",
      }}
    >
      {metrics.map((metric, index) => (
        <Box
          key={metric.label}
          sx={{
            px: 1,
            py: 1,
            textAlign: "center",
            borderLeft: {
              xs: index % 2 === 1 ? "1px solid" : "none",
              sm: index > 0 ? "1px solid" : "none",
            },
            borderTop: { xs: index > 1 ? "1px solid" : "none", sm: "none" },
            borderColor: "neutral.outlinedBorder",
          }}
        >
          <Typography
            level="body-sm"
            sx={{
              color: "neutral.800",
              fontWeight: 500,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {metric.value}
          </Typography>
          <Typography
            level="body-xs"
            sx={{ color: "neutral.500", fontSize: "10px" }}
          >
            {metric.label}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

export function CampaignResultCard({
  result,
}: {
  result: NormalizedToolResult;
}) {
  const { overflow, rows, total } = visibleRows(result);

  return (
    <ResultCardShell
      icon={<Megaphone size={15} strokeWidth={1.9} />}
      title="Campaigns"
      meta={`${total.toLocaleString()} shown`}
    >
      <Stack
        divider={
          <Divider
            sx={{ "--Divider-lineColor": "var(--joy-palette-neutral-100)" }}
          />
        }
      >
        {rows.length > 0 ? (
          rows.map((campaign, index) => {
            const name =
              readString(
                getValue(campaign, ["name", "title", "subject_line"]),
              ) ?? "Untitled campaign";
            const channel = formatLabel(
              getValue(campaign, ["delivery_method", "channel", "type"]),
              "Campaign",
            );
            const sentAt = formatDate(
              getValue(campaign, ["sent_at", "scheduled_at", "created_at"]),
            );
            const recipients = formatNumber(
              getValue(campaign, [
                "total_recipients",
                "recipients",
                "messages_sent",
                "metrics_summary.delivered_count",
              ]),
            );
            const metrics = [
              {
                label: "Open",
                value:
                  formatPercent(
                    getValue(campaign, [
                      "open_rate",
                      "metrics_summary.open_rate",
                    ]),
                  ) ?? "0%",
              },
              {
                label: "Click",
                value:
                  formatPercent(
                    getValue(campaign, [
                      "click_rate",
                      "metrics_summary.click_rate",
                    ]),
                  ) ?? "0%",
              },
              {
                label: "Conv",
                value:
                  formatPercent(
                    getValue(campaign, [
                      "conversion_rate",
                      "metrics_summary.conversion_rate",
                    ]),
                  ) ?? "0%",
              },
              {
                label: "Unsub",
                value:
                  formatPercent(
                    getValue(campaign, [
                      "unsubscribe_rate",
                      "metrics_summary.unsubscribe_rate",
                    ]),
                  ) ?? "0%",
              },
            ];
            const metaLine = [
              channel,
              sentAt ? `Sent ${sentAt}` : null,
              recipients ? `${recipients} recipients` : null,
            ]
              .filter(Boolean)
              .join(" · ");

            return (
              <Box key={`${name}-${index}`} sx={{ py: 1.5 }}>
                <Typography
                  level="body-sm"
                  sx={{
                    color: "neutral.800",
                    fontWeight: 500,
                    overflowWrap: "anywhere",
                  }}
                >
                  {name}
                </Typography>
                {metaLine ? (
                  <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                    {metaLine}
                  </Typography>
                ) : null}
                <MetricGrid metrics={metrics} />
              </Box>
            );
          })
        ) : (
          <Typography level="body-sm" sx={{ color: "neutral.500" }}>
            No campaign rows were returned.
          </Typography>
        )}
      </Stack>
      {overflow > 0 ? (
        <Typography level="body-xs" sx={{ color: "neutral.500", mt: 1.25 }}>
          and {overflow.toLocaleString()} more
        </Typography>
      ) : null}
    </ResultCardShell>
  );
}
