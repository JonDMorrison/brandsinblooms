
import { BundleLibrary } from "@/components/content-library/BundleLibrary";
import { ProtectedPageWrapper } from "@/components/ProtectedPageWrapper";
import { ContentLibraryErrorBoundary } from "@/components/content-library/ContentLibraryErrorBoundary";
import "@/styles/content-library-animations.css";

const ContentLibraryPage = () => {
  return (
    <ProtectedPageWrapper>
      <ContentLibraryErrorBoundary>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
          <div className="max-w-7xl mx-auto p-6">
            <BundleLibrary />
          </div>
        </div>
      </ContentLibraryErrorBoundary>
    </ProtectedPageWrapper>
  );
};

export default ContentLibraryPage;
