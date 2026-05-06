import { BundleLibrary } from "@/components/content-library/BundleLibrary";
import { ProtectedPageWrapper } from "@/components/ProtectedPageWrapper";
import { ContentLibraryErrorBoundary } from "@/components/content-library/ContentLibraryErrorBoundary";
import Box from "@mui/joy/Box";
import { PageContainer } from "@/components/joy/PageContainer";

const ContentLibraryPage = () => {
  return (
    <ProtectedPageWrapper>
      <ContentLibraryErrorBoundary>
        <Box
          sx={{
            minHeight: "100%",
            background:
              "linear-gradient(180deg, rgba(var(--joy-palette-neutral-mainChannel) / 0.02), rgba(var(--joy-palette-primary-mainChannel) / 0.04))",
          }}
        >
          <PageContainer
            fullWidth
            sx={{ px: { xs: 2, md: 3 }, py: { xs: 3, md: 4 } }}
          >
            <BundleLibrary />
          </PageContainer>
        </Box>
      </ContentLibraryErrorBoundary>
    </ProtectedPageWrapper>
  );
};

export default ContentLibraryPage;
