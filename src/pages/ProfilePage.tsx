
import React from 'react';
import { ProtectedPageWrapper } from '@/components/ProtectedPageWrapper';
import { CompanyProfilePage } from '@/components/CompanyProfilePage';

const ProfilePage = () => {
  return (
    <ProtectedPageWrapper>
      <CompanyProfilePage />
    </ProtectedPageWrapper>
  );
};

export default ProfilePage;
