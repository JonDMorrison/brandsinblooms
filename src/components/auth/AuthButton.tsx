import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode,
} from "react";

export type AuthButtonVariant = "primary" | "secondary" | "ghost";
export type AuthButtonSize = "sm" | "md";

interface CommonAuthButtonProps {
  variant?: AuthButtonVariant;
  size?: AuthButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
}

type AuthButtonAnchorProps = CommonAuthButtonProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
  };

type AuthButtonNativeProps = CommonAuthButtonProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: undefined;
  };

export type AuthButtonProps = AuthButtonAnchorProps | AuthButtonNativeProps;

export const AuthButton = ({
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = true,
  className = "",
  children,
  ...props
}: AuthButtonProps) => {
  const classes = [
    "auth-button",
    `auth-button--${variant}`,
    `auth-button--${size}`,
    fullWidth ? "auth-button--full" : "",
    loading ? "auth-button--loading" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const content = loading ? (
    <span className="auth-spinner" aria-hidden="true" />
  ) : (
    children
  );

  if ("href" in props && props.href) {
    return (
      <a className={classes} aria-busy={loading || undefined} {...props}>
        {content}
      </a>
    );
  }

  const { disabled, type, ...buttonProps } = props;

  return (
    <button
      type={type ?? "button"}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...buttonProps}
    >
      {content}
    </button>
  );
};
