import React from "react";
import Card from "@mui/joy/Card";
import CardContent from "@mui/joy/CardContent";
import Chip from "@mui/joy/Chip";
import Divider from "@mui/joy/Divider";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { MessageSquare, Pencil, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { PlanItem } from "../constants";

interface SMSPreviewCardProps {
  item: PlanItem;
  onEdit: () => void;
  onRegenerate: () => void;
}

const toDate = (date: Date | string) =>
  date instanceof Date ? date : new Date(date);

const getSmsSegments = (message: string) =>
  Math.max(1, Math.ceil(message.length / 160));

export const SMSPreviewCard: React.FC<SMSPreviewCardProps> = ({
  item,
  onEdit,
  onRegenerate,
}) => {
  const segmentCount = getSmsSegments(item.caption);

  return (
    <Card variant="outlined" sx={{ overflow: "hidden", p: 0 }}>
      <CardContent sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" spacing={1.5}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ flexWrap: "wrap" }}
            useFlexGap
          >
            <Chip
              color="neutral"
              size="sm"
              startDecorator={<MessageSquare aria-hidden="true" size={14} />}
              variant="soft"
            >
              SMS
            </Chip>
            {item.themeName && (
              <Chip color="primary" size="sm" variant="soft">
                {item.themeName}
              </Chip>
            )}
          </Stack>
          <Typography color="neutral" level="body-xs">
            {format(toDate(item.date), "MMM d")}
          </Typography>
        </Stack>
      </CardContent>

      <CardContent sx={{ p: 2.25, pt: 0 }}>
        <Stack spacing={1.5}>
          <Typography level="title-sm">{item.title}</Typography>
          <Sheet
            color="neutral"
            variant="soft"
            sx={{ borderRadius: "lg", maxWidth: "88%", p: 2 }}
          >
            <Typography level="body-sm" sx={{ whiteSpace: "pre-wrap" }}>
              {item.caption}
            </Typography>
          </Sheet>
          <Typography color="neutral" level="body-xs">
            {item.caption.length} characters · {segmentCount} segment
            {segmentCount === 1 ? "" : "s"}
          </Typography>
        </Stack>
      </CardContent>

      <Divider />
      <Stack
        direction="row"
        justifyContent="flex-end"
        spacing={0.75}
        sx={{ p: 1.25 }}
      >
        <IconButton
          aria-label="Edit SMS"
          color="neutral"
          onClick={onEdit}
          size="sm"
          variant="plain"
        >
          <Pencil size={16} />
        </IconButton>
        <IconButton
          aria-label="Regenerate SMS"
          color="neutral"
          onClick={onRegenerate}
          size="sm"
          variant="plain"
        >
          <RefreshCw size={16} />
        </IconButton>
      </Stack>
    </Card>
  );
};
