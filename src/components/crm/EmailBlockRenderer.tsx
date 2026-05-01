import React from "react";
import { EmailBlock, GlobalSettings } from "@/types/emailBuilder";
import { formatDraftRichText } from "@/lib/crm/htmlContent";
import {
  OPACITY_DEFAULTS,
  normalizeOpacityToDecimal,
} from "@/utils/opacityUtils";

interface EmailBlockRendererProps {
  block: EmailBlock;
  globalSettings: GlobalSettings;
  isPreview: boolean;
}

interface GalleryImageContent {
  id?: string;
  url?: string;
  alt?: string;
  caption?: string;
}

interface ProductGalleryContent {
  id?: string;
  title?: string;
  imageUrl?: string;
  badgeText?: string;
  url?: string;
}

const HERO_BACKGROUND_LAYOUTS = new Set([
  "image-background",
  "image-overlay",
  "background",
  "overlay",
]);

export const EmailBlockRenderer: React.FC<EmailBlockRendererProps> = ({
  block,
  globalSettings,
  isPreview,
}) => {
  const baseStyle = {
    fontFamily: globalSettings.fontFamily,
    fontSize: globalSettings.fontSize,
  };

  const getTextAlign = (
    fallback: React.CSSProperties["textAlign"] = "left",
  ): React.CSSProperties["textAlign"] => {
    const value = block.content.alignment || block.content.textAlign;
    return value === "left" ||
      value === "right" ||
      value === "center" ||
      value === "justify"
      ? value
      : fallback;
  };

  const getHeroAlignment = () => {
    const value = getTextAlign("center");
    return value === "left" || value === "right" ? value : "center";
  };

  const formatPublishDateLabel = (value?: string) => {
    if (!value) {
      return "";
    }

    const trimmed = String(value).trim();
    if (!trimmed) {
      return "";
    }

    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
      ? new Date(`${trimmed}T00:00:00`)
      : new Date(trimmed);

    if (Number.isNaN(parsed.getTime())) {
      return trimmed;
    }

    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(parsed);
  };

  const renderHeroButton = (textColor: string, outline = false) => {
    const label =
      block.cta_text || block.content.buttonText || block.content.ctaText;
    const url =
      block.cta_url || block.content.buttonUrl || block.content.ctaUrl;

    if (!label || !url) {
      return null;
    }

    return (
      <div style={{ marginTop: "24px" }}>
        <a
          href={url}
          style={{
            display: "inline-block",
            padding: "12px 24px",
            backgroundColor: outline
              ? "transparent"
              : globalSettings.buttonStyle.backgroundColor,
            color: outline ? textColor : globalSettings.buttonStyle.textColor,
            borderRadius: globalSettings.buttonStyle.cornerRadius,
            border: outline ? `1px solid ${textColor}` : "none",
            textDecoration: "none",
            fontWeight: "bold",
            fontSize: "16px",
            fontFamily: globalSettings.buttonFont || globalSettings.fontFamily,
          }}
        >
          {label}
        </a>
      </div>
    );
  };

  const renderLayeredHero = ({
    minHeight,
    titleSize,
    subtitleSize,
    defaultBackgroundColor = globalSettings.headerStyle.backgroundColor ||
      "#1F2937",
    defaultTextColor = globalSettings.headerStyle.textColor || "#FFFFFF",
    includeBody = false,
    includeIssueInfo = false,
    showPublishDate = false,
    outlineButton = false,
  }: {
    minHeight: number;
    titleSize: string;
    subtitleSize: string;
    defaultBackgroundColor?: string;
    defaultTextColor?: string;
    includeBody?: boolean;
    includeIssueInfo?: boolean;
    showPublishDate?: boolean;
    outlineButton?: boolean;
  }) => {
    const backgroundImageUrl =
      block.image_url || block.content.backgroundImageUrl || "";
    const backgroundColor =
      block.content.backgroundColor || defaultBackgroundColor;
    const textColor = block.content.textColor || defaultTextColor;
    const title =
      block.content.title || block.content.headline || "Header Title";
    const subtitle = block.content.subtitle || "";
    const body = includeBody
      ? block.content.body || block.content.content || ""
      : "";
    const issueInfo =
      includeIssueInfo && block.content.content !== block.content.body
        ? block.content.content || ""
        : "";
    const publishDate = showPublishDate
      ? formatPublishDateLabel(block.content.publishDate)
      : "";
    const alignment = getHeroAlignment();
    const backgroundOpacity = normalizeOpacityToDecimal(
      block.content.backgroundOpacity,
      OPACITY_DEFAULTS.backgroundImage,
    );
    const colorOverlayOpacity = backgroundImageUrl
      ? normalizeOpacityToDecimal(
          block.content.colorOverlayOpacity,
          OPACITY_DEFAULTS.colorOverlay,
        )
      : 0;
    const darkOverlayOpacity = backgroundImageUrl
      ? normalizeOpacityToDecimal(
          block.content.darkOverlayOpacity,
          OPACITY_DEFAULTS.darkOverlay,
        )
      : 0;
    const imageOverlayOpacity = backgroundImageUrl
      ? normalizeOpacityToDecimal(
          block.content.overlayOpacity,
          OPACITY_DEFAULTS.imageOverlay,
        )
      : 0;
    const contentMargin =
      alignment === "center"
        ? "0 auto"
        : alignment === "right"
          ? "0 0 0 auto"
          : "0 auto 0 0";

    return (
      <div
        style={{
          ...baseStyle,
          position: "relative",
          overflow: "hidden",
          minHeight: `${minHeight}px`,
          padding: "48px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor,
          textAlign: alignment as "left" | "center" | "right",
          color: textColor,
        }}
      >
        {backgroundImageUrl ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${backgroundImageUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              opacity: backgroundOpacity,
            }}
          />
        ) : null}
        {backgroundImageUrl && darkOverlayOpacity > 0 ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: "#000000",
              opacity: darkOverlayOpacity,
            }}
          />
        ) : null}
        {backgroundImageUrl && colorOverlayOpacity > 0 ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor,
              opacity: colorOverlayOpacity,
            }}
          />
        ) : null}
        {backgroundImageUrl && imageOverlayOpacity > 0 ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: block.content.overlayColor || "#000000",
              opacity: imageOverlayOpacity,
            }}
          />
        ) : null}

        <div
          style={{
            position: "relative",
            zIndex: 1,
            width: "100%",
            maxWidth: "640px",
            margin: contentMargin,
          }}
        >
          <h1
            style={{
              margin: "0 0 12px 0",
              fontSize: titleSize,
              fontWeight: "bold",
              lineHeight: 1.1,
              fontFamily:
                globalSettings.headlineFont || globalSettings.fontFamily,
            }}
          >
            {title}
          </h1>
          {subtitle ? (
            <p
              style={{
                margin: 0,
                fontSize: subtitleSize,
                lineHeight: 1.5,
                opacity: 0.92,
                fontFamily:
                  globalSettings.subheadingFont || globalSettings.fontFamily,
              }}
            >
              {subtitle}
            </p>
          ) : null}
          {includeBody && body && body !== subtitle ? (
            <div
              style={{
                margin: subtitle ? "16px 0 0 0" : 0,
                fontSize: "17px",
                lineHeight: 1.65,
                opacity: 0.92,
                fontFamily:
                  globalSettings.bodyFont || globalSettings.fontFamily,
              }}
              dangerouslySetInnerHTML={{ __html: formatDraftRichText(body) }}
            ></div>
          ) : null}
          {issueInfo ? (
            <div
              style={{
                marginTop: "14px",
                fontSize: "13px",
                lineHeight: 1.5,
                opacity: 0.72,
                fontFamily:
                  globalSettings.bodyFont || globalSettings.fontFamily,
              }}
              dangerouslySetInnerHTML={{
                __html: formatDraftRichText(issueInfo),
              }}
            ></div>
          ) : null}
          {publishDate ? (
            <div
              style={{
                marginTop: "24px",
                fontSize: "18px",
                lineHeight: 1.5,
                opacity: 0.82,
                fontFamily:
                  globalSettings.bodyFont || globalSettings.fontFamily,
              }}
            >
              {`\u{1F4C5} ${publishDate}`}
            </div>
          ) : null}
          {renderHeroButton(textColor, outlineButton)}
        </div>
      </div>
    );
  };

  const renderHeader = () => (
    <div
      style={{
        ...baseStyle,
        backgroundColor: globalSettings.headerStyle.backgroundColor,
        color: globalSettings.headerStyle.textColor,
        padding: "24px",
        textAlign: "center" as const,
      }}
    >
      <h1
        style={{
          margin: "0 0 8px 0",
          fontSize: "28px",
          fontWeight: "bold",
          fontFamily: globalSettings.headlineFont || globalSettings.fontFamily,
        }}
      >
        {block.content.title || "Header Title"}
      </h1>
      {block.content.subtitle && (
        <p
          style={{
            margin: "0",
            fontSize: "16px",
            opacity: 0.8,
            fontFamily:
              globalSettings.subheadingFont || globalSettings.fontFamily,
          }}
        >
          {block.content.subtitle}
        </p>
      )}
    </div>
  );

  const renderText = () => {
    // CRITICAL: Plain text blocks should NEVER render images, even if image_url exists
    // This is a pure text block - no images allowed
    const hasButton =
      (block.cta_text || block.content.buttonText) &&
      (block.cta_url || block.content.buttonUrl);

    return (
      <div style={{ ...baseStyle, padding: "16px 24px" }}>
        {block.content.title && (
          <h2
            style={{
              margin: "0 0 12px 0",
              fontSize: "20px",
              fontWeight: "bold",
              fontFamily:
                globalSettings.subheadingFont || globalSettings.fontFamily,
            }}
          >
            {block.content.title}
          </h2>
        )}
        <div
          style={{
            lineHeight: "1.6",
            color: "#374151",
            marginBottom: hasButton ? "16px" : "0",
            fontFamily: globalSettings.bodyFont || globalSettings.fontFamily,
          }}
          dangerouslySetInnerHTML={{
            __html: formatDraftRichText(
              block.content.content || "Add your text content here...",
            ),
          }}
        ></div>
        {hasButton && (
          <div
            style={{
              textAlign: getTextAlign("left"),
              marginTop: "16px",
            }}
          >
            <a
              href={block.cta_url || block.content.buttonUrl || "#"}
              style={{
                display: "inline-block",
                padding: "12px 24px",
                backgroundColor: globalSettings.buttonStyle.backgroundColor,
                color: globalSettings.buttonStyle.textColor,
                borderRadius: globalSettings.buttonStyle.cornerRadius,
                textDecoration: "none",
                fontWeight: "bold",
                fontSize: "16px",
                fontFamily:
                  globalSettings.buttonFont || globalSettings.fontFamily,
              }}
            >
              {block.cta_text || block.content.buttonText || "Click Here"}
            </a>
          </div>
        )}
      </div>
    );
  };

  const renderImage = () => {
    // Don't render anything if there's no image
    if (!block.image_url) {
      return null;
    }

    return (
      <div
        style={{
          padding: "0",
          width: "100%",
          textAlign: getTextAlign("center"),
        }}
      >
        <img
          src={block.image_url}
          alt={block.content.alt || "Email image"}
          style={{
            width: "100%",
            maxWidth: "100%",
            height: "auto",
            display: "block",
          }}
        />
        {block.content.caption && (
          <p
            style={{
              margin: "8px 0 0 0",
              padding: "0 24px",
              fontSize: "14px",
              color: "#6B7280",
              textAlign: "center" as const,
              fontFamily: globalSettings.bodyFont || globalSettings.fontFamily,
            }}
          >
            {block.content.caption}
          </p>
        )}
      </div>
    );
  };

  const renderImageGallery = () => {
    const galleryImages = Array.isArray(block.content.galleryImages)
      ? (block.content.galleryImages as GalleryImageContent[])
      : [];
    const galleryColumnsRaw = Number(
      block.content.galleryColumns || block.content.columns || 3,
    );
    const galleryColumns =
      Number.isFinite(galleryColumnsRaw) && galleryColumnsRaw > 0
        ? Math.min(3, Math.max(1, galleryColumnsRaw))
        : 3;
    const galleryGap =
      block.content.galleryGap === "small"
        ? 8
        : block.content.galleryGap === "large"
          ? 16
          : 12;
    const galleryRadius =
      block.content.galleryImageRadius === "none"
        ? "0px"
        : block.content.galleryImageRadius === "small"
          ? "6px"
          : block.content.galleryImageRadius === "large"
            ? "16px"
            : "12px";
    const galleryButtonLabel =
      block.cta_text || block.content.buttonText || block.content.ctaText;
    const galleryButtonUrl =
      block.cta_url || block.content.buttonUrl || block.content.ctaUrl || "";
    const galleryButtonColor =
      block.content.buttonColor ||
      globalSettings.buttonStyle.backgroundColor ||
      "#2E7D32";
    const galleryButtonRadius =
      block.content.isRounded === false
        ? globalSettings.buttonStyle.cornerRadius
        : "999px";

    if (!galleryImages.length) {
      return null;
    }

    return (
      <div style={{ ...baseStyle, padding: "16px 24px" }}>
        {block.content.headline && (
          <h2
            style={{
              margin: "0 0 12px 0",
              fontSize: "20px",
              fontWeight: "bold",
              textAlign: "center" as const,
              fontFamily:
                globalSettings.subheadingFont || globalSettings.fontFamily,
            }}
          >
            {block.content.headline}
          </h2>
        )}
        {block.content.body && (
          <div
            style={{
              margin: "0 0 16px 0",
              color: "#6B7280",
              textAlign: "center" as const,
              fontFamily: globalSettings.bodyFont || globalSettings.fontFamily,
            }}
            dangerouslySetInnerHTML={{
              __html: formatDraftRichText(block.content.body),
            }}
          ></div>
        )}
        <div
          style={{
            display: "grid",
            gap: `${galleryGap}px`,
            gridTemplateColumns: `repeat(${galleryColumns}, minmax(0, 1fr))`,
          }}
        >
          {galleryImages.map((image, index) => (
            <div
              key={image.id || `gallery-image-${index}`}
              style={{
                width: "100%",
                height: "200px",
                overflow: "hidden",
                borderRadius: galleryRadius,
              }}
            >
              <img
                src={image.url || ""}
                alt={image.alt || ""}
                style={{
                  width: "100%",
                  height: "100%",
                  display: "block",
                  objectFit: "cover",
                  objectPosition: "center",
                }}
              />
            </div>
          ))}
        </div>
        {galleryButtonLabel ? (
          <div style={{ marginTop: "20px", textAlign: "center" as const }}>
            {galleryButtonUrl ? (
              <a
                href={galleryButtonUrl}
                style={{
                  display: "inline-block",
                  padding: "12px 24px",
                  backgroundColor: galleryButtonColor,
                  color: "#FFFFFF",
                  borderRadius: galleryButtonRadius,
                  textDecoration: "none",
                  fontWeight: "bold",
                  fontSize: "16px",
                  fontFamily:
                    globalSettings.buttonFont || globalSettings.fontFamily,
                }}
              >
                {galleryButtonLabel}
              </a>
            ) : (
              <span
                style={{
                  display: "inline-block",
                  padding: "12px 24px",
                  backgroundColor: galleryButtonColor,
                  color: "#FFFFFF",
                  borderRadius: galleryButtonRadius,
                  fontWeight: "bold",
                  fontSize: "16px",
                  fontFamily:
                    globalSettings.buttonFont || globalSettings.fontFamily,
                }}
              >
                {galleryButtonLabel}
              </span>
            )}
          </div>
        ) : null}
      </div>
    );
  };

  const renderProductGallery = () => {
    const galleryItems = Array.isArray(block.content.galleryItems)
      ? (block.content.galleryItems as ProductGalleryContent[])
      : [];

    if (!galleryItems.length) {
      return null;
    }

    return (
      <div style={{ ...baseStyle, padding: "16px 24px" }}>
        {block.content.headline && (
          <h2
            style={{
              margin: "0 0 12px 0",
              fontSize: "20px",
              fontWeight: "bold",
              textAlign: "center" as const,
              fontFamily:
                globalSettings.subheadingFont || globalSettings.fontFamily,
            }}
          >
            {block.content.headline}
          </h2>
        )}
        {block.content.body && (
          <div
            style={{
              margin: "0 0 16px 0",
              color: "#6B7280",
              textAlign: "center" as const,
              fontFamily: globalSettings.bodyFont || globalSettings.fontFamily,
            }}
            dangerouslySetInnerHTML={{
              __html: formatDraftRichText(block.content.body),
            }}
          ></div>
        )}
        <div
          style={{
            display: "grid",
            gap: "16px",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          }}
        >
          {galleryItems.map((item, index) => (
            <div
              key={item.id || `product-gallery-item-${index}`}
              style={{
                border: "1px solid #E5E7EB",
                borderRadius: "12px",
                overflow: "hidden",
                backgroundColor: "#FFFFFF",
              }}
            >
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.title || `Product ${index + 1}`}
                  style={{
                    width: "100%",
                    aspectRatio: "1 / 1",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              ) : null}
              <div style={{ padding: "12px" }}>
                {item.badgeText && (
                  <div
                    style={{
                      display: "inline-block",
                      marginBottom: "8px",
                      padding: "4px 8px",
                      borderRadius: "999px",
                      fontSize: "12px",
                      fontWeight: "bold",
                      backgroundColor: "#111827",
                      color: "#FFFFFF",
                    }}
                  >
                    {item.badgeText}
                  </div>
                )}
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: "bold",
                    color: "#111827",
                    fontFamily:
                      globalSettings.subheadingFont ||
                      globalSettings.fontFamily,
                  }}
                >
                  {item.title || `Product ${index + 1}`}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderButton = () => {
    const headline =
      block.content.headline || block.content.title || block.content.heading;
    const subheading = block.content.subtitle || block.content.subheading;
    const body = block.content.body || block.content.content || "";
    const buttonLabel =
      block.cta_text ||
      block.content.buttonText ||
      block.content.ctaText ||
      block.content.text ||
      "Click Here";
    const buttonUrl =
      block.cta_url ||
      block.content.buttonUrl ||
      block.content.ctaUrl ||
      block.content.url ||
      "";
    const buttonColor =
      block.content.buttonColor ||
      globalSettings.buttonStyle.backgroundColor ||
      "#2E7D32";
    const buttonBorderRadius =
      block.content.isRounded === false
        ? globalSettings.buttonStyle.cornerRadius
        : "999px";
    const buttonSize = block.content.buttonSize || "medium";
    const buttonPadding =
      buttonSize === "small"
        ? "8px 16px"
        : buttonSize === "large"
          ? "16px 32px"
          : "12px 24px";
    const buttonFontSize =
      buttonSize === "small"
        ? "14px"
        : buttonSize === "large"
          ? "18px"
          : "16px";

    return (
      <div
        style={{
          ...baseStyle,
          padding: "32px 24px",
          textAlign: getTextAlign("center"),
          backgroundColor: block.content.backgroundColor || "#ffffff",
        }}
      >
        {headline ? (
          <h2
            style={{
              margin: "0 0 8px 0",
              fontSize: "24px",
              fontWeight: "bold",
              color: block.content.textColor || "#1f2937",
              fontFamily:
                globalSettings.subheadingFont || globalSettings.fontFamily,
            }}
          >
            {headline}
          </h2>
        ) : null}
        {subheading ? (
          <p
            style={{
              margin: "0 0 12px 0",
              fontSize: "16px",
              color: block.content.textColor || "#6b7280",
              fontFamily: globalSettings.bodyFont || globalSettings.fontFamily,
            }}
          >
            {subheading}
          </p>
        ) : null}
        {body ? (
          <div
            style={{
              marginBottom: "20px",
              lineHeight: "1.6",
              color: block.content.textColor || "#4b5563",
              fontFamily: globalSettings.bodyFont || globalSettings.fontFamily,
            }}
            dangerouslySetInnerHTML={{
              __html: formatDraftRichText(body),
            }}
          />
        ) : null}
        {buttonUrl ? (
          <a
            href={buttonUrl}
            style={{
              display: "inline-block",
              padding: buttonPadding,
              backgroundColor: buttonColor,
              color: globalSettings.buttonStyle.textColor,
              borderRadius: buttonBorderRadius,
              textDecoration: "none",
              fontWeight: "bold",
              fontSize: buttonFontSize,
              fontFamily:
                globalSettings.buttonFont || globalSettings.fontFamily,
            }}
          >
            {buttonLabel}
          </a>
        ) : (
          <span
            style={{
              display: "inline-block",
              padding: buttonPadding,
              backgroundColor: buttonColor,
              color: globalSettings.buttonStyle.textColor,
              borderRadius: buttonBorderRadius,
              fontWeight: "bold",
              fontSize: buttonFontSize,
              fontFamily:
                globalSettings.buttonFont || globalSettings.fontFamily,
            }}
          >
            {buttonLabel}
          </span>
        )}
      </div>
    );
  };

  const renderImageText = () => {
    const layout = block.content.layout || "two-column-left";
    const isFullWidth = layout === "full-width";
    const isImageRight =
      layout === "image-right" || layout === "two-column-right";
    const imageUrl =
      block.image_url ||
      block.content.imageUrl ||
      block.content.backgroundImageUrl ||
      "";
    const hasImage = Boolean(imageUrl);
    const title =
      block.content.headline ||
      block.content.title ||
      block.content.heading ||
      "";
    const subtitle = block.content.subtitle || block.content.subheading || "";
    const body = block.content.content || block.content.body || "";
    const backgroundColor = block.content.backgroundColor || "#ffffff";
    const headingColor = block.content.textColor || "#111827";
    const bodyColor = block.content.textColor || "#374151";
    const alignment = getTextAlign("left");
    const buttonBackgroundColor =
      block.content.buttonColor || globalSettings.buttonStyle.backgroundColor;
    const hasButton =
      (block.cta_text || block.content.buttonText) &&
      (block.cta_url || block.content.buttonUrl);

    const imageColumn = hasImage ? (
      <div style={{ width: "50%", flexShrink: 0, minWidth: 0 }}>
        <img
          src={imageUrl}
          alt={block.content.altText || block.content.alt || title}
          style={{
            width: "100%",
            maxWidth: "100%",
            height: "auto",
            display: "block",
            borderRadius: "12px",
            objectFit: "cover",
          }}
        />
      </div>
    ) : null;

    const textColumn = (
      <div
        style={{
          flex: 1,
          minWidth: 0,
          textAlign: alignment,
        }}
      >
        {title && (
          <h2
            style={{
              margin: "0 0 8px 0",
              fontSize: "20px",
              fontWeight: "bold",
              color: headingColor,
              fontFamily:
                globalSettings.subheadingFont || globalSettings.fontFamily,
            }}
          >
            {title}
          </h2>
        )}
        {subtitle && (
          <p
            style={{
              margin: "0 0 12px 0",
              fontSize: "15px",
              lineHeight: 1.6,
              color: bodyColor,
              fontFamily:
                globalSettings.subheadingFont || globalSettings.fontFamily,
            }}
          >
            {subtitle}
          </p>
        )}
        {body && (
          <div
            style={{
              lineHeight: "1.6",
              color: bodyColor,
              fontFamily: globalSettings.bodyFont || globalSettings.fontFamily,
            }}
            dangerouslySetInnerHTML={{
              __html: formatDraftRichText(body),
            }}
          />
        )}
        {hasButton && (
          <div style={{ marginTop: "16px" }}>
            <a
              href={block.cta_url || block.content.buttonUrl || "#"}
              style={{
                display: "inline-block",
                padding: "12px 24px",
                backgroundColor: buttonBackgroundColor,
                color: globalSettings.buttonStyle.textColor,
                borderRadius: globalSettings.buttonStyle.cornerRadius,
                textDecoration: "none",
                fontWeight: "bold",
                fontSize: "16px",
                fontFamily:
                  globalSettings.buttonFont || globalSettings.fontFamily,
              }}
            >
              {block.cta_text || block.content.buttonText || "Click Here"}
            </a>
          </div>
        )}
      </div>
    );

    if (!hasImage || isFullWidth) {
      return (
        <div
          style={{
            ...baseStyle,
            padding: "24px",
            backgroundColor,
            textAlign: alignment,
          }}
        >
          {hasImage ? (
            <div style={{ marginBottom: "20px" }}>
              <img
                src={imageUrl}
                alt={block.content.altText || block.content.alt || title}
                style={{
                  width: "100%",
                  maxWidth: "100%",
                  height: "auto",
                  display: "block",
                  borderRadius: "12px",
                }}
              />
            </div>
          ) : null}
          {textColumn}
        </div>
      );
    }

    return (
      <div
        style={{
          ...baseStyle,
          padding: "24px",
          backgroundColor,
          display: "flex",
          alignItems: "flex-start",
          gap: "24px",
        }}
      >
        {isImageRight ? (
          <>
            {textColumn}
            {imageColumn}
          </>
        ) : (
          <>
            {imageColumn}
            {textColumn}
          </>
        )}
      </div>
    );
  };

  const renderDivider = () => (
    <div style={{ padding: "16px 24px" }}>
      <div
        style={{
          width: "100%",
          height: "1px",
          backgroundColor: block.content.color || "#E5E7EB",
          border: "none",
        }}
      />
    </div>
  );

  const renderProduct = () => (
    <div
      style={{
        ...baseStyle,
        padding: "24px",
        border: "1px solid #E5E7EB",
        borderRadius: "8px",
        margin: "16px 24px",
      }}
    >
      <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
        {block.image_url && (
          <img
            src={block.image_url}
            alt={block.content.name || "Product"}
            style={{
              width: "80px",
              height: "80px",
              objectFit: "cover",
              borderRadius: "8px",
            }}
          />
        )}
        <div style={{ flex: 1 }}>
          <h3
            style={{
              margin: "0 0 4px 0",
              fontSize: "18px",
              fontWeight: "bold",
              fontFamily:
                globalSettings.subheadingFont || globalSettings.fontFamily,
            }}
          >
            {block.content.name || "Product Name"}
          </h3>
          <p
            style={{
              margin: "0 0 8px 0",
              color: "#6B7280",
              fontSize: "14px",
              fontFamily: globalSettings.bodyFont || globalSettings.fontFamily,
            }}
            dangerouslySetInnerHTML={{
              __html: formatDraftRichText(
                block.content.description || "Product description",
              ),
            }}
          ></p>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span
              style={{
                fontSize: "20px",
                fontWeight: "bold",
                color: globalSettings.buttonStyle.backgroundColor,
              }}
            >
              {block.content.price || "$0.00"}
            </span>
            <a
              href={block.content.buttonUrl || "#"}
              style={{
                padding: "8px 16px",
                backgroundColor: globalSettings.buttonStyle.backgroundColor,
                color: globalSettings.buttonStyle.textColor,
                borderRadius: globalSettings.buttonStyle.cornerRadius,
                textDecoration: "none",
                fontSize: "14px",
                fontWeight: "bold",
                fontFamily:
                  globalSettings.buttonFont || globalSettings.fontFamily,
              }}
            >
              {block.content.buttonText || "Shop Now"}
            </a>
          </div>
        </div>
      </div>
    </div>
  );

  const renderBlock = () => {
    // CRITICAL: Force text blocks to never render images
    // Even if image_url is accidentally set on a text block, ignore it
    const isTextBlock = block.block_type === "text";

    switch (block.block_type) {
      case "header":
        if (block.image_url || block.content?.backgroundImageUrl) {
          return renderLayeredHero({
            minHeight: 300,
            titleSize: "42px",
            subtitleSize: "20px",
            includeBody: true,
            defaultBackgroundColor:
              globalSettings.headerStyle.backgroundColor || "#1F2937",
            defaultTextColor: globalSettings.headerStyle.textColor || "#FFFFFF",
          });
        }
        return renderHeader();
      case "newsletter-header":
        return renderLayeredHero({
          minHeight: 400,
          titleSize: "48px",
          subtitleSize: "22px",
          defaultBackgroundColor: "#1F2937",
          defaultTextColor: "#FFFFFF",
          showPublishDate: true,
          outlineButton: true,
        });
      case "email-safe-hero":
        return renderLayeredHero({
          minHeight: 360,
          titleSize: "44px",
          subtitleSize: "22px",
          defaultBackgroundColor: "#F5F5F7",
          defaultTextColor: "#111111",
          includeBody: true,
          includeIssueInfo: true,
          outlineButton: true,
        });
      case "graphic-hero":
        // Graphic hero is a single clickable image — always full width
        return block.image_url ? (
          <div style={{ padding: "0", width: "100%" }}>
            {block.content?.ctaUrl || block.cta_url ? (
              <a
                href={block.content?.ctaUrl || block.cta_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "block", width: "100%" }}
              >
                <img
                  src={block.image_url}
                  alt={block.content?.altText || ""}
                  style={{
                    width: "100%",
                    maxWidth: "100%",
                    height: "auto",
                    display: "block",
                  }}
                />
              </a>
            ) : (
              <img
                src={block.image_url}
                alt={block.content?.altText || ""}
                style={{
                  width: "100%",
                  maxWidth: "100%",
                  height: "auto",
                  display: "block",
                }}
              />
            )}
          </div>
        ) : (
          <div
            style={{
              padding: "40px 20px",
              backgroundColor: "#f1f5f9",
              textAlign: "center" as const,
              borderRadius: "8px",
            }}
          >
            <p style={{ margin: 0, fontSize: "14px", color: "#94a3b8" }}>
              Add your graphic hero image
            </p>
          </div>
        );
      case "text":
        return renderText();
      case "image-text":
        if (
          HERO_BACKGROUND_LAYOUTS.has(block.content?.layout || "") &&
          (block.image_url || block.content?.backgroundImageUrl)
        ) {
          return renderLayeredHero({
            minHeight: 320,
            titleSize: "40px",
            subtitleSize: "20px",
            includeBody: true,
            outlineButton: true,
          });
        }
        return renderImageText();
      case "image":
        // Don't render image blocks if they're actually text blocks
        return isTextBlock ? renderText() : renderImage();
      case "image-gallery":
        return renderImageGallery();
      case "product-gallery":
        return renderProductGallery();
      case "button":
        return renderButton();
      case "divider":
        return renderDivider();
      case "product":
        return renderProduct();
      case "quote":
        return (
          <div
            style={{
              ...baseStyle,
              padding: "24px",
              borderLeft: "4px solid #d1d5db",
              margin: "16px 24px",
              fontStyle: "italic",
            }}
          >
            <p
              style={{ margin: "0 0 8px 0", fontSize: "18px", lineHeight: 1.6 }}
              dangerouslySetInnerHTML={{
                __html: formatDraftRichText(
                  block.content?.quote || block.content?.content || "",
                ),
              }}
            ></p>
            {block.content?.author && (
              <p
                style={{
                  margin: 0,
                  fontSize: "14px",
                  color: "#6B7280",
                  fontStyle: "normal",
                }}
              >
                — {block.content.author}
              </p>
            )}
          </div>
        );
      default:
        // Render as text block for any unrecognized type rather than "Unknown"
        return renderText();
    }
  };

  return (
    <div
      className={
        isPreview ? "hover:bg-muted/50 transition-colors cursor-pointer" : ""
      }
    >
      {renderBlock()}
    </div>
  );
};
