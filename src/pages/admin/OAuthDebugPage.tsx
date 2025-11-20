import React from 'react';
import { OAuthDebugPanel } from '@/components/admin/OAuthDebugPanel';

const OAuthDebugPage = () => {
  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        <OAuthDebugPanel />
      </div>
    </div>
  );
};

export default OAuthDebugPage;
