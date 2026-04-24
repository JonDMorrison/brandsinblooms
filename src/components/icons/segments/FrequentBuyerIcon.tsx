import * as React from "react";
import {
  EntityIcon,
  entityIconStrokeProps,
  type EntityIconProps,
} from "@/components/icons/shared";

export function FrequentBuyerIcon({ size = 22, className }: EntityIconProps) {
  return (
    <EntityIcon size={size} className={className}>
      <path
        d="M11 15.5H21V28C21 29.7 19.7 31 18 31H14C12.3 31 11 29.7 11 28V15.5Z"
        {...entityIconStrokeProps}
      />
      <path
        d="M14 15.5V13.8C14 11.7 15.7 10 17.8 10C19.9 10 21.6 11.7 21.6 13.8V15.5"
        {...entityIconStrokeProps}
      />
      <path
        d="M18.5 18H29V28.5C29 30.4 27.4 32 25.5 32H22C20.1 32 18.5 30.4 18.5 28.5V18Z"
        {...entityIconStrokeProps}
      />
      <path
        d="M21.5 18V16.6C21.5 14.8 22.9 13.4 24.7 13.4C26.5 13.4 27.9 14.8 27.9 16.6V18"
        {...entityIconStrokeProps}
      />
      <path
        d="M13.2 30C14.7 31.8 16.9 32.9 19.4 32.9C21.8 32.9 24 31.9 25.5 30.2"
        {...entityIconStrokeProps}
      />
      <polyline
        points="22.8 29.6 25.9 29.9 25.1 32.6"
        {...entityIconStrokeProps}
      />
    </EntityIcon>
  );
}
