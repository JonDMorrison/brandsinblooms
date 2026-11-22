import { strict as assert } from "node:assert";
import {
  sanitizeGrowthAttribution,
  verifiedGrowthVisitor,
  verifyGrowthBridge,
} from "./growthBridge.ts";
import { handler } from "../growth-signup-stats/index.ts";
const secret = "a".repeat(64);
const siteId = "37c1cf85-a81e-4185-aebc-83862a4096f0";
async function signed(
  body: string,
  purpose = "growth-signup-stats",
  time = Date.now(),
) {
  const timestamp = String(Math.floor(time / 1000));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(
      `bloomsites-growth:${purpose}:v1\n${timestamp}\n${body}`,
    ),
  );
  const signature = Array.from(new Uint8Array(mac)).map((x) =>
    x.toString(16).padStart(2, "0")
  ).join("");
  return new Request("https://example.test", {
    method: "POST",
    headers: {
      "x-bloomsites-growth-timestamp": timestamp,
      "x-bloomsites-growth-signature": signature,
    },
    body,
  });
}
Deno.test("bridge authenticates exact body and purpose", async () => {
  const req = await signed("{}", "submit-form");
  assert.equal(
    await verifyGrowthBridge(req, "{}", "submit-form", secret),
    "valid",
  );
  assert.equal(
    await verifyGrowthBridge(req, '{"changed":true}', "submit-form", secret),
    "invalid",
  );
  assert.equal(
    await verifyGrowthBridge(req, "{}", "growth-signup-stats", secret),
    "invalid",
  );
});
Deno.test("unsigned embed cannot authenticate by supplying visitor or headers", async () => {
  assert.equal(
    await verifyGrowthBridge(
      new Request("https://example.test"),
      "{}",
      "submit-form",
      secret,
    ),
    "unsigned",
  );
  const req = new Request("https://example.test", {
    headers: {
      "x-bloomsites-growth-timestamp": String(Math.floor(Date.now() / 1000)),
    },
  });
  assert.equal(
    await verifyGrowthBridge(req, "{}", "submit-form", secret),
    "invalid",
  );
});
Deno.test("expired, future, wrong-key and unconfigured signatures fail", async () => {
  for (const offset of [-301000, 301000]) {
    assert.equal(
      await verifyGrowthBridge(
        await signed("{}", "submit-form", Date.now() + offset),
        "{}",
        "submit-form",
        secret,
      ),
      "invalid",
    );
  }
  const req = await signed("{}", "submit-form");
  assert.equal(
    await verifyGrowthBridge(req, "{}", "submit-form", "b".repeat(64)),
    "invalid",
  );
  assert.equal(
    await verifyGrowthBridge(req, "{}", "submit-form", undefined),
    "invalid",
  );
});
Deno.test("visitor requires site binding and opaque digest", () => {
  assert.equal(
    verifiedGrowthVisitor({
      source: "bloomsites",
      site_id: siteId,
      bridge_visitor_key: "a".repeat(64),
    }),
    "a".repeat(64),
  );
  assert.equal(
    verifiedGrowthVisitor({
      source: "bloomsites",
      site_id: siteId,
      bridge_visitor_key: "203.0.113.1",
    }),
    null,
  );
  assert.equal(
    verifiedGrowthVisitor({
      source: "form",
      site_id: siteId,
      bridge_visitor_key: "a".repeat(64),
    }),
    null,
  );
});
Deno.test("stats denies unsigned requests without database access", async () => {
  const res = await handler(
    new Request("https://example.test", { method: "POST", body: "{}" }),
  );
  assert.equal(res.status, 401);
});
Deno.test("stats binds form and site to same tenant and uses exact counts", async () => {
  const original = globalThis.fetch;
  Deno.env.set("BLOOMSITES_GROWTH_BRIDGE_SECRET", secret);
  Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-only-key");
  const seen: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    seen.push(url);
    const u = new URL(url);
    if (u.pathname.endsWith("/forms")) {
      return Response.json({
        id: "form-1",
        tenant_id: "tenant-1",
        name: "Garden",
        status: "published",
      });
    }
    if (u.pathname.endsWith("/crm_connected_websites")) {
      assert.equal(u.searchParams.get("tenant_id"), "eq.tenant-1");
      assert.equal(u.searchParams.get("cms_site_id"), `eq.${siteId}`);
      return Response.json({ id: "link-1" });
    }
    assert.equal(u.searchParams.get("tenant_id"), "eq.tenant-1");
    assert.equal(u.searchParams.get("form_id"), "eq.form-1");
    assert.equal(u.searchParams.get("metadata->>site_id"), `eq.${siteId}`);
    assert.equal(u.searchParams.get("result"), "eq.accepted");
    if (init?.method === "HEAD") {
      return new Response(null, { headers: { "Content-Range": "0-0/1501" } });
    }
    return Response.json({ submitted_at: "2026-11-21T00:00:00Z" });
  };
  try {
    const res = await handler(
      await signed(JSON.stringify({ siteId, embedKey: "a".repeat(32) })),
    );
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.stats.acceptedTotal, 1501);
    assert.equal(data.stats.placements.popup, 1501);
    assert.equal(seen.length, 10);
  } finally {
    globalThis.fetch = original;
  }
});
Deno.test("stats refuses an unconnected site without reading submissions", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes("/forms?")) {
      return Response.json({
        id: "form-1",
        tenant_id: "tenant-1",
        name: "Garden",
        status: "published",
      });
    }
    assert.ok(url.includes("/crm_connected_websites?"));
    return Response.json(null);
  };
  try {
    const res = await handler(
      await signed(JSON.stringify({ siteId, embedKey: "a".repeat(32) })),
    );
    assert.equal((await res.json()).connection.status, "site_not_connected");
  } finally {
    globalThis.fetch = original;
  }
});

Deno.test("unsigned public embeds cannot spoof website attribution", () => {
  const meta = {
    source: " BloomSites ",
    site_id: siteId,
    bridge_visitor_key: "a".repeat(64),
    page_url: "https://example.test",
    event_id: "event",
  };
  assert.deepEqual(sanitizeGrowthAttribution(meta, false), {
    source: "public_embed",
    page_url: "https://example.test",
    event_id: "event",
  });
  assert.deepEqual(sanitizeGrowthAttribution(meta, true), meta);
  assert.deepEqual(
    sanitizeGrowthAttribution({
      source: "public_form",
      page_url: "https://example.test",
    }, false),
    { source: "public_form", page_url: "https://example.test" },
  );
});
