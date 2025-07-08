
import React from 'react';
import { SocialPlannerPage } from '@/components/social/SocialPlannerPage';
import { SidebarLayout } from '@/components/SidebarLayout';

const SocialPage = () => {
  return (
    <SidebarLayout>
      <div className="p-6">
        <SocialPlannerPage />
      </div>
    </SidebarLayout>
  );
};

export default SocialPage;
