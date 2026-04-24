import IconButton from "@mui/joy/IconButton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { formatDistanceToNow } from "date-fns";
import {
  ChevronRight,
  MoreHorizontal,
  PencilLine,
  Trash2,
  Users,
} from "lucide-react";
import {
  JoyDropdownMenu,
  JoyDropdownMenuContent,
  JoyDropdownMenuItem,
  JoyDropdownMenuTrigger,
} from "@/components/joy/JoyDropdownMenu";
import {
  JoyTable,
  JoyTableBody,
  JoyTableCell,
  JoyTableHead,
  JoyTableHeaderCell,
  JoyTableRow,
} from "@/components/joy/JoyTable";
import { SegmentStatusBadge } from "@/components/crm/segments/SegmentStatusBadge";
import { SegmentTypeBadge } from "@/components/crm/segments/SegmentTypeBadge";
import type { SegmentListItem } from "@/hooks/useSegments";

export interface SegmentsTableProps {
  segments: SegmentListItem[];
  summaries: Record<string, string>;
  onEdit: (segmentId: string) => void;
  onViewMembers: (segmentId: string) => void;
  onDelete: (segment: SegmentListItem) => void;
}

export function SegmentsTable({
  segments,
  summaries,
  onEdit,
  onViewMembers,
  onDelete,
}: SegmentsTableProps) {
  return (
    <JoyTable stickyHeader>
      <JoyTableHead>
        <JoyTableRow>
          <JoyTableHeaderCell>Name</JoyTableHeaderCell>
          <JoyTableHeaderCell>Type</JoyTableHeaderCell>
          <JoyTableHeaderCell>Status</JoyTableHeaderCell>
          <JoyTableHeaderCell>Members</JoyTableHeaderCell>
          <JoyTableHeaderCell>Summary</JoyTableHeaderCell>
          <JoyTableHeaderCell>Updated</JoyTableHeaderCell>
          <JoyTableHeaderCell sx={{ width: 72 }} />
        </JoyTableRow>
      </JoyTableHead>
      <JoyTableBody>
        {segments.map((segment) => (
          <JoyTableRow key={segment.id} hoverColor="neutral.50">
            <JoyTableCell>
              <Stack spacing={0.375}>
                <Typography level="title-sm">{segment.name}</Typography>
                <Typography level="body-xs" color="neutral">
                  {segment.description || "No description yet."}
                </Typography>
              </Stack>
            </JoyTableCell>
            <JoyTableCell>
              <SegmentTypeBadge type={segment.type} />
            </JoyTableCell>
            <JoyTableCell>
              <SegmentStatusBadge status={segment.status} />
            </JoyTableCell>
            <JoyTableCell>{segment.memberCount.toLocaleString()}</JoyTableCell>
            <JoyTableCell sx={{ maxWidth: 340 }}>
              <Typography level="body-sm" sx={{ color: "neutral.700" }}>
                {summaries[segment.id]}
              </Typography>
            </JoyTableCell>
            <JoyTableCell>
              {segment.updatedAt
                ? formatDistanceToNow(new Date(segment.updatedAt), {
                    addSuffix: true,
                  })
                : "Recently created"}
            </JoyTableCell>
            <JoyTableCell>
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
            </JoyTableCell>
          </JoyTableRow>
        ))}
      </JoyTableBody>
    </JoyTable>
  );
}
