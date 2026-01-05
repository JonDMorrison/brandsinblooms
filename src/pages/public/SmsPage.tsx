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
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-8">
            BloomSuite SMS Messaging Program
          </h1>

          {/* Intro Paragraph */}
          <p className="text-lg text-muted-foreground leading-relaxed mb-12">
            BloomSuite provides SMS messaging capabilities to independent garden centers so they can 
            communicate with customers who have explicitly opted in to receive text messages. This page 
            explains how our SMS program works, what messages you may receive, and how to manage your preferences.
          </p>

          {/* Program Description */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Program Description
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              BloomSuite SMS is used by independent garden centers to send informational and promotional 
              text messages to customers who have explicitly opted in. These messages may include store 
              announcements, upcoming events, back-in-stock notifications, seasonal gardening tips, 
              and workshop reminders.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              BloomSuite does not send unsolicited messages and does not use purchased or shared contact lists.
            </p>
          </section>

          {/* How You Opt In */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              How You Opt In
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              To receive SMS messages, you must explicitly opt in. Users opt in by entering their mobile 
              phone number into a BloomSuite web form and checking a required consent box. The consent 
              disclosure clearly states that recurring messages may be sent, that message and data rates 
              may apply, and that users can reply <strong className="text-foreground">STOP</strong> to 
              opt out or <strong className="text-foreground">HELP</strong> for assistance.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Consent is recorded with a timestamp and stored securely.
            </p>
          </section>

          {/* Message Frequency */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Message Frequency
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Message frequency varies by garden center and customer preferences. Most users receive 
              between 1 and 4 messages per month.
            </p>
          </section>

          {/* Opt-Out and Help */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Opt-Out and Help
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              You can opt out of SMS messages at any time by replying <strong className="text-foreground">STOP</strong> to 
              any message. After opting out, you will no longer receive SMS messages unless you opt in again.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              For help, reply <strong className="text-foreground">HELP</strong> or contact support at{' '}
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

          {/* Privacy and Terms */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Privacy and Terms
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              BloomSuite respects your privacy and does not sell or share mobile phone numbers. For more 
              details, see our full policies:
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
            <p className="text-muted-foreground leading-relaxed">
              If you have questions about the BloomSuite SMS program, contact us at{' '}
              <a 
                href={`mailto:${SMS_BRAND_CONFIG.support_email}`}
                className="text-primary hover:text-primary/80 underline"
              >
                {SMS_BRAND_CONFIG.support_email}
              </a>.
            </p>
          </section>
        </div>
      </article>
    </PublicPageLayout>
  );
};

export default SmsPage;
