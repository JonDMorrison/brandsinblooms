import * as React from "react";
import {
  EntityIcon,
  entityIconStrokeProps,
  type EntityIconProps,
} from "@/components/icons/shared";

export function LoyaltyIcon({ size = 22, className }: EntityIconProps) {
  return (
    <EntityIcon size={size} className={className}>
      <path
        d="M20 6L29 10V18C29 24.1 25.2 28.9 20 32C14.8 28.9 11 24.1 11 18V10L20 6Z"
        {...entityIconStrokeProps}
      />
      <path
        d="M20 24.5C15.9 21.8 13.8 19.4 13.8 16.8C13.8 14.9 15.3 13.4 17.2 13.4C18.5 13.4 19.4 14 20 15C20.6 14 21.5 13.4 22.8 13.4C24.7 13.4 26.2 14.9 26.2 16.8C26.2 19.4 24.1 21.8 20 24.5Z"
        fill="currentColor"
        fillOpacity={0.15}
        {...entityIconStrokeProps}
      />
    </EntityIcon>
  );
}
