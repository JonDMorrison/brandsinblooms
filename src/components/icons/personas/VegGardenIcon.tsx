import * as React from "react";
import {
  EntityIcon,
  entityIconStrokeProps,
  type EntityIconProps,
} from "@/components/icons/shared";

export function VegGardenIcon({ size = 22, className }: EntityIconProps) {
  return (
    <EntityIcon size={size} className={className}>
      <path d="M8 22.5H32" {...entityIconStrokeProps} />
      <path
        d="M20 22.5L16.2 33.2C17.3 34.3 18.5 35 20 35C21.5 35 22.7 34.3 23.8 33.2L20 22.5Z"
        {...entityIconStrokeProps}
        fill="currentColor"
        fillOpacity={0.15}
      />
      <path d="M18 29.8L16.4 32.2" {...entityIconStrokeProps} />
      <path d="M22 29.8L23.6 32.2" {...entityIconStrokeProps} />
      <path d="M20 22.5V13" {...entityIconStrokeProps} />
      <path d="M20 15C17.5 15 15.8 13.7 14.8 11" {...entityIconStrokeProps} />
      <path d="M20 15C22.5 15 24.2 13.7 25.2 11" {...entityIconStrokeProps} />
      <path d="M20 13.5C19.5 11.5 19.9 9.8 21 8.5" {...entityIconStrokeProps} />
    </EntityIcon>
  );
}
