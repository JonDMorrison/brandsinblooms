import { PublicPageLayout } from '@/components/public/PublicPageLayout';
import { SMS_BRAND_CONFIG } from '@/config/smsConfig';
import { Card, CardContent } from '@/components/ui/card';
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
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-8">
            Terms of Service
          </h1>

          <p className="text-muted-foreground mb-8">
            Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>

          <div className="prose prose-slate max-w-none space-y-8">
            {/* Introduction */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">Introduction</h2>
              <p className="text-muted-foreground leading-relaxed">
                Welcome to BloomSuite. These Terms of Service ("Terms") govern your use of the 
                BloomSuite platform and services provided by {SMS_BRAND_CONFIG.legal_name} 
                ("we," "us," or "our"). By accessing or using our services, you agree to be 
                bound by these Terms.
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

            {/* SMS Terms - VERBATIM REQUIRED TEXT */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">SMS Terms</h2>
              <Card className="bg-muted/30 border-primary/20">
                <CardContent className="p-6">
                  <p className="text-foreground leading-relaxed">
                    By subscribing, you consent to receive recurring marketing SMS from{' '}
                    {SMS_BRAND_CONFIG.legal_name} (BloomSuite) at the number you provide. 
                    Consent is not a condition of purchase. Frequency {SMS_BRAND_CONFIG.message_frequency_text}. 
                    Msg and Data rates may apply. Text STOP to cancel; HELP for help. 
                    See our Privacy Policy at{' '}
                    <Link to="/privacy" className="text-primary underline hover:text-primary/80">
                      {SMS_BRAND_CONFIG.privacy_url}
                    </Link>. 
                    For assistance contact{' '}
                    <a 
                      href={`mailto:${SMS_BRAND_CONFIG.support_email}`}
                      className="text-primary underline hover:text-primary/80"
                    >
                      {SMS_BRAND_CONFIG.support_email}
                    </a>.
                  </p>
                </CardContent>
              </Card>
            </section>

            {/* Intellectual Property */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">Intellectual Property</h2>
              <p className="text-muted-foreground leading-relaxed">
                All content, features, and functionality of our services, including but not limited 
                to text, graphics, logos, and software, are the exclusive property of 
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
