
import { ReactNode, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { TrialBanner } from "@/components/TrialBanner";
import { UserMenu } from "@/components/UserMenu";
import { SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from "@/components/AppSidebar";

interface SidebarLayoutProps {
  children: ReactNode;
}

export const SidebarLayout = ({ children }: SidebarLayoutProps) => {
  console.log('SidebarLayout rendering - CreateFlowDialog should not be referenced anywhere');
  const { user } = useAuth();

  // Defensive: ensure nothing marks the sidebar wrapper aria-hidden
  useEffect(() => {
    const wrapper = document.querySelector('.group\\/sidebar-wrapper');
    if (wrapper?.hasAttribute('aria-hidden')) {
      wrapper.removeAttribute('aria-hidden');
    }

    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.target instanceof HTMLElement && 
            mutation.target.hasAttribute('aria-hidden')) {
          mutation.target.removeAttribute('aria-hidden');
        }
      });
    });
    
    if (wrapper) {
      observer.observe(wrapper, { 
        attributes: true, 
        attributeFilter: ['aria-hidden'] 
      });
    }
    
    return () => observer.disconnect();
  }, []);

  if (!user) {
    return <div>Please log in to access this page</div>;
  }

  return (
    <SidebarProvider>
      <div className="relative min-h-screen overflow-hidden bg-surface-0 text-ink-1">
        {/* backdrop layer */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_20%_10%,rgba(32,227,154,0.12),transparent_60%),radial-gradient(50%_50%_at_80%_30%,rgba(122,108,255,0.10),transparent_55%),radial-gradient(40%_40%_at_60%_80%,rgba(47,193,255,0.10),transparent_60%)]" />
          <div className="absolute -top-24 -left-24 h-[420px] w-[420px] rounded-full bg-grad-secondary opacity-20 blur-3xl" />
          <div className="absolute -bottom-32 -right-20 h-[380px] w-[380px] rounded-full bg-grad-primary opacity-20 blur-3xl" />
        </div>

        <div className="relative flex">
          <aside className="glass grad-border sticky top-0 h-screen w-[260px] shrink-0 p-4">
            <div className="flex items-center gap-3 px-2 pt-1 pb-4">
              <div className="h-8 w-8 rounded-xl bg-grad-secondary animate-float" />
              <div className="font-heading text-lg">BloomSuite</div>
            </div>
            <nav className="mt-2 space-y-1">
              <AppSidebar />
            </nav>
          </aside>
          
          <main className="relative mx-auto w-full max-w-6xl p-6 md:p-10 animate-fadeScaleIn">
            {/* Fixed UserMenu - always visible in top-right */}
            <div className="fixed top-6 right-6 z-40">
              <UserMenu />
            </div>
            
            {/* Trial Banner */}
            <TrialBanner />
            
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};
