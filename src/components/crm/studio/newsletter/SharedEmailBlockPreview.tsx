import * as React from "react";
import Box from "@mui/joy/Box";
import Typography from "@mui/joy/Typography";
import DOMPurify from "dompurify";
import type { StudioBlock } from "@/types/studioBlocks";
import { useDesignSystem } from "@/contexts/DesignSystemContext";
import { renderFooterBlockToEmailHtml, renderNewsletterBlock } from "@/lib/studio/emailHtmlGenerator";
import { useNewsletterDesign } from "./NewsletterDesignContext";
import { uploadStudioImageFile } from "../fields/StudioImageUpload";
import { STUDIO_BLOCK_LOOKUP } from "../blockLibraryData";
import "./newsletterControls.css";
import { normalizeSocialLinks } from "@/lib/studio/socialIcons";
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
      ? renderFooterBlockToEmailHtml(block, {}, designSystem)
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
    const image = element.closest("img");
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
  return (
    <Box aria-busy={busy} sx={{ position: "relative" }}>
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
            choose(event.target as Element);
          }}
          onKeyDown={(event) => {
            if (
              (event.key === "Enter" || event.key === " ") &&
              (event.target as Element).matches("img")
            ) {
              event.preventDefault();
              choose(event.target as Element);
            }
          }}
          ref={(node) => {
            if (node && onUpdateBlockField)
              node
                .querySelectorAll<HTMLImageElement>(
                  "img:not([data-newsletter-readonly])",
                )
                .forEach((image) => {
                  if (block.type === "social-follow") return;
                  image.tabIndex = 0;
                  image.setAttribute("role", "button");
                  image.setAttribute(
                    "aria-label",
                    `Change ${image.alt || "block image"}`,
                  );
                });
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <Box
          sx={{
            p: 4,
            bgcolor: "#f1f5f4",
            textAlign: "center",
            border: "1px dashed #a8b8ba",
          }}
        >
          <Typography
            level="body-sm"
            sx={{ color: "#3f5b60", fontWeight: 600 }}
          >
            {STUDIO_BLOCK_LOOKUP[block.type]?.name || block.label}
          </Typography>
          <Typography level="body-xs" sx={{ mt: 0.5, color: "#526b72" }}>
            This block is empty. Click it, then fill in the boxes on the right.
          </Typography>
          <Typography level="body-xs" sx={{ mt: 0.25, color: "#6b7f85" }}>
            Customers will not see it until you add something.
          </Typography>
        </Box>
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
