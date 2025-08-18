
import React from 'react';
import { ProtectedPageWrapper } from '@/components/ProtectedPageWrapper';
import { DomainsHub } from '@/components/domains/DomainsHub';

const DomainsPage = () => {
  return (
    <ProtectedPageWrapper>
      <DomainsHub />
    </ProtectedPageWrapper>
  );
};

export default DomainsPage;
