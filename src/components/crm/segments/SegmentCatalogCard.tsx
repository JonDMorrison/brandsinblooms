import * as React from "react";
import Avatar from "@mui/joy/Avatar";
import Divider from "@mui/joy/Divider";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { MoreHorizontal } from "lucide-react";
import { Link as RouterLink } from "react-router-dom";
import { getSegmentIcon } from "@/components/icons/segments";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoyButton } from "@/components/joy/JoyButton";
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
  averageValue: number;
  totalValue: number;
}

interface SegmentCatalogCardProps {
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
        actions={
          <JoyDropdownMenu>
            <JoyDropdownMenuTrigger>
              <MoreHorizontal size={16} />
            </JoyDropdownMenuTrigger>
            <JoyDropdownMenuContent>
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
        }
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
            <Typography level="body-sm" sx={{ fontWeight: 600 }}>
              {item.memberCount.toLocaleString()} members
            </Typography>
          </Stack>

          <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
            <Stack spacing={0.35} sx={{ minWidth: 110 }}>
              <Typography level="body-xs" color="neutral">
                Average value
              </Typography>
              <Typography level="body-sm" sx={{ fontWeight: 500 }}>
                ${item.averageValue.toLocaleString()}
              </Typography>
            </Stack>
            <Stack spacing={0.35} sx={{ minWidth: 110 }}>
              <Typography level="body-xs" color="neutral">
                Total value
              </Typography>
              <Typography level="body-sm" sx={{ fontWeight: 500 }}>
                ${item.totalValue.toLocaleString()}
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
          <JoyButton
            size="sm"
            variant="soft"
            color="neutral"
            component={RouterLink}
            to={detailHref}
            onClick={stopPropagation}
          >
            View details
          </JoyButton>
          <JoyButton
            size="sm"
            variant="solid"
            color="primary"
            component={RouterLink}
            to={campaignHref}
            onClick={stopPropagation}
          >
            Create campaign
          </JoyButton>
        </Stack>
      </JoyCardContent>
    </JoyCard>
  );
}
