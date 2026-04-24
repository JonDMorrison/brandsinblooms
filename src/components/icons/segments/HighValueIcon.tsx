import * as React from "react";
import {
  EntityIcon,
  entityIconStrokeProps,
  type EntityIconProps,
} from "@/components/icons/shared";

export function HighValueIcon({ size = 22, className }: EntityIconProps) {
  return (
    <EntityIcon size={size} className={className}>
      <path d="M20 7L31 16L24 31H16L9 16L20 7Z" {...entityIconStrokeProps} />
      <path d="M9 16H31" {...entityIconStrokeProps} />
      <path d="M20 7L16 31" {...entityIconStrokeProps} />
      <path d="M20 7L24 31" {...entityIconStrokeProps} />
      <path
        d="M14.5 11.5L20 16L25.5 11.5"
        fill="currentColor"
        fillOpacity={0.15}
        {...entityIconStrokeProps}
      />
    </EntityIcon>
  );
}
