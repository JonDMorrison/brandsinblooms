import type { HTMLAttributes, ReactNode } from "react";

interface AuthCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const AuthCard = ({
  children,
  className = "",
  ...props
}: AuthCardProps) => (
  <div className={`auth-card ${className}`.trim()} {...props}>
    {children}
  </div>
);
