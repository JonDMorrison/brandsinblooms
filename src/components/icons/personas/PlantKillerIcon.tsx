import * as React from "react";
import {
  EntityIcon,
  entityIconStrokeProps,
  type EntityIconProps,
} from "@/components/icons/shared";

export function PlantKillerIcon({ size = 22, className }: EntityIconProps) {
  return (
    <EntityIcon size={size} className={className}>
      <path
        d="M20 26C20 22.5 21.2 19.9 23.5 17.8C26.1 15.4 27.1 12.5 26.6 9.2"
        {...entityIconStrokeProps}
      />
      <path
        d="M22.6 18.3C19.8 18.6 17.8 17.8 16.6 15.8C19.3 15.3 21.4 16 22.6 18.3Z"
        fill="currentColor"
        fillOpacity={0.15}
        {...entityIconStrokeProps}
      />
      <path
        d="M25.2 13.7C23 13.7 21.3 12.7 20.2 10.6C22.5 10.4 24.2 11.3 25.2 13.7Z"
        fill="currentColor"
        fillOpacity={0.15}
        {...entityIconStrokeProps}
      />
      <path d="M14 26H26L24.5 31H15.5L14 26Z" {...entityIconStrokeProps} />
      <path
        d="M20 26.4L18.6 28.3L20.3 29.6L18.9 31"
        {...entityIconStrokeProps}
      />
    </EntityIcon>
  );
}
