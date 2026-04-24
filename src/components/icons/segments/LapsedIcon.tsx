import * as React from "react";
import {
  EntityIcon,
  entityIconStrokeProps,
  type EntityIconProps,
} from "@/components/icons/shared";

export function LapsedIcon({ size = 22, className }: EntityIconProps) {
  return (
    <EntityIcon size={size} className={className}>
      <circle cx="20" cy="20.5" r="6.5" {...entityIconStrokeProps} />
      <path d="M20 20.5V16.5" {...entityIconStrokeProps} />
      <path d="M20 20.5L23 22.3" {...entityIconStrokeProps} />
      <path
        d="M30.5 22.8C29.5 27.9 25 31.8 19.6 31.8C13.4 31.8 8.4 26.8 8.4 20.6C8.4 14.4 13.4 9.4 19.6 9.4C22.9 9.4 25.8 10.7 27.9 12.9"
        {...entityIconStrokeProps}
      />
      <polyline
        points="28.5 9.4 28 13.6 23.8 13.2"
        {...entityIconStrokeProps}
      />
    </EntityIcon>
  );
}
