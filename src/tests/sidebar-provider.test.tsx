import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AppSidebar } from '@/components/navigation/AppSidebar';
import { SidebarProvider } from '@/components/ui/sidebar';

describe('AppSidebar Provider Tests', () => {
  it('should render fallback when used without SidebarProvider', () => {
    render(
      <BrowserRouter>
        <AppSidebar />
      </BrowserRouter>
    );
    
    expect(screen.getByText('Navigation unavailable')).toBeInTheDocument();
  });

  it('should render normally when used with SidebarProvider', () => {
    render(
      <BrowserRouter>
        <SidebarProvider>
          <AppSidebar />
        </SidebarProvider>
      </BrowserRouter>
    );
    
    expect(screen.getByText('BloomSuite')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });
});