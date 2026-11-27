import * as React from "react";
import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import Typography from "@mui/joy/Typography";
import { AlertTriangle } from "lucide-react";
import DOMPurify from "dompurify";
import type { StudioBlock } from "@/types/studioBlocks";
import { useDesignSystem } from "@/contexts/DesignSystemContext";
import { renderFooterBlockToEmailHtml, renderNewsletterBlock } from "@/lib/studio/emailHtmlGenerator";
import { useNewsletterDesign } from "./NewsletterDesignContext";
import { uploadStudioImageFile } from "../fields/StudioImageUpload";
import { STUDIO_BLOCK_LOOKUP } from "../blockLibraryData";
import "./newsletterControls.css";
import { normalizeSocialLinks } from "@/lib/studio/socialIcons";
import {
  inlineTextFromElement,
  markInlineEditableText,
  type InlineTextField,
} from "@/lib/studio/newsletter/inlineTextEditing";
type Update = (
  blockId: string,
  field: keyof StudioBlock,
  value: StudioBlock[keyof StudioBlock],
) => void;
// While editing, show personalisation as a readable chip ("Customer's first
// name") and not as raw code such as {{ first_name }}. This only changes what
// the canvas displays. The stored block and the sent email keep the real tag.
const FRIENDLY_MERGE_TAGS: Record<string, string> = {
  first_name: "Customer's first name",
  last_name: "Customer's last name",
  business_name: "Your business name",
  email: "Customer's email",
  city: "Customer's city",
};

function showFriendlyMergeTags(html: string) {
  return html
    .split(/(<[^>]+>)/)
    .map((part) =>
      part.startsWith("<")
        ? part
        : part.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key: string) => {
            const label = FRIENDLY_MERGE_TAGS[key];
            return label
              ? `<span data-newsletter-readonly style="display:inline-block;padding:0 6px;border-radius:6px;background:rgba(49,92,88,0.14);border:1px solid rgba(49,92,88,0.35);font-size:0.9em;line-height:1.5;">${label}</span>`
              : match;
          }),
    )
    .join("");
}

export default function SharedEmailBlockPreview({
  block,
  onUpdateBlockField,
}: {
  block: StudioBlock;
  onUpdateBlockField?: Update;
}) {
  const { designSystem } = useDesignSystem();
  const { settings } = useNewsletterDesign();
  const input = React.useRef<HTMLInputElement>(null);
  const target = React.useRef<{
    field: string;
    index: number;
    blockId: string;
    itemId?: string;
  } | null>(null);
  const latest = React.useRef({ block, onUpdateBlockField });
  latest.current = { block, onUpdateBlockField };
  const mounted = React.useRef(true);
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      target.current = null;
    };
  }, []);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const html = React.useMemo(() => {
    const markup = block.type === "footer"
      ? renderFooterBlockToEmailHtml(block, {}, designSystem, { showMissingAddressPrompt: true })
      : renderNewsletterBlock(block, designSystem, settings, { editing: true });
    return showFriendlyMergeTags(DOMPurify.sanitize(markup, {
        ADD_ATTR: [
          "data-newsletter-image",
          "data-newsletter-index",
          "data-newsletter-role",
        ],
        FORBID_TAGS: ["script", "iframe", "form", "input", "style", "link"],
    }));
  }, [block, designSystem, settings]);
  // With every network switched off, the block used to show faded example
  // icons that looked like real links. Show the plain "this block is empty"
  // message until at least one network is turned on.
  const socialHasNothingOn =
    block.type === "social-follow" &&
    !normalizeSocialLinks(block.socialLinks, block.socialLinkOrder).some(
      (link) => link.enabled,
    );
  const hasVisibleContent = !socialHasNothingOn && Boolean(
    html
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, "")
      .trim() ||
    /<(?:img\b|td\b[^>]*\sbackground=)/i.test(html) ||
    ["divider", "spacer"].includes(block.type),
  );
  // A Graphic Hero is an email background image, not an <img>. The generic
  // click-to-edit handler cannot find it, so expose the same picker explicitly.
  // This also works when the new Graphic Hero is completely empty.
  const openGraphicHeroImagePicker = () => {
    if (!onUpdateBlockField || busy || block.type !== "graphic-hero") return;
    target.current = { field: "imageUrl", index: 0, blockId: block.id };
    input.current?.click();
  };
  const choose = (element: Element) => {
    if (!onUpdateBlockField || busy) return;
    // A new block's grey "Add a photo" frame opens the same picker.
    const image = element.closest("img") ??
      element.closest('[data-editor-placeholder="image"][data-newsletter-image]');
    if (
      !image ||
      image.hasAttribute("data-newsletter-readonly") ||
      block.type === "social-follow"
    )
      return;
    let field = image.getAttribute("data-newsletter-image") || "imageUrl";
    const index = Number(image.getAttribute("data-newsletter-index") || 0);
    if (
      ![
        "imageUrl",
        "headerBannerUrl",
        "galleryImages",
        "galleryProducts",
      ].includes(field)
    )
      field = "imageUrl";
    // Legacy logo and banner renderers do not carry editor-only attributes.
    if (
      block.type === "newsletter-header" &&
      image.getAttribute("src") === block.logoUrl
    )
      field = "logoUrl";
    if (
      block.type === "quote" &&
      [block.authorImageUrl, block.authorAvatarUrl].includes(
        image.getAttribute("src") || "",
      )
    )
      field = "authorImageUrl";
    if (!Number.isInteger(index) || index < 0) return;
    const itemId =
      field === "galleryImages"
        ? block.galleryImages?.[index]?.id
        : field === "galleryProducts"
          ? block.galleryProducts?.[index]?.id
          : undefined;
    target.current = { field, index, blockId: block.id, itemId };
    input.current?.click();
  };
  // Click-to-edit for plain text (headline, button words and so on). The
  // element is made editable in place and saved to its block field when the
  // person clicks away, presses Enter or presses Escape. Escape keeps the new
  // words and leaves editing; the block stays selected. Cmd/Ctrl+Z undoes.
  const editing = React.useRef<{ element: HTMLElement; original: string } | null>(null);
  const finishTextEdit = (save: boolean) => {
    const active = editing.current;
    if (!active) return;
    editing.current = null;
    const { element, original } = active;
    const field = element.getAttribute("data-nl-edit") as InlineTextField | null;
    const next = inlineTextFromElement(element);
    element.removeAttribute("contenteditable");
    element.removeAttribute("data-nl-editing");
    const current = latest.current;
    if (!save || !field || next === original) {
      element.textContent = original;
      return;
    }
    current.onUpdateBlockField?.(current.block.id, field, next);
  };
  const startTextEdit = (element: HTMLElement, point?: { x: number; y: number }) => {
    if (!onUpdateBlockField || busy) return;
    if (editing.current?.element === element) return;
    finishTextEdit(true);
    editing.current = { element, original: inlineTextFromElement(element) };
    // "plaintext-only" stops pasted formatting where the browser supports it.
    element.setAttribute("contenteditable", "plaintext-only");
    if (!element.isContentEditable) element.setAttribute("contenteditable", "true");
    element.setAttribute("data-nl-editing", "true");
    element.focus({ preventScroll: true });
    const selection = element.ownerDocument.getSelection();
    if (!selection) return;
    const doc = element.ownerDocument as Document & {
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
    };
    const atPoint = point && doc.caretRangeFromPoint ? doc.caretRangeFromPoint(point.x, point.y) : null;
    const range = atPoint && element.contains(atPoint.startContainer) ? atPoint : doc.createRange();
    if (range !== atPoint) {
      range.selectNodeContents(element);
      // Keyboard entry selects all the words; a mouse click outside the text goes to the end.
      if (point) range.collapse(false);
    }
    selection.removeAllRanges();
    selection.addRange(range);
  };
  // Floating "Replace image" buttons, one per editable photo, positioned
  // over the photo's bottom-right corner. The Photo Banner keeps its own.
  const wrapper = React.useRef<HTMLDivElement>(null);
  const [replaceTargets, setReplaceTargets] = React.useState<
    Array<{ key: string; top: number; left: number; image: HTMLImageElement; label: string }>
  >([]);
  const showReplaceButtons =
    Boolean(onUpdateBlockField) &&
    hasVisibleContent &&
    block.type !== "graphic-hero" &&
    block.type !== "social-follow";
  React.useLayoutEffect(() => {
    const root = wrapper.current;
    if (!root || !showReplaceButtons) {
      setReplaceTargets([]);
      return;
    }
    const measure = () => {
      const base = root.getBoundingClientRect();
      const images = Array.from(
        root.querySelectorAll<HTMLImageElement>(
          // Same images the click-to-replace handler accepts.
          ".nl-preview img:not([data-newsletter-readonly])",
        ),
      );
      setReplaceTargets(
        images
          .map((image, i) => {
            const rect = image.getBoundingClientRect();
            return {
              key: `${i}-${image.getAttribute("data-newsletter-image")}-${image.getAttribute("data-newsletter-index") ?? 0}`,
              top: rect.bottom - base.top,
              left: rect.right - base.left,
              image,
              label: image.alt ? `Replace ${image.alt}` : "Replace image",
              visible: rect.width > 0 && rect.height > 0,
            };
          })
          .filter((target) => target.visible)
          .map(({ visible: _visible, ...target }) => target),
      );
    };
    measure();
    // Re-measure once photos load (or fail and fall back to alt text).
    const images = Array.from(root.querySelectorAll("img"));
    images.forEach((image) => {
      image.addEventListener("load", measure);
      image.addEventListener("error", measure);
    });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(root);
    return () => {
      images.forEach((image) => {
        image.removeEventListener("load", measure);
        image.removeEventListener("error", measure);
      });
      observer?.disconnect();
    };
  }, [html, showReplaceButtons]);
  return (
    <Box
      ref={wrapper}
      aria-busy={busy}
      sx={{
        position: "relative",
        // Shown while the block is hovered or a button has keyboard focus.
        "& .nl-replace-image": { opacity: 0, transition: "opacity 120ms ease" },
        "&:hover .nl-replace-image, & .nl-replace-image:focus-visible": { opacity: 1 },
        "@media (hover: none)": { "& .nl-replace-image": { opacity: 1 } },
      }}
    >
      {block.audience?.mode === "segments" && (
        <Box
          sx={{
            px: 1.5,
            py: 0.5,
            bgcolor: "#e7ecef",
            color: "#334b58",
            fontSize: 11,
          }}
        >
          Conditional block · shown here for editing
        </Box>
      )}
      {hasVisibleContent ? (
        <div
          className="nl-preview"
          onClick={(event) => {
            if ((event.target as Element).closest("a")) event.preventDefault();
            const text = (event.target as Element).closest<HTMLElement>("[data-nl-edit]");
            if (text) {
              startTextEdit(text, { x: event.clientX, y: event.clientY });
              return;
            }
            choose(event.target as Element);
          }}
          onBlur={(event) => {
            if (editing.current?.element === event.target) finishTextEdit(true);
          }}
          onDoubleClick={(event) => {
            // Double-click selects a word here. It must not jump to the panel.
            if ((event.target as Element).closest("[data-nl-edit]")) event.stopPropagation();
          }}
          onPaste={(event) => {
            // Browsers without plaintext-only: paste words only, on one line.
            if (!editing.current || editing.current.element.getAttribute("contenteditable") !== "true") return;
            event.preventDefault();
            const words = event.clipboardData.getData("text/plain").replace(/[\r\n]+/g, " ");
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0) return;
            const range = selection.getRangeAt(0);
            range.deleteContents();
            range.insertNode(document.createTextNode(words));
            range.collapse(false);
          }}
          onKeyDown={(event) => {
            const active = editing.current;
            if (active && event.target === active.element) {
              // Keep typing out of the page shortcuts (delete block, move block, undo).
              event.stopPropagation();
              if (event.key === "Enter") {
                event.preventDefault();
                active.element.blur();
              } else if (event.key === "Escape") {
                // Commit, then leave editing. stopPropagation above keeps the
                // page's Escape (which clears the selection) from running.
                event.preventDefault();
                finishTextEdit(true);
                active.element.blur();
              }
              return;
            }
            const text = (event.target as Element).closest<HTMLElement>("[data-nl-edit]");
            if (text && event.target === text && (event.key === "Enter" || event.key === " ")) {
              event.preventDefault();
              startTextEdit(text);
              return;
            }
            if (
              (event.key === "Enter" || event.key === " ") &&
              (event.target as Element).matches('img, [data-editor-placeholder="image"][data-newsletter-image]')
            ) {
              event.preventDefault();
              choose(event.target as Element);
            }
          }}
          ref={(node) => {
            if (node && onUpdateBlockField) markInlineEditableText(node, block);
            if (node && onUpdateBlockField)
              node
                .querySelectorAll<HTMLElement>(
                  'img:not([data-newsletter-readonly]), [data-editor-placeholder="image"][data-newsletter-image]',
                )
                .forEach((image) => {
                  if (block.type === "social-follow") return;
                  image.tabIndex = 0;
                  image.setAttribute("role", "button");
                  image.setAttribute(
                    "aria-label",
                    image instanceof HTMLImageElement
                      ? `Change ${image.alt || "block image"}`
                      : "Add a photo",
                  );
                });
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        // Editor-only notice (never part of the email HTML): the app's amber
        // warning style so an empty block is hard to miss.
        <Alert
          role="note"
          color="warning"
          variant="soft"
          data-testid="studio-empty-block-notice"
          startDecorator={<AlertTriangle size={18} aria-hidden="true" />}
          sx={{
            m: 1,
            border: "1px solid",
            borderColor: "warning.outlinedBorder",
            alignItems: "flex-start",
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography level="title-sm" sx={{ color: "inherit" }}>
              {STUDIO_BLOCK_LOOKUP[block.type]?.name || block.label}
            </Typography>
            <Typography level="body-sm" sx={{ color: "inherit" }}>
              This block is empty. Add content or remove it.
            </Typography>
          </Box>
        </Alert>
      )}
      {onUpdateBlockField && block.type === "graphic-hero" && (
        <Box
          component="button"
          type="button"
          aria-label={block.imageUrl ? "Replace Graphic Hero image" : "Upload Graphic Hero image"}
          disabled={busy}
          onClick={(event) => {
            event.stopPropagation();
            openGraphicHeroImagePicker();
          }}
          sx={{
            position: hasVisibleContent ? "absolute" : "relative",
            bottom: hasVisibleContent ? 12 : undefined,
            right: hasVisibleContent ? 8 : undefined,
            display: "block",
            mx: hasVisibleContent ? 0 : "auto",
            mt: hasVisibleContent ? 0 : 1,
            px: 1.75,
            py: 1,
            border: "1px solid",
            borderColor: "neutral.300",
            borderRadius: "sm",
            bgcolor: "#ffffff",
            color: "#203b3b",
            fontSize: 13,
            fontWeight: 650,
            cursor: busy ? "wait" : "pointer",
            boxShadow: "sm",
            zIndex: 2,
            "&:focus-visible": { outline: "2px solid", outlineColor: "primary.500" },
          }}
        >
          {block.imageUrl ? "Replace image" : "Upload image"}
        </Box>
      )}
      {replaceTargets.map((target) => (
        <Box
          key={target.key}
          component="button"
          type="button"
          className="nl-replace-image"
          aria-label={target.label}
          disabled={busy}
          onClick={(event) => {
            event.stopPropagation();
            choose(target.image);
          }}
          sx={{
            position: "absolute",
            top: target.top - 40,
            left: target.left - 8,
            transform: "translateX(-100%)",
            px: 1.25,
            py: 0.6,
            border: "1px solid",
            borderColor: "neutral.300",
            borderRadius: "sm",
            bgcolor: "#ffffff",
            color: "#203b3b",
            fontSize: 12,
            fontWeight: 650,
            whiteSpace: "nowrap",
            cursor: busy ? "wait" : "pointer",
            boxShadow: "sm",
            zIndex: 2,
            "&:focus-visible": { outline: "2px solid", outlineColor: "primary.500" },
          }}
        >
          Replace image
        </Box>
      ))}
      {onUpdateBlockField && (
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          hidden
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            const selected = target.current;
            if (!file || !selected || selected.blockId !== block.id) return;
            setBusy(true);
            setError("");
            try {
              const url = await uploadStudioImageFile(file);
              const current = latest.current;
              if (
                !mounted.current ||
                current.block.id !== selected.blockId ||
                !current.onUpdateBlockField
              )
                return;
              if (selected.field === "galleryImages") {
                const images = [...(current.block.galleryImages || [])];
                const index = images.findIndex(
                  (image) => image.id === selected.itemId,
                );
                if (index < 0) return;
                images[index] = { ...images[index], url };
                current.onUpdateBlockField(
                  current.block.id,
                  "galleryImages",
                  images,
                );
              } else if (selected.field === "galleryProducts") {
                const products = [...(current.block.galleryProducts || [])];
                const index = products.findIndex(
                  (product) => product.id === selected.itemId,
                );
                if (index < 0) return;
                products[index] = { ...products[index], imageUrl: url };
                current.onUpdateBlockField(
                  current.block.id,
                  "galleryProducts",
                  products,
                );
              } else {
                current.onUpdateBlockField(
                  current.block.id,
                  selected.field as keyof StudioBlock,
                  url,
                );
              }
            } catch (err) {
              if (
                !mounted.current ||
                latest.current.block.id !== selected.blockId
              )
                return;
              setError(
                err instanceof Error
                  ? err.message
                  : "Image could not be uploaded.",
              );
            } finally {
              if (mounted.current) setBusy(false);
            }
          }}
        />
      )}
      {busy && (
        <Box
          role="status"
          sx={{
            position: "absolute",
            top: 4,
            right: 4,
            p: 1,
            bgcolor: "#fff",
            color: "#243d42",
            fontSize: 12,
            boxShadow: "sm",
          }}
        >
          Uploading image…
        </Box>
      )}
      {error && (
        <Box role="alert" sx={{ p: 1, color: "danger.700", fontSize: 12 }}>
          {error}
        </Box>
      )}
    </Box>
  );
}
