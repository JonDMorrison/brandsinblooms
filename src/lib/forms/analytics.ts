import {
  AnalyticsTracker,
  type AnalyticsEvent,
} from "@/lib/analytics/AnalyticsTracker";

type FormAnalyticsEventType = Extract<
  AnalyticsEvent["event_type"],
  | "form_share_opened"
  | "form_share_method_selected"
  | "form_share_copy"
  | "form_docs_toc_selected"
  | "form_docs_markdown_copied"
>;

export function trackFormBuilderAnalyticsEvent(
  eventType: FormAnalyticsEventType,
  payload: Record<string, unknown>,
) {
  void AnalyticsTracker.trackEvent({
    event_type: eventType,
    payload: {
      ...payload,
      timestamp: new Date().toISOString(),
    },
  });
}
