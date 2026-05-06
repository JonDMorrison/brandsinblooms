import * as React from "react";
import { useCompanyInfo } from "@/hooks/useCompanyInfo";
import {
  buildStudioDesignSystem,
  type StudioDesignSystem,
} from "@/lib/studio/designSystem";

type DesignSystemContextValue = {
  designSystem: StudioDesignSystem;
  isLoading: boolean;
};

const DesignSystemContext =
  React.createContext<DesignSystemContextValue | null>(null);

export function DesignSystemProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { companyInfo, isLoading } = useCompanyInfo();
  const designSystem = React.useMemo(
    () => buildStudioDesignSystem(companyInfo),
    [companyInfo],
  );
  const value = React.useMemo(
    () => ({ designSystem, isLoading }),
    [designSystem, isLoading],
  );

  return (
    <DesignSystemContext.Provider value={value}>
      {children}
    </DesignSystemContext.Provider>
  );
}

export function useOptionalDesignSystem() {
  return React.useContext(DesignSystemContext);
}

export function useDesignSystem() {
  const context = React.useContext(DesignSystemContext);

  if (!context) {
    throw new Error("useDesignSystem must be used within DesignSystemProvider");
  }

  return context;
}
