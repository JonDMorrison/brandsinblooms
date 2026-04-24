import { IntegrationsHubIndex } from "@/components/integrations/IntegrationsHubIndex";
import type { IntegrationCategory } from "@/components/integrations/integrationsHubConfig";

type IntegrationCategoryLandingProps = {
  category: IntegrationCategory;
  title: string;
  description: string;
};

export function IntegrationCategoryLanding({
  category,
  title,
  description,
}: IntegrationCategoryLandingProps) {
  return (
    <IntegrationsHubIndex
      forcedCategory={category}
      title={title}
      description={description}
    />
  );
}
