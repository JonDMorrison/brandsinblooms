import * as React from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Chip from "@mui/joy/Chip";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Table from "@mui/joy/Table";
import Typography from "@mui/joy/Typography";
import { format } from "date-fns";
import {
  Eye,
  FileDown,
  Megaphone,
  MoreHorizontal,
  Plus,
  RotateCcw,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { SMSStats } from "@/hooks/useSMSStats";
import {
  JoyDropdownMenu,
  JoyDropdownMenuContent,
  JoyDropdownMenuItem,
  JoyDropdownMenuTrigger,
} from "@/components/joy/JoyDropdownMenu";

interface SMSCampaignsTableProps {
  campaigns: SMSStats["recentCampaigns"];
  loading?: boolean;
  onCreateCampaign: () => void;
}

type StatusTone = {
  color: "success" | "warning" | "danger" | "primary" | "neutral";
  label: string;
};

const columnWidths = {
  campaign: "30%",
  status: "12%",
  audience: "12%",
  delivered: "11%",
  failed: "10%",
  sentDate: "15%",
  actions: "10%",
} as const;

function getStatusTone(status: string): StatusTone {
  const normalized = status.trim().toLowerCase();

  switch (normalized) {
    case "sent":
    case "delivered":
    case "completed":
      return { color: "success", label: "Delivered" };
    case "sending":
    case "in_progress":
    case "in progress":
    case "processing":
      return { color: "warning", label: "Sending" };
    case "failed":
    case "error":
      return { color: "danger", label: "Failed" };
    case "scheduled":
      return { color: "primary", label: "Scheduled" };
    case "draft":
      return { color: "neutral", label: "Draft" };
    default:
      return {
        color: "neutral",
        label:
          normalized.length > 0
            ? normalized.charAt(0).toUpperCase() + normalized.slice(1)
            : "Draft",
      };
  }
}

function downloadCampaignSummary(
  campaign: SMSStats["recentCampaigns"][number],
) {
  const failedCount = Math.max(campaign.sent - campaign.delivered, 0);
  const csv = [
    [
      "Campaign Name",
      "Status",
      "Audience Size",
      "Delivered",
      "Failed",
      "Sent Date",
      "Clicks",
    ],
    [
      campaign.name,
      campaign.status,
      campaign.sent.toString(),
      campaign.delivered.toString(),
      failedCount.toString(),
      campaign.created_at,
      campaign.clicked.toString(),
    ],
  ]
    .map((row) =>
      row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","),
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `${campaign.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-summary.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

function CampaignSkeletonRow() {
  return (
    <tr>
      <td>
        <Stack spacing={0.75} sx={{ py: 0.75 }}>
          <Skeleton variant="text" sx={{ width: "68%", height: 18 }} />
          <Skeleton variant="text" sx={{ width: "36%", height: 14 }} />
        </Stack>
      </td>
      <td>
        <Skeleton
          variant="rectangular"
          sx={{ width: 82, height: 28, borderRadius: "999px" }}
        />
      </td>
      <td>
        <Skeleton variant="text" sx={{ width: 54, height: 18 }} />
      </td>
      <td>
        <Skeleton variant="text" sx={{ width: 54, height: 18 }} />
      </td>
      <td>
        <Skeleton variant="text" sx={{ width: 42, height: 18 }} />
      </td>
      <td>
        <Skeleton variant="text" sx={{ width: 94, height: 18 }} />
      </td>
      <td>
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <Skeleton variant="circular" width={28} height={28} />
        </Box>
      </td>
    </tr>
  );
}

export const SMSCampaignsTable: React.FC<SMSCampaignsTableProps> = ({
  campaigns,
  loading = false,
  onCreateCampaign,
}) => {
  const navigate = useNavigate();

  return (
    <Stack id="campaigns" spacing={2} sx={{ minWidth: 0 }}>
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          alignItems: { xs: "stretch", md: "center" },
          justifyContent: "space-between",
          gap: 1.5,
        }}
      >
        <Stack spacing={0.5} sx={{ minWidth: 0 }}>
          <Typography level="title-md" fontWeight="lg">
            Recent Campaigns
          </Typography>
          <Typography level="body-sm" color="neutral">
            Your latest SMS marketing campaigns, delivery health, and quick
            actions.
          </Typography>
        </Stack>
        <Button
          onClick={onCreateCampaign}
          variant="outline"
          color="neutral"
          size="sm"
          startDecorator={<Plus size={15} />}
          sx={{
            alignSelf: { xs: "flex-start", md: "center" },
            borderRadius: "12px",
          }}
        >
          New Campaign
        </Button>
      </Box>

      <Sheet
        variant="outlined"
        sx={{
          borderRadius: "24px",
          overflow: "hidden",
          borderColor: "neutral.200",
          backgroundColor: "background.surface",
        }}
      >
        {loading ? (
          <Table
            hoverRow
            stripe="odd"
            sx={{ "--TableCell-headBackground": "transparent" }}
          >
            <thead>
              <tr>
                <th style={{ width: columnWidths.campaign }}>Campaign Name</th>
                <th style={{ width: columnWidths.status }}>Status</th>
                <th style={{ width: columnWidths.audience }}>Audience Size</th>
                <th style={{ width: columnWidths.delivered }}>Delivered</th>
                <th style={{ width: columnWidths.failed }}>Failed</th>
                <th style={{ width: columnWidths.sentDate }}>Sent Date</th>
                <th style={{ width: columnWidths.actions, textAlign: "right" }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, index) => (
                <CampaignSkeletonRow key={index} />
              ))}
            </tbody>
          </Table>
        ) : campaigns.length === 0 ? (
          <Box
            sx={{
              minHeight: 320,
              display: "grid",
              placeItems: "center",
              px: 3,
              py: 8,
              textAlign: "center",
            }}
          >
            <Stack spacing={2.5} alignItems="center" sx={{ maxWidth: 420 }}>
              <Box
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "neutral.500",
                  opacity: 0.45,
                  "& > .lucide": {
                    width: 52,
                    height: 52,
                  },
                }}
              >
                <Megaphone />
              </Box>
              <Stack spacing={0.75}>
                <Typography level="title-md">No campaigns yet</Typography>
                <Typography level="body-sm" color="neutral">
                  Create your first SMS campaign and start reaching customers
                  faster.
                </Typography>
              </Stack>
              <Button
                variant="solid"
                size="sm"
                startDecorator={<Plus size={15} />}
                onClick={onCreateCampaign}
                sx={{ borderRadius: "12px" }}
              >
                Create Campaign
              </Button>
            </Stack>
          </Box>
        ) : (
          <Table
            hoverRow
            stripe="odd"
            sx={{ "--TableCell-headBackground": "transparent" }}
          >
            <thead>
              <tr>
                <th style={{ width: columnWidths.campaign }}>Campaign Name</th>
                <th style={{ width: columnWidths.status }}>Status</th>
                <th style={{ width: columnWidths.audience }}>Audience Size</th>
                <th style={{ width: columnWidths.delivered }}>Delivered</th>
                <th style={{ width: columnWidths.failed }}>Failed</th>
                <th style={{ width: columnWidths.sentDate }}>Sent Date</th>
                <th style={{ width: columnWidths.actions, textAlign: "right" }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => {
                const failedCount = Math.max(
                  campaign.sent - campaign.delivered,
                  0,
                );
                const statusTone = getStatusTone(campaign.status);

                return (
                  <tr key={campaign.id}>
                    <td>
                      <Stack spacing={0.75} sx={{ minWidth: 0, py: 0.75 }}>
                        <Stack
                          direction="row"
                          spacing={1}
                          useFlexGap
                          flexWrap="wrap"
                          alignItems="center"
                        >
                          <Typography level="body-sm" fontWeight="md">
                            {campaign.name}
                          </Typography>
                          {campaign.clicked > 0 ? (
                            <Chip variant="soft" size="sm" color="neutral">
                              {campaign.clicked.toLocaleString()} clicks
                            </Chip>
                          ) : null}
                        </Stack>
                        <Typography level="body-xs" color="neutral">
                          Delivery snapshot for this campaign.
                        </Typography>
                      </Stack>
                    </td>
                    <td>
                      <Chip color={statusTone.color} variant="soft" size="sm">
                        {statusTone.label}
                      </Chip>
                    </td>
                    <td>
                      <Typography level="body-sm">
                        {campaign.sent.toLocaleString()}
                      </Typography>
                    </td>
                    <td>
                      <Typography level="body-sm">
                        {campaign.delivered.toLocaleString()}
                      </Typography>
                    </td>
                    <td>
                      <Typography
                        level="body-sm"
                        sx={{
                          color:
                            failedCount > 0 ? "danger.600" : "text.primary",
                        }}
                      >
                        {failedCount.toLocaleString()}
                      </Typography>
                    </td>
                    <td>
                      <Typography level="body-sm" color="neutral">
                        {format(new Date(campaign.created_at), "MMM d, yyyy")}
                      </Typography>
                    </td>
                    <td>
                      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                        <JoyDropdownMenu>
                          <JoyDropdownMenuTrigger
                            aria-label={`Actions for ${campaign.name}`}
                          >
                            <MoreHorizontal size={16} />
                          </JoyDropdownMenuTrigger>
                          <JoyDropdownMenuContent>
                            <JoyDropdownMenuItem
                              startDecorator={<Eye size={16} />}
                              onClick={() => navigate(`/sms/${campaign.id}`)}
                            >
                              View Details
                            </JoyDropdownMenuItem>
                            <JoyDropdownMenuItem
                              startDecorator={<RotateCcw size={16} />}
                              disabled={failedCount === 0}
                              onClick={() => navigate(`/sms/${campaign.id}`)}
                            >
                              Retry Failed
                            </JoyDropdownMenuItem>
                            <JoyDropdownMenuItem
                              startDecorator={<FileDown size={16} />}
                              onClick={() => downloadCampaignSummary(campaign)}
                            >
                              Export Summary
                            </JoyDropdownMenuItem>
                          </JoyDropdownMenuContent>
                        </JoyDropdownMenu>
                      </Box>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Sheet>
    </Stack>
  );
};
