import * as React from "react";
import Box from "@mui/joy/Box";
import Checkbox from "@mui/joy/Checkbox";
import Divider from "@mui/joy/Divider";
import Sheet from "@mui/joy/Sheet";
import Typography from "@mui/joy/Typography";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import BloomCodeBlock from "@/components/bloom/BloomCodeBlock";
import {
  JoyTable,
  JoyTableBody,
  JoyTableCell,
  JoyTableHead,
  JoyTableHeaderCell,
  JoyTableRow,
} from "@/components/joy/JoyTable";
import type { BloomMarkdownProps } from "@/components/bloom/BloomMarkdown";

type MarkdownElementProps = {
  node?: unknown;
  children?: React.ReactNode;
  className?: string;
  inline?: boolean;
  href?: string;
  src?: string;
  alt?: string;
  checked?: boolean;
  type?: string;
};

const childrenToText = (children: React.ReactNode): string => {
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }

  if (Array.isArray(children)) {
    return children.map(childrenToText).join("");
  }

  if (!children || typeof children !== "object" || !("props" in children)) {
    return "";
  }

  const props = children.props as { children?: React.ReactNode };
  return childrenToText(props.children);
};

const spacing = (compact: boolean, normal: number, compactValue: number) =>
  compact ? compactValue : normal;

const CHAT_TEXT_FONT_SIZE = "16px";

const markdownRootSx = {
  minWidth: 0,
  fontSize: CHAT_TEXT_FONT_SIZE,
  "& > :last-child": { mb: 0 },
} as const;

const markdownImageBaseSx = {
  display: "block",
  maxWidth: "100%",
  borderRadius: "var(--joy-radius-md)",
} as const;

/**
 * Panel typography: the Ask Bloom drawer's compact, 14px reading style. It
 * styles the default markdown elements (same-tab links included) instead of
 * the chat components below.
 */
const panelMarkdownSx = {
  minWidth: 0,
  "& p": {
    margin: "0 0 10px 0",
    fontSize: "14px",
    lineHeight: 1.6,
    color: "text.primary",
    "&:last-child": { marginBottom: 0 },
  },
  "& strong, & b": {
    fontWeight: 700,
    color: "text.primary",
  },
  "& em, & i": {
    fontStyle: "italic",
  },
  "& a": {
    color: "primary.plainColor",
    textDecoration: "underline",
    textDecorationColor: "var(--joy-palette-primary-300)",
    textUnderlineOffset: "2px",
    cursor: "pointer",
    fontWeight: 500,
    "&:hover": {
      textDecorationColor: "var(--joy-palette-primary-plainColor)",
    },
  },
  '& a[href*="blocked"]': {
    color: "text.tertiary",
    textDecoration: "underline",
    cursor: "not-allowed",
  },
  "& code": {
    fontFamily: "var(--joy-fontFamily-code, monospace)",
    fontSize: "12.5px",
    fontWeight: 500,
    backgroundColor: "neutral.softBg",
    color: "text.primary",
    padding: "1.5px 5px",
    borderRadius: "4px",
    border: "1px solid",
    borderColor: "neutral.outlinedBorder",
    whiteSpace: "nowrap",
  },
  "& pre": {
    margin: "10px 0",
    padding: "12px 14px",
    backgroundColor: "neutral.softBg",
    borderRadius: "6px",
    border: "1px solid",
    borderColor: "neutral.outlinedBorder",
    overflowX: "auto",
    "& code": {
      backgroundColor: "transparent",
      border: "none",
      padding: 0,
      fontSize: "12.5px",
      lineHeight: 1.6,
      whiteSpace: "pre",
    },
  },
  "& ol": {
    margin: "8px 0",
    paddingLeft: "22px",
    listStyleType: "decimal",
    "& li": {
      marginBottom: "6px",
      fontSize: "14px",
      lineHeight: 1.6,
      paddingLeft: "4px",
      color: "text.primary",
      "&::marker": {
        color: "text.tertiary",
        fontWeight: 500,
      },
    },
  },
  "& ul": {
    margin: "8px 0",
    paddingLeft: "22px",
    listStyleType: "disc",
    "& li": {
      marginBottom: "6px",
      fontSize: "14px",
      lineHeight: 1.6,
      paddingLeft: "4px",
      color: "text.primary",
      "&::marker": {
        color: "text.tertiary",
      },
    },
  },
  "& hr": {
    margin: "12px 0",
    border: "none",
    borderTop: "1px solid",
    borderColor: "divider",
  },
  "& h1, & h2, & h3, & h4": {
    fontWeight: 700,
    color: "text.primary",
    margin: "14px 0 8px 0",
    lineHeight: 1.3,
    "&:first-of-type": { marginTop: 0 },
  },
  "& h1": { fontSize: "18px" },
  "& h2": { fontSize: "16px" },
  "& h3": { fontSize: "15px" },
  "& h4": { fontSize: "14px" },
  "& blockquote": {
    margin: "10px 0",
    padding: "8px 14px",
    borderLeft: "3px solid",
    borderColor: "neutral.outlinedBorder",
    backgroundColor: "background.level1",
    borderRadius: "0 6px 6px 0",
    "& p": {
      margin: 0,
      color: "text.secondary",
      fontStyle: "italic",
    },
  },
  "& table": {
    display: "block",
    width: "max-content",
    minWidth: "100%",
    maxWidth: "100%",
    overflowX: "auto",
    borderCollapse: "collapse",
    tableLayout: "fixed",
    margin: "10px 0",
    fontSize: "13px",
    "& th": {
      textAlign: "left",
      fontWeight: 600,
      padding: "6px 10px",
      width: "160px",
      minWidth: "160px",
      borderBottom: "2px solid",
      borderColor: "divider",
      color: "text.secondary",
      whiteSpace: "normal",
      overflowWrap: "anywhere",
      verticalAlign: "top",
    },
    "& td": {
      padding: "6px 10px",
      width: "160px",
      minWidth: "160px",
      borderBottom: "1px solid",
      borderColor: "divider",
      color: "text.primary",
      whiteSpace: "normal",
      overflowWrap: "anywhere",
      verticalAlign: "top",
    },
  },
} as const;

const MarkdownParagraph = React.memo(function MarkdownParagraph({
  children,
  sx,
}: {
  children: React.ReactNode;
  sx: React.ComponentProps<typeof Box>["sx"];
}) {
  return <Box sx={sx}>{children}</Box>;
});

const MarkdownImage = React.memo(function MarkdownImage({
  alt,
  src,
  sx,
}: {
  alt: string;
  src?: string;
  sx: React.ComponentProps<typeof Box>["sx"];
}) {
  return <Box component="img" alt={alt} src={src} sx={sx} />;
});

const PanelMarkdown = React.memo(function PanelMarkdown({
  content,
}: {
  content: string;
}) {
  return (
    <Box sx={panelMarkdownSx}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </Box>
  );
});

const ChatMarkdown = React.memo(function ChatMarkdown({
  compact = false,
  content,
}: {
  compact?: boolean;
  content: string;
}) {
  const paragraphLevel = "body-md";
  const bodyLineHeight = compact ? 1.55 : 1.65;
  const paragraphSx = React.useMemo(
    () => ({
      color: "neutral.700",
      fontSize: CHAT_TEXT_FONT_SIZE,
      lineHeight: bodyLineHeight,
      mb: spacing(compact, 1.5, 0.9),
      mt: 0,
      overflowWrap: "anywhere",
      whiteSpace: "pre-wrap",
    }),
    [bodyLineHeight, compact],
  );
  const imageSx = React.useMemo(
    () => ({
      ...markdownImageBaseSx,
      my: spacing(compact, 1, 0.75),
    }),
    [compact],
  );

  const components = React.useMemo(
    () => ({
      h1: ({ children }: MarkdownElementProps) => (
        <Typography
          level={paragraphLevel}
          sx={{
            mt: spacing(compact, 2, 1.25),
            mb: spacing(compact, 1, 0.75),
            color: "neutral.900",
            fontSize: CHAT_TEXT_FONT_SIZE,
            fontWeight: 700,
            lineHeight: bodyLineHeight,
          }}
        >
          {children}
        </Typography>
      ),
      h2: ({ children }: MarkdownElementProps) => (
        <Typography
          level={paragraphLevel}
          sx={{
            mt: spacing(compact, 2, 1.25),
            mb: spacing(compact, 1, 0.75),
            color: "neutral.900",
            fontSize: CHAT_TEXT_FONT_SIZE,
            fontWeight: 700,
            lineHeight: bodyLineHeight,
          }}
        >
          {children}
        </Typography>
      ),
      h3: ({ children }: MarkdownElementProps) => (
        <Typography
          level={paragraphLevel}
          sx={{
            mt: spacing(compact, 1.5, 1),
            mb: spacing(compact, 0.75, 0.5),
            color: "neutral.900",
            fontSize: CHAT_TEXT_FONT_SIZE,
            fontWeight: 650,
            lineHeight: bodyLineHeight,
          }}
        >
          {children}
        </Typography>
      ),
      h4: ({ children }: MarkdownElementProps) => (
        <Typography
          level={paragraphLevel}
          sx={{
            mt: spacing(compact, 1, 0.75),
            mb: spacing(compact, 0.5, 0.35),
            color: "neutral.900",
            fontSize: CHAT_TEXT_FONT_SIZE,
            fontWeight: 650,
            lineHeight: bodyLineHeight,
          }}
        >
          {children}
        </Typography>
      ),
      h5: ({ children }: MarkdownElementProps) => (
        <Typography
          level={paragraphLevel}
          sx={{
            mt: spacing(compact, 1, 0.75),
            mb: spacing(compact, 0.5, 0.35),
            color: "neutral.800",
            fontSize: CHAT_TEXT_FONT_SIZE,
            fontWeight: 600,
            lineHeight: bodyLineHeight,
          }}
        >
          {children}
        </Typography>
      ),
      h6: ({ children }: MarkdownElementProps) => (
        <Typography
          level={paragraphLevel}
          sx={{
            mt: spacing(compact, 1, 0.75),
            mb: spacing(compact, 0.5, 0.35),
            color: "neutral.700",
            fontSize: CHAT_TEXT_FONT_SIZE,
            fontWeight: 600,
            lineHeight: bodyLineHeight,
          }}
        >
          {children}
        </Typography>
      ),
      p: ({ children }: MarkdownElementProps) => (
        <MarkdownParagraph sx={paragraphSx}>{children}</MarkdownParagraph>
      ),
      strong: ({ children }: MarkdownElementProps) => (
        <Typography
          component="strong"
          sx={{
            color: "inherit",
            display: "inline",
            fontSize: "inherit",
            fontWeight: 600,
            lineHeight: "inherit",
          }}
        >
          {children}
        </Typography>
      ),
      em: ({ children }: MarkdownElementProps) => (
        <Typography
          component="em"
          sx={{
            color: "inherit",
            display: "inline",
            fontSize: "inherit",
            fontStyle: "italic",
            lineHeight: "inherit",
          }}
        >
          {children}
        </Typography>
      ),
      del: ({ children }: MarkdownElementProps) => (
        <Typography
          component="del"
          sx={{
            color: "inherit",
            display: "inline",
            fontSize: "inherit",
            lineHeight: "inherit",
            textDecoration: "line-through",
          }}
        >
          {children}
        </Typography>
      ),
      code: ({ children, className, inline }: MarkdownElementProps) => {
        const code = childrenToText(children);
        if (!inline && (className || code.includes("\n"))) {
          return (
            <BloomCodeBlock className={className} compact={compact}>
              {code}
            </BloomCodeBlock>
          );
        }

        return (
          <Typography
            component="code"
            sx={{
              display: "inline",
              px: 0.5,
              py: 0.25,
              borderRadius: "var(--joy-radius-xs)",
              backgroundColor: "neutral.100",
              color: "neutral.800",
              fontFamily: "var(--joy-fontFamily-code)",
              fontSize: "0.85em",
            }}
          >
            {children}
          </Typography>
        );
      },
      pre: ({ children }: MarkdownElementProps) => <>{children}</>,
      a: ({ children, href }: MarkdownElementProps) => (
        <Box
          component="a"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            color: "primary.600",
            textDecoration: "underline",
            textUnderlineOffset: 2,
          }}
        >
          {children}
        </Box>
      ),
      blockquote: ({ children }: MarkdownElementProps) => (
        <Sheet
          variant="soft"
          color="neutral"
          sx={{
            my: spacing(compact, 1.5, 1),
            py: spacing(compact, 1, 0.75),
            pl: spacing(compact, 2, 1.5),
            pr: spacing(compact, 1.5, 1),
            borderLeft: "3px solid",
            borderColor: "primary.200",
            borderTopLeftRadius: 0,
            borderBottomLeftRadius: 0,
            borderTopRightRadius: "var(--joy-radius-sm)",
            borderBottomRightRadius: "var(--joy-radius-sm)",
            backgroundColor: "neutral.50",
            "& > :last-child": { mb: 0 },
          }}
        >
          {children}
        </Sheet>
      ),
      hr: () => (
        <Divider
          sx={{
            my: spacing(compact, 2, 1.25),
            "--Divider-lineColor": "var(--joy-palette-neutral-200)",
          }}
        />
      ),
      ul: ({ children }: MarkdownElementProps) => (
        <Box
          component="ul"
          sx={{
            pl: spacing(compact, 2.5, 2),
            my: spacing(compact, 1, 0.65),
            color: "neutral.700",
            listStyleType: "disc",
            "& ul": { listStyleType: "circle", mt: 0.5 },
            "& ul ul": { listStyleType: "square" },
          }}
        >
          {children}
        </Box>
      ),
      ol: ({ children }: MarkdownElementProps) => (
        <Box
          component="ol"
          sx={{
            pl: spacing(compact, 2.5, 2),
            my: spacing(compact, 1, 0.65),
            color: "neutral.700",
            listStyleType: "decimal",
          }}
        >
          {children}
        </Box>
      ),
      li: ({ checked, children, className }: MarkdownElementProps) => {
        const isTaskItem =
          typeof checked === "boolean" || className?.includes("task-list-item");
        return (
          <Box
            component="li"
            sx={{
              mb: spacing(compact, 0.5, 0.35),
              pl: isTaskItem ? 0 : undefined,
              listStyleType: isTaskItem ? "none" : undefined,
              display: isTaskItem ? "flex" : "list-item",
              alignItems: isTaskItem ? "flex-start" : undefined,
              gap: isTaskItem ? 0.75 : undefined,
              color: "neutral.700",
              fontSize: CHAT_TEXT_FONT_SIZE,
              lineHeight: bodyLineHeight,
              overflowWrap: "anywhere",
            }}
          >
            {children}
          </Box>
        );
      },
      input: ({ checked, type }: MarkdownElementProps) => {
        if (type !== "checkbox") {
          return null;
        }

        return (
          <Checkbox
            checked={Boolean(checked)}
            disabled
            size="sm"
            variant="outlined"
            sx={{ mt: 0.15, flexShrink: 0 }}
          />
        );
      },
      table: ({ children }: MarkdownElementProps) => (
        <JoyTable
          size="sm"
          variant="outlined"
          containerSx={{
            my: spacing(compact, 1.5, 1),
            maxWidth: "100%",
            overflowX: "auto",
          }}
          sx={{ minWidth: 420 }}
        >
          {children}
        </JoyTable>
      ),
      thead: ({ children }: MarkdownElementProps) => (
        <JoyTableHead>{children}</JoyTableHead>
      ),
      tbody: ({ children }: MarkdownElementProps) => (
        <JoyTableBody
          sx={{
            "& tr:nth-of-type(even) > td": { backgroundColor: "neutral.50" },
          }}
        >
          {children}
        </JoyTableBody>
      ),
      tr: ({ children }: MarkdownElementProps) => (
        <JoyTableRow>{children}</JoyTableRow>
      ),
      th: ({ children }: MarkdownElementProps) => (
        <JoyTableHeaderCell>
          <Typography
            level={paragraphLevel}
            sx={{
              color: "neutral.600",
              fontSize: CHAT_TEXT_FONT_SIZE,
              fontWeight: 600,
            }}
          >
            {children}
          </Typography>
        </JoyTableHeaderCell>
      ),
      td: ({ children }: MarkdownElementProps) => (
        <JoyTableCell>
          <Typography
            level={paragraphLevel}
            sx={{
              color: "neutral.700",
              fontSize: CHAT_TEXT_FONT_SIZE,
              lineHeight: bodyLineHeight,
            }}
          >
            {children}
          </Typography>
        </JoyTableCell>
      ),
      img: ({ alt, src }: MarkdownElementProps) => (
        <MarkdownImage alt={alt ?? ""} src={src} sx={imageSx} />
      ),
      br: () => <Box component="br" />,
    }),
    [bodyLineHeight, compact, imageSx, paragraphLevel, paragraphSx],
  );

  return (
    <Box sx={markdownRootSx}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </Box>
  );
});

const MarkdownRoot = React.memo(function MarkdownRoot({
  compact,
  content,
  variant = "chat",
}: BloomMarkdownProps) {
  if (variant === "panel") {
    return <PanelMarkdown content={content} />;
  }

  return <ChatMarkdown compact={compact} content={content} />;
});

export default MarkdownRoot;
