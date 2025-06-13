
import { CompanyProfilePage } from "@/components/CompanyProfilePage";
import { ProtectedPageWrapper } from "@/components/ProtectedPageWrapper";

const ProfilePage = () => {
  return (
    <ProtectedPageWrapper>
      <CompanyProfilePage />
    </ProtectedPageWrapper>
  );
};

export default ProfilePage;
