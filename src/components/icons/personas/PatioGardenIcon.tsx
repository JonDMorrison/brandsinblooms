import * as React from "react";
import {
  EntityIcon,
  entityIconStrokeProps,
  type EntityIconProps,
} from "@/components/icons/shared";

export function PatioGardenIcon({ size = 22, className }: EntityIconProps) {
  return (
    <EntityIcon size={size} className={className}>
      <path d="M10 28H30" {...entityIconStrokeProps} />
      <path d="M13 28V31" {...entityIconStrokeProps} />
      <path d="M27 28V31" {...entityIconStrokeProps} />
      <path d="M14 21H26L24.5 28H15.5L14 21Z" {...entityIconStrokeProps} />
      <path d="M20 21V14" {...entityIconStrokeProps} />
      <path d="M20 17C17.4 17 15.6 15.8 14.7 13.3" {...entityIconStrokeProps} />
      <path
        d="M20 15.5C22.6 15.5 24.4 14.3 25.3 11.8"
        {...entityIconStrokeProps}
      />
    </EntityIcon>
  );
}
