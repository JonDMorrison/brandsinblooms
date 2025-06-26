
import React from 'react';
import { DevSocialPage } from '@/components/social/DevSocialPage';
import { SidebarLayout } from '@/components/SidebarLayout';
import { UserMenu } from '@/components/UserMenu';

const DevSocialPageWrapper = () => {
  return (
    <SidebarLayout>
      {/* Fixed User Menu in top right */}
      <div className="fixed top-4 right-6 z-50">
        <UserMenu />
      </div>
      
      <div className="p-6">
        <DevSocialPage />
      </div>
    </SidebarLayout>
  );
};

export default DevSocialPageWrapper;
