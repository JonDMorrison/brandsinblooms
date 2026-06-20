import { useCallback, useEffect } from "react";

/**
 * Jira Issue Collector — internal "Send feedback" → Jira from inside the CRM.
 *
 * Adapted from the Atlassian-generated embed for collector `3b0701b8`, made
 * fully jQuery-free. The CRM ships no global jQuery, so the lightweight
 * `issuecollector-embededjs` bootstrap cannot be used: that build is invoked as
 * `!function($){…}(jQuery)` and would throw `jQuery is not defined`. We instead
 * load the self-contained *standard* `issuecollector` build for the SAME
 * collector, which bundles its own (Atlassian-patched) jQuery and honours
 * `window.ATL_JQ_PAGE_PROPS.triggerFunction`.
 *
 * Behaviour mirrors the original snippet without jQuery:
 *  1. Set `window.ATL_JQ_PAGE_PROPS` BEFORE the script loads. The collector reads
 *     it on load and, because we supply a custom `triggerFunction`, renders no
 *     default feedback tab of its own.
 *  2. Inject the collector `<script>` once (id-guarded) via the DOM — this
 *     replaces the snippet's `jQuery.ajax({ dataType: "script" })` loader.
 *  3. Inside `triggerFunction`, capture the collector's dialog opener.
 *  4. The Joy button's React `onClick` calls the captured opener.
 *
 * IMPORTANT — why `triggerFunction` is an arrow that only touches globals:
 * the standard collector consumes the trigger via `eval("(" + triggerFunction + ")")`,
 * i.e. it stringifies our function and re-evaluates it in its own scope. So the
 * body cannot reference any module/closure variable (only globals survive), and
 * the source must stringify to a valid standalone expression. An arrow satisfies
 * both: esbuild can rewrite `{ fn: function(){} }` into method-shorthand
 * `{ fn(){} }` (which `eval("(fn(){})")` would reject), but it never converts an
 * arrow into a method. The opener is therefore stashed on `window`, not a ref.
 */

const COLLECTOR_ID = "3b0701b8";
const COLLECTOR_SCRIPT_ID = `jira-issue-collector-${COLLECTOR_ID}`;

// Self-contained STANDARD build (bundles its own jQuery) for collector 3b0701b8.
// Public, non-secret Atlassian embed asset — no tokens or tenant/user data.
const COLLECTOR_SCRIPT_URL =
  "https://bloomsuite.atlassian.net/s/d41d8cd98f00b204e9800998ecf8427e-T/kq7re0/b/1/b0105d975e9e59f24a3230a22972a71a/_/download/batch/com.atlassian.jira.collector.plugin.jira-issue-collector-plugin:issuecollector/com.atlassian.jira.collector.plugin.jira-issue-collector-plugin:issuecollector.js?locale=en-US&collectorId=3b0701b8";

interface AtlassianIssueCollectorPageProps {
  triggerFunction: (showCollectorDialog: () => void) => void;
}

declare global {
  interface Window {
    ATL_JQ_PAGE_PROPS?: AtlassianIssueCollectorPageProps;
    /** Dialog opener handed back by the collector via `triggerFunction`. */
    showJiraFeedbackCollector?: () => void;
  }
}

/**
 * Sets the page props and injects the collector script exactly once. Safe to
 * call on every mount / route change — the id guard makes repeat calls no-ops,
 * and the captured opener lives on `window`, so it survives shell remounts.
 */
function ensureIssueCollectorLoaded(): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  if (document.getElementById(COLLECTOR_SCRIPT_ID)) {
    return;
  }

  // 1. Props MUST be assigned before the script runs (the collector reads them
  //    on load). Body may only reference globals — see the file header note.
  window.ATL_JQ_PAGE_PROPS = {
    triggerFunction: (showCollectorDialog) => {
      window.showJiraFeedbackCollector = showCollectorDialog;
    },
  };

  // 2. Plain DOM script injection (replaces the snippet's jQuery.ajax loader).
  const script = document.createElement("script");
  script.id = COLLECTOR_SCRIPT_ID;
  script.src = COLLECTOR_SCRIPT_URL;
  script.async = true;
  document.head.appendChild(script);
}

/**
 * Loads the Jira Issue Collector once (on mount) and returns a stable opener for
 * the feedback button. Intended for use inside the authenticated dashboard shell
 * so the collector never initialises on public / unauthenticated screens.
 */
export function useJiraIssueCollector(): { openFeedback: () => void } {
  useEffect(() => {
    ensureIssueCollectorLoaded();
  }, []);

  const openFeedback = useCallback(() => {
    window.showJiraFeedbackCollector?.();
  }, []);

  return { openFeedback };
}
