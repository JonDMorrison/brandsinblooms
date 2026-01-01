import { SMS_BRAND_CONFIG, getProgramNumberDisplay } from '@/config/smsConfig';
import { MessageSquare } from 'lucide-react';

export const ComplianceHero = () => {
  return (
    <section className="py-12 px-6 bg-gradient-to-b from-muted/30 to-background">
      <div className="max-w-3xl mx-auto text-center">
        {/* Icon */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
          <MessageSquare className="w-8 h-8 text-primary" />
        </div>

        {/* H1 - Required for compliance review */}
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
          BloomSuite SMS Program
        </h1>

        {/* Purpose paragraph - verbatim compliance text */}
        <p className="text-lg text-muted-foreground leading-relaxed mb-6">
          BloomSuite sends recurring marketing text messages about product updates, 
          feature announcements, webinars, and helpful tips. Msg and Data rates may apply.
        </p>

        {/* Frequency disclosure */}
        <p className="text-base font-medium text-foreground">
          Message frequency: {SMS_BRAND_CONFIG.message_frequency_text}.
        </p>
      </div>
    </section>
  );
};
