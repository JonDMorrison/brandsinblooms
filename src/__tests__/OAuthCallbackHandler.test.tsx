import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { OAuthCallbackHandler } from "@/components/migrations/OAuthCallbackHandler";

describe("OAuthCallbackHandler server-redirect flow", () => {
  const openerPostMessage = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    openerPostMessage.mockReset();

    Object.defineProperty(window, "opener", {
      configurable: true,
      value: {
        closed: false,
        postMessage: openerPostMessage,
      },
    });

    vi.spyOn(window, "close").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("posts Mailchimp OAuth results back to the opener using the current origin", async () => {
    render(
      <MemoryRouter
        initialEntries={[
          "/oauth/callback?provider=mailchimp&status=success&message=Connected%20successfully",
        ]}
      >
        <Routes>
          <Route path="/oauth/callback" element={<OAuthCallbackHandler />} />
        </Routes>
      </MemoryRouter>,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(openerPostMessage).toHaveBeenCalledTimes(1);

    const [payload, targetOrigin] = openerPostMessage.mock.calls[0];
    expect(payload).toMatchObject({
      type: "oauth-success",
      provider: "mailchimp",
      message: "Connected successfully",
    });
    expect(targetOrigin).toBe(window.location.origin);
  });
});
