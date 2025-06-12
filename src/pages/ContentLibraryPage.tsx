
import { ContentLibrary } from "@/components/content-library/ContentLibrary";
import { ProtectedPageWrapper } from "@/components/ProtectedPageWrapper";

const ContentLibraryPage = () => {
  return (
    <ProtectedPageWrapper>
      <div className="p-6 border-b border-green-200 bg-white">
        <h1 className="text-3xl font-bold text-garden-green-dark">Content Library</h1>
        <p className="text-garden-green font-medium">Manage your assets and templates</p>
      </div>
      <div className="p-6">
        <ContentLibrary onboardingData={{}} />
      </div>
    </ProtectedPageWrapper>
  );
};

export default ContentLibraryPage;
