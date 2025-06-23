
import React from 'react';
import { SocialPlannerPage } from '@/components/social/SocialPlannerPage';
import { ProtectedPageWrapper } from '@/components/ProtectedPageWrapper';

const SocialPage = () => {
  return (
    <ProtectedPageWrapper>
      <SocialPlannerPage />
    </ProtectedPageWrapper>
  );
};

export default SocialPage;
