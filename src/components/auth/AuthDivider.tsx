interface AuthDividerProps {
  label?: string;
}

export const AuthDivider = ({ label = "or" }: AuthDividerProps) => (
  <div className="auth-divider" role="separator" aria-label={label}>
    <span>{label}</span>
  </div>
);
