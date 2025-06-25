
import React from 'react';
import { ProtectedPageWrapper } from '@/components/ProtectedPageWrapper';
import { DeleteAccountSection } from '@/components/account/DeleteAccountSection';
import { SidebarLayout } from '@/components/SidebarLayout';

const AccountPage = () => {
  return (
    <ProtectedPageWrapper>
      <SidebarLayout>
        <div className="container mx-auto px-4 py-8 space-y-8">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold text-garden-green-dark mb-2">
              Account Settings
            </h1>
            <p className="text-garden-green mb-8">
              Manage your account preferences and settings
            </p>
            
            <DeleteAccountSection />
          </div>
        </div>
      </SidebarLayout>
    </ProtectedPageWrapper>
  );
};

export default AccountPage;
