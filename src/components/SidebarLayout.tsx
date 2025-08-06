
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
      <div className="min-h-screen w-full flex">
        {/* Fixed UserMenu - always visible in top-right */}
        <div className="fixed top-6 right-6 z-40">
          <UserMenu />
        </div>
        
        <AppSidebar />
        <main 
          className="flex-1 w-full h-full overflow-x-hidden flex flex-col"
          style={{
            scrollBehavior: 'auto',
            contain: 'layout style paint',
            willChange: 'transform',
            transform: 'translateZ(0)',
            backfaceVisibility: 'hidden',
            perspective: '1000px'
          }}
        >
          {/* Trial Banner - constrained to main content width */}
          <TrialBanner />
          <div className="flex-1 w-full h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};
