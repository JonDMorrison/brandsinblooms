import * as React from "react";
import Box from "@mui/joy/Box";
import Typography from "@mui/joy/Typography";
import DOMPurify from "dompurify";
import type { StudioBlock } from "@/types/studioBlocks";
import { useDesignSystem } from "@/contexts/DesignSystemContext";
import { renderNewsletterBlock } from "@/lib/studio/emailHtmlGenerator";
import { useNewsletterDesign } from "./NewsletterDesignContext";
import { uploadStudioImageFile } from "../fields/StudioImageUpload";
import { STUDIO_BLOCK_LOOKUP } from "../blockLibraryData";
import "./newsletterControls.css";
type Update = (
  blockId: string,
  field: keyof StudioBlock,
  value: StudioBlock[keyof StudioBlock],
) => void;
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
  } | null>(null);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const html = React.useMemo(
    () =>
      DOMPurify.sanitize(renderNewsletterBlock(block, designSystem, settings), {
        ADD_ATTR: [
          "data-newsletter-image",
          "data-newsletter-index",
          "data-newsletter-role",
        ],
        FORBID_TAGS: ["script", "iframe", "form", "input", "style", "link"],
      }),
    [block, designSystem, settings],
  );
  const hasVisibleContent = Boolean(
    html
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, "")
      .trim() ||
    /<img\b/i.test(html) ||
    ["divider", "spacer"].includes(block.type),
  );
  const choose = (element: Element) => {
    if (!onUpdateBlockField || busy) return;
    const image = element.closest("img");
    if (!image) return;
    let field = image.getAttribute("data-newsletter-image") || "imageUrl";
    let index = Number(image.getAttribute("data-newsletter-index") || 0);
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
    target.current = { field, index, blockId: block.id };
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
              node.querySelectorAll("img").forEach((image) => {
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
            Select this block to add its content in Properties.
          </Typography>
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
              if (selected.field === "galleryImages") {
                const images = [...(block.galleryImages || [])];
                if (images[selected.index]) {
                  images[selected.index] = { ...images[selected.index], url };
                  onUpdateBlockField(block.id, "galleryImages", images);
                }
              } else if (selected.field === "galleryProducts") {
                const products = [...(block.galleryProducts || [])];
                if (products[selected.index]) {
                  products[selected.index] = {
                    ...products[selected.index],
                    imageUrl: url,
                  };
                  onUpdateBlockField(block.id, "galleryProducts", products);
                }
              } else
                onUpdateBlockField(
                  block.id,
                  selected.field as keyof StudioBlock,
                  url,
                );
            } catch (err) {
              setError(
                err instanceof Error
                  ? err.message
                  : "Image could not be uploaded.",
              );
            } finally {
              setBusy(false);
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
