import { Fragment } from "react";

import { DocCallout } from "@/components/docs/DocCallout";
import { DocCodeBlock } from "@/components/docs/DocCodeBlock";
import { DocFieldTable } from "@/components/docs/DocFieldTable";
import { DocInlineCode } from "@/components/docs/DocInlineCode";
import { DocStep } from "@/components/docs/DocStep";
import type { DocContent, DocField } from "@/components/docs/types";
import { getIntegrationSeed } from "@/components/integrations/integrationsHubConfig";

interface StepDefinition {
  title: string;
  body: string;
}

interface ProviderDocConfig {
  integrationSlug: string;
  overview: string;
  readingTimeMinutes: number;
  lastUpdated: string;
  fields: DocField[];
  setupSteps: StepDefinition[];
  syncNotes: string[];
  warning: string;
  tip: string;
  criticalNote?: string;
  logoSrc?: string;
}

export function buildProviderDocContent(config: ProviderDocConfig): DocContent {
  const seed = getIntegrationSeed(config.integrationSlug);

  if (!seed) {
    throw new Error(`Unknown integration slug: ${config.integrationSlug}`);
  }

  return {
    integrationName: seed.name,
    integrationSlug: seed.slug,
    category: seed.categoryLabel,
    pageTitle: `${seed.name} Integration Guide`,
    overview: config.overview,
    readingTimeMinutes: config.readingTimeMinutes,
    lastUpdated: config.lastUpdated,
    branding: {
      icon: seed.icon,
      logoSrc: config.logoSrc,
      logoAlt: `${seed.name} logo`,
    },
    sections: [
      {
        id: "before-you-begin",
        title: "Before You Begin",
        group: "Overview",
        content: (
          <div className="space-y-4 text-[15px] leading-7 text-muted-foreground">
            <p>
              This baseline documentation page establishes the shared BloomSuite
              documentation shell for {seed.name}. Provider-specific field
              mapping, event matrices, and edge-case behaviors will slot into
              these sections in the next documentation milestones without
              changing layout or navigation.
            </p>
            <DocCallout title="Static documentation only">
              This route renders from hardcoded TypeScript content. It does not
              fetch tenant data, provider credentials, or connection state.
              Sensitive values such as merchant IDs, access tokens, and account
              secrets should never be surfaced here.
            </DocCallout>
            <DocCallout variant="success" title="Recommended operator access">
              Complete setup using an account that can manage both BloomSuite
              and {seed.name}. In most environments that means an admin or
              owner-level role with authority to review scopes, approve
              callbacks, and validate sync readiness.
            </DocCallout>
          </div>
        ),
      },
      {
        id: "connect-and-configure",
        title: "Connect and Configure",
        group: "Setup",
        content: (
          <div className="space-y-6">
            <div className="space-y-0">
              {config.setupSteps.map((step, index) => (
                <DocStep
                  key={step.title}
                  stepNumber={index + 1}
                  stepTitle={step.title}
                  isLast={index === config.setupSteps.length - 1}
                >
                  <p>{step.body}</p>
                </DocStep>
              ))}
            </div>
            <DocCallout variant="warning" title="Configuration depth">
              {config.warning}
            </DocCallout>
          </div>
        ),
      },
      {
        id: "credential-reference",
        title: "Credential Reference",
        group: "Reference",
        content: (
          <div className="space-y-4">
            <p className="text-[15px] leading-7 text-muted-foreground">
              Treat the following values as the minimum contract for onboarding
              and operational review. Any value that resembles a token,
              callback, or environment-specific identifier should be captured
              and verified through a secure operator flow rather than embedded
              into public-facing documentation.
            </p>
            <DocFieldTable fields={config.fields} />
          </div>
        ),
      },
      {
        id: "sync-behavior",
        title: "Sync Behavior",
        group: "Reference",
        content: (
          <div className="space-y-4">
            <p className="text-[15px] leading-7 text-muted-foreground">
              BloomSuite should treat {seed.name} as an external system of
              record. Use documented field ownership and retry semantics before
              enabling any workflow that mutates CRM state from upstream
              changes.
            </p>
            <DocCodeBlock
              language="text"
              code={[
                `integration: ${seed.slug}`,
                `category: ${seed.categoryLabel}`,
                "documentation_mode: static",
                "auth_surface: internal app route",
              ].join("\n")}
              ariaLabel={`${seed.name} configuration summary`}
            />
            <div className="space-y-2 text-sm leading-7 text-muted-foreground">
              {config.syncNotes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </div>
            <DocCallout variant="success" title="Operator tip">
              {config.tip}
            </DocCallout>
          </div>
        ),
      },
      {
        id: "troubleshooting",
        title: "Troubleshooting",
        group: "Operations",
        content: (
          <div className="space-y-4 text-[15px] leading-7 text-muted-foreground">
            <p>
              If setup appears stalled, first confirm that the integration
              detail page at{" "}
              <DocInlineCode>{`/integrations/${seed.slug}`}</DocInlineCode>{" "}
              still reflects the expected provider and environment. This
              documentation route is intentionally static and should not be used
              as a live health indicator.
            </p>
            {config.criticalNote ? (
              <DocCallout variant="danger" title="Escalate when this appears">
                {config.criticalNote}
              </DocCallout>
            ) : null}
            <DocCallout title="Support handoff">
              When escalating, capture the integration slug, the exact setup
              step that failed, and whether the issue occurred during
              authorization, callback, sync verification, or post-connect
              validation.
            </DocCallout>
          </div>
        ),
      },
    ],
  };
}

export function createCredentialFields(providerLabel: string): DocField[] {
  return [
    {
      name: "client_id",
      description: (
        <Fragment>
          The application identifier BloomSuite uses when initiating the{" "}
          {providerLabel} connection flow.
        </Fragment>
      ),
      required: true,
    },
    {
      name: "client_secret",
      description: (
        <Fragment>
          A confidential value used server-side to complete token exchange and
          provider verification.
        </Fragment>
      ),
      required: true,
    },
    {
      name: "redirect_uri",
      description: (
        <Fragment>
          The approved callback location that returns operators to BloomSuite
          after the provider authorizes access.
        </Fragment>
      ),
      required: true,
    },
    {
      name: "environment",
      description: (
        <Fragment>
          The target provider environment such as production or sandbox, where
          supported.
        </Fragment>
      ),
      required: false,
    },
  ];
}
