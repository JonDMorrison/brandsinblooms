import { Link } from 'react-router-dom';
import { PublicPageLayout } from '@/components/public/PublicPageLayout';
import { LegalContents, LegalList, LegalSection } from '@/components/public/LegalSection';
import { POS_LEGAL_CONFIG } from '@/config/posLegalConfig';
import { SMS_BRAND_CONFIG } from '@/config/smsConfig';

const SECTIONS = [
  { id: 'agreement', title: 'This agreement' },
  { id: 'licence', title: 'Your licence' },
  { id: 'accounts', title: 'Accounts and staff' },
  { id: 'restrictions', title: 'What you may not do' },
  { id: 'data', title: 'Your data' },
  { id: 'quickbooks', title: 'QuickBooks Online' },
  { id: 'third-parties', title: 'Other third-party services' },
  { id: 'fees', title: 'Fees' },
  { id: 'changes-service', title: 'Updates to the software' },
  { id: 'termination', title: 'Ending this agreement' },
  { id: 'warranty', title: 'Disclaimer' },
  { id: 'liability', title: 'Limitation of liability' },
  { id: 'law', title: 'Governing law' },
  { id: 'changes', title: 'Changes to this agreement' },
  { id: 'contact', title: 'Contact us' },
];

const linkClass = 'text-primary underline hover:text-primary/80';

export const PosEulaPage = () => {
  const { legal_name, support_email } = SMS_BRAND_CONFIG;

  return (
    <PublicPageLayout
      title="BloomSuite POS End-User Licence Agreement"
      description="The licence terms for using BloomSuite POS, the till and back office for garden centres, including its QuickBooks Online connection."
      canonicalPath={POS_LEGAL_CONFIG.eula_path}
      breadcrumbs={[
        { name: 'Home', url: '/' },
        { name: 'BloomSuite POS End-User Licence Agreement', url: POS_LEGAL_CONFIG.eula_path },
      ]}
    >
      <section className="py-12 px-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            BloomSuite POS End-User Licence Agreement
          </h1>
          <p className="text-sm text-muted-foreground mb-8">
            Last updated: {POS_LEGAL_CONFIG.last_updated}
          </p>

          <LegalContents sections={SECTIONS} />

          <div className="space-y-10">
            <LegalSection id="agreement" title="1. This agreement">
              <p>
                This agreement is between {legal_name} ("BloomSuite", "we", "us") and the business that
                uses BloomSuite POS ("you"). BloomSuite POS includes the till, the back office at{' '}
                <a href={POS_LEGAL_CONFIG.app_url} className={linkClass}>
                  pos.bloomsuite.app
                </a>
                , the BloomSuite POS apps, and their integrations, including the QuickBooks Online
                connection.
              </p>
              <p>
                By using BloomSuite POS, or by connecting it to another service, you agree to this
                agreement. The person who accepts it confirms they have authority to bind the business. If
                you have signed a separate agreement or order with us for BloomSuite POS, that agreement
                applies where it differs from this one.
              </p>
            </LegalSection>

            <LegalSection id="licence" title="2. Your licence">
              <p>
                While your subscription is active, we give you a limited, non-exclusive, non-transferable
                licence to use BloomSuite POS for your own business operations. We and our licensors keep
                all rights in the software. This licence does not let you sublicense, resell or share the
                software outside your business.
              </p>
            </LegalSection>

            <LegalSection id="accounts" title="3. Accounts and staff">
              <p>
                You are responsible for the people you give access to, the roles you give them, and keeping
                sign-in details and staff PINs private. Tell us promptly at{' '}
                <a href={`mailto:${support_email}`} className={linkClass}>
                  {support_email}
                </a>{' '}
                if you believe an account has been misused.
              </p>
            </LegalSection>

            <LegalSection id="restrictions" title="4. What you may not do">
              <LegalList
                items={[
                  'Copy, modify, or reverse engineer the software, except where the law allows it despite this restriction.',
                  'Get around security, usage limits or access controls, or test them without our written permission.',
                  "Access another business's records.",
                  'Use BloomSuite POS for anything unlawful, including processing payments you are not authorised to take.',
                  'Use BloomSuite POS to build a competing product.',
                ]}
              />
            </LegalSection>

            <LegalSection id="data" title="5. Your data">
              <p>
                You own your business records and your customer information. You allow us to store and
                process them only to provide BloomSuite POS to you, support you, keep the service secure, and
                meet our legal obligations. You are responsible for having the right to collect the
                information you enter and for telling your customers how you use it.
              </p>
              <p>
                How we handle information is described in the{' '}
                <Link to={POS_LEGAL_CONFIG.privacy_path} className={linkClass}>
                  BloomSuite POS Privacy Policy
                </Link>
                . You can export your records at any time while your account is open.
              </p>
            </LegalSection>

            <LegalSection id="quickbooks" title="6. QuickBooks Online">
              <div className="rounded-lg border border-border bg-muted/30 p-6 space-y-4 text-foreground">
                <p>
                  The QuickBooks Online connection is optional. When a store owner connects it, you
                  authorise BloomSuite to read your QuickBooks company information, preferences, chart of
                  accounts and customer list, and to create the daily journal entries you review and send.
                  The Privacy Policy lists exactly what is read, written and kept.
                </p>
                <p>
                  You remain responsible for your books. Review each journal before you send it, and have
                  your accountant confirm the accounts you map and how entries are treated. BloomSuite does
                  not provide accounting, tax or legal advice.
                </p>
                <p>
                  Your use of QuickBooks Online is governed by your agreement with Intuit. You can disconnect
                  BloomSuite at any time from Reports in the back office, or from your Intuit account.
                  Journals already sent stay in QuickBooks.
                </p>
                <p>
                  BloomSuite is not affiliated with, sponsored by, or endorsed by Intuit. QuickBooks is a
                  trademark of Intuit Inc.
                </p>
              </div>
            </LegalSection>

            <LegalSection id="third-parties" title="7. Other third-party services">
              <p>
                Card payments are processed by Stripe under your agreement with Stripe. Other services you
                connect are governed by their own terms. We are not responsible for a third-party service
                being unavailable or changing how it works, but we will tell you when that affects
                BloomSuite POS.
              </p>
            </LegalSection>

            <LegalSection id="fees" title="8. Fees">
              <p>
                Fees are set out in your subscription or order. Payment processing fees are charged by the
                payment provider as set out in your agreement with them.
              </p>
            </LegalSection>

            <LegalSection id="changes-service" title="9. Updates to the software">
              <p>
                We update BloomSuite POS to fix problems, improve security and add features. We will not make
                a change that materially reduces the core features you pay for without telling you first.
              </p>
            </LegalSection>

            <LegalSection id="termination" title="10. Ending this agreement">
              <p>
                You can stop using BloomSuite POS at any time, subject to your subscription terms. We may
                suspend or end access if you seriously breach this agreement or if the law requires it. When
                access ends, your licence ends. Export your records before your account closes. We will help
                you do so on request.
              </p>
            </LegalSection>

            <LegalSection id="warranty" title="11. Disclaimer">
              <p>
                We work to keep BloomSuite POS accurate and available. To the extent the law allows, it is
                provided "as is", without other warranties, including fitness for a particular purpose. You
                should keep your own records of material transactions.
              </p>
            </LegalSection>

            <LegalSection id="liability" title="12. Limitation of liability">
              <p>
                To the maximum extent permitted by law, BloomSuite is not liable for indirect, incidental,
                special, consequential or punitive damages, including lost profits, revenue or data.
                BloomSuite's total liability under this agreement is limited to the fees you paid to
                BloomSuite in the twelve (12) months before the claim.
              </p>
            </LegalSection>

            <LegalSection id="law" title="13. Governing law">
              <p>
                This agreement is governed by the laws of the province of Canada in which {legal_name} is
                incorporated and the federal laws of Canada that apply there. The courts of that province
                have jurisdiction over any dispute.
              </p>
            </LegalSection>

            <LegalSection id="changes" title="14. Changes to this agreement">
              <p>
                We may update this agreement. We will post the new version here and update the date above.
                If a change is material, we will tell store owners at least thirty (30) days before it takes
                effect. Continuing to use BloomSuite POS after that means you accept the change.
              </p>
            </LegalSection>

            <LegalSection id="contact" title="15. Contact us">
              <p>{legal_name}</p>
              <p>
                Email:{' '}
                <a href={`mailto:${support_email}`} className={linkClass}>
                  {support_email}
                </a>
              </p>
            </LegalSection>

            <section className="pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground">
                See also:{' '}
                <Link to={POS_LEGAL_CONFIG.privacy_path} className={linkClass}>
                  BloomSuite POS Privacy Policy
                </Link>
                {' | '}
                <Link to="/terms" className={linkClass}>
                  Terms of Service
                </Link>
                {' | '}
                <Link to="/platform-agreement" className={linkClass}>
                  Platform Agreement
                </Link>
              </p>
            </section>
          </div>
        </div>
      </section>
    </PublicPageLayout>
  );
};

export default PosEulaPage;
