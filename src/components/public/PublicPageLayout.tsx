import { ReactNode } from 'react';
import { Helmet } from 'react-helmet-async';
import { LandingPageHeader } from '@/components/landing/LandingPageHeader';
import { PublicFooter } from './PublicFooter';
import { useNavigate } from 'react-router-dom';

interface PublicPageLayoutProps {
  children: ReactNode;
  title: string;
  description: string;
  canonicalPath?: string;
  breadcrumbs?: Array<{ name: string; url: string }>;
}

export const PublicPageLayout = ({
  children,
  title,
  description,
  canonicalPath,
  breadcrumbs,
}: PublicPageLayoutProps) => {
  const navigate = useNavigate();
  const baseUrl = 'https://bloomsuite.app';

  // Generate BreadcrumbList structured data
  const breadcrumbSchema = breadcrumbs
    ? {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbs.map((crumb, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: crumb.name,
          item: `${baseUrl}${crumb.url}`,
        })),
      }
    : null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Helmet>
        <title>{title} - BloomSuite</title>
        <meta name="description" content={description} />
        {canonicalPath && <link rel="canonical" href={`${baseUrl}${canonicalPath}`} />}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {breadcrumbSchema && (
          <script type="application/ld+json">
            {JSON.stringify(breadcrumbSchema)}
          </script>
        )}
      </Helmet>

      <LandingPageHeader onLogin={() => navigate('/auth')} />

      <main className="flex-1">
        {children}
      </main>

      <PublicFooter />
    </div>
  );
};
