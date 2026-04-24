import * as React from "react";
import {
  EntityIcon,
  entityIconStrokeProps,
  type EntityIconProps,
} from "@/components/icons/shared";

export function CurbAppealIcon({ size = 22, className }: EntityIconProps) {
  return (
    <EntityIcon size={size} className={className}>
      <path d="M10 19.5L20 11L30 19.5V30H10V19.5Z" {...entityIconStrokeProps} />
      <path
        d="M18 30V24.5C18 23.1 19.1 22 20.5 22H21.5C22.9 22 24 23.1 24 24.5V30"
        {...entityIconStrokeProps}
      />
      <path d="M6.5 30H15" {...entityIconStrokeProps} />
      <circle
        cx="9.5"
        cy="26.5"
        r="2.5"
        fill="currentColor"
        fillOpacity={0.15}
        {...entityIconStrokeProps}
      />
    </EntityIcon>
  );
}
