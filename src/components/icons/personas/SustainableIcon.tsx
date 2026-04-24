import * as React from "react";
import {
  EntityIcon,
  entityIconStrokeProps,
  type EntityIconProps,
} from "@/components/icons/shared";

export function SustainableIcon({ size = 22, className }: EntityIconProps) {
  return (
    <EntityIcon size={size} className={className}>
      <path d="M20 8C24.5 8 27.9 10 29.5 13.7" {...entityIconStrokeProps} />
      <polyline points="26 13.2 29.7 14 28.8 10.2" {...entityIconStrokeProps} />
      <path d="M31 20C30.4 24.3 27.9 27.8 24 29.5" {...entityIconStrokeProps} />
      <polyline
        points="25.8 26.2 23.6 29.5 27.5 30.1"
        {...entityIconStrokeProps}
      />
      <path d="M16 29.5C11.9 27.8 9.3 24 8.8 19.6" {...entityIconStrokeProps} />
      <polyline
        points="12.1 20.8 8.6 19.2 10.1 22.8"
        {...entityIconStrokeProps}
      />
      <path
        d="M20 26.5C17.6 22.6 17.6 18.4 20 14C22.4 18.4 22.4 22.6 20 26.5Z"
        fill="currentColor"
        fillOpacity={0.15}
        {...entityIconStrokeProps}
      />
    </EntityIcon>
  );
}
