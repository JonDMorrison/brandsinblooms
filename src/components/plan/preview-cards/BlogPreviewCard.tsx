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
import Link from "@mui/joy/Link";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { FileText, Image as ImageIcon, Pencil, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { PlanItem } from "../constants";

interface BlogPreviewCardProps {
  item: PlanItem;
  onEdit: () => void;
  onRegenerate: () => void;
  onImageSelect: () => void;
  onReadMore: () => void;
}

const imageOverlayGradient =
  "linear-gradient(to top, rgb(var(--joy-palette-common-blackChannel, 0 0 0) / 0.80), rgb(var(--joy-palette-common-blackChannel, 0 0 0) / 0.50), transparent)";

const toDate = (date: Date | string) =>
  date instanceof Date ? date : new Date(date);

const getBlogFullContent = (item: PlanItem) =>
  item.enhancedContent?.fullContent || item.caption;

const getBlogPreview = (item: PlanItem) =>
  item.enhancedContent?.summary || getBlogFullContent(item);

const getBlogReadingTime = (item: PlanItem) => {
  if (item.enhancedContent?.readingTime) {
    return item.enhancedContent.readingTime;
  }

  const wordCount = getBlogFullContent(item)
    .split(/\s+/)
    .filter(Boolean).length;
  return `${Math.max(1, Math.ceil(wordCount / 200))} min read`;
};

const BlogImage = ({ item }: { item: PlanItem }) => {
  const isGenerating = item.imageGenerationStatus === "generating";

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
      ) : item.imageUrl ? (
        <Box sx={{ height: "100%", position: "relative", width: "100%" }}>
          <Box
            alt={item.title}
            component="img"
            src={item.imageUrl}
            sx={{ height: "100%", objectFit: "cover", width: "100%" }}
          />
          <Box
            sx={{
              background: imageOverlayGradient,
              inset: 0,
              position: "absolute",
            }}
          />
          <Stack
            justifyContent="flex-end"
            sx={{ inset: 0, p: 2, position: "absolute" }}
          >
            <Typography
              level="title-md"
              sx={{ color: "common.white", fontWeight: "lg" }}
            >
              {item.title}
            </Typography>
          </Stack>
        </Box>
      ) : (
        <Stack
          alignItems="center"
          justifyContent="center"
          spacing={1}
          sx={{ bgcolor: "neutral.softBg", color: "neutral.500" }}
        >
          <ImageIcon aria-hidden="true" size={24} />
          <Typography color="neutral" level="body-xs">
            Featured image can be selected
          </Typography>
        </Stack>
      )}
    </AspectRatio>
  );
};

export const BlogPreviewCard: React.FC<BlogPreviewCardProps> = ({
  item,
  onEdit,
  onImageSelect,
  onReadMore,
  onRegenerate,
}) => {
  const fullContent = getBlogFullContent(item);

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
              startDecorator={<FileText aria-hidden="true" size={14} />}
              variant="soft"
            >
              Blog
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
        <BlogImage item={item} />
      </CardOverflow>

      <CardContent sx={{ p: 2.25 }}>
        <Stack spacing={1.25}>
          {!item.imageUrl && (
            <Typography level="title-md" sx={{ fontWeight: "lg" }}>
              {item.title}
            </Typography>
          )}
          <Typography color="neutral" level="body-xs">
            {getBlogReadingTime(item)} · {fullContent.length} characters
          </Typography>
          <Typography
            color="neutral"
            level="body-sm"
            sx={{
              display: "-webkit-box",
              overflow: "hidden",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 3,
            }}
          >
            {getBlogPreview(item)}
          </Typography>
          <Link
            component="button"
            level="body-xs"
            onClick={onReadMore}
            type="button"
          >
            Read more
          </Link>
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
          aria-label="Edit blog post"
          color="neutral"
          onClick={onEdit}
          size="sm"
          variant="plain"
        >
          <Pencil size={16} />
        </IconButton>
        <IconButton
          aria-label="Regenerate blog post"
          color="neutral"
          onClick={onRegenerate}
          size="sm"
          variant="plain"
        >
          <RefreshCw size={16} />
        </IconButton>
        <IconButton
          aria-label="Select blog image"
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
