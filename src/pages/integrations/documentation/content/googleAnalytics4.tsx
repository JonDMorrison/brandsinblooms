import type { ReactNode } from "react";

import { DocCallout } from "@/components/docs/DocCallout";
import { DocCodeBlock } from "@/components/docs/DocCodeBlock";
import { DocInlineCode } from "@/components/docs/DocInlineCode";
import { DocStep } from "@/components/docs/DocStep";
import type { DocContent } from "@/components/docs/types";
import { getIntegrationSeed } from "@/components/integrations/integrationsHubConfig";

const ga4Seed = getIntegrationSeed("google-analytics-4");

if (!ga4Seed) {
  throw new Error("Google Analytics 4 integration seed is missing.");
}

const proseClassName = "space-y-4 text-[15px] leading-7 text-muted-foreground";

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

const ga4ScopeBlock = "https://www.googleapis.com/auth/analytics.readonly";

export const googleAnalytics4Documentation: DocContent = {
  integrationName: ga4Seed.name,
  integrationSlug: ga4Seed.slug,
  category: ga4Seed.categoryLabel,
  pageTitle: "Google Analytics 4 Integration Guide",
  overview:
    "Connect a Google Analytics 4 property to BloomSuite to power the current website analytics surface. The shipped implementation is property-driven, stores connection state in Google Analytics settings, exposes connection actions from the GA4 integration detail page, and feeds the Website Analytics card with overview, daily traffic, country, and device breakdown data.",
  readingTimeMinutes: 11,
  lastUpdated: "2026-03-23",
  branding: {
    icon: ga4Seed.icon,
  },
  sections: [
    {
      id: "overview",
      title: "Overview",
      group: "Getting Started",
      content: (
        <div className={proseClassName}>
          <p>
            Google Analytics 4 is BloomSuite&apos;s current website analytics
            integration. In the live app, the GA4 detail page exposes property
            status, reporting capabilities, and connection actions, while the
            Website Analytics view uses that connection to request traffic and
            engagement data for the selected date range.
          </p>
          <p>
            The frontend is already wired to show total users, page views,
            sessions, top countries, device types, and a daily traffic chart.
            Those metrics are requested through the GA4 report function using a
            property-level connection rather than a generic analytics account
            connection.
          </p>
          <DocCallout title="Current scope of the integration">
            This guide documents the GA4 connection that exists today: property
            setup, connection management, and BloomSuite&apos;s website
            analytics reporting surface. It does not describe a broader Google
            Marketing Platform integration.
          </DocCallout>
        </div>
      ),
    },
    {
      id: "prerequisites",
      title: "Prerequisites",
      group: "Getting Started",
      content: (
        <div className="space-y-6">
          <StepList
            steps={[
              {
                title: "Access to the correct GA4 property",
                body: (
                  <p>
                    The current OAuth start path requires a specific
                    <DocInlineCode>propertyId</DocInlineCode>. Confirm the exact
                    GA4 property you intend to connect before starting setup,
                    because the most common failure mode is authorizing the
                    wrong property rather than breaking the connection itself.
                  </p>
                ),
              },
              {
                title:
                  "BloomSuite access to the Website and Integrations areas",
                body: (
                  <p>
                    The operator should be able to open the GA4 integration page
                    and the Website Analytics surface so they can confirm both
                    connection state and downstream reporting behavior after the
                    OAuth flow completes.
                  </p>
                ),
              },
              {
                title: "Expectation alignment on current reporting maturity",
                body: (
                  <p>
                    BloomSuite already exposes a reporting dashboard path and a
                    test connection action, but the current report edge function
                    still contains a fallback response path. Treat GA4 as an
                    active integration surface with an implementation caveat,
                    not as a finished attribution warehouse.
                  </p>
                ),
              },
            ]}
          />
        </div>
      ),
    },
    {
      id: "connecting-google-analytics-4",
      title: "Connecting Google Analytics 4",
      group: "Connection Setup",
      content: (
        <div className="space-y-6">
          <StepList
            steps={[
              {
                title: "Open the GA4 integration page",
                body: (
                  <p>
                    Start from the Integrations hub and open Google Analytics 4.
                    The integration detail page is the best place to verify the
                    connection because it shows{" "}
                    <strong>Property Details</strong>,{" "}
                    <strong>Reporting Capabilities</strong>, and connection
                    actions in one place.
                  </p>
                ),
              },
              {
                title: "Provide the property context before OAuth",
                body: (
                  <p>
                    The current OAuth initiation path requires BloomSuite to
                    send a specific <DocInlineCode>propertyId</DocInlineCode>{" "}
                    when starting authorization. In the implementation, that
                    property value is embedded into the OAuth state and stored
                    in the Google Analytics settings record.
                  </p>
                ),
              },
              {
                title: "Approve the current Google Analytics scope",
                body: (
                  <div className="space-y-4">
                    <p>
                      The GA4 authorization flow currently requests this
                      read-only scope:
                    </p>
                    <DocCodeBlock
                      language="text"
                      code={ga4ScopeBlock}
                      ariaLabel="Google Analytics OAuth scope"
                    />
                  </div>
                ),
              },
              {
                title: "Return to BloomSuite and verify connection actions",
                body: (
                  <p>
                    After Google redirects back, confirm the property label,
                    connection state, and the available actions. The current UI
                    exposes <DocInlineCode>Test Connection</DocInlineCode>,{" "}
                    <DocInlineCode>Re-authorize Google Analytics</DocInlineCode>
                    , and{" "}
                    <DocInlineCode>View Reporting Dashboard</DocInlineCode>.
                  </p>
                ),
              },
            ]}
          />
          <DocCallout
            variant="warning"
            title="Property ID accuracy is critical"
          >
            If the wrong property ID is used at authorization time, BloomSuite
            may look connected while still pointing at the wrong analytics data
            source. Validate the property before chasing reporting bugs.
          </DocCallout>
        </div>
      ),
    },
    {
      id: "data-and-reporting-surface",
      title: "Data and Reporting Surface",
      group: "Data & Reporting",
      content: (
        <div className={proseClassName}>
          <p>
            The current GA4 reporting path is designed to return overview
            metrics, daily traffic rows, top countries, and device breakdowns.
            The Website Analytics card already consumes that shape and renders
            totals for users, page views, sessions, country count, and a daily
            traffic chart for the active date range.
          </p>
          <p>
            On the integration detail page, BloomSuite also exposes connection
            metadata such as the property label, current connection status,
            service-account configuration flag, and the last test timestamp. Use
            that detail page when deciding whether an issue belongs to setup
            state or downstream reporting behavior.
          </p>
          <DocCallout title="Operational UI surfaces">
            In the current app, GA4 spans two operator surfaces: the integration
            detail page for connection management and the Website Analytics
            interface for metric review.
          </DocCallout>
        </div>
      ),
    },
    {
      id: "current-reporting-caveats",
      title: "Current Reporting Caveats",
      group: "Data & Reporting",
      content: (
        <div className={proseClassName}>
          <p>
            The current report edge function is wired for GA4-style output, but
            it still contains a mock-data fallback while token storage and
            retrieval are not fully completed in that path. That means the UI
            shape and reporting route are real, but production expectations for
            fully live analytics retrieval should remain cautious until that
            backend path is finished end to end.
          </p>
          <p>
            This matters most when users assume that a healthy connection alone
            proves live GA4 ingestion. In the current codebase, connection state
            and reporting maturity are related, but not identical.
          </p>
          <DocCallout
            variant="warning"
            title="Do not oversell live data readiness"
          >
            Use the current GA4 docs to explain what BloomSuite exposes today,
            not to promise a completed live-data pipeline that the current
            report function has not fully finished implementing.
          </DocCallout>
        </div>
      ),
    },
    {
      id: "common-issues",
      title: "Common Connection Issues",
      group: "Troubleshooting",
      content: (
        <div className="space-y-5 text-[15px] leading-7 text-muted-foreground">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              The connection exists, but reports look wrong
            </h3>
            <p>
              Verify the configured <DocInlineCode>propertyId</DocInlineCode>{" "}
              first, then run <DocInlineCode>Test Connection</DocInlineCode>. If
              the property is correct but the returned data still looks
              incomplete, treat the issue as a reporting-path investigation
              rather than immediately reauthorizing.
            </p>
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Reauthorization is required
            </h3>
            <p>
              Use <DocInlineCode>Re-authorize Google Analytics</DocInlineCode>
              from the detail page, then confirm the property label and updated
              connection status before returning to the dashboard.
            </p>
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              The Website Analytics card says setup is required
            </h3>
            <p>
              That state usually means no GA4 property is configured for the
              current user settings. Confirm the integration exists and that the
              property was saved successfully before debugging the report API.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "faq",
      title: "Frequently Asked Questions",
      group: "Troubleshooting",
      content: (
        <div className="space-y-5 text-[15px] leading-7 text-muted-foreground">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Does BloomSuite connect to a Google Analytics account or a
              property?
            </h3>
            <p>
              The current implementation is property-driven. The OAuth start
              path requires a <DocInlineCode>propertyId</DocInlineCode> and
              stores that property context in the Google Analytics settings
              record used by BloomSuite.
            </p>
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Which metrics does the current website analytics view use?
            </h3>
            <p>
              The frontend currently expects overview totals, daily traffic,
              top-country rows, and device breakdown data. Those are the metric
              categories this documentation treats as the active GA4 reporting
              surface.
            </p>
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Does a successful connection guarantee fully live GA4 reporting?
            </h3>
            <p>
              Not yet. The integration and UI are real, but the current report
              function still includes a fallback response path, so live-data
              expectations should stay conservative until that backend work is
              completed.
            </p>
          </div>
        </div>
      ),
    },
  ],
};
