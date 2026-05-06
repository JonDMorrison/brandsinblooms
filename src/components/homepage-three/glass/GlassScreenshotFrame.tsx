import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { joinClassNames } from "./utils";
import "./glass.css";

type ImageFetchPriority = "high" | "low" | "auto";

export interface GlassScreenshotFrameProps extends HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt: string;
  showChrome?: boolean;
  chromeUrl?: string;
  placeholderLabel?: string;
  placeholderMeta?: ReactNode;
  placeholderIcon?: ReactNode;
  imageLoading?: "eager" | "lazy";
  imageFetchPriority?: ImageFetchPriority;
  imageStyle?: CSSProperties;
  className?: string;
}

export const GlassScreenshotFrame = ({
  src,
  alt,
  showChrome = true,
  chromeUrl = "app.bloomsuite.com",
  placeholderLabel = "Dashboard Screenshot",
  placeholderMeta,
  placeholderIcon,
  imageLoading = "lazy",
  imageFetchPriority,
  imageStyle,
  className,
  ...props
}: GlassScreenshotFrameProps) => (
  <div className={joinClassNames("hp-screenshot-frame", className)} {...props}>
    {showChrome ? (
      <div className="hp-screenshot-frame__chrome" aria-hidden="true">
        <span className="hp-screenshot-frame__dots">
          <span />
          <span />
          <span />
        </span>
        <span className="hp-screenshot-frame__url">{chromeUrl}</span>
      </div>
    ) : null}
    {src ? (
      <img
        className="hp-screenshot-frame__image"
        src={src}
        alt={alt}
        loading={imageLoading}
        decoding="async"
        fetchPriority={imageFetchPriority}
        style={imageStyle}
      />
    ) : (
      <div
        className="hp-screenshot-frame__placeholder"
        role="img"
        aria-label={alt}
      >
        <span
          className="hp-screenshot-frame__placeholder-icon"
          aria-hidden="true"
        >
          {placeholderIcon}
        </span>
        <span className="hp-screenshot-frame__placeholder-label">
          {placeholderLabel}
        </span>
        {placeholderMeta ? (
          <span className="hp-screenshot-frame__placeholder-meta">
            {placeholderMeta}
          </span>
        ) : null}
      </div>
    )}
  </div>
);
