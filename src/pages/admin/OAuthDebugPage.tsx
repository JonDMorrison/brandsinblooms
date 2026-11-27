import React from "react";
import { OAuthDebugPanel } from "@/components/admin/OAuthDebugPanel";
import { PageContainer } from "@/components/joy/PageContainer";
import { PageHeader } from "@/components/joy/PageHeader";

const OAuthDebugPage = () => {
  return (
    <PageContainer>
      <PageHeader title="OAuth debug" sx={{ mb: 3 }} />
      <OAuthDebugPanel />
    </PageContainer>
  );
};

export default OAuthDebugPage;
