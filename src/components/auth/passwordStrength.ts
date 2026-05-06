export type AuthPasswordStrengthTone = "too-short" | "weak" | "fair" | "strong";

export interface AuthPasswordStrengthValue {
  label: string;
  width: number;
  tone: AuthPasswordStrengthTone;
}

export const getPasswordStrength = (
  password: string,
): AuthPasswordStrengthValue => {
  const hasMixedCase = /[a-z]/.test(password) && /[A-Z]/.test(password);
  const hasNumberOrSymbol = /[0-9\W_]/.test(password);

  if (password.length < 6) {
    return {
      label: "Too short",
      width: password.length === 0 ? 0 : Math.max(8, password.length * 4),
      tone: "too-short",
    };
  }

  if (password.length < 8) {
    return { label: "Weak", width: 42, tone: "weak" };
  }

  if (password.length >= 12 && hasMixedCase && hasNumberOrSymbol) {
    return { label: "Strong", width: 100, tone: "strong" };
  }

  if (hasMixedCase) {
    return { label: "Fair", width: 70, tone: "fair" };
  }

  return { label: "Weak", width: 42, tone: "weak" };
};
