import { ProtectedPageWrapper } from "@/components/ProtectedPageWrapper";
import { RetentionDashboard } from "@/components/retention/RetentionDashboard";

const SuccessPage = () => {
  return (
    <ProtectedPageWrapper>
      <RetentionDashboard />
    </ProtectedPageWrapper>
  );
};

export default SuccessPage;