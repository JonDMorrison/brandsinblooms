import * as React from "react";
import {
  EntityIcon,
  entityIconStrokeProps,
  type EntityIconProps,
} from "@/components/icons/shared";

export function WellnessIcon({ size = 22, className }: EntityIconProps) {
  return (
    <EntityIcon size={size} className={className}>
      <path
        d="M20 31C14.8 28.5 11.5 23.9 11.5 18.8C11.5 13.1 15.7 8.5 28.5 8.5C28.5 21.3 25.4 27.8 20 31Z"
        fill="currentColor"
        fillOpacity={0.15}
        {...entityIconStrokeProps}
      />
      <path
        d="M18.1 27C20.6 21.5 23.6 17.4 28.5 13.5"
        {...entityIconStrokeProps}
      />
      <path
        d="M12.5 28.5C12.5 26.6 14 25.1 14.8 24C15.9 25.6 17.1 27.1 17.1 28.7C17.1 30.4 15.8 31.7 14.8 31.7C13.6 31.7 12.5 30.6 12.5 28.5Z"
        fill="currentColor"
        fillOpacity={0.15}
        {...entityIconStrokeProps}
      />
    </EntityIcon>
  );
}
