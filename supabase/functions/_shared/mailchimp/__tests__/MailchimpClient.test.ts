import { assertEquals, assertRejects } from "@std/assert";

import {
  MailchimpClient,
  MailchimpRequestError,
  MailchimpTimeoutError,
} from "../MailchimpClient.ts";
import type { MailchimpConnectionCredentials } from "../types.ts";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

function buildConnection(
  metadata: MailchimpConnectionCredentials["metadata"],
): MailchimpConnectionCredentials {
  return {
    encrypted_access_token: "encrypted-token",
    metadata,
  };
}

Deno.test(
  "MailchimpClient.fromConnection derives data center from metadata.dc",
  async () => {
    const urls: string[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL | Request) => {
      urls.push(String(input));
      return jsonResponse({ health_status: "Everything's Chimpy!" });
    }) as typeof fetch;

    try {
      const client = await MailchimpClient.fromConnection(
        buildConnection({ dc: "us19" }),
        async () => "decrypted-token",
      );

      await client.ping();
      assertEquals(urls[0], "https://us19.api.mailchimp.com/3.0/ping");
    } finally {
      globalThis.fetch = originalFetch;
    }
  },
);

Deno.test(
  "MailchimpClient.fromConnection derives data center from metadata.api_endpoint when dc is absent",
  async () => {
    const urls: string[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL | Request) => {
      urls.push(String(input));
      return jsonResponse({ health_status: "Everything's Chimpy!" });
    }) as typeof fetch;

    try {
      const client = await MailchimpClient.fromConnection(
        buildConnection({ api_endpoint: "https://us7.api.mailchimp.com" }),
        async () => "decrypted-token",
      );

      await client.ping();
      assertEquals(urls[0], "https://us7.api.mailchimp.com/3.0/ping");
    } finally {
      globalThis.fetch = originalFetch;
    }
  },
);

Deno.test(
  "MailchimpClient.fromConnection falls back to us1 when metadata is missing dc details",
  async () => {
    const urls: string[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL | Request) => {
      urls.push(String(input));
      return jsonResponse({ health_status: "Everything's Chimpy!" });
    }) as typeof fetch;

    try {
      const client = await MailchimpClient.fromConnection(
        buildConnection({}),
        async () => "decrypted-token",
      );

      await client.ping();
      assertEquals(urls[0], "https://us1.api.mailchimp.com/3.0/ping");
    } finally {
      globalThis.fetch = originalFetch;
    }
  },
);

Deno.test(
  "MailchimpClient.fromConnection decrypts the access token before use",
  async () => {
    let decryptedValue = "";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (
      _input: string | URL | Request,
      init?: RequestInit,
    ) => {
      const headers = new Headers(init?.headers);
      decryptedValue = headers.get("Authorization") ?? "";
      return jsonResponse({ health_status: "Everything's Chimpy!" });
    }) as typeof fetch;

    try {
      const client = await MailchimpClient.fromConnection(
        buildConnection({ dc: "us3" }),
        async () => "plain-token",
      );

      await client.ping();
      assertEquals(decryptedValue, "Bearer plain-token");
    } finally {
      globalThis.fetch = originalFetch;
    }
  },
);

Deno.test(
  "MailchimpClient.request includes Authorization header on every request",
  async () => {
    const capturedHeaders: string[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (
      _input: string | URL | Request,
      init?: RequestInit,
    ) => {
      const headers = new Headers(init?.headers);
      capturedHeaders.push(headers.get("Authorization") ?? "");
      return jsonResponse({ health_status: "ok" });
    }) as typeof fetch;

    try {
      const client = await MailchimpClient.fromConnection(
        buildConnection({ dc: "us3" }),
        async () => "bearer-token",
      );

      await client.request("/ping");
      assertEquals(capturedHeaders, ["Bearer bearer-token"]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  },
);

Deno.test(
  "MailchimpClient.request retries on 429 with Retry-After delay",
  async () => {
    let callCount = 0;
    const delays: number[] = [];
    const originalFetch = globalThis.fetch;
    const originalSetTimeout = globalThis.setTimeout;

    globalThis.fetch = (async () => {
      callCount += 1;
      if (callCount === 1) {
        return new Response("rate limited", {
          status: 429,
          headers: { "Retry-After": "2" },
        });
      }
      return jsonResponse({ health_status: "ok" });
    }) as typeof fetch;
    globalThis.setTimeout = ((
      callback: (...args: unknown[]) => void,
      delay?: number,
    ) => {
      delays.push(Number(delay ?? 0));
      if (typeof callback === "function") {
        callback();
      }
      return 0 as unknown as number;
    }) as typeof setTimeout;

    try {
      const client = await MailchimpClient.fromConnection(
        buildConnection({ dc: "us3" }),
        async () => "retry-token",
      );

      await client.request("/ping");
      assertEquals(callCount, 2);
      assertEquals(delays.includes(2000), true);
    } finally {
      globalThis.fetch = originalFetch;
      globalThis.setTimeout = originalSetTimeout;
    }
  },
);

Deno.test("MailchimpClient.request does not retry on 401", async () => {
  let callCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    callCount += 1;
    return new Response("unauthorized", { status: 401 });
  }) as typeof fetch;

  try {
    const client = await MailchimpClient.fromConnection(
      buildConnection({ dc: "us3" }),
      async () => "retry-token",
    );

    await assertRejects(
      () => client.request("/lists"),
      MailchimpRequestError,
      "Mailchimp API error 401",
    );
    assertEquals(callCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("MailchimpClient.request does not retry on 404", async () => {
  let callCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    callCount += 1;
    return new Response("missing", { status: 404 });
  }) as typeof fetch;

  try {
    const client = await MailchimpClient.fromConnection(
      buildConnection({ dc: "us3" }),
      async () => "retry-token",
    );

    await assertRejects(
      () => client.request("/lists/missing"),
      MailchimpRequestError,
      "Mailchimp API error 404",
    );
    assertEquals(callCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("MailchimpClient.request retries on 500 responses", async () => {
  let callCount = 0;
  const delays: number[] = [];
  const originalFetch = globalThis.fetch;
  const originalSetTimeout = globalThis.setTimeout;

  globalThis.fetch = (async () => {
    callCount += 1;
    if (callCount === 1) {
      return new Response("server error", { status: 500 });
    }
    return jsonResponse({ health_status: "ok" });
  }) as typeof fetch;
  globalThis.setTimeout = ((
    callback: (...args: unknown[]) => void,
    delay?: number,
  ) => {
    delays.push(Number(delay ?? 0));
    if (typeof callback === "function") {
      callback();
    }
    return 0 as unknown as number;
  }) as typeof setTimeout;

  try {
    const client = await MailchimpClient.fromConnection(
      buildConnection({ dc: "us3" }),
      async () => "retry-token",
    );

    await client.request("/ping");
    assertEquals(callCount, 2);
    assertEquals(delays.includes(1000), true);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
  }
});

Deno.test("MailchimpClient.request retries on transport errors", async () => {
  let callCount = 0;
  const delays: number[] = [];
  const originalFetch = globalThis.fetch;
  const originalSetTimeout = globalThis.setTimeout;

  globalThis.fetch = (async () => {
    callCount += 1;
    if (callCount === 1) {
      throw new TypeError("network failure");
    }
    return jsonResponse({ health_status: "ok" });
  }) as typeof fetch;
  globalThis.setTimeout = ((
    callback: (...args: unknown[]) => void,
    delay?: number,
  ) => {
    delays.push(Number(delay ?? 0));
    if (typeof callback === "function") {
      callback();
    }
    return 0 as unknown as number;
  }) as typeof setTimeout;

  try {
    const client = await MailchimpClient.fromConnection(
      buildConnection({ dc: "us3" }),
      async () => "retry-token",
    );

    await client.request("/ping");
    assertEquals(callCount, 2);
    assertEquals(delays.includes(1000), true);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
  }
});

Deno.test("MailchimpClient.request retries on request timeouts", async () => {
  let callCount = 0;
  const delays: number[] = [];
  const originalFetch = globalThis.fetch;
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  let timerId = 0;

  globalThis.fetch = (async (
    _input: string | URL | Request,
    init?: RequestInit,
  ) => {
    callCount += 1;

    if (callCount === 1) {
      return await new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        const rejectAbort = () =>
          reject(new DOMException("The operation was aborted.", "AbortError"));

        if (signal?.aborted) {
          rejectAbort();
          return;
        }

        signal?.addEventListener("abort", rejectAbort, { once: true });
      });
    }

    return jsonResponse({ health_status: "ok" });
  }) as typeof fetch;
  globalThis.setTimeout = ((
    callback: (...args: unknown[]) => void,
    delay?: number,
  ) => {
    timerId += 1;
    delays.push(Number(delay ?? 0));

    if (
      typeof callback === "function" &&
      (timerId === 1 || Number(delay ?? 0) !== 15000)
    ) {
      callback();
    }

    return timerId as unknown as number;
  }) as typeof setTimeout;
  globalThis.clearTimeout = ((_id?: number) => {
    return undefined;
  }) as typeof clearTimeout;

  try {
    const client = await MailchimpClient.fromConnection(
      buildConnection({ dc: "us3" }),
      async () => "retry-token",
    );

    await client.request("/ping");
    assertEquals(callCount, 2);
    assertEquals(delays, [15000, 1000, 15000]);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});

Deno.test(
  "MailchimpClient.request throws MailchimpTimeoutError after repeated timeouts",
  async () => {
    let timerId = 0;
    const originalFetch = globalThis.fetch;
    const originalSetTimeout = globalThis.setTimeout;
    const originalClearTimeout = globalThis.clearTimeout;

    globalThis.fetch = (async (
      _input: string | URL | Request,
      init?: RequestInit,
    ) => {
      return await new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        const rejectAbort = () =>
          reject(new DOMException("The operation was aborted.", "AbortError"));

        if (signal?.aborted) {
          rejectAbort();
          return;
        }

        signal?.addEventListener("abort", rejectAbort, { once: true });
      });
    }) as typeof fetch;
    globalThis.setTimeout = ((
      callback: (...args: unknown[]) => void,
      _delay?: number,
    ) => {
      timerId += 1;
      if (typeof callback === "function") {
        callback();
      }
      return timerId as unknown as number;
    }) as typeof setTimeout;
    globalThis.clearTimeout = ((_id?: number) => {
      return undefined;
    }) as typeof clearTimeout;

    try {
      const client = await MailchimpClient.fromConnection(
        buildConnection({ dc: "us3" }),
        async () => "retry-token",
      );

      await assertRejects(
        () => client.request("/ping"),
        MailchimpTimeoutError,
        "Mailchimp request timed out after 15000ms",
      );
    } finally {
      globalThis.fetch = originalFetch;
      globalThis.setTimeout = originalSetTimeout;
      globalThis.clearTimeout = originalClearTimeout;
    }
  },
);

Deno.test(
  "MailchimpClient.request throws a typed error with status code and body on non-200",
  async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      return new Response("bad request body", { status: 400 });
    }) as typeof fetch;

    try {
      const client = await MailchimpClient.fromConnection(
        buildConnection({ dc: "us3" }),
        async () => "token",
      );

      const error = await assertRejects(
        () => client.request("/lists"),
        MailchimpRequestError,
      );
      assertEquals(error.status, 400);
      assertEquals(error.path, "/lists");
      assertEquals(error.body, "bad request body");
    } finally {
      globalThis.fetch = originalFetch;
    }
  },
);

Deno.test(
  "MailchimpClient.request does not exceed MAX_RETRIES on repeated 429 responses",
  async () => {
    let callCount = 0;
    const originalFetch = globalThis.fetch;
    const originalSetTimeout = globalThis.setTimeout;

    globalThis.fetch = (async () => {
      callCount += 1;
      return new Response("rate limited", {
        status: 429,
        headers: { "Retry-After": "1" },
      });
    }) as typeof fetch;
    globalThis.setTimeout = ((callback: (...args: unknown[]) => void) => {
      if (typeof callback === "function") {
        callback();
      }
      return 0 as unknown as number;
    }) as typeof setTimeout;

    try {
      const client = await MailchimpClient.fromConnection(
        buildConnection({ dc: "us3" }),
        async () => "token",
      );

      await assertRejects(() => client.request("/lists"), Error);
      assertEquals(callCount, 3);
    } finally {
      globalThis.fetch = originalFetch;
      globalThis.setTimeout = originalSetTimeout;
    }
  },
);

Deno.test(
  "MailchimpClient.getLists fetches all lists across multiple pages",
  async () => {
    const requests: string[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      requests.push(url);
      if (url.includes("offset=0")) {
        return jsonResponse({
          lists: Array.from({ length: 100 }, (_, index) => ({
            id: `list-${index + 1}`,
            name: `List ${index + 1}`,
            stats: { member_count: 10 },
          })),
          total_items: 101,
        });
      }

      return jsonResponse({
        lists: [
          { id: "list-101", name: "List 101", stats: { member_count: 5 } },
        ],
        total_items: 101,
      });
    }) as typeof fetch;

    try {
      const client = await MailchimpClient.fromConnection(
        buildConnection({ dc: "us3" }),
        async () => "token",
      );

      const lists = await client.getLists();
      assertEquals(lists.length, 101);
      assertEquals(requests.length, 2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  },
);

Deno.test(
  "MailchimpClient.getLists returns an empty array when account has no lists",
  async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      jsonResponse({ lists: [], total_items: 0 })) as typeof fetch;

    try {
      const client = await MailchimpClient.fromConnection(
        buildConnection({ dc: "us3" }),
        async () => "token",
      );

      const lists = await client.getLists();
      assertEquals(lists, []);
    } finally {
      globalThis.fetch = originalFetch;
    }
  },
);

Deno.test(
  "MailchimpClient.getSegmentMembers fetches members from the segment endpoint",
  async () => {
    let requestedUrl = "";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL | Request) => {
      requestedUrl = String(input);
      return jsonResponse({ members: [], total_items: 0 });
    }) as typeof fetch;

    try {
      const client = await MailchimpClient.fromConnection(
        buildConnection({ dc: "us3" }),
        async () => "token",
      );

      await client.getSegmentMembers("list-1", "99", 0, 10);
      assertEquals(
        requestedUrl,
        "https://us3.api.mailchimp.com/3.0/lists/list-1/segments/99/members?count=10&offset=0",
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  },
);

Deno.test(
  "MailchimpClient.ping returns true when /ping returns 200",
  async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      jsonResponse({ health_status: "ok" })) as typeof fetch;

    try {
      const client = await MailchimpClient.fromConnection(
        buildConnection({ dc: "us3" }),
        async () => "token",
      );

      assertEquals(await client.ping(), true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  },
);

Deno.test(
  "MailchimpClient.ping returns false when /ping returns 401",
  async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response("unauthorized", { status: 401 })) as typeof fetch;

    try {
      const client = await MailchimpClient.fromConnection(
        buildConnection({ dc: "us3" }),
        async () => "token",
      );

      assertEquals(await client.ping(), false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  },
);
