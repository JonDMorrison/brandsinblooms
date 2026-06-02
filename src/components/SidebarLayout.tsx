import { ReactNode } from "react";
import Box from "@mui/joy/Box";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { AskBloomPanel } from "@/components/askBloom/AskBloomPanel";
import { AskBloomProvider } from "@/providers/AskBloomProvider";

interface SidebarLayoutProps {
  children: ReactNode;
}

/*
 * ASK-BLOOM-FIX-01: Ask Bloom panel promoted to root layout level.
 *
 * Previous structure injected the panel INSIDE the shell content area:
 *   <DashboardShell mode="tenant" contentLayout="split" rightPanel={<AskBloomPanel />}>
 *     {children}
 *   </DashboardShell>
 * The shell's `contentLayout === "split"` branch wrapped `children` in a
 * flex:1 scroll box with `transition: "all 250ms ease"` and rendered
 * `rightPanel` beside it, BELOW the top bar. `rightPanel`/`contentLayout`
 * had NO other consumers across src/** (verified), so both were removed
 * from DashboardShell entirely.
 *
 * New structure: DashboardShell and AskBloomPanel are siblings in a root
 * flex container so the panel is a full-viewport-height third column
 * alongside the ENTIRE shell (sidebar + top bar + content). The shell
 * wrapper carries the 250ms compression transition; `flex: 1`/`minWidth: 0`
 * let it shrink when the panel opens; `overflow: hidden` prevents overflow.
 * AskBloomPanel self-gates visibility (`if (!isOpen) return null`) and owns
 * its responsive rendering (desktop flex column @ panelWidth default 400 /
 * 40px collapsed tab, tablet Drawer, mobile full-screen Sheet), so it is
 * rendered unconditionally here.
 */
export const SidebarLayout = ({ children }: SidebarLayoutProps) => {
  const { user } = useAuth();

  if (!user) {
    return <div>Please log in to access this page</div>;
  }

  return (
    <AskBloomProvider>
      <Box
        sx={{
          display: "flex",
          width: "100%",
          height: "100vh",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            height: "100%",
            overflow: "hidden",
            transition: "all 250ms ease",
          }}
        >
          <DashboardShell mode="tenant">{children}</DashboardShell>
        </Box>
        <AskBloomPanel />
      </Box>
    </AskBloomProvider>
  );
};
