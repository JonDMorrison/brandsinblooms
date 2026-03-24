import type { ReactNode } from "react";

import { DocCallout } from "@/components/docs/DocCallout";
import { DocInlineCode } from "@/components/docs/DocInlineCode";
import { DocStep } from "@/components/docs/DocStep";
import type { DocContent } from "@/components/docs/types";
import { getIntegrationSeed } from "@/components/integrations/integrationsHubConfig";

import { documentationLogoAssets } from "./logoAssets";

const klaviyoSeed = getIntegrationSeed("klaviyo");

if (!klaviyoSeed) {
  throw new Error("Klaviyo integration seed is missing.");
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

export const klaviyoDocumentation: DocContent = {
  integrationName: "Klaviyo",
  integrationSlug: klaviyoSeed.slug,
  category: "Marketing Import",
  pageTitle: "Klaviyo Import Guide",
  overview:
    "Migrate your Klaviyo profiles, lists, and segments into BloomSuite. This integration pulls contact data from Klaviyo through the BloomSuite migration flow and imports it into your CRM while preserving the audience structure needed for review and follow-up campaigns.",
  readingTimeMinutes: 10,
  lastUpdated: "2026-01-15",
  branding: {
    icon: klaviyoSeed.icon,
    logoSrc: documentationLogoAssets.klaviyo,
    logoAlt: "Klaviyo logo",
  },
  sections: [
    {
      id: "overview-what-this-integration-does",
      title: "Overview & What This Integration Does",
      group: "Getting Started",
      content: (
        <div className={proseClassName}>
          <p>
            Klaviyo in BloomSuite is a migration path for profiles, lists, and
            segments. The current detail page and migration wizard treat it as a
            one-time or periodic import workflow rather than as an always-on
            marketing sync.
          </p>
          <p>
            That matches the existing UI language: the connection purpose is
            <strong> Contact Import</strong>, and the provider capability panel
            explicitly states that live sync is not available. After import,
            Klaviyo is not monitored continuously for new subscribers or list
            changes.
          </p>
          <p>
            Typical use case: you are moving email marketing operations from
            Klaviyo into BloomSuite and need to bring audience structure and
            profile data with you.
          </p>
        </div>
      ),
    },
    {
      id: "before-you-start",
      title: "Before You Start",
      group: "Getting Started",
      content: (
        <div className="space-y-4 text-[15px] leading-7 text-muted-foreground">
          <ul className="list-disc space-y-3 pl-6">
            <li>
              Audit your Klaviyo lists and segments before the first production
              import.
            </li>
            <li>
              Identify which profile properties are worth carrying into
              BloomSuite and which should be skipped.
            </li>
            <li>
              Verify your BloomSuite sending domain before you begin emailing
              imported contacts.
            </li>
            <li>
              Confirm who owns the migration scope and which Klaviyo account is
              the authoritative source.
            </li>
          </ul>
          <DocCallout title="Dynamic segments do not stay dynamic after import">
            BloomSuite can preserve the membership of a Klaviyo segment at the
            time of import, but the portable asset is a snapshot of current
            members, not Klaviyo&apos;s original dynamic rule engine.
          </DocCallout>
        </div>
      ),
    },
    {
      id: "connecting-klaviyo",
      title: "Connecting Klaviyo",
      group: "Getting Started",
      content: (
        <div className="space-y-6">
          <StepList
            steps={[
              {
                title: "Open the Klaviyo integration page",
                body: (
                  <p>
                    Start from Integrations and open Klaviyo. The detail page
                    shows whether the provider is connected and exposes the
                    import actions that hand off to the migration wizard.
                  </p>
                ),
              },
              {
                title: "Connect the provider in BloomSuite",
                body: (
                  <p>
                    Use the existing connection flow in BloomSuite to establish
                    a Klaviyo provider connection. The current app tracks
                    Klaviyo as a connected provider for the migration wizard and
                    then validates the connection before running an import.
                  </p>
                ),
              },
              {
                title: "Return to the import flow and validate the connection",
                body: (
                  <p>
                    Once connected, open the import flow and proceed to the
                    provider validation step. The current import process runs a
                    Klaviyo-specific validation call before the import job is
                    allowed to start.
                  </p>
                ),
              },
            ]}
          />
        </div>
      ),
    },
    {
      id: "step-1-validate-your-connection",
      title: "Step 1: Validate Your Connection",
      group: "Import Process",
      content: (
        <div className={proseClassName}>
          <p>
            The current import flow validates Klaviyo before import begins. If
            validation fails, treat that as a provider-connection problem first
            rather than a field-mapping or import-size issue.
          </p>
        </div>
      ),
    },
    {
      id: "step-2-preview-lists-segments",
      title: "Step 2: Preview Lists & Segments",
      group: "Import Process",
      content: (
        <div className={proseClassName}>
          <p>
            Use <DocInlineCode>Preview Lists</DocInlineCode> to fetch available
            Klaviyo artifacts into the migration wizard. The current capability
            metadata for Klaviyo emphasizes previewing lists before import and
            retaining imported audience groupings for later CRM review.
          </p>
          <DocTable
            headers={["Item", "Details shown"]}
            rows={[
              ["Lists", "Name and profile count for the import scope"],
              [
                "Segments",
                "Current segment membership for snapshot import review",
              ],
            ]}
          />
        </div>
      ),
    },
    {
      id: "step-3-select-and-map",
      title: "Step 3: Select and Map",
      group: "Import Process",
      content: (
        <div className="space-y-5">
          <p className="text-[15px] leading-7 text-muted-foreground">
            Select the lists and segments you want to carry over, then review
            how Klaviyo profile properties should map into BloomSuite. Standard
            identity fields should map cleanly; custom properties should be
            reviewed one by one so you only migrate fields that will still be
            useful in BloomSuite.
          </p>
          <DocTable
            headers={["Klaviyo Property", "BloomSuite Field"]}
            rows={[
              [
                <DocInlineCode key="k-email">email</DocInlineCode>,
                <DocInlineCode key="b-email">email</DocInlineCode>,
              ],
              [
                <DocInlineCode key="k-first">first_name</DocInlineCode>,
                <DocInlineCode key="b-first">first_name</DocInlineCode>,
              ],
              [
                <DocInlineCode key="k-last">last_name</DocInlineCode>,
                <DocInlineCode key="b-last">last_name</DocInlineCode>,
              ],
              [
                <DocInlineCode key="k-phone">phone_number</DocInlineCode>,
                <DocInlineCode key="b-phone">phone</DocInlineCode>,
              ],
              [
                <DocInlineCode key="k-org">organisation</DocInlineCode>,
                <DocInlineCode key="b-company">company</DocInlineCode>,
              ],
              [
                <DocInlineCode key="k-consent">$consent</DocInlineCode>,
                <DocInlineCode key="b-consent">consent_status</DocInlineCode>,
              ],
            ]}
          />
        </div>
      ),
    },
    {
      id: "step-4-import-monitor",
      title: "Step 4: Import & Monitor",
      group: "Import Process",
      content: (
        <div className={proseClassName}>
          <p>
            Start the import from the migration wizard using the existing{" "}
            <DocInlineCode>Start Import</DocInlineCode> action. The current UI
            supports background processing and real-time progress updates while
            the Klaviyo import job runs.
          </p>
        </div>
      ),
    },
    {
      id: "after-import",
      title: "After Import",
      group: "Import Process",
      content: (
        <div className={proseClassName}>
          <p>
            After the import completes, verify profile counts, list-derived
            groupings, consent state, and any high-value custom properties you
            expected to preserve from Klaviyo.
          </p>
        </div>
      ),
    },
    {
      id: "profile-fields",
      title: "Profile Fields",
      group: "What Gets Imported",
      content: (
        <DocTable
          headers={["Klaviyo Data", "Imported", "Notes"]}
          rows={[
            ["Email address", "Yes", "Primary identifier"],
            ["First and last name", "Yes", ""],
            ["Phone number", "Yes", ""],
            ["Organisation", "Yes", "Mapped where useful"],
            ["Consent status", "Yes", "Preserved as contact state"],
            [
              "Suppression status",
              "Yes",
              "Restrictive states should remain restrictive",
            ],
            ["Custom properties", "Yes", "Review during field mapping"],
          ]}
        />
      ),
    },
    {
      id: "lists-segments",
      title: "Lists & Segments",
      group: "What Gets Imported",
      content: (
        <div className={proseClassName}>
          <p>
            Klaviyo lists and segments are part of the migration surface, but
            segments should be understood as membership snapshots at the moment
            of import. BloomSuite does not recreate Klaviyo&apos;s original
            dynamic rule definitions as a live synced asset.
          </p>
        </div>
      ),
    },
    {
      id: "consent-status",
      title: "Consent Status",
      group: "What Gets Imported",
      content: (
        <div className={proseClassName}>
          <p>
            Preserve email and other available consent indicators during import,
            and treat restrictive or suppressed Klaviyo states as the safer
            output when mapping to BloomSuite campaign eligibility.
          </p>
        </div>
      ),
    },
    {
      id: "what-does-not-import",
      title: "What Does NOT Import",
      group: "What Gets Imported",
      content: (
        <DocTable
          headers={["Klaviyo Data", "Why not imported"]}
          rows={[
            [
              "Flow automation history",
              "Klaviyo automation context does not transfer directly into BloomSuite",
            ],
            [
              "Campaign send history",
              "Per-profile campaign context is outside the core contact-import path",
            ],
            [
              "Predictive analytics",
              "Provider-specific model output is not portable CRM identity data",
            ],
            [
              "SMS message history",
              "Message history is not part of the documented contact migration surface",
            ],
            [
              "A/B test results",
              "Campaign-level reporting is outside the import scope",
            ],
          ]}
        />
      ),
    },
    {
      id: "api-key-issues",
      title: "API Key Issues",
      group: "Troubleshooting",
      content: (
        <div className={proseClassName}>
          <p>
            If your deployment uses provider credentials behind the current
            Klaviyo connection flow, treat validation failures as credential or
            provider-access issues first. In the current app, the import path
            already runs a Klaviyo validation step before the import starts.
          </p>
        </div>
      ),
    },
    {
      id: "import-errors",
      title: "Import Errors",
      group: "Troubleshooting",
      content: (
        <div className={proseClassName}>
          <p>
            Use the import progress screen and latest import summary to confirm
            whether the job failed during validation, fetch, mapping, or record
            creation.
          </p>
        </div>
      ),
    },
    {
      id: "missing-profiles",
      title: "Missing Profiles",
      group: "Troubleshooting",
      content: (
        <div className={proseClassName}>
          <p>
            Missing profiles usually trace back to import scope, segment
            selection, or deduplication decisions rather than to live sync,
            because Klaviyo is not connected as a continuous synchronization
            provider.
          </p>
        </div>
      ),
    },
    {
      id: "field-mapping-reference",
      title: "Field Mapping Reference",
      group: "Reference",
      content: (
        <DocTable
          headers={["Klaviyo Property Key", "Description", "BloomSuite Field"]}
          rows={[
            [
              <DocInlineCode key="r-email">email</DocInlineCode>,
              "Email address",
              <DocInlineCode key="rf-email">email</DocInlineCode>,
            ],
            [
              <DocInlineCode key="r-first">first_name</DocInlineCode>,
              "First name",
              <DocInlineCode key="rf-first">first_name</DocInlineCode>,
            ],
            [
              <DocInlineCode key="r-last">last_name</DocInlineCode>,
              "Last name",
              <DocInlineCode key="rf-last">last_name</DocInlineCode>,
            ],
            [
              <DocInlineCode key="r-phone">phone_number</DocInlineCode>,
              "Phone",
              <DocInlineCode key="rf-phone">phone</DocInlineCode>,
            ],
            [
              <DocInlineCode key="r-org">organisation</DocInlineCode>,
              "Company name",
              <DocInlineCode key="rf-company">company</DocInlineCode>,
            ],
            [
              <DocInlineCode key="r-city">location.city</DocInlineCode>,
              "City",
              "Custom field",
            ],
            [
              <DocInlineCode key="r-country">location.country</DocInlineCode>,
              "Country",
              "Custom field",
            ],
          ]}
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
              Can I import Klaviyo lists and segments more than once?
            </h3>
            <p>
              Yes. The current model is periodic import, not live sync, so
              repeat imports are expected when you need a refresh.
            </p>
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Does importing from Klaviyo affect the Klaviyo account?
            </h3>
            <p>No. The migration path is read-only from BloomSuite.</p>
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              What happens if I import the same Klaviyo list twice?
            </h3>
            <p>
              BloomSuite should update matching contacts rather than treating a
              repeat import as a live-sync stream that creates a fresh CRM copy
              each time.
            </p>
          </div>
        </div>
      ),
    },
  ],
};
