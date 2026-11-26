import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode,
} from "react";
import { joinClassNames } from "./utils";
import "./glass.css";

export type GlassButtonVariant = "primary" | "secondary" | "ghost";
export type GlassButtonSize = "sm" | "md" | "lg";

interface CommonGlassButtonProps {
  variant?: GlassButtonVariant;
  size?: GlassButtonSize;
  className?: string;
  children: ReactNode;
}

type GlassButtonAnchorProps = CommonGlassButtonProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
  };

type GlassButtonNativeProps = CommonGlassButtonProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: undefined;
  };

export type GlassButtonProps = GlassButtonAnchorProps | GlassButtonNativeProps;

type GlassButtonAnchorRest = Omit<
  GlassButtonAnchorProps,
  keyof CommonGlassButtonProps
>;
type GlassButtonNativeRest = Omit<
  GlassButtonNativeProps,
  keyof CommonGlassButtonProps
>;

const isAnchorRest = (
  props: GlassButtonAnchorRest | GlassButtonNativeRest,
): props is GlassButtonAnchorRest => Boolean(props.href);

export const GlassButton = ({
  variant = "secondary",
  size = "md",
  className,
  children,
  ...props
}: GlassButtonProps) => {
  const classes = joinClassNames(
    "hp-glass-button",
    `hp-glass-button--${variant}`,
    `hp-glass-button--${size}`,
    className,
  );

  if (isAnchorRest(props)) {
    return (
      <a className={classes} {...props}>
        {children}
      </a>
    );
  }

  return (
    <button type="button" className={classes} {...props}>
      {children}
    </button>
  );
};
