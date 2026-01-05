import { PublicPageLayout } from '@/components/public/PublicPageLayout';
import { SMS_BRAND_CONFIG } from '@/config/smsConfig';
import { Link } from 'react-router-dom';

export const TermsPage = () => {
  return (
    <PublicPageLayout
      title="Terms of Service"
      description="Read the terms and conditions for using BloomSuite services, including our SMS marketing program terms."
      canonicalPath="/terms"
      breadcrumbs={[
        { name: 'Home', url: '/' },
        { name: 'Terms of Service', url: '/terms' },
      ]}
    >
      <section className="py-12 px-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Terms of Service
          </h1>

          <p className="text-sm text-muted-foreground mb-8">
            Last updated: {SMS_BRAND_CONFIG.last_updated}
          </p>

          <div className="prose prose-slate max-w-none space-y-8">
            {/* Introduction */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">Introduction</h2>
              <p className="text-muted-foreground leading-relaxed">
                Welcome to BloomSuite. These Terms of Service ("Terms") govern your use of the 
                BloomSuite platform and services provided by {SMS_BRAND_CONFIG.legal_name} 
                ("we," "us," or "our"). BloomSuite is a product operated by {SMS_BRAND_CONFIG.legal_name}. 
                By accessing or using our services, you agree to be bound by these Terms.
              </p>
            </section>

            {/* Use of Services */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">Use of Services</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                You agree to use our services only for lawful purposes and in accordance with 
                these Terms. You are responsible for:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Maintaining the confidentiality of your account credentials</li>
                <li>All activities that occur under your account</li>
                <li>Complying with all applicable laws and regulations</li>
                <li>Not using the services for any illegal or unauthorized purpose</li>
              </ul>
            </section>

            {/* SMS Messaging Terms - EXPANDED FOR TWILIO COMPLIANCE */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">SMS Messaging Terms</h2>
              <div className="bg-muted/30 border border-border rounded-lg p-6">
                <p className="text-foreground leading-relaxed mb-4">
                  SMS messaging through BloomSuite is optional. You must explicitly opt in to receive 
                  text messages by providing your mobile phone number and checking a consent checkbox 
                  on a BloomSuite web form.
                </p>
                <p className="text-foreground leading-relaxed mb-4">
                  By opting in, you consent to receive recurring informational and promotional SMS 
                  messages from {SMS_BRAND_CONFIG.legal_name} (BloomSuite) at the mobile number you provide. 
                  Consent is not a condition of purchase.
                </p>
                <ul className="list-disc list-inside text-foreground space-y-2 mb-4">
                  <li>
                    <strong>Frequency:</strong> Message frequency varies ({SMS_BRAND_CONFIG.message_frequency_text}).
                  </li>
                  <li>
                    <strong>Rates:</strong> Message and data rates may apply depending on your carrier and plan.
                  </li>
                  <li>
                    <strong>Opt-Out:</strong> Reply STOP to cancel. You will receive a confirmation and 
                    no further messages unless you opt in again.
                  </li>
                  <li>
                    <strong>Help:</strong> Reply HELP for assistance.
                  </li>
                </ul>
                <p className="text-foreground leading-relaxed mb-4">
                  We may suspend or terminate SMS messaging to any user who violates these Terms, 
                  engages in abusive behavior, or whose usage poses compliance or operational risks.
                </p>
                <p className="text-foreground leading-relaxed">
                  For more information about our SMS program, visit{' '}
                  <Link to="/sms-program" className="text-primary underline hover:text-primary/80">
                    https://bloomsuite.app/sms-program
                  </Link>. 
                  For assistance, contact{' '}
                  <a 
                    href={`mailto:${SMS_BRAND_CONFIG.support_email}`}
                    className="text-primary underline hover:text-primary/80"
                  >
                    {SMS_BRAND_CONFIG.support_email}
                  </a>.
                </p>
              </div>
            </section>

            {/* Intellectual Property */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">Intellectual Property</h2>
              <p className="text-muted-foreground leading-relaxed">
                All content, features, and functionality of our services, including but not limited 
                to text, graphics, logos, and software, are the exclusive property of{' '}
                {SMS_BRAND_CONFIG.legal_name} and are protected by copyright, trademark, and 
                other intellectual property laws.
              </p>
            </section>

            {/* Disclaimer */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">Disclaimer</h2>
              <p className="text-muted-foreground leading-relaxed">
                Our services are provided "as is" and "as available" without warranties of any kind, 
                either express or implied. We do not warrant that our services will be uninterrupted, 
                secure, or error-free.
              </p>
            </section>

            {/* Limitation of Liability */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">Limitation of Liability</h2>
              <p className="text-muted-foreground leading-relaxed">
                To the fullest extent permitted by law, {SMS_BRAND_CONFIG.legal_name} shall not 
                be liable for any indirect, incidental, special, consequential, or punitive damages 
                arising out of or related to your use of our services.
              </p>
            </section>

            {/* Modifications */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">Modifications</h2>
              <p className="text-muted-foreground leading-relaxed">
                We reserve the right to modify these Terms at any time. We will notify you of 
                material changes by posting the updated Terms on our website. Your continued use 
                of our services after such changes constitutes acceptance of the new Terms.
              </p>
            </section>

            {/* Governing Law */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">Governing Law</h2>
              <p className="text-muted-foreground leading-relaxed">
                These Terms shall be governed by and construed in accordance with the laws of the 
                State of California, without regard to its conflict of law provisions.
              </p>
            </section>

            {/* Contact */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">Contact Us</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have questions about these Terms, please contact us at:
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
                <Link to="/privacy" className="text-primary underline hover:text-primary/80">
                  Privacy Policy
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

export default TermsPage;
