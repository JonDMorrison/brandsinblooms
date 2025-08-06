import React from 'react';
import { ProtectedPageWrapper } from '@/components/ProtectedPageWrapper';
import { SettingsHub } from '@/components/settings/SettingsHub';

const SettingsPage = () => {
  return (
    <ProtectedPageWrapper>
      <SettingsHub />
    </ProtectedPageWrapper>
  );
};

export default SettingsPage;