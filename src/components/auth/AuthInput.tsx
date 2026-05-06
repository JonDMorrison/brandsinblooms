import { forwardRef, useId, useState } from "react";
import type {
  InputHTMLAttributes,
  ReactNode,
  Ref,
  TextareaHTMLAttributes,
} from "react";
import { Eye, EyeOff } from "lucide-react";

export interface AuthInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  icon?: ReactNode;
  passwordToggleTabIndex?: number;
  multiline?: boolean;
  rows?: number;
}

export const AuthInput = forwardRef<HTMLInputElement, AuthInputProps>(
  (
    {
      label,
      error,
      icon,
      id,
      type = "text",
      className = "",
      passwordToggleTabIndex = 0,
      multiline = false,
      rows = 3,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;
    const isPassword = type === "password";
    const [passwordVisible, setPasswordVisible] = useState(false);
    const resolvedType = isPassword && passwordVisible ? "text" : type;

    if (multiline) {
      const { minLength, ...textareaProps } = props;

      return (
        <div className="auth-input-field">
          <label className="auth-input-label" htmlFor={inputId}>
            {label}
          </label>
          <textarea
            ref={ref as unknown as Ref<HTMLTextAreaElement>}
            id={inputId}
            rows={rows}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            className={["auth-textarea", className].filter(Boolean).join(" ")}
            minLength={minLength}
            {...(textareaProps as unknown as TextareaHTMLAttributes<HTMLTextAreaElement>)}
          />
          {error ? (
            <p className="auth-input-error" id={errorId}>
              {error}
            </p>
          ) : null}
        </div>
      );
    }

    return (
      <div className="auth-input-field">
        <label className="auth-input-label" htmlFor={inputId}>
          {label}
        </label>
        <div className="auth-input-shell">
          {icon ? <span className="auth-input-icon">{icon}</span> : null}
          <input
            ref={ref}
            id={inputId}
            type={resolvedType}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            className={[
              "auth-input",
              icon ? "auth-input--with-icon" : "",
              isPassword ? "auth-input--with-toggle" : "",
              className,
            ]
              .filter(Boolean)
              .join(" ")}
            {...props}
          />
          {isPassword ? (
            <button
              type="button"
              className="auth-input-toggle"
              aria-label={passwordVisible ? "Hide password" : "Show password"}
              tabIndex={passwordToggleTabIndex}
              onClick={() => setPasswordVisible((visible) => !visible)}
            >
              {passwordVisible ? (
                <EyeOff aria-hidden="true" />
              ) : (
                <Eye aria-hidden="true" />
              )}
            </button>
          ) : null}
        </div>
        {error ? (
          <p className="auth-input-error" id={errorId}>
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);

AuthInput.displayName = "AuthInput";
