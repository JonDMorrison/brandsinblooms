import { PublicPageLayout } from '@/components/public/PublicPageLayout';
import { ComplianceHero } from '@/components/sms-public/ComplianceHero';
import { ConsentForm } from '@/components/sms-public/ConsentForm';
import { FeatureGrid } from '@/components/sms-public/FeatureGrid';
import { SmsExamples } from '@/components/sms-public/SmsExamples';
import { ScreenshotStrip } from '@/components/sms-public/ScreenshotStrip';
import { FaqAccordion } from '@/components/sms-public/FaqAccordion';
import { PolicyFooter } from '@/components/sms-public/PolicyFooter';
import { SMS_BRAND_CONFIG, getProgramNumberDisplay, isProgramNumberConfigured } from '@/config/smsConfig';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

export const SmsPage = () => {
  const programNumber = getProgramNumberDisplay();
  const isConfigured = isProgramNumberConfigured();

  return (
    <PublicPageLayout
      title="SMS Program"
      description={`Subscribe to BloomSuite SMS for product updates, feature announcements, and tips. Message frequency ${SMS_BRAND_CONFIG.message_frequency_text}. Reply STOP to cancel.`}
      canonicalPath="/sms-program"
      breadcrumbs={[
        { name: 'Home', url: '/' },
        { name: 'SMS Program', url: '/sms-program' },
      ]}
    >
      {/* Hero Section with compliance text */}
      <ComplianceHero />

      {/* How to Join Section - Above the fold */}
      <section className="py-8 px-6">
        <div className="max-w-xl mx-auto">
          <h2 className="text-xl font-bold text-foreground text-center mb-6">
            How to Join
          </h2>

          {/* Keyword opt-in */}
          <Card className="bg-muted/30 border-border mb-6">
            <CardContent className="p-6 text-center">
              <p className="text-lg font-medium text-foreground mb-2">
                Text <span className="font-bold text-primary">{SMS_BRAND_CONFIG.opt_in_keyword_primary}</span> to{' '}
                <span className="font-bold text-primary">{programNumber}</span> to subscribe.
              </p>
              
              {/* Admin warning if not configured */}
              {!isConfigured && (
                <Badge variant="destructive" className="mt-2">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  ENV: VITE_SMS_PROGRAM_NUMBER not set
                </Badge>
              )}
            </CardContent>
          </Card>

          {/* Divider */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 border-t border-border" />
            <span className="text-sm text-muted-foreground font-medium">or</span>
            <div className="flex-1 border-t border-border" />
          </div>

          {/* Web form */}
          <ConsentForm />

          {/* Frequency and links - required for compliance */}
          <div className="mt-6 text-center text-sm text-muted-foreground space-y-2">
            <p>
              Message frequency: {SMS_BRAND_CONFIG.message_frequency_text}.
            </p>
            <p>
              <Link to="/terms" className="text-primary underline hover:text-primary/80">
                {SMS_BRAND_CONFIG.terms_url}
              </Link>
              {' | '}
              <Link to="/privacy" className="text-primary underline hover:text-primary/80">
                {SMS_BRAND_CONFIG.privacy_url}
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* Below the fold content */}
      <FeatureGrid />
      <SmsExamples />
      <ScreenshotStrip />
      <FaqAccordion />
      <PolicyFooter />
    </PublicPageLayout>
  );
};

export default SmsPage;
