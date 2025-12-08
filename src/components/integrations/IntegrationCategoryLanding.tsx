import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Store, 
  Users, 
  Share2, 
  Zap, 
  Globe,
  ChevronRight
} from 'lucide-react';
import { MigrationStatusIndicator } from '@/components/migrations/MigrationStatusIndicator';

interface CategoryCard {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  route: string;
}

const categories: CategoryCard[] = [
  {
    id: 'pos',
    title: 'Point of Sale',
    description: 'Sync customers, orders, and purchase data from Lightspeed, Square, and more',
    icon: <Store className="w-8 h-8" />,
    route: '/integrations/pos'
  },
  {
    id: 'crm',
    title: 'CRM & Email',
    description: 'Import contacts from Mailchimp, Klaviyo, HubSpot and other marketing tools',
    icon: <Users className="w-8 h-8" />,
    route: '/integrations/crm'
  },
  {
    id: 'social',
    title: 'Social Media',
    description: 'Connect Facebook and Instagram to publish posts and manage your pages',
    icon: <Share2 className="w-8 h-8" />,
    route: '/integrations/social'
  },
  {
    id: 'automations',
    title: 'Automations',
    description: 'Connect Zapier, webhooks, and Slack to automate your workflows',
    icon: <Zap className="w-8 h-8" />,
    route: '/integrations/automations'
  },
  {
    id: 'website',
    title: 'Website',
    description: 'Track traffic and conversions with Google Analytics integration',
    icon: <Globe className="w-8 h-8" />,
    route: '/integrations/website'
  }
];

export function IntegrationCategoryLanding() {
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      <MigrationStatusIndicator />

      <div>
        <h1 className="text-3xl font-bold">Integrations</h1>
        <p className="text-muted-foreground mt-2">
          Connect your tools to sync data, automate workflows, and grow your business
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((category) => (
          <Card
            key={category.id}
            className="bg-card border border-border rounded-xl cursor-pointer hover:shadow-lg hover:border-primary/30 transition-all duration-200 group"
            onClick={() => navigate(category.route)}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="p-3 rounded-lg bg-primary/10 text-primary">
                  {category.icon}
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <h2 className="text-xl font-semibold mt-4">{category.title}</h2>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                {category.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
