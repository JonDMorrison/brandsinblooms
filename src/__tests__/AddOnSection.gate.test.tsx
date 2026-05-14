import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

type SubscriptionShape = {
  plan: string;
  stripe_subscription_item_id: string | null;
  crm_enabled?: boolean;
  sms_enabled?: boolean;
  max_posts_per_month?: number;
  max_connections?: number;
  end_date?: string;
  email_quota?: number;
  sms_quota?: number;
  email_usage?: number;
  sms_usage?: number;
};

const subscriptionState: { current: SubscriptionShape | null } = {
  current: null,
};

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({
    subscription: subscriptionState.current,
    loading: false,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

import { AddOnSection } from "@/components/billing/AddOnSection";

const setSubscription = (sub: SubscriptionShape | null) => {
  subscriptionState.current = sub;
};

describe("AddOnSection add-on gate (Bug 15 phase 1)", () => {
  afterEach(() => {
    setSubscription(null);
  });

  it("disables both toggles and shows the upgrade helper when plan is free_trial", () => {
    setSubscription({
      plan: "free_trial",
      stripe_subscription_item_id: null,
    });

    render(<AddOnSection />);

    expect(screen.getByTestId("addon-toggle-crm")).toHaveClass(
      "Mui-disabled",
    );
    expect(screen.getByTestId("addon-toggle-sms")).toHaveClass(
      "Mui-disabled",
    );

    const helpers = screen.getAllByText(/Add-ons available on paid plans/i);
    expect(helpers).toHaveLength(2);
  });

  it("disables both toggles and shows the contact-support helper when plan is paid but stripe_subscription_item_id is null", () => {
    setSubscription({
      plan: "bloom",
      stripe_subscription_item_id: null,
    });

    render(<AddOnSection />);

    expect(screen.getByTestId("addon-toggle-crm")).toHaveClass(
      "Mui-disabled",
    );
    expect(screen.getByTestId("addon-toggle-sms")).toHaveClass(
      "Mui-disabled",
    );

    const helpers = screen.getAllByText(/temporarily unavailable/i);
    expect(helpers).toHaveLength(2);
  });

  it("enables the toggles and renders no gate helper when plan is paid and stripe_subscription_item_id is present", () => {
    setSubscription({
      plan: "bloom",
      stripe_subscription_item_id: "si_test_123",
      crm_enabled: false,
      sms_enabled: false,
    });

    render(<AddOnSection />);

    expect(screen.getByTestId("addon-toggle-crm")).not.toHaveClass(
      "Mui-disabled",
    );
    expect(screen.getByTestId("addon-toggle-sms")).not.toHaveClass(
      "Mui-disabled",
    );
    expect(screen.queryByTestId("addon-gate-helper-crm")).toBeNull();
    expect(screen.queryByTestId("addon-gate-helper-sms")).toBeNull();
  });

  it("treats expired and free plans the same as free_trial — both gated to upgrade", () => {
    setSubscription({
      plan: "expired",
      stripe_subscription_item_id: "si_test_456",
    });

    render(<AddOnSection />);

    expect(screen.getByTestId("addon-toggle-crm")).toHaveClass(
      "Mui-disabled",
    );
    expect(screen.getByTestId("addon-toggle-sms")).toHaveClass(
      "Mui-disabled",
    );
    expect(
      screen.getAllByText(/Add-ons available on paid plans/i),
    ).toHaveLength(2);
  });
});
