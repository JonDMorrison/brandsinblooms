import * as React from "react";
import {
  EntityIcon,
  entityIconStrokeProps,
  type EntityIconProps,
} from "@/components/icons/shared";

export function NewCustomerIcon({ size = 22, className }: EntityIconProps) {
  return (
    <EntityIcon size={size} className={className}>
      <path d="M8 29H32" {...entityIconStrokeProps} />
      <path d="M20 29V17" {...entityIconStrokeProps} />
      <path
        d="M20 21C20 21 14.5 21 12.5 15.5C17 15.2 19.6 17.4 20 21Z"
        fill="currentColor"
        fillOpacity={0.15}
        {...entityIconStrokeProps}
      />
      <path
        d="M20 18.5C20 18.5 25.5 18.5 27.5 13C23 12.7 20.4 14.9 20 18.5Z"
        fill="currentColor"
        fillOpacity={0.15}
        {...entityIconStrokeProps}
      />
    </EntityIcon>
  );
}
