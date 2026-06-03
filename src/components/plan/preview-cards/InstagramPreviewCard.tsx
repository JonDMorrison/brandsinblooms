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
import {
  Heart,
  Image as ImageIcon,
  Instagram,
  MessageCircle,
  Pencil,
  RefreshCw,
  Send,
} from "lucide-react";
import { format } from "date-fns";
import { PlanItem } from "../constants";

interface InstagramPreviewCardProps {
  item: PlanItem;
  onEdit: () => void;
  onRegenerate: () => void;
  onImageSelect: () => void;
}

const toDate = (date: Date | string) =>
  date instanceof Date ? date : new Date(date);

const ImagePreview = ({ item }: { item: PlanItem }) => {
  const isGenerating = item.imageGenerationStatus === "generating";

  return (
    <AspectRatio ratio="1/1">
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
      ) : item.imageUrl ? (
        <Box
          alt={item.title}
          component="img"
          src={item.imageUrl}
          sx={{ height: "100%", objectFit: "cover", width: "100%" }}
        />
      ) : (
        <Stack
          alignItems="center"
          justifyContent="center"
          spacing={1}
          sx={{ bgcolor: "neutral.softBg", color: "neutral.500" }}
        >
          <ImageIcon aria-hidden="true" size={26} />
          <Typography color="neutral" level="body-xs">
            Image can be selected
          </Typography>
        </Stack>
      )}
    </AspectRatio>
  );
};

export const InstagramPreviewCard: React.FC<InstagramPreviewCardProps> = ({
  item,
  onEdit,
  onImageSelect,
  onRegenerate,
}) => (
  <Card variant="outlined" sx={{ overflow: "hidden", p: 0 }}>
    <CardContent sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" spacing={1.5}>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }} useFlexGap>
          <Chip
            color="neutral"
            size="sm"
            startDecorator={<Instagram aria-hidden="true" size={14} />}
            variant="soft"
          >
            Instagram
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

    <CardContent sx={{ p: 2 }}>
      <Stack spacing={1.25}>
        <Stack direction="row" spacing={1.25}>
          <Heart aria-hidden="true" size={18} />
          <MessageCircle aria-hidden="true" size={18} />
          <Send aria-hidden="true" size={18} />
        </Stack>
        <Typography level="title-sm">{item.title}</Typography>
        <Typography
          level="body-sm"
          sx={{
            display: "-webkit-box",
            overflow: "hidden",
            whiteSpace: "pre-wrap",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 3,
          }}
        >
          <Typography
            component="span"
            level="body-sm"
            sx={{ fontWeight: "lg" }}
          >
            Profile
          </Typography>{" "}
          {item.caption}
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
        aria-label="Edit Instagram post"
        color="neutral"
        onClick={onEdit}
        size="sm"
        variant="plain"
      >
        <Pencil size={16} />
      </IconButton>
      <IconButton
        aria-label="Regenerate Instagram post"
        color="neutral"
        onClick={onRegenerate}
        size="sm"
        variant="plain"
      >
        <RefreshCw size={16} />
      </IconButton>
      <IconButton
        aria-label="Select Instagram image"
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
