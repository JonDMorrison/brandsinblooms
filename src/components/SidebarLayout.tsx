
import { ReactNode, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { TrialBanner } from "@/components/TrialBanner";
import { UserMenu } from "@/components/UserMenu";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/navigation/AppSidebar";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import logoImage from "@/assets/bloomsuite-logo-correct.png";

interface SidebarLayoutProps {
  children: ReactNode;
}

export const SidebarLayout = ({ children }: SidebarLayoutProps) => {
  const { user } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);

  // Track scroll position for header styling
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
        
        <main className="flex-1 w-full min-h-screen flex flex-col">
          {/* Trial Banner */}
          <TrialBanner />
          
          {/* Sticky Top Bar with Toggle Button and UserMenu */}
          <header className="sticky top-0 z-40 transition-all duration-300">
            <div className="flex justify-between items-center px-4 py-2">
              <div className="flex items-center gap-3 md:hidden">
                <HeaderToggleButton />
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 flex items-center justify-center">
                    <img 
                      src={logoImage} 
                      alt="BloomSuite Logo" 
                      className="w-full h-full object-contain"
                      style={{ background: 'transparent' }}
                    />
                  </div>
                  <span className="font-bold text-lg tracking-tight">BloomSuite</span>
                </div>
              </div>
              <div className="hidden md:block">
                <HeaderToggleButton />
              </div>
              <UserMenu />
            </div>
          </header>
          
          <div className="flex-1">
            <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              {children}
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

const HeaderToggleButton = () => {
  const { toggleSidebar, state } = useSidebar();
  const isCollapsed = state === "collapsed";

  // Always show on mobile, only show when collapsed on desktop
  if (!isCollapsed) {
    return (
      <Button
        onClick={toggleSidebar}
        variant="ghost" 
        size="icon"
        className="hover:bg-teal-600 hover:text-white h-8 w-8 md:hidden"
        aria-label="Toggle sidebar"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button
      onClick={toggleSidebar}
      variant="ghost" 
      size="icon"
      className="hover:bg-teal-600 hover:text-white h-8 w-8"
      aria-label="Toggle sidebar"
    >
      <ChevronRight className="h-4 w-4" />
    </Button>
  );
};
