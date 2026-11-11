import * as React from "react";
import { CatalogListRow } from "@/components/crm/catalog/CatalogListRow";
import type { CatalogLayout } from "@/components/crm/catalog/CatalogViewToggle";
import Avatar from "@mui/joy/Avatar";
import Divider from "@mui/joy/Divider";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { MoreHorizontal } from "lucide-react";
import { Link as RouterLink } from "react-router-dom";
import { getSegmentIcon } from "@/components/icons/segments";
import { formatSegmentValue } from "@/lib/crm/systemSegmentDataAvailability";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import Button from "@mui/joy/Button";
import { JoyChip } from "@/components/joy/JoyChip";
import {
  JoyDropdownMenu,
  JoyDropdownMenuContent,
  JoyDropdownMenuItem,
  JoyDropdownMenuSeparator,
  JoyDropdownMenuTrigger,
} from "@/components/joy/JoyDropdownMenu";

export interface SegmentCatalogItem {
  id: string;
  name: string;
  description: string;
  isSystemSegment: boolean;
  memberCount: number;
  /** null when spend is unknown; never rendered as $0. */
  averageValue: number | null;
  totalValue: number | null;
  /** Plain explanation shown instead of a bare 0 when the group cannot fill yet. */
  emptyReason?: string | null;
}

interface SegmentCatalogCardProps {
  layout?: CatalogLayout;
  item: SegmentCatalogItem;
  detailHref: string;
  campaignHref: string;
  membersHref: string;
  onView: () => void;
  onViewMembers: () => void;
  onCreateCampaign: () => void;
  onExportMembers: () => void;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onArchive?: () => void;
}

const stopPropagation = (event: React.MouseEvent<HTMLElement>) => {
  event.stopPropagation();
};

export function SegmentCatalogCard({
  layout = "grid",
  item,
  detailHref,
  campaignHref,
  membersHref,
  onView,
  onViewMembers,
  onCreateCampaign,
  onExportMembers,
  onEdit,
  onDuplicate,
  onArchive,
}: SegmentCatalogCardProps) {
  const SegmentIcon = getSegmentIcon(item.id, item.name, item.isSystemSegment);

  const actions = (
    <JoyDropdownMenu>
      <JoyDropdownMenuTrigger
        aria-label={`Actions for ${item.name}`}
        onClick={stopPropagation}
        iconButtonSx={{ width: 40, height: 40, minWidth: 40, minHeight: 40 }}
      >
        <MoreHorizontal size={16} />
      </JoyDropdownMenuTrigger>
      <JoyDropdownMenuContent onClick={stopPropagation}>
        <JoyDropdownMenuItem onClick={onView}>
          View details
        </JoyDropdownMenuItem>
        <JoyDropdownMenuItem onClick={onViewMembers}>
          View members
        </JoyDropdownMenuItem>
        <JoyDropdownMenuItem onClick={onCreateCampaign}>
          Create campaign
        </JoyDropdownMenuItem>
        <JoyDropdownMenuItem onClick={onExportMembers}>
          Export members
        </JoyDropdownMenuItem>
        {!item.isSystemSegment && (onEdit || onDuplicate || onArchive) ? (
          <>
            <JoyDropdownMenuSeparator />
            {onEdit ? (
              <JoyDropdownMenuItem onClick={onEdit}>
                Edit segment
              </JoyDropdownMenuItem>
            ) : null}
            {onDuplicate ? (
              <JoyDropdownMenuItem onClick={onDuplicate}>
                Duplicate segment
              </JoyDropdownMenuItem>
            ) : null}
            {onArchive ? (
              <JoyDropdownMenuItem destructive onClick={onArchive}>
                Archive segment
              </JoyDropdownMenuItem>
            ) : null}
          </>
        ) : null}
      </JoyDropdownMenuContent>
    </JoyDropdownMenu>
  );

  if (layout === "list") {
    return (
      <CatalogListRow
        name={item.name}
        description={item.description}
        icon={<SegmentIcon size={20} />}
        isCustom={!item.isSystemSegment}
        detailHref={detailHref}
        campaignHref={campaignHref}
        actions={actions}
        metrics={[
          { label: "Members", value: item.memberCount === 0 && item.emptyReason ? item.emptyReason : `${item.memberCount.toLocaleString()} members` },
          { label: "Average value", value: formatSegmentValue(item.averageValue, item.memberCount) },
          { label: "Total value", value: formatSegmentValue(item.totalValue, item.memberCount) },
        ]}
      />
    );
  }

  return (
    <JoyCard
      interactive
      onClick={onView}
      sx={{
        minHeight: 280,
        borderColor: "neutral.200",
        backgroundColor: "background.surface",
        boxShadow: "var(--joy-shadow-xs)",
        transition: "border-color 160ms ease, box-shadow 160ms ease",
        "&:hover": {
          borderColor: "neutral.300",
          boxShadow: "var(--joy-shadow-sm)",
          backgroundColor: "background.surface",
        },
      }}
    >
      <JoyCardHeader
        title={item.name}
        description={item.description}
        startDecorator={
          <Avatar
            variant="soft"
            color={item.isSystemSegment ? "neutral" : "primary"}
            sx={{
              "--Avatar-size": "40px",
              flexShrink: 0,
              "& svg": {
                display: "block",
              },
            }}
          >
            <SegmentIcon size={22} />
          </Avatar>
        }
        actions={actions}
      />

      <JoyCardContent
        sx={{ pt: 2, display: "flex", flexDirection: "column", gap: 1.75 }}
      >
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          <JoyChip size="sm" variant="outlined" color="neutral">
            {item.isSystemSegment ? "System" : "Custom"}
          </JoyChip>
        </Stack>

        <Stack spacing={1.25}>
          <Stack spacing={0.35}>
            <Typography level="body-xs" color="neutral">
              Members
            </Typography>
            {item.memberCount === 0 && item.emptyReason ? (
              <Typography level="body-sm" color="neutral">
                {item.emptyReason}
              </Typography>
            ) : (
              <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                {item.memberCount.toLocaleString()} members
              </Typography>
            )}
          </Stack>

          <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
            <Stack spacing={0.35} sx={{ minWidth: 110 }}>
              <Typography level="body-xs" color="neutral">
                Average value
              </Typography>
              <Typography level="body-sm" sx={{ fontWeight: 500 }}>
                {formatSegmentValue(item.averageValue, item.memberCount)}
              </Typography>
            </Stack>
            <Stack spacing={0.35} sx={{ minWidth: 110 }}>
              <Typography level="body-xs" color="neutral">
                Total value
              </Typography>
              <Typography level="body-sm" sx={{ fontWeight: 500 }}>
                {formatSegmentValue(item.totalValue, item.memberCount)}
              </Typography>
            </Stack>
          </Stack>
        </Stack>

        <Divider />

        <Stack
          direction="row"
          justifyContent="flex-end"
          alignItems="center"
          spacing={1}
          mt="auto"
        >
          <Button
            size="sm"
            variant="soft"
            color="neutral"
            component={RouterLink}
            to={detailHref}
            onClick={stopPropagation}
          >
            View details
          </Button>
          <Button
            size="sm"
            variant="solid"
            color="primary"
            component={RouterLink}
            to={campaignHref}
            onClick={stopPropagation}
          >
            Create campaign
          </Button>
        </Stack>
      </JoyCardContent>
    </JoyCard>
  );
}
