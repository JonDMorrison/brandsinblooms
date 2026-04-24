import * as React from "react";
import {
  EntityIcon,
  entityIconStrokeProps,
  type EntityIconProps,
} from "@/components/icons/shared";

export function PollinatorIcon({ size = 22, className }: EntityIconProps) {
  return (
    <EntityIcon size={size} className={className}>
      <path
        d="M15.5 17C16.7 19.3 18.2 20.8 20.5 22C18.2 23.2 16.7 24.7 15.5 27C14.3 24.7 12.8 23.2 10.5 22C12.8 20.8 14.3 19.3 15.5 17Z"
        fill="currentColor"
        fillOpacity={0.15}
        {...entityIconStrokeProps}
      />
      <circle cx="15.5" cy="22" r="2.25" {...entityIconStrokeProps} />
      <path
        d="M22.4 18.3C23.8 16.7 24.9 15.8 26.2 15.4"
        strokeDasharray="2.5 2.5"
        {...entityIconStrokeProps}
      />
      <ellipse
        cx="29.2"
        cy="14.6"
        rx="2.2"
        ry="3.2"
        {...entityIconStrokeProps}
      />
      <path
        d="M27.5 12.8C26.2 11.5 25.8 10.2 26.4 8.8C28 9.2 29.1 10 29.9 11.5"
        {...entityIconStrokeProps}
      />
      <path
        d="M30.9 12.8C32.2 11.5 32.6 10.2 32 8.8C30.4 9.2 29.3 10 28.5 11.5"
        {...entityIconStrokeProps}
      />
    </EntityIcon>
  );
}
