import { useParams, Navigate } from "react-router-dom";
import { FeaturePage } from "@/components/feature-pages/FeaturePage";
import { getFeaturePageContent } from "@/components/feature-pages/featurePageRegistry";

export const FeatureDetailPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const content = getFeaturePageContent(slug);

  if (!content) {
    // Slugs not yet registered (5 of 6 in stage 1) bounce to /features
    // until their content config is added in stage 2.
    return <Navigate to="/features" replace />;
  }

  return <FeaturePage content={content} />;
};

export default FeatureDetailPage;
