
import React from 'react';
import { DevSocialPage } from '@/components/social/DevSocialPage';
import { SocialErrorBoundary } from '@/components/social/SocialErrorBoundary';
import { UserMenu } from '@/components/UserMenu';

const DevSocialPageWrapper = () => {
  console.log('🚀 DevSocialPageWrapper: Component rendering');

  return (
    <SocialErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        {/* Fixed User Menu in top right - but make it optional for dev mode */}
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
  );
};

export default DevSocialPageWrapper;
