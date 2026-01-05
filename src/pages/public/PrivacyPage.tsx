import { PublicPageLayout } from '@/components/public/PublicPageLayout';
import { SMS_BRAND_CONFIG } from '@/config/smsConfig';
import { Link } from 'react-router-dom';

export const PrivacyPage = () => {
  return (
    <PublicPageLayout
      title="Privacy Policy"
      description="Learn how BloomSuite collects, uses, and protects your personal information. Your privacy is important to us."
      canonicalPath="/privacy"
      breadcrumbs={[
        { name: 'Home', url: '/' },
        { name: 'Privacy Policy', url: '/privacy' },
      ]}
    >
      <section className="py-12 px-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Privacy Policy
          </h1>

          <p className="text-sm text-muted-foreground mb-8">
            Last updated: {SMS_BRAND_CONFIG.last_updated}
          </p>

          <div className="prose prose-slate max-w-none space-y-8">
            {/* Introduction */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">Introduction</h2>
              <p className="text-muted-foreground leading-relaxed">
                {SMS_BRAND_CONFIG.legal_name} ("BloomSuite," "we," "us," or "our") respects your privacy 
                and is committed to protecting your personal information. BloomSuite is a product 
                operated by {SMS_BRAND_CONFIG.legal_name}. This Privacy Policy explains 
                how we collect, use, disclose, and safeguard your information when you use our services.
              </p>
            </section>

            {/* Information We Collect */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">Information We Collect</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                We may collect information about you in various ways, including:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Personal data you provide directly (name, email, phone number)</li>
                <li>Usage data collected automatically when you use our services</li>
                <li>Device and browser information</li>
                <li>Communication preferences and consent records</li>
              </ul>
            </section>

            {/* How We Use Information */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">How We Use Information</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                We use the information we collect to:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Provide, maintain, and improve our services</li>
                <li>Send you marketing communications you have opted into</li>
                <li>Respond to your inquiries and provide customer support</li>
                <li>Analyze usage patterns to enhance user experience</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            {/* SMS and Mobile Data - TWILIO COMPLIANCE SECTION */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">SMS and Mobile Data</h2>
              <div className="bg-muted/30 border border-border rounded-lg p-6">
                <p className="text-foreground leading-relaxed mb-4">
                  We collect mobile phone numbers only with your explicit consent. When you opt in 
                  to receive SMS messages, we record the following consent metadata:
                </p>
                <ul className="list-disc list-inside text-foreground space-y-2 mb-4">
                  <li>The timestamp of your consent</li>
                  <li>The source of your opt-in (web form, point of sale, etc.)</li>
                  <li>Your mobile phone number</li>
                </ul>
                <p className="text-foreground leading-relaxed mb-4">
                  <strong>We do not sell or rent your mobile phone number.</strong> We do not share 
                  your phone number with third parties for their marketing purposes.
                </p>
                <p className="text-foreground leading-relaxed mb-4">
                  We may share your phone number with service providers strictly to deliver messages. 
                  Our SMS delivery is powered by Twilio, a third-party communications platform. Twilio 
                  processes your phone number solely to transmit messages on our behalf and is 
                  contractually obligated to protect your information.
                </p>
                <p className="text-foreground leading-relaxed mb-4">
                  Consent records are retained for compliance purposes even after you opt out. 
                  Phone numbers of users who have opted out are retained in a suppression list to 
                  ensure we do not send further messages.
                </p>
                <p className="text-foreground leading-relaxed">
                  For more information about our SMS program, visit{' '}
                  <Link to="/sms-program" className="text-primary underline hover:text-primary/80">
                    https://bloomsuite.app/sms-program
                  </Link>.
                </p>
              </div>
            </section>

            {/* Email Engagement Tracking */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">Email Engagement Tracking</h2>
              <div className="bg-muted/30 border border-border rounded-lg p-6">
                <p className="text-foreground leading-relaxed">
                  We measure email engagement using tracking pixels and link redirects to understand 
                  aggregate performance. This helps us improve our communications and send you more 
                  relevant content. We track when emails are opened and which links are clicked, but 
                  we do not sell this data or share it with third parties for advertising purposes. 
                  IP addresses are hashed for privacy and we do not store raw IP data. You can opt out 
                  of email tracking by unsubscribing from our email list using the link in any email.
                </p>
              </div>
            </section>

            {/* Sharing with Processors */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">Sharing with Service Providers</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may share your information with third-party service providers who assist us in 
                operating our services, such as SMS delivery providers (Twilio), email services, and analytics 
                platforms. These providers are contractually obligated to protect your information 
                and use it only for the purposes we specify.
              </p>
            </section>

            {/* Retention */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">Data Retention</h2>
              <p className="text-muted-foreground leading-relaxed">
                We retain your personal information for as long as necessary to fulfill the purposes 
                for which it was collected, comply with legal obligations, resolve disputes, and 
                enforce our agreements. Consent records for SMS messaging are retained for compliance 
                purposes even after you opt out.
              </p>
            </section>

            {/* Your Choices */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">Your Choices</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                You have the following choices regarding your information:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Opt out of SMS messages by replying STOP to any message</li>
                <li>Unsubscribe from email communications using the link in emails</li>
                <li>Request access to or deletion of your personal data</li>
                <li>Update your communication preferences</li>
              </ul>
            </section>

            {/* Contact */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">Contact Us</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have questions about this Privacy Policy or our practices, please contact us at:
              </p>
              <div className="mt-4 text-muted-foreground">
                <p>{SMS_BRAND_CONFIG.legal_name}</p>
                <p>
                  Email:{' '}
                  <a 
                    href={`mailto:${SMS_BRAND_CONFIG.support_email}`}
                    className="text-primary underline hover:text-primary/80"
                  >
                    {SMS_BRAND_CONFIG.support_email}
                  </a>
                </p>
              </div>
            </section>

            {/* Links */}
            <section className="pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground">
                See also:{' '}
                <Link to="/terms" className="text-primary underline hover:text-primary/80">
                  Terms of Service
                </Link>
                {' | '}
                <Link to="/sms-program" className="text-primary underline hover:text-primary/80">
                  SMS Program
                </Link>
                {' | '}
                <Link to="/contact" className="text-primary underline hover:text-primary/80">
                  Contact Us
                </Link>
              </p>
            </section>
          </div>
        </div>
      </section>
    </PublicPageLayout>
  );
};

export default PrivacyPage;
