import Box from "@mui/joy/Box";
import Divider from "@mui/joy/Divider";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowRight,
  ChevronRight,
  MoreHorizontal,
  PencilLine,
  Trash2,
  Users,
} from "lucide-react";
import {
  JoyCard,
  JoyCardContent,
  JoyCardFooter,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  JoyDropdownMenu,
  JoyDropdownMenuContent,
  JoyDropdownMenuItem,
  JoyDropdownMenuTrigger,
} from "@/components/joy/JoyDropdownMenu";
import { SegmentStatusBadge } from "@/components/crm/segments/SegmentStatusBadge";
import { SegmentTypeBadge } from "@/components/crm/segments/SegmentTypeBadge";
import type { SegmentListItem } from "@/hooks/useSegments";

export interface SegmentCardProps {
  segment: SegmentListItem;
  summary: string;
  onEdit: (segmentId: string) => void;
  onViewMembers: (segmentId: string) => void;
  onDelete: (segment: SegmentListItem) => void;
}

export function SegmentCard({
  segment,
  summary,
  onEdit,
  onViewMembers,
  onDelete,
}: SegmentCardProps) {
  const updatedLabel = segment.updatedAt
    ? formatDistanceToNow(new Date(segment.updatedAt), { addSuffix: true })
    : "Recently created";

  return (
    <JoyCard sx={{ minHeight: 320 }}>
      <JoyCardHeader
        actions={
          <JoyDropdownMenu>
            <JoyDropdownMenuTrigger>
              <MoreHorizontal size={16} />
            </JoyDropdownMenuTrigger>
            <JoyDropdownMenuContent>
              <JoyDropdownMenuItem
                onClick={() => onEdit(segment.id)}
                startDecorator={<PencilLine size={16} />}
              >
                Edit segment
              </JoyDropdownMenuItem>
              <JoyDropdownMenuItem
                onClick={() => onViewMembers(segment.id)}
                startDecorator={<Users size={16} />}
              >
                View members
              </JoyDropdownMenuItem>
              <JoyDropdownMenuItem
                destructive
                onClick={() => onDelete(segment)}
                startDecorator={<Trash2 size={16} />}
              >
                Delete segment
              </JoyDropdownMenuItem>
            </JoyDropdownMenuContent>
          </JoyDropdownMenu>
        }
        description={segment.description || "No description yet."}
        title={segment.name}
      >
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          <SegmentTypeBadge type={segment.type} />
          <SegmentStatusBadge status={segment.status} />
        </Stack>
      </JoyCardHeader>

      <JoyCardContent
        sx={{ gap: 2, display: "flex", flexDirection: "column", pt: 3 }}
      >
        <Stack direction="row" spacing={2}>
          <Box sx={{ flex: 1 }}>
            <Typography level="body-xs" color="neutral">
              Members
            </Typography>
            <Typography level="title-lg">
              {segment.memberCount.toLocaleString()}
            </Typography>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography level="body-xs" color="neutral">
              Updated
            </Typography>
            <Typography level="body-sm">{updatedLabel}</Typography>
          </Box>
        </Stack>

        <Divider />

        <Box sx={{ minHeight: 82 }}>
          <Typography level="body-xs" color="neutral" sx={{ mb: 0.75 }}>
            Audience logic
          </Typography>
          <Typography level="body-sm" sx={{ color: "neutral.700" }}>
            {summary}
          </Typography>
        </Box>
      </JoyCardContent>

      <JoyCardFooter
        sx={{ justifyContent: "space-between", alignItems: "center" }}
      >
        <Typography level="body-xs" color="neutral">
          {segment.type === "dynamic"
            ? "Auto-updates when customers change"
            : "Members are managed manually"}
        </Typography>
        <Stack direction="row" spacing={1}>
          <JoyButton
            bloomVariant="ghost"
            onClick={() => onViewMembers(segment.id)}
            startDecorator={<Users size={16} />}
          >
            Members
          </JoyButton>
          <JoyButton
            onClick={() => onEdit(segment.id)}
            endDecorator={<ChevronRight size={16} />}
          >
            Open
          </JoyButton>
        </Stack>
      </JoyCardFooter>
    </JoyCard>
  );
}
