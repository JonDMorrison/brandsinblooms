import React, { useState, useMemo, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { Button } from "@/components/ui-legacy/button";
import { Card } from "@/components/ui-legacy/card";
import { processNewsletterContent } from "@/utils/newsletterContentProcessor";
import { sanitizeWeekNumbers } from "@/utils/weekNumberSanitizer";
import { sanitizeHtml } from "@/utils/htmlSanitizer";
import {
  Edit,
  Save,
  X,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from "lucide-react";

interface EditableNewsletterPreviewProps {
  content: string;
  title: string;
  onChange: (content: string) => void;
  onSave?: () => void;
  className?: string;
}

const EMPTY_PREVIEW_MESSAGE =
  "No content available. Click edit to add newsletter content.";

const HTML_TAG_PATTERN = /<[^>]+>/;

const renderPlainTextPreview = (value: string) => {
  const paragraphs = value
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return EMPTY_PREVIEW_MESSAGE;
  }

  return paragraphs
    .map(
      (paragraph) =>
        `<p class="text-slate-700 leading-relaxed mb-4">${paragraph.replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
};

const renderSectionBody = (value: string) => {
  if (!value.trim()) {
    return "";
  }

  if (HTML_TAG_PATTERN.test(value)) {
    return value;
  }

  return renderPlainTextPreview(value);
};

const renderStructuredPreview = (
  processedNewsletter: ReturnType<typeof processNewsletterContent>,
) => {
  const sections =
    processedNewsletter.blocks.length > 0
      ? processedNewsletter.blocks.map((block) => ({
          title: block.title || block.headline || "",
          body: block.body || block.content || "",
          cta: block.cta || block.ctaText || "",
          link: block.link || "",
        }))
      : (processedNewsletter.unstructuredSections ?? []).map((section) => ({
          title: section.title || "",
          body: section.content || "",
          cta: section.cta || "",
          link: section.link || "",
        }));

  if (sections.length === 0) {
    return "";
  }

  return sections
    .map((section) => {
      const titleHtml = section.title
        ? `<h2 class="text-2xl font-semibold text-slate-900 mb-3">${section.title}</h2>`
        : "";
      const bodyHtml = renderSectionBody(section.body);
      const ctaHtml = section.cta
        ? section.link && section.link.startsWith("http")
          ? `<a href="${section.link}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center text-primary font-semibold hover:text-primary/80 transition-colors">${section.cta} &rarr;</a>`
          : `<span class="inline-flex items-center text-primary font-semibold">${section.cta} &rarr;</span>`
        : "";

      return `
        <section class="mb-8 last:mb-0">
          ${titleHtml}
          ${bodyHtml}
          ${ctaHtml ? `<div class="mt-6">${ctaHtml}</div>` : ""}
        </section>
      `;
    })
    .join("");
};

export const EditableNewsletterPreview: React.FC<
  EditableNewsletterPreviewProps
> = ({ content, title, onChange, onSave, className = "" }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);

  // Rich text editor configuration
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
    ],
    content: editContent || "Start writing your newsletter content...",
    onUpdate: ({ editor }) => {
      setEditContent(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose prose-slate max-w-none focus:outline-none",
      },
    },
  });

  // Update editor content when editContent changes
  useEffect(() => {
    if (editor && !editor.isDestroyed && isEditing) {
      const currentContent = editor.getHTML();
      if (currentContent !== editContent) {
        editor.commands.setContent(
          editContent || "Start writing your newsletter content...",
        );
      }
    }
  }, [editContent, editor, isEditing]);

  // Update editContent when the main content prop changes (external updates)
  useEffect(() => {
    if (!isEditing && content !== editContent) {
      setEditContent(content);
    }
  }, [content, isEditing, editContent]);

  // Process newsletter content to get structured blocks
  const processedNewsletter = useMemo(() => {
    const result = processNewsletterContent(content, title);
    return result;
  }, [content, title]);

  const previewHtml = useMemo(() => {
    if (!content.trim()) {
      return EMPTY_PREVIEW_MESSAGE;
    }

    if (HTML_TAG_PATTERN.test(content)) {
      return content;
    }

    const structuredPreview = renderStructuredPreview(processedNewsletter);
    if (structuredPreview) {
      return structuredPreview;
    }

    return renderPlainTextPreview(content);
  }, [content, processedNewsletter]);

  const handleStartEdit = () => {
    setEditContent(content);
    setIsEditing(true);
    // Set editor content when starting to edit
    if (editor && !editor.isDestroyed) {
      editor.commands.setContent(
        content || "Start writing your newsletter content...",
      );
    }
  };

  const handleSave = () => {
    // Get the latest content directly from the editor
    const latestContent = editor ? editor.getHTML() : editContent;

    // Update the content through onChange prop
    onChange(latestContent);
    setIsEditing(false);
    onSave?.();
  };

  const handleCancel = () => {
    setEditContent(content);
    setIsEditing(false);
    // Reset editor content when canceling
    if (editor && !editor.isDestroyed) {
      editor.commands.setContent(content || "");
    }
  };

  if (isEditing) {
    return (
      <Card className={`p-4 ${className}`}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Edit Newsletter Content</h3>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleCancel}>
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave}>
                <Save className="h-4 w-4 mr-1" />
                Save
              </Button>
            </div>
          </div>

          {/* Rich Text Editor Toolbar */}
          {editor && (
            <div className="border border-border rounded-md">
              <div className="flex items-center gap-1 p-2 border-b border-border bg-muted/50">
                <Button
                  variant={editor.isActive("bold") ? "default" : "ghost"}
                  size="sm"
                  onClick={() => editor.chain().focus().toggleBold().run()}
                >
                  <Bold className="h-4 w-4" />
                </Button>
                <Button
                  variant={editor.isActive("italic") ? "default" : "ghost"}
                  size="sm"
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                >
                  <Italic className="h-4 w-4" />
                </Button>
                <Button
                  variant={editor.isActive("underline") ? "default" : "ghost"}
                  size="sm"
                  onClick={() => editor.chain().focus().toggleUnderline().run()}
                >
                  <UnderlineIcon className="h-4 w-4" />
                </Button>
                <div className="w-px h-6 bg-border mx-1" />
                <Button
                  variant={editor.isActive("bulletList") ? "default" : "ghost"}
                  size="sm"
                  onClick={() =>
                    editor.chain().focus().toggleBulletList().run()
                  }
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={editor.isActive("orderedList") ? "default" : "ghost"}
                  size="sm"
                  onClick={() =>
                    editor.chain().focus().toggleOrderedList().run()
                  }
                >
                  <ListOrdered className="h-4 w-4" />
                </Button>
                <div className="w-px h-6 bg-border mx-1" />
                <Button
                  variant={
                    editor.isActive({ textAlign: "left" }) ? "default" : "ghost"
                  }
                  size="sm"
                  onClick={() =>
                    editor.chain().focus().setTextAlign("left").run()
                  }
                >
                  <AlignLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant={
                    editor.isActive({ textAlign: "center" })
                      ? "default"
                      : "ghost"
                  }
                  size="sm"
                  onClick={() =>
                    editor.chain().focus().setTextAlign("center").run()
                  }
                >
                  <AlignCenter className="h-4 w-4" />
                </Button>
                <Button
                  variant={
                    editor.isActive({ textAlign: "right" })
                      ? "default"
                      : "ghost"
                  }
                  size="sm"
                  onClick={() =>
                    editor.chain().focus().setTextAlign("right").run()
                  }
                >
                  <AlignRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Rich Text Editor Content */}
              <div className="min-h-[300px] p-4 focus-within:ring-2 focus-within:ring-primary">
                <EditorContent editor={editor} />
              </div>
            </div>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card className={`relative group ${className}`}>
      {/* Edit button overlay - positioned to not interfere with block controls */}
      <div className="absolute top-4 right-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button size="sm" variant="secondary" onClick={handleStartEdit}>
          <Edit className="h-4 w-4 mr-1" />
          Edit Content
        </Button>
      </div>

      {/* Newsletter Preview */}
      <div className="p-6">
        {/* Newsletter Header */}
        <div className="mb-8 text-center border-b pb-6">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            {sanitizeWeekNumbers(title)}
          </h1>
          <p className="text-sm text-slate-600">
            Your Garden Center Newsletter
          </p>
        </div>

        {/* Newsletter Content */}
        <div className="prose prose-slate max-w-none">
          <div
            className="text-slate-700 leading-relaxed"
            // SECURITY: X2 - Sanitize HTML to prevent XSS
            dangerouslySetInnerHTML={{
              __html: sanitizeHtml(previewHtml),
            }}
          />
        </div>

        {/* Newsletter Footer */}
        <div className="mt-12 pt-6 border-t border-slate-200 text-center text-sm text-slate-500">
          <p>
            © {new Date().getFullYear()} Your Garden Center | All rights
            reserved
          </p>
          <p className="mt-1">
            <a href="#" className="hover:text-primary">
              Unsubscribe
            </a>{" "}
            |
            <a href="#" className="hover:text-primary ml-1">
              Update preferences
            </a>
          </p>
        </div>
      </div>
    </Card>
  );
};
