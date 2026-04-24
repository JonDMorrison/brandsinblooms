import * as React from "react";
import {
  EntityIcon,
  entityIconStrokeProps,
  type EntityIconProps,
} from "@/components/icons/shared";

export function DIYIcon({ size = 22, className }: EntityIconProps) {
  return (
    <EntityIcon size={size} className={className}>
      <path d="M13 28L24 17" {...entityIconStrokeProps} />
      <path
        d="M24 17L29.8 11.2L31.8 13.2L26 19"
        fill="currentColor"
        fillOpacity={0.15}
        {...entityIconStrokeProps}
      />
      <path d="M12 12L23 23" {...entityIconStrokeProps} />
      <path d="M8.5 8.5L12 12" {...entityIconStrokeProps} />
      <path d="M6.8 8.6H10.6" {...entityIconStrokeProps} />
      <path d="M6.8 10.8L9.3 10.8" {...entityIconStrokeProps} />
      <path d="M6.8 12.9H10.6" {...entityIconStrokeProps} />
    </EntityIcon>
  );
}
