import React from 'react';
import { useCRMAccess } from '@/hooks/useCRMAccess';
import { CRMUpgradePrompt } from './CRMUpgradePrompt';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

interface CRMAccessGateProps {
  children: React.ReactNode;
  redirectTo?: string;
  showModal?: boolean;
}

export const CRMAccessGate = ({ 
  children, 
  redirectTo = '/dashboard',
  showModal = false 
}: CRMAccessGateProps) => {
  const { hasCRMAccess, loading } = useCRMAccess();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !hasCRMAccess && redirectTo && !showModal) {
      navigate(redirectTo);
    }
  }, [hasCRMAccess, loading, redirectTo, navigate, showModal]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!hasCRMAccess) {
    if (showModal) {
      return <CRMUpgradePrompt variant="modal" />;
    }
    return <CRMUpgradePrompt variant="card" className="m-6" />;
  }

  return <>{children}</>;
};