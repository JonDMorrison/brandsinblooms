import { Link } from 'react-router-dom';
import { PublicPageLayout } from '@/components/public/PublicPageLayout';
import { LegalContents, LegalList, LegalSection } from '@/components/public/LegalSection';
import { POS_LEGAL_CONFIG } from '@/config/posLegalConfig';
import { SMS_BRAND_CONFIG } from '@/config/smsConfig';

const SECTIONS = [
  { id: 'scope', title: 'Who we are and what this covers' },
  { id: 'information', title: 'Information BloomSuite POS handles' },
  { id: 'quickbooks', title: 'QuickBooks Online connection' },
  { id: 'use', title: 'How we use information' },
  { id: 'sharing', title: 'Who we share it with' },
  { id: 'security', title: 'How we protect it' },
  { id: 'retention', title: 'How long we keep it' },
  { id: 'rights', title: 'Your choices and rights' },
  { id: 'changes', title: 'Changes to this policy' },
  { id: 'contact', title: 'Contact us' },
];

const linkClass = 'text-primary underline hover:text-primary/80';

export const PosPrivacyPage = () => {
  const { legal_name, support_email } = SMS_BRAND_CONFIG;

  return (
    <PublicPageLayout
      title="BloomSuite POS Privacy Policy"
      description="How BloomSuite POS handles store, staff and customer information, including what the QuickBooks Online connection reads, writes and stores."
      canonicalPath={POS_LEGAL_CONFIG.privacy_path}
      breadcrumbs={[
        { name: 'Home', url: '/' },
        { name: 'BloomSuite POS Privacy Policy', url: POS_LEGAL_CONFIG.privacy_path },
      ]}
    >
      <section className="py-12 px-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            BloomSuite POS Privacy Policy
          </h1>
          <p className="text-sm text-muted-foreground mb-8">
            Last updated: {POS_LEGAL_CONFIG.last_updated}
          </p>

          <LegalContents sections={SECTIONS} />

          <div className="space-y-10">
            <LegalSection id="scope" title="1. Who we are and what this covers">
              <p>
                BloomSuite POS is the point of sale and back office for garden centres, available at{' '}
                <a href={POS_LEGAL_CONFIG.app_url} className={linkClass}>
                  pos.bloomsuite.app
                </a>
                . It is operated by {legal_name} ("BloomSuite", "we", "us").
              </p>
              <p>
                This policy covers information handled through BloomSuite POS, including its optional
                connection to QuickBooks Online. It adds to our general{' '}
                <Link to="/privacy" className={linkClass}>
                  Privacy Policy
                </Link>
                . Where the two differ for BloomSuite POS, this policy applies.
              </p>
              <p>
                A store that uses BloomSuite POS decides what information it keeps about its own
                customers and staff. For that information we act on the store's behalf, and the store is
                responsible for telling its customers how it uses their information.
              </p>
            </LegalSection>

            <LegalSection id="information" title="2. Information BloomSuite POS handles">
              <LegalList
                items={[
                  <>
                    <strong className="text-foreground">Staff accounts:</strong> name, email address, role,
                    the store each person can work in, and sign-in and activity records.
                  </>,
                  <>
                    <strong className="text-foreground">Store business records:</strong> products, prices,
                    stock, sales, refunds, tills, tax amounts, gift card and store credit balances, and
                    accounting setup.
                  </>,
                  <>
                    <strong className="text-foreground">Customer records the store chooses to keep:</strong>{' '}
                    for example name, contact details, purchase history, account balances, and marketing
                    consent.
                  </>,
                  <>
                    <strong className="text-foreground">Payments:</strong> card payments are processed by
                    Stripe. BloomSuite receives payment results such as the amount, status and Stripe
                    reference. We do not receive or store card numbers or security codes.
                  </>,
                  <>
                    <strong className="text-foreground">Technical information:</strong> device, browser and
                    app version details, and error records needed to keep the service working.
                  </>,
                ]}
              />
            </LegalSection>

            <LegalSection id="quickbooks" title="3. QuickBooks Online connection">
              <div className="rounded-lg border border-border bg-muted/30 p-6 space-y-4">
                <p className="text-foreground">
                  Connecting QuickBooks Online is optional. Only a store owner can connect it, and they
                  approve the connection on Intuit's own sign-in screen. BloomSuite asks Intuit only for
                  access to accounting data (the <code>com.intuit.quickbooks.accounting</code> scope). We
                  do not ask for payments access or for the owner's Intuit profile.
                </p>
                <p className="text-foreground">
                  Before the connection is used, the owner sees the company Intuit returned and confirms
                  it is the right one.
                </p>

                <div>
                  <h3 className="text-base font-semibold text-foreground mb-2">What we read</h3>
                  <LegalList
                    items={[
                      'Company information: the company ID, legal or company name, and country.',
                      'Company preferences: home currency and whether multicurrency is on.',
                      'The active chart of accounts: account ID, name, type, subtype and currency, so the owner can choose where each kind of sale is recorded.',
                      'The active customer list: customer ID, display name and currency, so the owner can choose the QuickBooks customer for amounts a customer owes the store.',
                      'Journal entries BloomSuite created, found by their reference number, so a journal is never sent twice.',
                    ]}
                  />
                </div>

                <div>
                  <h3 className="text-base font-semibold text-foreground mb-2">What we write</h3>
                  <p>
                    BloomSuite creates daily journal entries that summarise the store's sales, payments,
                    taxes, gift cards, store credit and fees. A journal is sent only after the owner has
                    reviewed and approved that day in BloomSuite and chosen to send it. A correction sends
                    only the difference from the journal already sent. BloomSuite does not change or
                    delete other records in QuickBooks.
                  </p>
                </div>

                <div>
                  <h3 className="text-base font-semibold text-foreground mb-2">What we keep</h3>
                  <LegalList
                    items={[
                      'The connected company ID, name, country, home currency and multicurrency setting.',
                      'The account and customer choices the owner saved, using QuickBooks IDs and names.',
                      'A copy of each journal sent and the ID QuickBooks gave it, as part of the store\'s accounting records.',
                      'Records of who connected, confirmed, sent and disconnected, and when.',
                      'Intuit access and refresh tokens, encrypted with AES-256-GCM. They are used only by our servers and never reach a browser.',
                    ]}
                  />
                </div>

                <div>
                  <h3 className="text-base font-semibold text-foreground mb-2">What we never do</h3>
                  <LegalList
                    items={[
                      'Sell QuickBooks data, or use it for advertising.',
                      'Use QuickBooks data for anything other than the store\'s own BloomSuite accounting features.',
                      'Write tokens or QuickBooks responses into our logs.',
                    ]}
                  />
                </div>

                <div>
                  <h3 className="text-base font-semibold text-foreground mb-2">Disconnecting</h3>
                  <p>
                    An owner can disconnect QuickBooks Online at any time from Reports in the BloomSuite
                    back office. We delete the stored tokens first, then ask Intuit to revoke access. If
                    Intuit does not confirm the revocation, BloomSuite tells the owner to remove the app in
                    QuickBooks as well. Journals already sent stay in QuickBooks. The connection history
                    stays with the store's accounting records.
                  </p>
                </div>
              </div>
            </LegalSection>

            <LegalSection id="use" title="4. How we use information">
              <LegalList
                items={[
                  'To run the till, back office and the features the store turns on.',
                  'To keep store records accurate, including stock, balances and accounting.',
                  'To send messages the store asks us to send, such as email receipts.',
                  'To secure accounts, prevent fraud and investigate problems.',
                  'To provide support when the store asks for it.',
                  'To meet legal, tax and accounting obligations.',
                ]}
              />
            </LegalSection>

            <LegalSection id="sharing" title="5. Who we share it with">
              <p>
                We do not sell personal information. We share information only with service providers that
                help us run BloomSuite POS, and only as needed to provide it:
              </p>
              <LegalList
                items={[
                  'Supabase: database, sign-in and server functions.',
                  'Vercel: web hosting.',
                  'Stripe: card payments and payouts.',
                  'Resend: email delivery, such as receipts.',
                  'Intuit: only when the store connects QuickBooks Online, as described above.',
                ]}
              />
              <p>
                These providers may process information outside your province or country, including in the
                United States. We may also disclose information where the law requires it.
              </p>
            </LegalSection>

            <LegalSection id="security" title="6. How we protect it">
              <p>
                Information is encrypted in transit. Each store's records are kept separate from every
                other store's. Staff see only what their role allows. Integration credentials such as
                QuickBooks tokens are stored encrypted and are never sent to a browser.
              </p>
            </LegalSection>

            <LegalSection id="retention" title="7. How long we keep it">
              <p>
                We keep store records for as long as the store uses BloomSuite, and longer only where the
                law requires, for example for tax and accounting records. A store owner can export the
                store's records at any time. When a store closes its account, it can ask us to delete its
                information, and we will do so except where we must keep it by law.
              </p>
            </LegalSection>

            <LegalSection id="rights" title="8. Your choices and rights">
              <p>
                You can ask to see or correct the personal information we hold about you, or withdraw your
                consent where we rely on it. If you are a customer of a store that uses BloomSuite, please
                contact that store first, because it controls your records. We will help it respond.
              </p>
            </LegalSection>

            <LegalSection id="changes" title="9. Changes to this policy">
              <p>
                We will post any change on this page and update the date above. If a change materially
                affects how we handle store information, we will tell store owners before it takes effect.
              </p>
            </LegalSection>

            <LegalSection id="contact" title="10. Contact us">
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
                <Link to={POS_LEGAL_CONFIG.eula_path} className={linkClass}>
                  BloomSuite POS End-User Licence Agreement
                </Link>
                {' | '}
                <Link to="/privacy" className={linkClass}>
                  Privacy Policy
                </Link>
                {' | '}
                <Link to="/terms" className={linkClass}>
                  Terms of Service
                </Link>
              </p>
            </section>
          </div>
        </div>
      </section>
    </PublicPageLayout>
  );
};

export default PosPrivacyPage;
