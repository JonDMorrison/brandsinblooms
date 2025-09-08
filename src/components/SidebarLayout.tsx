
import { ReactNode, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { TrialBanner } from "@/components/TrialBanner";
import { UserMenu } from "@/components/UserMenu";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/navigation/AppSidebar";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";

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
        <AppSidebar />
        
        <main className="flex-1 w-full min-h-screen overflow-auto">
          {/* Floating sidebar toggle button - desktop only when collapsed */}
          <SidebarToggleButton />
          
          {/* Mobile floating toggle button - always visible on mobile */}
          <MobileToggleButton />
          
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
    </SidebarProvider>
  );
};

const SidebarToggleButton = () => {
  const { toggleSidebar, state } = useSidebar();
  const isCollapsed = state === "collapsed";

  if (!isCollapsed) return null;

  return (
    <div className="fixed top-4 left-4 z-50 hidden md:block">
      <Button
        onClick={toggleSidebar}
        variant="outline"
        size="icon"
        className="bg-transparent shadow-sm hover:bg-[#68beb9] hover:text-white h-10 w-10"
        aria-label="Toggle sidebar"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
};

const MobileToggleButton = () => {
  const { toggleSidebar } = useSidebar();

  return (
    <div className="fixed top-4 left-4 z-50 md:hidden">
      <Button
        onClick={toggleSidebar}
        variant="outline"
        size="icon"
        className="bg-transparent shadow-sm hover:bg-[#68beb9] hover:text-white h-10 w-10"
        aria-label="Toggle sidebar"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
};
