import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { formatDraftRichText } from "@/lib/crm/htmlContent";
import type { StudioBlock } from "@/types/studioBlocks";

type QuoteRendererProps = {
  block: StudioBlock;
};

function QuoteText({
  block,
  centered = false,
}: {
  block: StudioBlock;
  centered?: boolean;
}) {
  const hasQuote = Boolean(
    block.quoteText
      ?.replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim(),
  );
  const textColor = block.textColor || "#111827";
  const align = centered ? "center" : block.textAlign || "left";

  return (
    <Box
      sx={{
        color: textColor,
        fontFamily: "var(--studio-font-headline)",
        fontSize: centered ? "24px" : "19px",
        fontStyle: block.fontStyle ?? "italic",
        fontWeight: 500,
        lineHeight: centered ? 1.42 : 1.55,
        textAlign: align,
        opacity: hasQuote ? 1 : 0.36,
        "& p": { m: 0 },
        "& p + p": { mt: 0.75 },
        "& a": {
          color: "inherit",
          textDecoration: "underline",
          textUnderlineOffset: "2px",
        },
      }}
      dangerouslySetInnerHTML={{
        __html: hasQuote
          ? formatDraftRichText(block.quoteText)
          : formatDraftRichText(
              "This is a powerful quote that resonates with the reader.",
            ),
      }}
    />
  );
}

function AuthorText({
  block,
  centered = false,
}: {
  block: StudioBlock;
  centered?: boolean;
}) {
  const hasAuthor = Boolean(block.authorName?.trim());
  const hasTitle = Boolean(block.authorTitle?.trim());
  const textColor = block.textColor || "#111827";
  const align = centered ? "center" : block.textAlign || "left";

  return (
    <Stack spacing={0.25} sx={{ textAlign: align }}>
      <Typography
        sx={{
          color: textColor,
          fontFamily: "var(--studio-font-subheading)",
          fontSize: "14px",
          fontWeight: 700,
          opacity: hasAuthor ? 0.86 : 0.34,
        }}
      >
        {hasAuthor ? `- ${block.authorName}` : "- Author Name"}
      </Typography>
      <Typography
        sx={{
          color: textColor,
          fontFamily: "var(--studio-font-body)",
          fontSize: "12px",
          lineHeight: 1.35,
          opacity: hasTitle ? 0.56 : 0.28,
        }}
      >
        {hasTitle ? block.authorTitle : "Title or source"}
      </Typography>
    </Stack>
  );
}

function Avatar({ block }: { block: StudioBlock }) {
  const imageUrl = block.authorImageUrl || block.authorAvatarUrl;
  const size = block.authorAvatarSize ?? 48;

  if (block.showAuthorImage === false) {
    return null;
  }

  if (imageUrl) {
    return (
      <Box
        component="img"
        src={imageUrl}
        alt=""
        sx={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          bgcolor: "neutral.100",
        }}
      />
    );
  }

  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: "50%",
        bgcolor: "neutral.100",
        border: "1px dashed",
        borderColor: "neutral.300",
        fontFamily: "var(--studio-font-brand)",
      }}
    />
  );
}

export default function QuoteRenderer({ block }: QuoteRendererProps) {
  const layout = block.layout || "classic";
  const backgroundColor = block.backgroundColor || "#ffffff";
  const accentColor = block.accentColor || "#111827";
  const padding = `${block.contentPadding ?? 32}px 24px`;
  const showAvatar =
    block.showAuthorImage ??
    Boolean(block.authorImageUrl || block.authorAvatarUrl);

  if (layout === "large-centered") {
    return (
      <Box sx={{ bgcolor: backgroundColor, p: padding, textAlign: "center" }}>
        <Typography
          sx={{
            color: accentColor,
            fontFamily: "var(--studio-font-headline)",
            fontSize: `${block.quoteMarkSize ?? 48}px`,
            lineHeight: 0.8,
            opacity: 0.15,
          }}
        >
          &quot;
        </Typography>
        <Box sx={{ maxWidth: 520, mx: "auto", mt: 0.5 }}>
          <QuoteText block={block} centered />
        </Box>
        <Box sx={{ mt: 2.5 }}>
          {showAvatar ? (
            <Stack spacing={1.25} alignItems="center">
              <Avatar block={block} />
              <AuthorText block={block} centered />
            </Stack>
          ) : (
            <AuthorText block={block} centered />
          )}
        </Box>
      </Box>
    );
  }

  if (layout === "avatar-card") {
    return (
      <Box sx={{ bgcolor: backgroundColor, p: padding }}>
        <Box
          sx={{
            border: "1px solid",
            borderColor: "neutral.200",
            borderRadius: "12px",
            p: 3,
            bgcolor: "#ffffff",
          }}
        >
          <QuoteText block={block} />
          {showAvatar ? (
            <Stack
              direction="row"
              useFlexGap
              spacing={1.5}
              alignItems="center"
              sx={{ mt: 2.5, flexWrap: "wrap", rowGap: 1 }}
            >
              <Avatar block={block} />
              <AuthorText block={block} />
            </Stack>
          ) : (
            <Box sx={{ mt: 2.5 }}>
              <AuthorText block={block} />
            </Box>
          )}
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: backgroundColor, p: padding }}>
      <Box sx={{ borderLeft: "4px solid", borderColor: accentColor, pl: 2.5 }}>
        <QuoteText block={block} />
        <Box sx={{ mt: 2 }}>
          {showAvatar ? (
            <Stack
              direction="row"
              useFlexGap
              spacing={1.5}
              alignItems="center"
              sx={{ flexWrap: "wrap", rowGap: 1 }}
            >
              <Avatar block={block} />
              <AuthorText block={block} />
            </Stack>
          ) : (
            <AuthorText block={block} />
          )}
        </Box>
      </Box>
    </Box>
  );
}
