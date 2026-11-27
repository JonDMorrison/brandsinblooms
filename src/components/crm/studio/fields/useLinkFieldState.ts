import * as React from "react";
import {
  LINK_FIELD_ERROR,
  normalizeLinkUrl,
  validateLinkUrl,
} from "@/lib/email/linkValidation";

type LinkFieldStateOptions = {
  value: string | undefined;
  onChange: (value: string) => void;
  /** An empty link is a problem too (a button with words but no link). */
  required?: boolean;
};

/**
 * The state every block link field shares: the inline error from the shared
 * link check, and the clean-up when the person leaves the field (trimmed, a
 * bare domain becomes https://). The error waits while the person is typing
 * a new value and shows as soon as they leave the field.
 */
export function useLinkFieldState({ value, onChange, required = false }: LinkFieldStateOptions) {
  const [typing, setTyping] = React.useState(false);
  const focusedRef = React.useRef(false);
  const current = value ?? "";

  const result = validateLinkUrl(current);
  let error: string | undefined;
  if (!typing) {
    if (!current.trim()) error = required ? LINK_FIELD_ERROR : undefined;
    else if (result.status !== "valid") error = result.message;
  }

  const handleChange = React.useCallback(
    (next: string) => {
      if (focusedRef.current) setTyping(true);
      onChange(next);
    },
    [onChange],
  );
  const handleFocus = React.useCallback(() => {
    focusedRef.current = true;
  }, []);
  const handleBlur = React.useCallback(() => {
    focusedRef.current = false;
    setTyping(false);
    const normalized = normalizeLinkUrl(current);
    if (normalized !== current) onChange(normalized);
  }, [current, onChange]);

  return { error, handleChange, handleFocus, handleBlur };
}
