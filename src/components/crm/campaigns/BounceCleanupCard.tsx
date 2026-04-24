import * as React from "react";
import Chip from "@mui/joy/Chip";
import CircularProgress from "@mui/joy/CircularProgress";
import IconButton from "@mui/joy/IconButton";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoySwitch } from "@/components/joy/JoySwitch";
import {
  JoyTable,
  JoyTableBody,
  JoyTableCell,
  JoyTableHead,
  JoyTableHeaderCell,
  JoyTableRow,
} from "@/components/joy/JoyTable";
import { useCampaignBounces } from "@/hooks/useCampaignBounces";

interface BounceCleanupCardProps {
  campaignId: string;
}

export function BounceCleanupCard({ campaignId }: BounceCleanupCardProps) {
  const {
    bouncedEmails,
    isLoading,
    unsuppressedCount,
    suppressAll,
    isSuppressing,
    toggleSuppression,
    activeBounceId,
  } = useCampaignBounces(campaignId);
  const [page, setPage] = React.useState(1);
  const pageSize = 10;

  React.useEffect(() => {
    setPage(1);
  }, [campaignId, bouncedEmails.length]);

  const pageCount = Math.max(1, Math.ceil(bouncedEmails.length / pageSize));
  const visibleRows = bouncedEmails.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

  if (isLoading) {
    return (
      <JoyCard variant="outlined">
        <JoyCardHeader
          title="Bounced Recipients"
          description="Review and suppress bounced recipients before the next send."
        />
        <JoyCardContent>
          <Stack spacing={1.5}>
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} variant="rectangular" height={48} />
            ))}
          </Stack>
        </JoyCardContent>
      </JoyCard>
    );
  }

  if (bouncedEmails.length === 0) {
    return null;
  }

  return (
    <JoyCard variant="outlined">
      <JoyCardHeader
        title="Bounced Recipients"
        description="Hard bounces should typically be suppressed before future campaigns."
        actions={
          <Chip variant="soft" color="warning">
            {bouncedEmails.length.toLocaleString()}
          </Chip>
        }
      />
      <JoyCardContent>
        <Stack spacing={2}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            spacing={1.5}
            alignItems={{ xs: "flex-start", sm: "center" }}
          >
            <Typography level="body-sm" color="neutral">
              {unsuppressedCount.toLocaleString()} recipient
              {unsuppressedCount === 1 ? "" : "s"} still need suppression.
            </Typography>
            <JoyButton
              color="danger"
              bloomVariant="secondary"
              size="sm"
              disabled={unsuppressedCount === 0 || isSuppressing}
              onClick={() => suppressAll()}
            >
              {isSuppressing ? <CircularProgress size="sm" /> : null}
              Suppress All Hard Bounces
            </JoyButton>
          </Stack>

          <JoyTable variant="plain" borderAxis="none" stickyHeader>
            <JoyTableHead>
              <JoyTableRow>
                <JoyTableHeaderCell>Email</JoyTableHeaderCell>
                <JoyTableHeaderCell>Bounce Type</JoyTableHeaderCell>
                <JoyTableHeaderCell>Bounce Reason</JoyTableHeaderCell>
                <JoyTableHeaderCell align="right">Suppress</JoyTableHeaderCell>
              </JoyTableRow>
            </JoyTableHead>
            <JoyTableBody>
              {visibleRows.map((bounce) => {
                const isActive = activeBounceId === bounce.id && isSuppressing;

                return (
                  <JoyTableRow key={bounce.id}>
                    <JoyTableCell>
                      <Typography level="body-sm" fontWeight="md">
                        {bounce.email}
                      </Typography>
                    </JoyTableCell>
                    <JoyTableCell>
                      <Chip
                        size="sm"
                        variant="soft"
                        color={
                          bounce.bounceType?.toLowerCase() === "hard"
                            ? "danger"
                            : "warning"
                        }
                      >
                        {bounce.bounceType
                          ? `${bounce.bounceType} bounce`
                          : "Unknown"}
                      </Chip>
                    </JoyTableCell>
                    <JoyTableCell>
                      <Typography level="body-sm" color="neutral">
                        {bounce.bounceMessage || "No bounce details provided."}
                      </Typography>
                    </JoyTableCell>
                    <JoyTableCell align="right">
                      <Stack
                        direction="row"
                        spacing={1}
                        justifyContent="flex-end"
                        alignItems="center"
                      >
                        {isActive ? <CircularProgress size="sm" /> : null}
                        <JoySwitch
                          checked={bounce.isSuppressed}
                          disabled={isActive}
                          onCheckedChange={(checked) =>
                            toggleSuppression(bounce, checked)
                          }
                        />
                      </Stack>
                    </JoyTableCell>
                  </JoyTableRow>
                );
              })}
            </JoyTableBody>
          </JoyTable>

          {pageCount > 1 ? (
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
            >
              <Typography level="body-sm" color="neutral">
                Page {page} of {pageCount}
              </Typography>
              <Stack direction="row" spacing={0.5}>
                <IconButton
                  size="sm"
                  variant="plain"
                  color="neutral"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  <ChevronLeft size={16} />
                </IconButton>
                <IconButton
                  size="sm"
                  variant="plain"
                  color="neutral"
                  disabled={page >= pageCount}
                  onClick={() =>
                    setPage((current) => Math.min(pageCount, current + 1))
                  }
                >
                  <ChevronRight size={16} />
                </IconButton>
              </Stack>
            </Stack>
          ) : null}

          <Stack direction="row" spacing={1} alignItems="center">
            <AlertTriangle size={16} />
            <Typography level="body-xs" color="neutral">
              Suppression updates only affect future sends. They do not alter
              this campaign's historical metrics.
            </Typography>
          </Stack>
        </Stack>
      </JoyCardContent>
    </JoyCard>
  );
}
