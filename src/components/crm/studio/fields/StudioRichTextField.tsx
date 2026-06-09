import * as React from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import TiptapLink from "@tiptap/extension-link";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  Bold,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Tags,
  Sparkles,
  Underline as UnderlineIcon,
} from "lucide-react";

type StudioRichTextFieldProps = {
  label: string;
  value?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  minRows?: number;
  aiDecorator?: boolean;
};

const MERGE_TAGS = [
  { label: "First name", value: "{{first_name}}" },
  { label: "Last name", value: "{{last_name}}" },
  { label: "Business", value: "{{business_name}}" },
  { label: "Email", value: "{{email}}" },
  { label: "City", value: "{{city}}" },
];

function ToolbarDivider() {
  return (
    <Box sx={{ width: 1, height: 18, bgcolor: "neutral.200", mx: 0.25 }} />
  );
}

type ToolbarIconButtonProps = {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
};

function ToolbarIconButton({
  label,
  active = false,
  onClick,
  children,
}: ToolbarIconButtonProps) {
  return (
    <IconButton
      variant="plain"
      color="neutral"
      size="sm"
      aria-label={label}
      title={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      sx={{
        width: 24,
        height: 24,
        minWidth: 24,
        minHeight: 24,
        borderRadius: "4px",
        color: active ? "neutral.900" : "neutral.500",
        bgcolor: active ? "neutral.200" : "transparent",
        "&:hover": { bgcolor: active ? "neutral.200" : "neutral.100" },
        "& svg": { width: 14, height: 14 },
      }}
    >
      {children}
    </IconButton>
  );
}

export default function StudioRichTextField({
  label,
  value = "",
  onChange,
  placeholder = "Start writing...",
  minRows = 3,
  aiDecorator = false,
}: StudioRichTextFieldProps) {
  const [personalizeOpen, setPersonalizeOpen] = React.useState(false);
  const minEditorHeight = Math.max(2, minRows) * 22 + 24;
  const editor = useEditor({
    extensions: [
      // HardBreak (Shift+Enter for a soft line break within the same paragraph)
      // is a StarterKit default but make the config explicit so a future
      // StarterKit upgrade can't quietly drop the keymap. keepMarks lets the
      // line break carry bold/italic marks from the surrounding text.
      StarterKit.configure({
        underline: false,
        link: false,
        hardBreak: { keepMarks: true },
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Underline,
      TiptapLink.configure({
        openOnClick: false,
        HTMLAttributes: {
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange?.(editor.isEmpty ? "" : editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "studio-rich-text-prosemirror",
      },
    },
  });

  React.useEffect(() => {
    if (!editor || editor.isDestroyed) {
      return;
    }

    if ((value || "") === "" && editor.isEmpty) {
      return;
    }

    if (value !== editor.getHTML()) {
      editor.commands.setContent(value || "");
    }
  }, [editor, value]);

  const setLink = React.useCallback(() => {
    if (!editor) {
      return;
    }

    const currentHref = String(editor.getAttributes("link").href ?? "");
    const nextHref = window.prompt("Paste link URL", currentHref || "https://");

    if (nextHref === null) {
      return;
    }

    const trimmedHref = nextHref.trim();
    const chain = editor.chain().focus().extendMarkRange("link") as any;

    if (!trimmedHref) {
      chain.unsetLink().run();
      return;
    }

    chain
      .setLink({
        href: trimmedHref,
        target: "_blank",
        rel: "noopener noreferrer",
      })
      .run();
  }, [editor]);

  if (!editor) {
    return null;
  }

  return (
    <Stack spacing={0.5} sx={{ width: "100%" }}>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        justifyContent="space-between"
      >
        <Typography
          level="body-xs"
          sx={{
            fontSize: "12px",
            fontWeight: 650,
            color: "neutral.700",
            maxWidth: "100%",
          }}
        >
          {label}
        </Typography>
        {aiDecorator ? (
          <IconButton
            variant="plain"
            color="neutral"
            size="sm"
            aria-label={`Generate ${label}`}
            onClick={() => {}}
            sx={{
              minWidth: 28,
              minHeight: 28,
              borderRadius: "8px",
              color: "neutral.400",
              transition:
                "color 140ms ease, background-color 140ms ease, box-shadow 140ms ease, transform 140ms ease",
              "&:hover": {
                color: "primary.600",
                bgcolor: "primary.50",
                boxShadow: "0 0 0 1px var(--joy-palette-primary-100)",
                transform: "translateY(-1px) scale(1.04)",
              },
              "&:hover svg": {
                animation: "studioSparklePulse 1.2s ease-in-out infinite",
              },
              "&:active": {
                color: "primary.700",
                bgcolor: "primary.100",
                transform: "translateY(0) scale(0.98)",
              },
              "&:focus-visible": {
                outline: "2px solid",
                outlineColor: "primary.400",
                outlineOffset: 2,
              },
              "@keyframes studioSparklePulse": {
                "0%, 100%": {
                  transform: "scale(1)",
                  opacity: 0.9,
                },
                "50%": {
                  transform: "scale(1.18)",
                  opacity: 1,
                },
              },
            }}
          >
            <Sparkles size={14} />
          </IconButton>
        ) : null}
      </Stack>
      <Sheet
        variant="plain"
        sx={{
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <Sheet
          variant="plain"
          sx={{
            bgcolor: "neutral.50",
            borderRadius: "6px 6px 0 0",
            p: "4px",
            display: "flex",
            alignItems: "center",
            gap: "2px",
            width: "100%",
            maxWidth: "100%",
            boxSizing: "border-box",
            overflowX: "auto",
            scrollbarWidth: "none",
            "&::-webkit-scrollbar": { display: "none" },
          }}
        >
          <ToolbarIconButton
            label="Bold"
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold />
          </ToolbarIconButton>
          <ToolbarIconButton
            label="Italic"
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic />
          </ToolbarIconButton>
          <ToolbarIconButton
            label="Underline"
            active={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <UnderlineIcon />
          </ToolbarIconButton>
          <ToolbarDivider />
          <ToolbarIconButton
            label="Heading 1"
            active={editor.isActive("heading", { level: 1 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 1 }).run()
            }
          >
            <Heading1 />
          </ToolbarIconButton>
          <ToolbarIconButton
            label="Heading 2"
            active={editor.isActive("heading", { level: 2 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
          >
            <Heading2 />
          </ToolbarIconButton>
          <ToolbarIconButton
            label="Heading 3"
            active={editor.isActive("heading", { level: 3 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 3 }).run()
            }
          >
            <Heading3 />
          </ToolbarIconButton>
          <ToolbarDivider />
          <ToolbarIconButton
            label="Bullet list"
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List />
          </ToolbarIconButton>
          <ToolbarIconButton
            label="Ordered list"
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered />
          </ToolbarIconButton>
          <ToolbarDivider />
          <ToolbarIconButton
            label="Insert link"
            active={editor.isActive("link")}
            onClick={setLink}
          >
            <LinkIcon />
          </ToolbarIconButton>
          <ToolbarDivider />
          <Button
            variant="plain"
            color="neutral"
            size="sm"
            startDecorator={<Tags size={13} />}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setPersonalizeOpen((open) => !open)}
            sx={{
              minHeight: 24,
              borderRadius: "4px",
              px: 0.75,
              fontSize: "11px",
              fontWeight: 600,
              color: personalizeOpen ? "neutral.900" : "neutral.500",
              bgcolor: personalizeOpen ? "neutral.200" : "transparent",
              "&:hover": { bgcolor: "neutral.100" },
            }}
          >
            Personalize
          </Button>
        </Sheet>

        {personalizeOpen ? (
          <Sheet
            variant="outlined"
            sx={{
              position: "absolute",
              zIndex: 3,
              top: 34,
              right: 0,
              width: 168,
              p: 0.5,
              borderRadius: "8px",
              bgcolor: "background.surface",
              boxShadow: "md",
            }}
          >
            {MERGE_TAGS.map((tag) => (
              <Button
                key={tag.value}
                variant="plain"
                color="neutral"
                size="sm"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  editor.chain().focus().insertContent(tag.value).run();
                  setPersonalizeOpen(false);
                }}
                sx={{
                  width: "100%",
                  justifyContent: "space-between",
                  minHeight: 28,
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 500,
                }}
              >
                <Box component="span">{tag.label}</Box>
                <Typography
                  component="span"
                  level="body-xs"
                  sx={{ color: "neutral.400", fontFamily: "monospace" }}
                >
                  {tag.value}
                </Typography>
              </Button>
            ))}
          </Sheet>
        ) : null}

        <Box
          sx={{
            position: "relative",
            minHeight: minEditorHeight,
            width: "100%",
            maxWidth: "100%",
            boxSizing: "border-box",
            border: "1px solid",
            borderColor: "neutral.200",
            borderTop: "none",
            borderRadius: "0 0 6px 6px",
            bgcolor: "#ffffff",
            color: "neutral.900",
            "&:focus-within": {
              borderColor: "primary.400",
              boxShadow: "0 0 0 3px var(--joy-palette-primary-100)",
            },
            "& .studio-rich-text-prosemirror": {
              minHeight: minEditorHeight,
              outline: "none",
              fontSize: "13px",
              lineHeight: 1.6,
              padding: "12px",
              overflowWrap: "anywhere",
              wordBreak: "break-word",
            },
            "& .studio-rich-text-prosemirror p": { margin: 0 },
            "& .studio-rich-text-prosemirror p + p": { marginTop: "8px" },
            "& .studio-rich-text-prosemirror h1": {
              margin: "0 0 8px",
              fontSize: "20px",
              lineHeight: 1.25,
            },
            "& .studio-rich-text-prosemirror h2": {
              margin: "0 0 8px",
              fontSize: "17px",
              lineHeight: 1.3,
            },
            "& .studio-rich-text-prosemirror h3": {
              margin: "0 0 6px",
              fontSize: "15px",
              lineHeight: 1.35,
            },
            "& .studio-rich-text-prosemirror ul, & .studio-rich-text-prosemirror ol":
              {
                margin: "6px 0",
                paddingLeft: "18px",
              },
            "& .studio-rich-text-prosemirror a": {
              color: "inherit",
              textDecoration: "underline",
              textUnderlineOffset: "2px",
            },
          }}
        >
          {editor.isEmpty ? (
            <Typography
              level="body-sm"
              sx={{
                position: "absolute",
                top: 12,
                left: 12,
                color: "neutral.400",
                fontSize: "13px",
                pointerEvents: "none",
              }}
            >
              {placeholder}
            </Typography>
          ) : null}
          <EditorContent editor={editor} />
        </Box>
        <Typography
          level="body-xs"
          sx={{
            color: "neutral.400",
            fontSize: "11px",
            mt: 0.5,
            px: 0.25,
            userSelect: "none",
          }}
        >
          Enter for a new paragraph · Shift + Enter for a soft line break ·
          use the list buttons in the toolbar for bullets
        </Typography>
      </Sheet>
    </Stack>
  );
}
