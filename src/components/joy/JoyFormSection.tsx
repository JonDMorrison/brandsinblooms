import * as React from "react";
import Stack from "@mui/joy/Stack";
import type { SxProps } from "@mui/joy/styles/types";
import { mergeSx } from "@/components/joy/mergeSx";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
  type JoyCardProps,
} from "@/components/joy/JoyCard";

export interface JoyFormSectionProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  headerActions?: React.ReactNode;
  spacing?: number | string;
  sx?: SxProps;
  contentSx?: SxProps;
  cardProps?: Omit<JoyCardProps, "children" | "sx">;
}

export const JoyFormSection = React.forwardRef<
  HTMLDivElement,
  JoyFormSectionProps
>(
  (
    {
      title,
      description,
      children,
      actions,
      headerActions,
      spacing = 2.5,
      sx,
      contentSx,
      cardProps,
    },
    ref,
  ) => (
    <JoyCard ref={ref} sx={sx} {...cardProps}>
      <JoyCardHeader
        title={title}
        description={description}
        actions={headerActions}
      />
      <JoyCardContent sx={contentSx}>
        <Stack spacing={spacing}>
          {children}
          {actions ? (
            <Stack
              direction="row"
              spacing={1}
              justifyContent="flex-end"
              alignItems="center"
              useFlexGap
              flexWrap="wrap"
            >
              {actions}
            </Stack>
          ) : null}
        </Stack>
      </JoyCardContent>
    </JoyCard>
  ),
);

JoyFormSection.displayName = "JoyFormSection";
