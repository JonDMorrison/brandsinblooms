import * as React from "react";
import {
  EntityIcon,
  entityIconStrokeProps,
  type EntityIconProps,
} from "@/components/icons/shared";

export function PetFriendlyIcon({ size = 22, className }: EntityIconProps) {
  return (
    <EntityIcon size={size} className={className}>
      <circle cx="12.5" cy="14" r="2.5" {...entityIconStrokeProps} />
      <circle cx="18" cy="10.5" r="2.5" {...entityIconStrokeProps} />
      <circle cx="22" cy="10.5" r="2.5" {...entityIconStrokeProps} />
      <circle cx="27.5" cy="14" r="2.5" {...entityIconStrokeProps} />
      <path
        d="M20 31C15.5 28.4 13 24.8 13 20.4C13 17.1 15.6 14.5 18.9 14.5C22.1 14.5 24.7 17.1 24.7 20.4C24.7 24.8 22.2 28.4 20 31Z"
        fill="currentColor"
        fillOpacity={0.15}
        {...entityIconStrokeProps}
      />
      <path d="M20 17.5V27.5" {...entityIconStrokeProps} />
    </EntityIcon>
  );
}
