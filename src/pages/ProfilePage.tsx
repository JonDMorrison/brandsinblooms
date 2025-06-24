
import React from 'react';
import { ProtectedPageWrapper } from '@/components/ProtectedPageWrapper';
import { CompanyProfilePage } from '@/components/CompanyProfilePage';
import { DeleteAccountSection } from '@/components/account/DeleteAccountSection';

const ProfilePage = () => {
  return (
    <ProtectedPageWrapper>
      <div className="container mx-auto px-4 py-8 space-y-8">
        <CompanyProfilePage />
        <DeleteAccountSection />
      </div>
    </ProtectedPageWrapper>
  );
};

export default ProfilePage;
