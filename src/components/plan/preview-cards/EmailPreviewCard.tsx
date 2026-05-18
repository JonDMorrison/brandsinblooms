import React from "react";
import AspectRatio from "@mui/joy/AspectRatio";
import Box from "@mui/joy/Box";
import Card from "@mui/joy/Card";
import CardContent from "@mui/joy/CardContent";
import CardOverflow from "@mui/joy/CardOverflow";
import Chip from "@mui/joy/Chip";
import CircularProgress from "@mui/joy/CircularProgress";
import Divider from "@mui/joy/Divider";
import IconButton from "@mui/joy/IconButton";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Image as ImageIcon, Mail, Pencil, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { PlanItem } from "../constants";

interface EmailPreviewCardProps {
  item: PlanItem;
  onEdit: () => void;
  onRegenerate: () => void;
  onImageSelect: () => void;
}

const toDate = (date: Date | string) =>
  date instanceof Date ? date : new Date(date);

const stripMarkup = (value: string) =>
  value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const ImagePreview = ({ item }: { item: PlanItem }) => {
  const isGenerating = item.imageGenerationStatus === "generating";

  if (!item.imageUrl && !isGenerating) {
    return (
      <AspectRatio ratio="16/9">
        <Stack
          alignItems="center"
          justifyContent="center"
          spacing={1}
          sx={{ bgcolor: "neutral.softBg", color: "neutral.500" }}
        >
          <ImageIcon aria-hidden="true" size={22} />
          <Typography color="neutral" level="body-xs">
            Image can be selected
          </Typography>
        </Stack>
      </AspectRatio>
    );
  }

  return (
    <AspectRatio ratio="16/9">
      {isGenerating ? (
        <Box sx={{ height: "100%", position: "relative", width: "100%" }}>
          <Skeleton sx={{ height: "100%", inset: 0, position: "absolute" }} />
          <Stack
            alignItems="center"
            justifyContent="center"
            sx={{ height: "100%" }}
          >
            <CircularProgress size="sm" />
          </Stack>
        </Box>
      ) : (
        <Box
          alt={item.title}
          component="img"
          src={item.imageUrl}
          sx={{ height: "100%", objectFit: "cover", width: "100%" }}
        />
      )}
    </AspectRatio>
  );
};

export const EmailPreviewCard: React.FC<EmailPreviewCardProps> = ({
  item,
  onEdit,
  onImageSelect,
  onRegenerate,
}) => {
  const bodyPreview = stripMarkup(item.caption);

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
              startDecorator={<Mail aria-hidden="true" size={14} />}
              variant="soft"
            >
              Email
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

      <CardOverflow>
        <ImagePreview item={item} />
      </CardOverflow>

      <CardContent sx={{ p: 2.25 }}>
        <Card variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1.25}>
            <Typography color="neutral" level="body-xs">
              From
            </Typography>
            <Typography level="title-sm" sx={{ fontWeight: "lg" }}>
              {item.emailSubject || item.title}
            </Typography>
            {item.emailPreheader && (
              <Typography
                color="neutral"
                level="body-xs"
                sx={{ fontStyle: "italic" }}
              >
                {item.emailPreheader}
              </Typography>
            )}
            <Typography
              color="neutral"
              level="body-sm"
              sx={{
                display: "-webkit-box",
                overflow: "hidden",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: 4,
              }}
            >
              {bodyPreview}
            </Typography>
          </Stack>
        </Card>
      </CardContent>

      <Divider />
      <Stack
        direction="row"
        justifyContent="flex-end"
        spacing={0.75}
        sx={{ p: 1.25 }}
      >
        <IconButton
          aria-label="Edit email"
          color="neutral"
          onClick={onEdit}
          size="sm"
          variant="plain"
        >
          <Pencil size={16} />
        </IconButton>
        <IconButton
          aria-label="Regenerate email"
          color="neutral"
          onClick={onRegenerate}
          size="sm"
          variant="plain"
        >
          <RefreshCw size={16} />
        </IconButton>
        <IconButton
          aria-label="Select email image"
          color="neutral"
          onClick={onImageSelect}
          size="sm"
          variant="plain"
        >
          <ImageIcon size={16} />
        </IconButton>
      </Stack>
    </Card>
  );
};
