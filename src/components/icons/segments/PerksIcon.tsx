import * as React from "react";
import {
  EntityIcon,
  entityIconStrokeProps,
  type EntityIconProps,
} from "@/components/icons/shared";

export function PerksIcon({ size = 22, className }: EntityIconProps) {
  return (
    <EntityIcon size={size} className={className}>
      <rect
        x="8"
        y="18"
        width="24"
        height="14"
        rx="2"
        {...entityIconStrokeProps}
      />
      <rect
        x="6"
        y="13"
        width="28"
        height="6"
        rx="1.5"
        {...entityIconStrokeProps}
      />
      <line x1="20" y1="13" x2="20" y2="32" {...entityIconStrokeProps} />
      <path
        d="M20 13C20 13 16 8 12 10C8 12 14 13 20 13Z"
        fill="currentColor"
        fillOpacity={0.15}
        {...entityIconStrokeProps}
      />
      <path
        d="M20 13C20 13 24 8 28 10C32 12 26 13 20 13Z"
        fill="currentColor"
        fillOpacity={0.15}
        {...entityIconStrokeProps}
      />
    </EntityIcon>
  );
}
