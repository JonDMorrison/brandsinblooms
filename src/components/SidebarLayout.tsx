
import { ReactNode, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { TrialBanner } from "@/components/TrialBanner";
import { UserMenu } from "@/components/UserMenu";
import { SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { CreateFlowDialog } from "@/components/create-flow/CreateFlowDialog";
import { useCreateFlow } from "@/state/useCreateFlow";

interface SidebarLayoutProps {
  children: ReactNode;
}

export const SidebarLayout = ({ children }: SidebarLayoutProps) => {
  const { user } = useAuth();
  const { dialogOpen, setDialogOpen } = useCreateFlow();

  // Keyboard shortcut: press "C" to open Create
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping = !!target?.closest('input, textarea, [contenteditable="true"]');
      if (isTyping) return;
      if (e.key.toLowerCase() === 'c') {
        setDialogOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setDialogOpen]);

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
      <div className="min-h-screen w-full flex">
        <AppSidebar />
        
        <main className="flex-1 w-full min-h-screen overflow-auto">
          {/* Fixed UserMenu - always visible in top-right */}
          <div className="fixed top-6 right-6 z-40">
            <UserMenu />
          </div>
          
          {/* Trial Banner */}
          <TrialBanner />
          
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {children}
          </div>
        </main>
      </div>
      <CreateFlowDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </SidebarProvider>
  );
};
