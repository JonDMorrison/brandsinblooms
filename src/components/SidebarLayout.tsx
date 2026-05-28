import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { AskBloomPanel } from "@/components/askBloom/AskBloomPanel";
import { AskBloomProvider } from "@/providers/AskBloomProvider";

interface SidebarLayoutProps {
  children: ReactNode;
}

export const SidebarLayout = ({ children }: SidebarLayoutProps) => {
  const { user } = useAuth();

  if (!user) {
    return <div>Please log in to access this page</div>;
  }

  return (
    <AskBloomProvider>
      <DashboardShell
        mode="tenant"
        contentLayout="split"
        rightPanel={<AskBloomPanel />}
      >
        {children}
      </DashboardShell>
    </AskBloomProvider>
  );
};
