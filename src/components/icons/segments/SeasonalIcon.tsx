import * as React from "react";
import {
  EntityIcon,
  entityIconStrokeProps,
  type EntityIconProps,
} from "@/components/icons/shared";

export function SeasonalIcon({ size = 22, className }: EntityIconProps) {
  return (
    <EntityIcon size={size} className={className}>
      <rect
        x="8"
        y="10"
        width="24"
        height="22"
        rx="3"
        {...entityIconStrokeProps}
      />
      <path d="M13 8V12" {...entityIconStrokeProps} />
      <path d="M27 8V12" {...entityIconStrokeProps} />
      <path d="M8 16H32" {...entityIconStrokeProps} />
      <path
        d="M24.5 26.5C24.5 22.8 27.2 20.2 31.5 20C31.3 24.6 28.8 28.8 24.8 30.2C24.1 29 23.9 27.6 24.5 26.5Z"
        fill="currentColor"
        fillOpacity={0.15}
        {...entityIconStrokeProps}
      />
      <path
        d="M26.2 28.8C27.4 26.6 29 24.8 31 23.2"
        {...entityIconStrokeProps}
      />
    </EntityIcon>
  );
}
