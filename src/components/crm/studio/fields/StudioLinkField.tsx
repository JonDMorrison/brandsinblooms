import StudioTextField from "@/components/crm/studio/fields/StudioTextField";
import { useLinkFieldState } from "@/components/crm/studio/fields/useLinkFieldState";

type StudioLinkFieldProps = {
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
};

/** A Studio text box for a block link (button, image or secondary link). */
export default function StudioLinkField({
  label,
  value,
  onChange,
  placeholder = "https://...",
  required = false,
}: StudioLinkFieldProps) {
  const { error, handleChange, handleFocus, handleBlur } = useLinkFieldState({
    value,
    onChange,
    required,
  });
  return (
    <StudioTextField
      label={label}
      placeholder={placeholder}
      type="url"
      value={value ?? ""}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      error={error}
    />
  );
}
