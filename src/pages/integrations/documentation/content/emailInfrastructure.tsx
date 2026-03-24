import type { ReactNode } from "react";

import { DocCallout } from "@/components/docs/DocCallout";
import { DocCodeBlock } from "@/components/docs/DocCodeBlock";
import { DocInlineCode } from "@/components/docs/DocInlineCode";
import { DocStep } from "@/components/docs/DocStep";
import type { DocContent } from "@/components/docs/types";
import { getIntegrationSeed } from "@/components/integrations/integrationsHubConfig";

const emailInfrastructureSeed = getIntegrationSeed("email-infrastructure");

if (!emailInfrastructureSeed) {
  throw new Error("Email Infrastructure integration seed is missing.");
}

const proseClassName = "space-y-4 text-[15px] leading-7 text-muted-foreground";

function DocTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border/70 bg-white">
      <table className="w-full min-w-[40rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border/70 bg-slate-50/80">
            {headers.map((header) => (
              <th
                key={header}
                className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className="border-b border-border/60 align-top last:border-b-0"
            >
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className="px-4 py-3 text-sm leading-6 text-muted-foreground"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StepList({
  steps,
}: {
  steps: Array<{ title: string; body: ReactNode }>;
}) {
  return (
    <div className="space-y-0">
      {steps.map((step, index) => (
        <DocStep
          key={step.title}
          stepNumber={index + 1}
          stepTitle={step.title}
          isLast={index === steps.length - 1}
        >
          {step.body}
        </DocStep>
      ))}
    </div>
  );
}

const spfExample = [
  "Type:   TXT",
  "Name:   @ (root domain) or mail (for mail.yourstore.com)",
  "Value:  v=spf1 include:spf.bloomsuite.io ~all",
  "TTL:    3600 (or Auto)",
].join("\n");

const dkimExample = [
  "Type:   CNAME",
  "Name:   [selector]._domainkey.yourstore.com",
  "Value:  [selector]._domainkey.bloomsuite.io",
  "TTL:    3600 (or Auto)",
].join("\n");

const dmarcExample = [
  "Type:   TXT",
  "Name:   _dmarc.yourstore.com",
  "Value:  v=DMARC1; p=none; rua=mailto:dmarc@yourstore.com; fo=1",
  "TTL:    3600",
].join("\n");

const requiredRecordsExample = [
  "SPF:",
  "  Type:  TXT",
  "  Name:  @ (or your subdomain)",
  "  Value: v=spf1 include:spf.bloomsuite.io ~all",
  "",
  "DKIM:",
  "  Type:  CNAME",
  "  Name:  [selector]._domainkey.[yourdomain.com]",
  "  Value: [selector]._domainkey.bloomsuite.io",
  "  (Exact values appear in the BloomSuite DNS records panel)",
  "",
  "DMARC:",
  "  Type:  TXT",
  "  Name:  _dmarc.[yourdomain.com]",
  "  Value: v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com; fo=1",
  "",
  "MX (if bounce handling is enabled in your setup):",
  "  Type:     MX",
  "  Name:     bounces.[yourdomain.com]",
  "  Value:    provider-specific target shown in BloomSuite",
  "  Priority: 10",
].join("\n");

export const emailInfrastructureDocumentation: DocContent = {
  integrationName: "Email Infrastructure",
  integrationSlug: emailInfrastructureSeed.slug,
  category: "Infrastructure",
  pageTitle: "Email Infrastructure & Sending Domain Guide",
  overview:
    "Set up and manage your BloomSuite sending domain to ensure your emails reach inboxes. This guide covers DNS record configuration, SPF, DKIM, DMARC, domain verification, and deliverability best practices for BloomSuite-powered email campaigns.",
  readingTimeMinutes: 20,
  lastUpdated: "2026-01-15",
  branding: {
    icon: emailInfrastructureSeed.icon,
  },
  sections: [
    {
      id: "why-your-sending-domain-matters",
      title: "Why Your Sending Domain Matters",
      group: "Understanding Email Infrastructure",
      content: (
        <div className={proseClassName}>
          <p>
            When BloomSuite sends email on your behalf, that message carries
            your brand domain, for example{" "}
            <DocInlineCode>hello@yourstore.com</DocInlineCode>. Receiving
            providers such as Gmail, Outlook, and Yahoo use DNS-based
            authentication and reputation signals to decide whether that email
            belongs in the inbox, spam folder, or rejection queue.
          </p>
          <p>
            Without proper DNS configuration, your emails are more likely to be
            marked as suspicious, bounced, or delivered inconsistently. The
            BloomSuite Email Infrastructure detail page exists to help you track
            exactly that risk through <strong>Primary Domain</strong>,{" "}
            <strong>DNS Coverage</strong>, and{" "}
            <strong>Infrastructure Health</strong>
            summaries.
          </p>
          <DocCallout title="Deliverability starts with authentication">
            A verified sending domain with SPF, DKIM, and DMARC configured
            correctly is one of the most effective deliverability improvements
            you can make. It is worth getting right before scaling campaign
            volume.
          </DocCallout>
        </div>
      ),
    },
    {
      id: "how-bloomsuite-sends-email",
      title: "How BloomSuite Sends Email",
      group: "Understanding Email Infrastructure",
      content: (
        <div className={proseClassName}>
          <p>
            In the current product, BloomSuite tracks a primary sending domain,
            DNS verification coverage, provider mode, recent sending volume, and
            infrastructure health. When you launch a campaign, BloomSuite
            assembles the message and routes delivery through its configured
            sending infrastructure, then surfaces the resulting health and
            deliverability signals back inside the Email Infrastructure and
            activity views.
          </p>
          <p>
            Receiving mail servers effectively ask: is this infrastructure
            authorized to send mail that claims to be from your domain? SPF,
            DKIM, and DMARC are the records that answer that question.
          </p>
        </div>
      ),
    },
    {
      id: "key-concepts-spf-dkim-dmarc",
      title: "Key Concepts: SPF, DKIM, DMARC",
      group: "Understanding Email Infrastructure",
      content: (
        <div className={proseClassName}>
          <p>
            <strong>SPF</strong> is a DNS record that lists which mail systems
            are allowed to send on behalf of your domain.
          </p>
          <p>
            <strong>DKIM</strong> signs outbound mail with a cryptographic key
            so receiving providers can verify the message has not been altered
            and was sent by an authorized system.
          </p>
          <p>
            <strong>DMARC</strong> tells receiving providers what to do if SPF
            or DKIM fails and provides reporting data so you can monitor domain
            abuse and authentication problems.
          </p>
          <DocCallout title="The strongest result comes from all three together">
            SPF, DKIM, and DMARC are most effective when used together.
            BloomSuite&apos;s DNS and health surfaces should be treated as the
            operational checkpoint for whether that stack is complete.
          </DocCallout>
        </div>
      ),
    },
    {
      id: "step-1-choose-your-sending-domain",
      title: "Step 1: Choose Your Sending Domain",
      group: "Setting Up Your Domain",
      content: (
        <div className="space-y-5">
          <p className="text-[15px] leading-7 text-muted-foreground">
            Decide whether you want to send from your root domain or from a
            dedicated subdomain before you add DNS records. BloomSuite can work
            with either model, but your choice affects sender reputation,
            operational separation, and brand presentation.
          </p>
          <DocTable
            headers={["Option", "Example", "Recommendation"]}
            rows={[
              [
                "Root domain",
                "yourstore.com",
                "Strong brand recognition when your list quality is established",
              ],
              [
                "Subdomain",
                "mail.yourstore.com",
                "Useful when you want to isolate sending reputation",
              ],
              [
                "Separate marketing domain",
                "yourstore-emails.com",
                "Fallback only when the primary domain cannot be used",
              ],
            ]}
          />
          <DocCallout
            variant="warning"
            title="Do not use free-mail addresses as your sending identity"
          >
            Using addresses such as{" "}
            <DocInlineCode>hello@gmail.com</DocInlineCode>
            for marketing mail can create alignment and deliverability problems.
            Use a business-controlled domain instead.
          </DocCallout>
        </div>
      ),
    },
    {
      id: "step-2-add-dns-records",
      title: "Step 2: Add DNS Records",
      group: "Setting Up Your Domain",
      content: (
        <div className={proseClassName}>
          <p>
            Add the required DNS records at your DNS provider, then use the
            BloomSuite domains surface as the source of truth for the exact
            record names and values. The static examples in this guide explain
            the record types, but the live DNS records panel is what should be
            copied into production.
          </p>
          <p>
            In the current app, the Email Infrastructure and Domain settings
            surfaces already support reviewing DNS records, running health
            checks, and continuing manual setup when automatic management is not
            available.
          </p>
        </div>
      ),
    },
    {
      id: "step-3-verify-your-domain",
      title: "Step 3: Verify Your Domain",
      group: "Setting Up Your Domain",
      content: (
        <div className={proseClassName}>
          <p>
            After adding or updating DNS, return to BloomSuite and run{" "}
            <DocInlineCode>Run Health Check</DocInlineCode> or review the DNS
            records view. The detail page summarizes readiness through DNS
            coverage, the primary domain status label, and a readiness summary
            that tells you how many records are currently verified.
          </p>
          <DocTable
            headers={["Status", "Meaning"]}
            rows={[
              ["Verified", "Record is visible and matches the expected target"],
              ["Missing", "Record is not visible from BloomSuite checks yet"],
              [
                "Incorrect",
                "A record exists but does not match the expected value or target",
              ],
              ["Pending", "Propagation or verification has not completed yet"],
            ]}
          />
        </div>
      ),
    },
    {
      id: "step-4-set-your-from-address",
      title: "Step 4: Set Your From Address",
      group: "Setting Up Your Domain",
      content: (
        <div className={proseClassName}>
          <p>
            Once the domain is verified, configure your sender identity in the
            BloomSuite email settings path. A typical production setup includes
            a brand-friendly from name, a verified from address, and a reply-to
            address that routes to the right team.
          </p>
          <DocCallout title="Use the email settings path after DNS is healthy">
            The Email Infrastructure view helps you confirm the domain is ready;
            the email settings path is where you finalize how messages appear to
            recipients.
          </DocCallout>
        </div>
      ),
    },
    {
      id: "spf-record-setup",
      title: "SPF Record Setup",
      group: "DNS Configuration",
      content: (
        <div className="space-y-5">
          <p className="text-[15px] leading-7 text-muted-foreground">
            SPF is usually a TXT record on the root domain or the dedicated
            sending subdomain.
          </p>
          <DocCodeBlock
            language="text"
            code={spfExample}
            ariaLabel="SPF example"
          />
          <div className="space-y-3 text-[15px] leading-7 text-muted-foreground">
            <p>
              You should only publish one SPF record per domain or subdomain.
            </p>
            <p>
              If you already have SPF in place, merge BloomSuite&apos;s include
              into the existing record rather than publishing a second TXT
              record.
            </p>
          </div>
          <DocCallout
            variant="warning"
            title="Two SPF records can break authentication"
          >
            Always merge SPF includes into one record. Two separate SPF records
            for the same hostname can cause SPF evaluation to fail.
          </DocCallout>
        </div>
      ),
    },
    {
      id: "dkim-record-setup",
      title: "DKIM Record Setup",
      group: "DNS Configuration",
      content: (
        <div className="space-y-5">
          <p className="text-[15px] leading-7 text-muted-foreground">
            BloomSuite-managed DKIM typically appears as a delegated CNAME
            record. The live selector and target should always be copied from
            BloomSuite&apos;s DNS records panel rather than from a static guide.
          </p>
          <DocCodeBlock
            language="text"
            code={dkimExample}
            ariaLabel="DKIM example"
          />
          <p className="text-[15px] leading-7 text-muted-foreground">
            CNAME-based delegation is useful because key rotation can happen on
            the provider side without requiring you to update DNS every time the
            signing key changes.
          </p>
        </div>
      ),
    },
    {
      id: "dmarc-policy-setup",
      title: "DMARC Policy Setup",
      group: "DNS Configuration",
      content: (
        <div className="space-y-5">
          <p className="text-[15px] leading-7 text-muted-foreground">
            A safe starting point is a monitoring-only DMARC policy while you
            confirm that all legitimate senders for your domain are aligned.
          </p>
          <DocCodeBlock
            language="text"
            code={dmarcExample}
            ariaLabel="DMARC example"
          />
          <DocTable
            headers={["Value", "Meaning"]}
            rows={[
              ["p=none", "Monitoring mode only"],
              [
                "p=quarantine",
                "Ask providers to route failing mail to spam or junk",
              ],
              ["p=reject", "Ask providers to reject failing mail outright"],
            ]}
          />
          <DocCallout
            variant="warning"
            title="Do not jump straight to reject without review"
          >
            Start by monitoring DMARC results, then tighten enforcement after
            confirming BloomSuite and every other legitimate sender for the
            domain is configured correctly.
          </DocCallout>
        </div>
      ),
    },
    {
      id: "using-domain-connect-automated-setup",
      title: "Using Domain Connect (Automated Setup)",
      group: "DNS Configuration",
      content: (
        <div className={proseClassName}>
          <p>
            BloomSuite&apos;s current infrastructure detail data distinguishes
            between manually managed DNS and automatically managed or prepared
            DNS modes. In the UI this appears through the provider label,
            provider mode label, and the domain-connect summary text.
          </p>
          <p>
            If your domain is managed automatically, BloomSuite may be able to
            streamline setup through the domain settings path. If it is not, use
            the manual DNS setup path and the live record list.
          </p>
          <DocCallout title="Treat the domain settings surface as the source of truth">
            The exact automation path depends on your provider and account. Use
            the BloomSuite domains flow to determine whether automatic setup is
            actually available for your domain.
          </DocCallout>
        </div>
      ),
    },
    {
      id: "reading-the-dns-status-dashboard",
      title: "Reading the DNS Status Dashboard",
      group: "Domain Health",
      content: (
        <div className={proseClassName}>
          <p>
            The Email Infrastructure detail page already summarizes DNS progress
            through <strong>DNS Coverage</strong>, which compares verified
            records against the total records currently tracked for the primary
            domain.
          </p>
          <DocTable
            headers={["Column", "Description"]}
            rows={[
              [
                "Record Type",
                "Whether the record is TXT, CNAME, MX, or another DNS type",
              ],
              ["Record Name", "The host or name that must be published"],
              [
                "Status",
                "Whether BloomSuite currently considers the record verified",
              ],
              [
                "Last Checked",
                "The last verification timestamp available from BloomSuite",
              ],
            ]}
          />
        </div>
      ),
    },
    {
      id: "common-dns-errors-and-fixes",
      title: "Common DNS Errors and Fixes",
      group: "Domain Health",
      content: (
        <DocTable
          headers={["Error", "Likely Cause", "Fix"]}
          rows={[
            [
              "SPF missing",
              "TXT record was not added or was added to the wrong hostname",
              "Add or correct the SPF TXT record using the live BloomSuite value",
            ],
            [
              "SPF incorrect",
              "The record is missing the BloomSuite include or contains a conflicting value",
              "Merge the expected include into the one SPF record for that hostname",
            ],
            [
              "DKIM missing",
              "Delegated CNAME was not added",
              "Add the DKIM CNAME exactly as BloomSuite shows it",
            ],
            [
              "DKIM incorrect",
              "CNAME target or selector does not match",
              "Update the CNAME so it matches the BloomSuite DNS panel exactly",
            ],
            [
              "DMARC missing",
              "Policy record has not been added yet",
              "Add the _dmarc TXT record",
            ],
            [
              "Changes not visible",
              "DNS propagation or caching delay",
              "Wait and run another health or DNS check after propagation time has passed",
            ],
          ]}
        />
      ),
    },
    {
      id: "monitoring-deliverability",
      title: "Monitoring Deliverability",
      group: "Domain Health",
      content: (
        <div className={proseClassName}>
          <p>
            BloomSuite already exposes deliverability signals such as recent
            volume, bounce rate, complaint rate, reputation score, 30-day
            delivery rate, 30-day bounce rate, and health-check status. Use
            those metrics instead of guessing whether the infrastructure is
            healthy.
          </p>
          <p>
            The key actions are already in the detail page: run a health check,
            inspect DNS records, review sending logs, and contact support when
            infrastructure problems persist.
          </p>
        </div>
      ),
    },
    {
      id: "what-is-sandbox-mode",
      title: "What Is Sandbox Mode",
      group: "Sandbox Mode",
      content: (
        <div className={proseClassName}>
          <p>
            Sandbox mode is a controlled state where sending is restricted for
            safety during setup or testing. This guide includes it because it is
            a common operator question, but the current Email Infrastructure
            detail data does not expose a dedicated sandbox-state field in the
            same way it exposes DNS coverage and health metrics.
          </p>
          <p>
            In practice, treat incomplete domain verification, setup-required
            domain state, or restricted sending access as signals that you may
            still be in a pre-production sending posture.
          </p>
        </div>
      ),
    },
    {
      id: "disabling-sandbox-mode",
      title: "Disabling Sandbox Mode",
      group: "Sandbox Mode",
      content: (
        <div className={proseClassName}>
          <p>
            The operational path out of a restricted setup state is the same one
            the current UI already emphasizes: finish DNS setup, verify the
            sending domain, confirm the sender identity path, and run health
            checks until the infrastructure view reflects a healthy state.
          </p>
          <p>
            If the domain is verified but sending still appears restricted,
            review logs and escalate through the support path surfaced on the
            detail page.
          </p>
        </div>
      ),
    },
    {
      id: "custom-return-path-bounce-handling",
      title: "Custom Return-Path / Bounce Handling",
      group: "Advanced Topics",
      content: (
        <div className={proseClassName}>
          <p>
            Some sending configurations require dedicated bounce or return-path
            handling. If your BloomSuite DNS panel includes an MX or related
            infrastructure record for bounce handling, publish the live values
            exactly as shown in the panel rather than relying on a static guide
            example.
          </p>
        </div>
      ),
    },
    {
      id: "multiple-sending-domains",
      title: "Multiple Sending Domains",
      group: "Advanced Topics",
      content: (
        <div className={proseClassName}>
          <p>
            BloomSuite&apos;s infrastructure detail data tracks a primary domain
            and also counts configured domains, so multi-domain setups are
            possible operationally. Use the domains settings path to decide
            which domain should be primary for production sending and which
            should remain secondary or staged.
          </p>
        </div>
      ),
    },
    {
      id: "warm-up-best-practices",
      title: "Warm-Up Best Practices",
      group: "Advanced Topics",
      content: (
        <div className="space-y-5">
          <p className="text-[15px] leading-7 text-muted-foreground">
            The current infrastructure detail data already exposes warmup stage,
            healthy-day counters, and daily limit signals. Use those fields to
            pace volume increases instead of assuming a new domain can send at
            full capacity immediately.
          </p>
          <DocTable
            headers={["Day", "Volume"]}
            rows={[
              ["Day 1-3", "200-500 emails"],
              ["Day 4-7", "1,000-2,000 emails"],
              ["Week 2", "5,000-10,000 emails"],
              ["Week 3", "20,000-50,000 emails"],
              ["Week 4+", "Full volume if health remains strong"],
            ]}
          />
          <DocCallout title="Warm up with engaged contacts first">
            Prioritize your most engaged audience during warmup. Strong early
            engagement supports reputation growth and lowers the chance of spam
            placement during the ramp period.
          </DocCallout>
        </div>
      ),
    },
    {
      id: "dns-records-not-verifying",
      title: "DNS Records Not Verifying",
      group: "Troubleshooting",
      content: (
        <div className="space-y-4 text-[15px] leading-7 text-muted-foreground">
          <ol className="list-decimal space-y-3 pl-6">
            <li>
              Confirm you copied the exact name and value from BloomSuite.
            </li>
            <li>
              Check whether the record belongs on the root domain or a
              subdomain.
            </li>
            <li>
              Use an external DNS lookup tool to confirm the record is publicly
              visible.
            </li>
            <li>
              Check for conflicting record types on the same hostname,
              especially for CNAME records.
            </li>
            <li>
              If propagation still has not completed after a long delay, contact
              your DNS provider or use the BloomSuite support path.
            </li>
          </ol>
        </div>
      ),
    },
    {
      id: "emails-going-to-spam",
      title: "Emails Going to Spam",
      group: "Troubleshooting",
      content: (
        <div className="space-y-4 text-[15px] leading-7 text-muted-foreground">
          <ol className="list-decimal space-y-3 pl-6">
            <li>Verify SPF, DKIM, and DMARC are all healthy.</li>
            <li>Review list quality and recent bounce or complaint rates.</li>
            <li>Check content quality and subject-line practices.</li>
            <li>Confirm the domain is being warmed up at a safe pace.</li>
            <li>
              Review sending logs and reputation trends before changing
              infrastructure again.
            </li>
          </ol>
        </div>
      ),
    },
    {
      id: "high-bounce-rates",
      title: "High Bounce Rates",
      group: "Troubleshooting",
      content: (
        <div className={proseClassName}>
          <p>
            High bounce rates usually indicate a combined infrastructure and
            list-quality problem. Use the 24-hour and 30-day bounce metrics in
            the infrastructure detail page as the starting point, then review
            audience hygiene and DNS alignment together.
          </p>
        </div>
      ),
    },
    {
      id: "dmarc-failures",
      title: "DMARC Failures",
      group: "Troubleshooting",
      content: (
        <div className={proseClassName}>
          <p>
            DMARC failures usually mean SPF or DKIM alignment is broken for one
            or more senders using the domain. Start in monitoring mode where
            possible, verify every legitimate sender, and tighten enforcement
            only after the full sending footprint is aligned.
          </p>
        </div>
      ),
    },
    {
      id: "required-dns-records",
      title: "Required DNS Records",
      group: "Reference",
      content: (
        <DocCodeBlock
          language="text"
          code={requiredRecordsExample}
          ariaLabel="Required DNS records reference"
        />
      ),
    },
    {
      id: "faq",
      title: "Frequently Asked Questions",
      group: "Reference",
      content: (
        <div className="space-y-5 text-[15px] leading-7 text-muted-foreground">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Where should I get the exact DNS values I need to publish?
            </h3>
            <p>
              From the live BloomSuite DNS records panel. This guide explains
              the record types and strategy, but the app is the operational
              source of truth for the exact names and values.
            </p>
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              How do I know if the domain is healthy enough to send?
            </h3>
            <p>
              Use the Infrastructure Health, DNS Coverage, reputation, bounce,
              complaint, and volume metrics on the detail page, then run a fresh
              health check if the status looks stale.
            </p>
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              When should I contact support?
            </h3>
            <p>
              When DNS is correct but verification still fails, when health
              checks surface persistent infrastructure issues, or when sending
              remains blocked after the domain appears ready.
            </p>
          </div>
        </div>
      ),
    },
  ],
};
