
import { ReactNode, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { TrialBanner } from "@/components/TrialBanner";
import { UserMenu } from "@/components/UserMenu";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/navigation/AppSidebar";

interface SidebarLayoutProps {
  children: ReactNode;
}

export const SidebarLayout = ({ children }: SidebarLayoutProps) => {
  console.log('🔧 SidebarLayout: Rendering with children');
  const { user } = useAuth();

  console.log('🔧 SidebarLayout: User state:', {
    hasUser: !!user,
    userId: user?.id
  });

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
    console.log('❌ SidebarLayout: No user, showing login message');
    return <div>Please log in to access this page</div>;
  }

  console.log('✅ SidebarLayout: User authenticated, rendering sidebar layout');

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
            <div style={{ minHeight: '200px', backgroundColor: 'rgba(255,0,0,0.1)' }}>
              <p style={{ color: 'red', fontSize: '18px', fontWeight: 'bold' }}>DEBUG: SidebarLayout content wrapper</p>
              <div style={{ minHeight: '200px', backgroundColor: 'rgba(255,0,0,0.1)' }}>
                <p>DEBUG: Content should render here</p>
                {children}
              </div>
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};
