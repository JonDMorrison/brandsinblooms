
import { ContentLibrary } from "@/components/content-library/ContentLibrary";
import { ProtectedPageWrapper } from "@/components/ProtectedPageWrapper";

const ContentLibraryPage = () => {
  return (
    <ProtectedPageWrapper>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="max-w-7xl mx-auto p-6">
          <ContentLibrary onboardingData={{}} />
        </div>
      </div>
    </ProtectedPageWrapper>
  );
};

export default ContentLibraryPage;
