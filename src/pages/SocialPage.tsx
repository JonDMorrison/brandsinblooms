
import React from 'react';
import { SocialPlannerPage } from '@/components/social/SocialPlannerPage';
import { SidebarLayout } from '@/components/SidebarLayout';
import { UserMenu } from '@/components/UserMenu';

const SocialPage = () => {
  return (
    <SidebarLayout>
      {/* Fixed User Menu in top right */}
      <div className="fixed top-4 right-6 z-50">
        <UserMenu />
      </div>
      
      <div className="p-6">
        <SocialPlannerPage />
      </div>
    </SidebarLayout>
  );
};

export default SocialPage;
