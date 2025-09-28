
import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { CRMCampaignCreator } from '@/components/crm/CRMCampaignCreator';

export const CRMCampaignCreatorPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  
  // 🚨 EMERGENCY: Try prefill logic in page component
  console.error('🚨🚨🚨 PAGE COMPONENT: CRMCampaignCreatorPage rendering');
  console.error('🚨 PAGE COMPONENT: URL =', window.location.href);
  console.error('🚨 PAGE COMPONENT: searchParams =', searchParams.toString());
  
  if (searchParams.get('type') === 'newsletter' && searchParams.get('prefillData')) {
    console.error('🚨🚨🚨 PAGE COMPONENT: Newsletter prefill data detected!');
    alert('🚨 EMERGENCY: Page component detected newsletter data!');
    
    try {
      const prefillDataParam = searchParams.get('prefillData');
      if (prefillDataParam) {
        const parsedData = JSON.parse(decodeURIComponent(prefillDataParam));
        console.error('🚨 PAGE COMPONENT: Parsed prefill data =', parsedData);
        
        // Store in localStorage for the component to use
        localStorage.setItem('emergency-newsletter-prefill', JSON.stringify({
          title: parsedData.title,
          content: parsedData.content,
          featuredImage: parsedData.featuredImage,
          timestamp: Date.now()
        }));
        
        console.error('🚨 PAGE COMPONENT: Stored in localStorage');
      }
    } catch (error) {
      console.error('🚨 PAGE COMPONENT: Error =', error);
    }
  }
  
  // Extract campaign slug and content task ID from URL params
  const campaignSlug = searchParams.get('slug') || 'new';
  const contentTaskId = searchParams.get('contentTaskId') || undefined;
  
  return <CRMCampaignCreator campaignSlug={campaignSlug} contentTaskId={contentTaskId} />;
};
