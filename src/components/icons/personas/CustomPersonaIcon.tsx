import * as React from "react";
import {
  EntityIcon,
  entityIconStrokeProps,
  type EntityIconProps,
} from "@/components/icons/shared";

export function CustomPersonaIcon({ size = 22, className }: EntityIconProps) {
  return (
    <EntityIcon size={size} className={className}>
      <circle cx="19" cy="13.5" r="4.75" {...entityIconStrokeProps} />
      <path
        d="M10.5 31C12.2 26.6 15.7 24.1 20.1 24.1C24.4 24.1 27.8 26.6 29.5 31"
        {...entityIconStrokeProps}
      />
      <path
        d="M30.5 8L31.4 10.1L33.5 11L31.4 11.9L30.5 14L29.6 11.9L27.5 11L29.6 10.1L30.5 8Z"
        fill="currentColor"
        fillOpacity={0.15}
        {...entityIconStrokeProps}
      />
    </EntityIcon>
  );
}
