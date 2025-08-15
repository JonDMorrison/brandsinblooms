
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
        {/* Sophisticated layered background */}
        <div className="bloom-bg bloom-bg-vignette"></div>

        <div className="relative flex">
          <aside className="glass grad-border sidebar-vignette sticky top-0 h-screen w-[260px] shrink-0 p-4 relative">
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
