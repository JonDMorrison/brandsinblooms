import React from "react";
import { ContentBlock } from "@/types/emailBuilder";
import {
  Image,
  Type,
  MousePointerClick,
  Minus,
  LayoutGrid,
} from "lucide-react";

function stripHtml(html: string): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, "").trim();
}

function truncate(text: string, len: number): string {
  const clean = stripHtml(text);
  if (clean.length <= len) return clean;
  return clean.slice(0, len).trimEnd() + "…";
}

interface BlockMiniPreviewProps {
  block: ContentBlock;
}

export const BlockMiniPreview: React.FC<BlockMiniPreviewProps> = ({
  block,
}) => {
  const headline = block.headline || block.title || "";
  const body = block.body || block.content || "";
  const imgSrc = block.imageUrl || block.backgroundImageUrl || "";
  const btnText = block.buttonText || block.ctaText || "";
  const bgColor = block.backgroundColor || undefined;

  switch (block.type) {
    // ── Hero / Header blocks ──────────────────────────────────
    case "header":
    case "newsletter-header":
    case "email-safe-hero": {
      const displayText = truncate(headline, 40) || "New Headline";
      return (
        <div
          className="flex items-center gap-3 h-[60px] px-3 rounded overflow-hidden"
          style={{ backgroundColor: bgColor || "#0d9488" }}
        >
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-semibold truncate"
              style={{ color: block.textColor || "#fff" }}
            >
              {displayText}
            </p>
            {body && (
              <p
                className="text-xs truncate opacity-70 mt-0.5"
                style={{ color: block.textColor || "#fff" }}
              >
                {truncate(body, 50)}
              </p>
            )}
          </div>
          {imgSrc ? (
            <img
              src={imgSrc}
              alt=""
              className="h-10 w-14 rounded object-cover flex-shrink-0"
            />
          ) : (
            <div className="h-10 w-14 rounded bg-white/20 flex-shrink-0" />
          )}
        </div>
      );
    }

    case "graphic-hero": {
      return (
        <div className="flex items-center gap-3 h-[60px] px-3 rounded bg-muted/40 overflow-hidden">
          {imgSrc ? (
            <img
              src={imgSrc}
              alt=""
              className="h-10 w-20 rounded object-cover flex-shrink-0"
            />
          ) : (
            <div className="h-10 w-20 rounded bg-muted flex-shrink-0 flex items-center justify-center">
              <Image className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          <span className="text-xs text-muted-foreground">Graphic Hero</span>
        </div>
      );
    }

    // ── Text / Image-Text blocks ──────────────────────────────
    case "text":
    case "image-text": {
      const headlineText = truncate(headline, 40);
      const bodyText = truncate(body, 60);
      const hasImg = !!block.imageUrl;
      return (
        <div className="flex items-center gap-3 h-[60px] px-3 rounded bg-white overflow-hidden">
          {hasImg && (
            <img
              src={block.imageUrl!}
              alt=""
              className="h-10 w-14 rounded object-cover flex-shrink-0"
            />
          )}
          <div className="flex-1 min-w-0 space-y-1">
            {headlineText ? (
              <p className="text-xs font-semibold text-foreground truncate">
                {headlineText}
              </p>
            ) : (
              <div className="h-2.5 w-3/5 bg-muted rounded-full" />
            )}
            {bodyText ? (
              <p className="text-[11px] text-muted-foreground truncate leading-tight">
                {bodyText}
              </p>
            ) : (
              <div className="space-y-1">
                <div className="h-2 w-full bg-muted/60 rounded-full" />
                <div className="h-2 w-4/5 bg-muted/40 rounded-full" />
              </div>
            )}
          </div>
          {!hasImg && (
            <Type className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
          )}
        </div>
      );
    }

    // ── Image blocks ──────────────────────────────────────────
    case "image": {
      return (
        <div className="flex items-center gap-3 h-[60px] px-3 rounded bg-muted/30 overflow-hidden">
          {imgSrc ? (
            <img
              src={imgSrc}
              alt=""
              className="h-10 w-20 rounded object-cover flex-shrink-0"
            />
          ) : (
            <div className="h-10 w-20 rounded bg-muted flex-shrink-0 flex items-center justify-center">
              <Image className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          <span className="text-xs text-muted-foreground">
            {block.altText || block.caption || "Image Block"}
          </span>
        </div>
      );
    }

    // ── Button block ──────────────────────────────────────────
    case "button": {
      const label = btnText || "Button";
      return (
        <div className="flex items-center justify-center h-[60px] px-3 rounded bg-white">
          <div
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium text-white"
            style={{
              backgroundColor: block.buttonColor || "#22c55e",
            }}
          >
            <MousePointerClick className="h-3 w-3" />
            {truncate(label, 24)}
          </div>
        </div>
      );
    }

    // ── Divider block ─────────────────────────────────────────
    case "divider": {
      return (
        <div className="flex items-center h-[40px] px-6">
          <hr
            className="w-full border-t"
            style={{
              borderColor: block.textColor || "#e2e8f0",
              borderWidth: `${(block as any).dividerThickness || 1}px`,
            }}
          />
        </div>
      );
    }

    // ── Gallery blocks ────────────────────────────────────────
    case "image-gallery": {
      const galleryImages = (block as any).galleryImages || [];
      const slots = Math.max(galleryImages.length, 3);
      return (
        <div className="flex items-center gap-2 h-[60px] px-3 rounded bg-muted/30 overflow-hidden">
          <LayoutGrid className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
          <div className="flex gap-1.5 flex-1 min-w-0">
            {Array.from({ length: Math.min(slots, 4) }).map((_, i) => {
              const src = galleryImages[i]?.url || galleryImages[i];
              return typeof src === "string" && src ? (
                <img
                  key={i}
                  src={src}
                  alt=""
                  className="h-10 w-10 rounded object-cover flex-shrink-0"
                />
              ) : (
                <div
                  key={i}
                  className="h-10 w-10 rounded bg-muted flex-shrink-0"
                />
              );
            })}
            {slots > 4 && (
              <span className="text-[10px] text-muted-foreground self-center ml-1">
                +{slots - 4}
              </span>
            )}
          </div>
        </div>
      );
    }

    case "product-gallery": {
      const galleryItems = (block as any).galleryItems || [];
      const slots = Math.max(galleryItems.length, 4);
      return (
        <div className="flex items-center gap-2 h-[60px] px-3 rounded bg-muted/30 overflow-hidden">
          <LayoutGrid className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
          <div className="grid grid-cols-2 gap-1.5 flex-1 min-w-0">
            {Array.from({ length: Math.min(slots, 4) }).map((_, i) => {
              const item = galleryItems[i];
              return item?.imageUrl ? (
                <img
                  key={item.id || i}
                  src={item.imageUrl}
                  alt=""
                  className="h-10 w-10 rounded object-cover flex-shrink-0"
                />
              ) : (
                <div
                  key={item?.id || i}
                  className="h-10 w-10 rounded bg-muted flex-shrink-0"
                />
              );
            })}
          </div>
        </div>
      );
    }

    // ── Quote block ───────────────────────────────────────────
    case "quote": {
      const quoteText = (block as any).quote || body || "";
      return (
        <div className="flex items-center gap-2 h-[60px] px-3 rounded bg-muted/20 overflow-hidden">
          <div className="text-2xl text-muted-foreground/30 font-serif leading-none">
            "
          </div>
          <p className="text-xs text-muted-foreground italic truncate flex-1">
            {truncate(quoteText, 60) || "Add a quote…"}
          </p>
        </div>
      );
    }

    // ── Fallback ──────────────────────────────────────────────
    default: {
      const label =
        block.type
          .replace(/-/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase()) || "Block";
      return (
        <div className="flex items-center gap-2 h-[60px] px-3 rounded bg-muted/20 overflow-hidden">
          <div className="h-8 w-8 rounded bg-muted flex-shrink-0" />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
      );
    }
  }
};
