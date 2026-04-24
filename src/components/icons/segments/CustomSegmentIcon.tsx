import * as React from "react";
import {
  EntityIcon,
  entityIconStrokeProps,
  type EntityIconProps,
} from "@/components/icons/shared";

export function CustomSegmentIcon({ size = 22, className }: EntityIconProps) {
  return (
    <EntityIcon size={size} className={className}>
      <circle cx="13" cy="13" r="3" {...entityIconStrokeProps} />
      <circle cx="27" cy="13" r="3" {...entityIconStrokeProps} />
      <circle cx="20" cy="21" r="3" {...entityIconStrokeProps} />
      <path d="M10 27C13.4 29.7 16.4 31.6 20 34" {...entityIconStrokeProps} />
      <path d="M30 27C26.6 29.7 23.6 31.6 20 34" {...entityIconStrokeProps} />
    </EntityIcon>
  );
}
