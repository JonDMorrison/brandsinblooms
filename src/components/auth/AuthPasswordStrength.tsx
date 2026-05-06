import { getPasswordStrength } from "./passwordStrength";

interface AuthPasswordStrengthProps {
  password: string;
  className?: string;
}

export const AuthPasswordStrength = ({
  password,
  className = "",
}: AuthPasswordStrengthProps) => {
  const passwordStrength = getPasswordStrength(password);

  return (
    <div
      className={`auth-password-strength ${className}`.trim()}
      aria-live="polite"
      aria-label={`Password strength: ${passwordStrength.label}`}
    >
      <span className="auth-password-strength__track" aria-hidden="true">
        <span
          className={`auth-password-strength__bar auth-password-strength__bar--${passwordStrength.tone}`}
          style={{ width: `${passwordStrength.width}%` }}
        />
      </span>
      <span className="auth-password-strength__label">
        {passwordStrength.label}
      </span>
    </div>
  );
};
