import type { ReactNode } from "react";

import { DocCallout } from "@/components/docs/DocCallout";
import { DocCodeBlock } from "@/components/docs/DocCodeBlock";
import { DocInlineCode } from "@/components/docs/DocInlineCode";
import { DocStep } from "@/components/docs/DocStep";
import type { DocContent } from "@/components/docs/types";
import { getIntegrationSeed } from "@/components/integrations/integrationsHubConfig";

const metaSeed = getIntegrationSeed("meta");

if (!metaSeed) {
  throw new Error("Meta integration seed is missing.");
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

const metaScopeBlock = [
  "pages_read_engagement",
  "pages_show_list",
  "pages_manage_posts",
  "instagram_basic",
  "instagram_content_publish",
  "instagram_manage_insights",
].join("\n");

export const metaDocumentation: DocContent = {
  integrationName: metaSeed.name,
  integrationSlug: metaSeed.slug,
  category: metaSeed.categoryLabel,
  pageTitle: "Meta Integration Guide",
  overview:
    "Connect Meta once to authorize Facebook Pages and Instagram Business accounts inside BloomSuite. The current implementation uses a shared Meta authorization flow, exposes connected assets on the integration detail page, supports Facebook and Instagram publishing operations, and syncs a focused set of Meta analytics signals for reporting and follow-up workflows.",
  readingTimeMinutes: 12,
  lastUpdated: "2026-03-23",
  branding: {
    icon: metaSeed.icon,
  },
  sections: [
    {
      id: "overview",
      title: "Overview",
      group: "Getting Started",
      content: (
        <div className={proseClassName}>
          <p>
            BloomSuite treats Meta as one provider connection that can expose
            both Facebook Pages and Instagram Business accounts. In the current
            app, the Meta detail page is the operational source of truth after
            setup, with separate panels for <strong>Meta Authorization</strong>,{" "}
            <strong>Facebook Pages</strong>, <strong>Instagram Accounts</strong>
            , and <strong>Publishing &amp; Analytics Capabilities</strong>.
          </p>
          <p>
            That shared connection is used in two runtime paths today. The
            publishing worker posts to Facebook Pages and Instagram accounts,
            while the analytics sync job pulls a smaller set of Facebook and
            Instagram insight metrics into BloomSuite&apos;s analytics storage.
          </p>
          <DocCallout title="Current implementation scope">
            The Meta integration is already wired for authorization, connected
            asset visibility, publishing operations, asset refresh, and a small
            insights sync. It is not documented here as a general-purpose Meta
            Business Manager admin surface.
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
                title: "Meta access with the correct business context",
                body: (
                  <p>
                    Use a Meta login that actually has access to the Facebook
                    Pages and Instagram Business accounts you expect to manage.
                    Authorization succeeds at the provider level first, then
                    BloomSuite can only work with assets that Meta exposes for
                    that operator.
                  </p>
                ),
              },
              {
                title: "BloomSuite access to the integrations area",
                body: (
                  <p>
                    The person completing setup should be able to open the Meta
                    integration page, review the connected asset panels after
                    OAuth, and use actions such as reauthorization or asset
                    refresh if the expected pages do not appear.
                  </p>
                ),
              },
              {
                title: "Media-ready workflow for Instagram publishing",
                body: (
                  <p>
                    The current publishing worker requires media for Instagram
                    publishing. Treat text-only publishing expectations as a
                    Facebook-only path unless your workflow includes valid image
                    or video assets.
                  </p>
                ),
              },
            ]}
          />
          <DocCallout
            variant="warning"
            title="Asset access matters more than login success"
          >
            A successful Meta OAuth callback does not guarantee the correct
            Facebook Page or Instagram account is available in BloomSuite.
            Always review the connected asset lists before assuming publishing
            or analytics coverage is complete.
          </DocCallout>
        </div>
      ),
    },
    {
      id: "connecting-your-meta-account",
      title: "Connecting Your Meta Account",
      group: "Connection Setup",
      content: (
        <div className="space-y-6">
          <StepList
            steps={[
              {
                title: "Open the Meta integration page",
                body: (
                  <p>
                    Start from the Integrations hub and open Meta. Use the
                    integration detail page as the before-and-after check for
                    setup because it reflects the current authorization state,
                    connected assets, and available actions.
                  </p>
                ),
              },
              {
                title: "Launch authorization from BloomSuite",
                body: (
                  <p>
                    Use <DocInlineCode>Authorize Meta</DocInlineCode> or{" "}
                    <DocInlineCode>Re-authorize Meta</DocInlineCode> to start
                    the provider-managed OAuth flow. BloomSuite does not ask you
                    to paste a Graph API token manually in the current UI.
                  </p>
                ),
              },
              {
                title: "Review the current requested scopes",
                body: (
                  <div className="space-y-4">
                    <p>
                      The current hook-backed Meta flow requests the following
                      scopes:
                    </p>
                    <DocCodeBlock
                      language="text"
                      code={metaScopeBlock}
                      ariaLabel="Meta OAuth scopes"
                    />
                  </div>
                ),
              },
              {
                title: "Return to BloomSuite and confirm assets",
                body: (
                  <p>
                    After Meta redirects back, confirm the detail page now shows
                    the expected authorization state plus the Facebook Pages and
                    Instagram accounts you intend to use. If the list looks
                    wrong or incomplete, use{" "}
                    <DocInlineCode>Refresh asset list</DocInlineCode> before
                    assuming the connection failed.
                  </p>
                ),
              },
            ]}
          />
        </div>
      ),
    },
    {
      id: "permissions-and-connected-assets",
      title: "Permissions and Connected Assets",
      group: "Permissions & Access",
      content: (
        <div className={proseClassName}>
          <p>
            Meta authorization and channel visibility are related but not the
            same thing. BloomSuite can show a connected Meta authorization while
            still exposing fewer assets than expected if the operator account is
            missing Page access, if the Instagram account is not linked in the
            expected business context, or if the original OAuth approval did not
            grant the intended coverage.
          </p>
          <p>
            The current detail page surfaces platform-specific asset counts,
            connected platform labels, and a summary line that describes the
            assets BloomSuite can see right now. That is the field support
            should trust when triaging missing Facebook or Instagram surfaces.
          </p>
          <DocCallout title="Operational actions">
            Use <DocInlineCode>Refresh asset list</DocInlineCode> when the
            account should already be authorized but the visible pages or
            profiles are stale. Use{" "}
            <DocInlineCode>Re-authorize Meta</DocInlineCode> when the approval
            is expired or tied to the wrong Meta context.
          </DocCallout>
        </div>
      ),
    },
    {
      id: "publishing-and-analytics-coverage",
      title: "Publishing and Analytics Coverage",
      group: "Permissions & Access",
      content: (
        <div className={proseClassName}>
          <p>
            Meta publishing is already wired into the current queue worker. For
            Facebook, BloomSuite posts to the Page feed. For Instagram,
            BloomSuite creates a media container and publishes it through the
            Instagram API path. The code path currently supports Instagram feed
            and reel publishing when valid media is present.
          </p>
          <p>
            BloomSuite also syncs a limited set of analytics metrics through the
            Meta analytics job. The current Facebook metrics are{" "}
            <DocInlineCode>page_impressions</DocInlineCode>,{" "}
            <DocInlineCode>page_reach</DocInlineCode>, and{" "}
            <DocInlineCode>page_engaged_users</DocInlineCode>. The current
            Instagram metrics are <DocInlineCode>impressions</DocInlineCode>,{" "}
            <DocInlineCode>reach</DocInlineCode>, and{" "}
            <DocInlineCode>profile_views</DocInlineCode>.
          </p>
          <DocCallout variant="warning" title="Instagram requires media">
            The current Instagram publish path is media-driven. If a campaign
            has no valid media asset, treat Instagram as not ready to publish
            even if the Meta authorization itself is healthy.
          </DocCallout>
          <DocCallout title="Use publishing logs for operational review">
            The Meta detail page links to{" "}
            <DocInlineCode>View publishing logs</DocInlineCode>
            so operators can inspect recent posting attempts without re-running
            authorization.
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
              Authorized, but no pages or profiles appear
            </h3>
            <p>
              Start with <DocInlineCode>Refresh asset list</DocInlineCode>. If
              the asset count is still wrong, re-run authorization with the
              correct Meta operator account and confirm that the intended
              Facebook Page or Instagram Business account is actually available
              in that business context.
            </p>
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Publishing works for Facebook but not Instagram
            </h3>
            <p>
              Check the content payload first. The current Instagram path
              expects media and does not behave like a text-only Facebook Page
              post. After that, confirm the Instagram account is present in the
              connected asset list and still covered by the active
              authorization.
            </p>
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Authorization shows expired
            </h3>
            <p>
              Use <DocInlineCode>Re-authorize Meta</DocInlineCode> from the
              detail page, then review the authorization panel and asset counts
              again before resuming publishing or analytics troubleshooting.
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
              Does Meta connect Facebook and Instagram separately?
            </h3>
            <p>
              Not in the current BloomSuite implementation. Meta is presented as
              one shared authorization flow that can expose Facebook Pages and
              Instagram Business accounts under the same provider connection.
            </p>
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Can BloomSuite publish Instagram text-only posts?
            </h3>
            <p>
              The current Instagram publish path is media-based. Plan Instagram
              publishing around valid image or video assets instead of assuming
              a Facebook-style text-only path.
            </p>
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Which analytics does BloomSuite currently sync from Meta?
            </h3>
            <p>
              Today the sync job covers a focused set of Facebook and Instagram
              insight metrics rather than the full Meta analytics surface. Use
              the integration detail page and downstream analytics views as the
              current operational source of truth.
            </p>
          </div>
        </div>
      ),
    },
  ],
};
