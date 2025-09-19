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
  // Under the new plan, all users have access to CRM features
  return <>{children}</>;
};