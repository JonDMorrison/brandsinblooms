
import React from 'react';
import { DevSocialPage } from '@/components/social/DevSocialPage';
import { SocialErrorBoundary } from '@/components/social/SocialErrorBoundary';
import { SidebarLayout } from '@/components/SidebarLayout';

const DevSocialPageWrapper = () => {
  console.log('🚀 DevSocialPageWrapper: Component rendering');

  return (
    <SidebarLayout>
      <SocialErrorBoundary>
        <div className="min-h-screen bg-gray-50">
          {/* Dev Mode indicator in top right */}
          <div className="fixed top-4 right-6 z-50">
            <div className="bg-white rounded-lg shadow-sm border p-2">
              <div className="text-xs text-gray-500">Dev Mode</div>
            </div>
          </div>
          
          <div className="p-6">
            <DevSocialPage />
          </div>
        </div>
      </SocialErrorBoundary>
    </SidebarLayout>
  );
};

export default DevSocialPageWrapper;
