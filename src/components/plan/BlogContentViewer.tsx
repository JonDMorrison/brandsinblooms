import React from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Chip from "@mui/joy/Chip";
import Modal from "@mui/joy/Modal";
import ModalClose from "@mui/joy/ModalClose";
import ModalDialog from "@mui/joy/ModalDialog";
import Sheet from "@mui/joy/Sheet";
import Snackbar from "@mui/joy/Snackbar";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Copy, ExternalLink } from "lucide-react";
import { convertMarkdownToHtml } from "@/utils/markdownUtils";

interface BlogContentViewerItem {
  title: string;
  caption: string;
  enhancedContent?: {
    title?: string;
    description?: string;
    fullContent?: string;
    readingTime?: string;
    summary?: string;
    tags?: string[];
  };
}

interface BlogContentViewerProps {
  blogItem?: BlogContentViewerItem | null;
  open?: boolean;
  onClose?: () => void;
}

const stripStyleTags = (html: string) =>
  html.replace(/<style[\s\S]*?<\/style>/gi, "");

const hasHtml = (value: string) => /<\/?[a-z][\s\S]*>/i.test(value);

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const getBlogFullContent = (blogItem: BlogContentViewerItem) =>
  blogItem.enhancedContent?.fullContent || blogItem.caption;

const getReadingTime = (blogItem: BlogContentViewerItem) => {
  if (blogItem.enhancedContent?.readingTime) {
    return blogItem.enhancedContent.readingTime;
  }

  const wordCount = getBlogFullContent(blogItem)
    .split(/\s+/)
    .filter(Boolean).length;
  return `${Math.max(1, Math.ceil(wordCount / 200))} min read`;
};

const BlogContentBody = ({
  blogItem,
  onCopy,
  onOpenNewTab,
  renderedHtml,
}: {
  blogItem: BlogContentViewerItem;
  onCopy: () => void;
  onOpenNewTab: () => void;
  renderedHtml: string;
}) => {
  const title = blogItem.enhancedContent?.title || blogItem.title;
  const fullContent = getBlogFullContent(blogItem);

  return (
    <Stack spacing={2.5}>
      <Stack
        alignItems={{ xs: "flex-start", sm: "center" }}
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        spacing={1.5}
        sx={{ pr: { sm: 3 } }}
      >
        <Stack spacing={0.5}>
          <Typography level="title-lg">{title}</Typography>
          <Typography color="neutral" level="body-xs">
            {fullContent.length} characters
          </Typography>
        </Stack>
        <Chip color="neutral" size="sm" variant="soft">
          {getReadingTime(blogItem)}
        </Chip>
      </Stack>

      <Sheet
        color="neutral"
        variant="soft"
        sx={{
          borderRadius: "lg",
          maxHeight: "62vh",
          overflow: "auto",
          p: { xs: 2, sm: 3 },
        }}
      >
        <Box
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
          sx={{
            color: "text.primary",
            "& blockquote": {
              borderColor: "primary.outlinedBorder",
              borderLeft: "3px solid",
              color: "text.secondary",
              m: 0,
              my: 2,
              pl: 2,
            },
            "& code": {
              bgcolor: "background.level2",
              borderRadius: "xs",
              px: 0.5,
            },
            "& h1": {
              color: "text.primary",
              fontSize: "var(--joy-fontSize-xl3)",
              lineHeight: "var(--joy-lineHeight-sm)",
              mb: 2,
            },
            "& h2": {
              color: "text.primary",
              fontSize: "var(--joy-fontSize-xl2)",
              lineHeight: "var(--joy-lineHeight-sm)",
              mt: 3,
              mb: 1.5,
            },
            "& h3": {
              color: "text.primary",
              fontSize: "var(--joy-fontSize-xl)",
              mt: 2.5,
              mb: 1,
            },
            "& li": {
              color: "text.secondary",
              lineHeight: "var(--joy-lineHeight-md)",
              mb: 0.75,
            },
            "& p": {
              color: "text.secondary",
              lineHeight: "var(--joy-lineHeight-lg)",
              mb: 1.5,
            },
            "& pre": {
              bgcolor: "background.level2",
              borderRadius: "md",
              overflow: "auto",
              p: 1.5,
            },
            "& ul, & ol": {
              m: 0,
              mb: 2,
              pl: 3,
            },
          }}
        />
      </Sheet>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="flex-end"
        spacing={1}
      >
        <Button
          color="neutral"
          onClick={onCopy}
          startDecorator={<Copy aria-hidden="true" size={16} />}
          variant="outlined"
        >
          Copy Markdown
        </Button>
        <Button
          color="neutral"
          onClick={onOpenNewTab}
          startDecorator={<ExternalLink aria-hidden="true" size={16} />}
          variant="outlined"
        >
          Open in New Tab
        </Button>
      </Stack>
    </Stack>
  );
};

export const BlogContentViewer: React.FC<BlogContentViewerProps> = ({
  blogItem,
  onClose,
  open,
}) => {
  const [notice, setNotice] = React.useState<string | null>(null);

  const renderedHtml = React.useMemo(() => {
    if (!blogItem) return "";

    const fullContent = getBlogFullContent(blogItem);
    return stripStyleTags(
      hasHtml(fullContent) ? fullContent : convertMarkdownToHtml(fullContent),
    );
  }, [blogItem]);

  if (!blogItem) {
    return null;
  }

  const handleCopyMarkdown = () => {
    void navigator.clipboard.writeText(getBlogFullContent(blogItem));
    setNotice("Blog markdown copied");
  };

  const handleOpenNewTab = () => {
    const title = blogItem.enhancedContent?.title || blogItem.title;
    const documentHtml = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(
      title,
    )}</title></head><body><article>${renderedHtml}</article></body></html>`;

    window.open(
      `data:text/html;charset=utf-8,${encodeURIComponent(documentHtml)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const content = (
    <BlogContentBody
      blogItem={blogItem}
      onCopy={handleCopyMarkdown}
      onOpenNewTab={handleOpenNewTab}
      renderedHtml={renderedHtml}
    />
  );

  return (
    <>
      {typeof open === "boolean" ? (
        <Modal open={open} onClose={onClose}>
          <ModalDialog
            sx={{
              maxHeight: "92vh",
              maxWidth: 900,
              overflow: "auto",
              width: "calc(100% - 32px)",
            }}
          >
            <ModalClose />
            {content}
          </ModalDialog>
        </Modal>
      ) : (
        content
      )}
      <Snackbar
        anchorOrigin={{ horizontal: "center", vertical: "bottom" }}
        autoHideDuration={3000}
        color="neutral"
        onClose={() => setNotice(null)}
        open={Boolean(notice)}
        variant="soft"
      >
        {notice}
      </Snackbar>
    </>
  );
};
