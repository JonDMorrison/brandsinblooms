export const HOMEPAGE_ANALYTICS_CONSENT_STORAGE_KEY =
  "bloomsuite.analyticsConsent";

export type HomepageTelemetryEventType =
  | "page_view"
  | "section_view"
  | "cta_click";

export interface HomepageTelemetryPayload {
  section?: string;
  label?: string;
  href?: string;
  source?: string;
}

export interface HomepageTelemetryEvent extends HomepageTelemetryPayload {
  event: `homepage_${HomepageTelemetryEventType}`;
  timestamp: string;
}

declare global {
  interface Window {
    dataLayer?: HomepageTelemetryEvent[];
    __BLOOMSUITE_ANALYTICS_CONSENT__?: "granted" | "denied";
  }
}

const getStoredConsent = () => {
  try {
    return window.localStorage.getItem(HOMEPAGE_ANALYTICS_CONSENT_STORAGE_KEY);
  } catch {
    return null;
  }
};

export const isHomepageAnalyticsConsentGranted = () => {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.__BLOOMSUITE_ANALYTICS_CONSENT__ === "granted" ||
    getStoredConsent() === "granted"
  );
};

export const trackHomepageEvent = (
  eventType: HomepageTelemetryEventType,
  payload: HomepageTelemetryPayload = {},
) => {
  if (!isHomepageAnalyticsConsentGranted()) {
    return false;
  }

  const event: HomepageTelemetryEvent = {
    event: `homepage_${eventType}`,
    timestamp: new Date().toISOString(),
    ...payload,
  };

  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push(event);
  window.dispatchEvent(
    new CustomEvent("bloomsuite:homepage-analytics", { detail: event }),
  );

  return true;
};
