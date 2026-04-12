import { describe, expect, it, vi } from "vitest";

import { handlePublicFormSubmission } from "./publicSubmission";

const publishedForm = {
  embedKey: "embed_123",
  fields: [
    {
      id: "email-field",
      type: "email",
      label: "Email Address",
      required: true,
      mapping_key: "email",
      step_index: 0,
    },
  ],
  id: "form_123",
  status: "published",
} as const;

describe("handlePublicFormSubmission", () => {
  it("normalizes flat request bodies and forwards metadata to the upstream submit function", async () => {
    const lookupForm = vi.fn().mockResolvedValue(publishedForm);
    const forwardSubmission = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          customer_id: "customer_123",
          message: "Thanks for signing up!",
          redirect_url: "https://example.com/thanks",
          suppressed: false,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    const response = await handlePublicFormSubmission(
      new Request("https://example.com/api/forms/form_123/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Referer: "https://example.com/landing",
          "User-Agent": "Vitest",
          "X-Forwarded-For": "203.0.113.10",
        },
        body: JSON.stringify({
          email: "customer@example.com",
          page_url: "https://example.com/landing",
          referrer: "https://google.com",
          source: "paid-social",
        }),
      }),
      "form_123",
      {
        lookupForm,
        forwardSubmission,
      },
    );

    expect(lookupForm).toHaveBeenCalledWith("form_123");
    expect(forwardSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        embedKey: "embed_123",
        data: {
          email: "customer@example.com",
        },
        meta: {
          page_url: "https://example.com/landing",
          referrer: "https://google.com",
          source: "paid-social",
          user_agent: "Vitest",
          utm_source: undefined,
          utm_medium: undefined,
          utm_campaign: undefined,
        },
        headers: expect.objectContaining({
          "x-forwarded-for": "203.0.113.10",
          "x-real-ip": "203.0.113.10",
          "cf-connecting-ip": "203.0.113.10",
          "user-agent": "Vitest",
        }),
      }),
    );

    expect(await response.json()).toEqual({
      success: true,
      message: "Thanks for signing up!",
      redirectUrl: "https://example.com/thanks",
      customerId: "customer_123",
      suppressed: false,
    });
  });

  it("maps validation failures back to the documented submission keys", async () => {
    const response = await handlePublicFormSubmission(
      new Request("https://example.com/api/forms/form_123/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          page_url: "https://example.com/landing",
        }),
      }),
      "form_123",
      {
        lookupForm: vi.fn().mockResolvedValue(publishedForm),
        forwardSubmission: vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              error: "Validation failed",
              details: ["Email Address is required"],
            }),
            {
              status: 400,
              headers: {
                "Content-Type": "application/json",
              },
            },
          ),
        ),
      },
    );

    expect(await response.json()).toEqual({
      success: false,
      error: "Validation failed",
      details: ["Email Address is required"],
      errors: {
        email: "Email Address is required",
      },
    });
  });
});
