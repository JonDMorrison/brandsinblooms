import { PublicPageLayout } from '@/components/public/PublicPageLayout';
import { SMS_BRAND_CONFIG } from '@/config/smsConfig';
import { Link } from 'react-router-dom';

export const SmsPage = () => {
  return (
    <PublicPageLayout
      title="SMS Messaging Program"
      description="Learn about the BloomSuite SMS messaging program, how to opt in, message frequency, and how to manage your preferences."
      canonicalPath="/sms-program"
      breadcrumbs={[
        { name: 'Home', url: '/' },
        { name: 'SMS Program', url: '/sms-program' },
      ]}
    >
      <article className="py-12 px-6">
        <div className="max-w-3xl mx-auto">
          {/* Page Title */}
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            BloomSuite SMS Messaging Program
          </h1>

          <p className="text-sm text-muted-foreground mb-8">
            Last updated: {SMS_BRAND_CONFIG.last_updated}
          </p>

          {/* Above-the-fold Disclosure Block - REQUIRED FOR TWILIO */}
          <div className="bg-muted/50 border border-border rounded-lg p-6 mb-10">
            <p className="text-foreground leading-relaxed">
              By providing your mobile number and checking the consent box, you agree to receive 
              recurring informational and promotional SMS messages from BloomSuite, a product 
              operated by {SMS_BRAND_CONFIG.legal_name}. Message frequency varies ({SMS_BRAND_CONFIG.message_frequency_text}). 
              Reply STOP to cancel, HELP for help. Message and data rates may apply. 
              See <Link to="/terms" className="text-primary underline hover:text-primary/80">Terms</Link> and{' '}
              <Link to="/privacy" className="text-primary underline hover:text-primary/80">Privacy Policy</Link> for details.
            </p>
          </div>

          {/* Program Description */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Program Description
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              BloomSuite provides SMS messaging capabilities to independent garden centers so they can 
              communicate with customers who have explicitly opted in to receive text messages. Messages 
              may include sales and event announcements, back-in-stock alerts, seasonal care tips, and 
              workshop reminders. BloomSuite does not send unsolicited messages and does not use 
              purchased or shared contact lists.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              BloomSuite is a product operated by {SMS_BRAND_CONFIG.legal_name}.
            </p>
          </section>

          {/* Who Is Sending */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Who Is Sending
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Messages are sent by BloomSuite on behalf of independent garden centers. BloomSuite 
              is operated by {SMS_BRAND_CONFIG.legal_name}.
            </p>
          </section>

          {/* What Messages You May Receive */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              What Messages You May Receive
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              You may receive informational and promotional messages including:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 mb-4">
              <li>Sales and event announcements</li>
              <li>Back-in-stock notifications</li>
              <li>Seasonal gardening tips</li>
              <li>Workshop and webinar reminders</li>
            </ul>
          </section>

          {/* How You Opt In */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              How You Opt In
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              To receive SMS messages, you must explicitly opt in by entering your mobile phone number 
              into a BloomSuite web form and checking a required consent checkbox. The consent disclosure 
              clearly states:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 mb-4">
              <li>You will receive recurring messages</li>
              <li>Message frequency varies ({SMS_BRAND_CONFIG.message_frequency_text})</li>
              <li>Message and data rates may apply</li>
              <li>You can reply STOP to opt out or HELP for assistance</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed">
              Consent is recorded with a timestamp and source, and stored securely.
            </p>
          </section>

          {/* Message Frequency */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Message Frequency
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Message frequency varies ({SMS_BRAND_CONFIG.message_frequency_text}).
            </p>
          </section>

          {/* Opt-Out and Help */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Opt-Out and Help
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              <strong className="text-foreground">STOP:</strong> Reply STOP to any message to opt out. 
              After opting out, you will no longer receive SMS messages unless you opt in again.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              <strong className="text-foreground">HELP:</strong> Reply HELP to any message for assistance, 
              or contact support at{' '}
              <a 
                href={`mailto:${SMS_BRAND_CONFIG.support_email}`}
                className="text-primary hover:text-primary/80 underline"
              >
                {SMS_BRAND_CONFIG.support_email}
              </a>.
            </p>
          </section>

          {/* Message and Data Rates */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Message and Data Rates
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Message and data rates may apply depending on your mobile carrier and plan.
            </p>
          </section>

          {/* Sample Messages */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Sample Messages
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Below are examples of the types of messages you may receive. All messages include 
              STOP/HELP instructions and first-party links only.
            </p>
            <div className="space-y-4">
              <div className="bg-muted/30 border border-border rounded-lg p-4">
                <p className="text-sm text-foreground font-mono">
                  BloomSuite: Thanks for stopping by. This is a live text sent from the BloomSuite CRM 
                  in real time. See how it works: https://bloomsuite.app/sms-program HELP=help STOP=cancel
                </p>
              </div>
              <div className="bg-muted/30 border border-border rounded-lg p-4">
                <p className="text-sm text-foreground font-mono">
                  BloomSuite: Webinar reminder. Save your seat: https://bloomsuite.app/webinars HELP=help STOP=cancel
                </p>
              </div>
              <div className="bg-muted/30 border border-border rounded-lg p-4">
                <p className="text-sm text-foreground font-mono">
                  BloomSuite: Seasonal tip from your local garden center. Read: https://bloomsuite.app/blog/sms-tips HELP=help STOP=cancel
                </p>
              </div>
            </div>
          </section>

          {/* Privacy and Terms */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Privacy and Terms
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              BloomSuite respects your privacy and does not sell or share mobile phone numbers. 
              For more details, see our full policies:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>
                <Link 
                  to="/privacy" 
                  className="text-primary hover:text-primary/80 underline"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link 
                  to="/terms" 
                  className="text-primary hover:text-primary/80 underline"
                >
                  Terms of Service
                </Link>
              </li>
            </ul>
          </section>

          {/* Contact Information */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Contact Information
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-2">
              If you have questions about the BloomSuite SMS program, contact us at:
            </p>
            <p className="text-muted-foreground">
              Email:{' '}
              <a 
                href={`mailto:${SMS_BRAND_CONFIG.support_email}`}
                className="text-primary hover:text-primary/80 underline"
              >
                {SMS_BRAND_CONFIG.support_email}
              </a>
            </p>
            <p className="text-muted-foreground mt-2">
              {SMS_BRAND_CONFIG.legal_name}
            </p>
          </section>

          {/* Reviewer Checklist - REQUIRED FOR TWILIO VERIFICATION */}
          <section className="mb-10 bg-muted/30 border border-border rounded-lg p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Program Compliance Summary
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              For carrier and verification review:
            </p>
            <ul className="text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-primary font-semibold">STOP:</span>
                <span>Reply STOP to cancel. Handled by Twilio.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-semibold">HELP:</span>
                <span>Reply HELP for assistance. Handled by Twilio.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-semibold">Frequency:</span>
                <span>Message frequency varies ({SMS_BRAND_CONFIG.message_frequency_text}).</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-semibold">Rates:</span>
                <span>Message and data rates may apply.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-semibold">Terms:</span>
                <span>
                  <Link to="/terms" className="text-primary underline hover:text-primary/80">
                    https://bloomsuite.app/terms
                  </Link>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-semibold">Privacy:</span>
                <span>
                  <Link to="/privacy" className="text-primary underline hover:text-primary/80">
                    https://bloomsuite.app/privacy
                  </Link>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-semibold">Contact:</span>
                <span>{SMS_BRAND_CONFIG.support_email}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-semibold">Operator:</span>
                <span>{SMS_BRAND_CONFIG.legal_name}</span>
              </li>
            </ul>
          </section>
        </div>
      </article>
    </PublicPageLayout>
  );
};

export default SmsPage;
