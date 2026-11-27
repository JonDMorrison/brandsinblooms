import { assert, assertEquals, assertRejects } from "@std/assert";

import { BloomSitesBridgeError, openBloomSitesBridge } from "./bloomsitesBridge.ts";
import { runBloomSitesTool } from "../generate-theme-newsletter/bloomsites-tool.ts";
import {
  BLOOMSITES_REST_URL,
  CATALOG_PRODUCTS,
  CHRISTMAS_TREE_MEMBERS,
  CHRISTMAS_TREES_COLLECTION,
  EVENT_MEDIA,
  EVENT_OCCURRENCES,
  EVENTS,
  FIXTURE_NOW,
  LACOSTE_ORIGIN,
  LACOSTE_SITE,
  LACOSTE_SITE_ID,
  LACOSTE_TENANT_ID,
  PRODUCT_IMAGES,
  PRODUCT_STOCK,
} from "./testing/lacosteBloomSitesFixture.ts";

type Call = { url: URL; method: string; headers: Headers };

/** Fake BloomSites: REST tables and the public catalogue, GET only. */
function fakeBloomSites() {
  const calls: Call[] = [];
  const fetchImpl = ((input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const method = init?.method ?? "GET";
    const headers = new Headers(init?.headers);
    calls.push({ url, method, headers });
    const respond = (body: unknown) =>
      Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));
    if (method !== "GET") return Promise.resolve(new Response("write attempted", { status: 500 }));

    if (url.origin === "https://bloomsites.app" && url.pathname === "/api/connected-content/catalog") {
      const itemId = url.searchParams.get("itemId");
      const q = (url.searchParams.get("q") ?? "").toLowerCase();
      let items = CATALOG_PRODUCTS.filter((p) => !itemId || p.id === itemId);
      if (q) items = items.filter((p) => `${p.title} ${p.description}`.toLowerCase().includes(q));
      return respond({ catalogVersion: 1, siteId: LACOSTE_SITE_ID, siteOrigin: LACOSTE_ORIGIN, items });
    }
    if (url.origin === BLOOMSITES_REST_URL && url.pathname.startsWith("/rest/v1/")) {
      if (headers.get("x-site-id") !== LACOSTE_SITE_ID) return respond([]);
      const table = url.pathname.slice("/rest/v1/".length);
      const ids = (url.searchParams.get("id") ?? url.searchParams.get("product_id") ?? url.searchParams.get("event_id") ?? "")
        .replace(/^in\.\(|\)$/g, "").split(",").filter(Boolean);
      switch (table) {
        case "sites": return respond([LACOSTE_SITE]);
        case "product_collections": return respond([CHRISTMAS_TREES_COLLECTION]);
        case "product_collection_products": return respond(CHRISTMAS_TREE_MEMBERS);
        case "products": return respond(PRODUCT_STOCK.filter((p) => ids.includes(p.id)));
        case "product_images": return respond(PRODUCT_IMAGES.filter((p) => ids.includes(p.product_id)));
        case "events": return respond(EVENTS);
        case "event_occurrences": return respond(EVENT_OCCURRENCES.filter((o) => ids.includes(o.event_id)));
        case "event_media": return respond(EVENT_MEDIA.filter((m) => ids.includes(m.event_id)));
      }
    }
    return Promise.resolve(new Response("not found", { status: 404 }));
  }) as typeof fetch;
  return { calls, fetchImpl };
}

function crmClients(options: { canAccess?: boolean; linked?: boolean } = {}) {
  const log: string[] = [];
  const userClient = {
    rpc: (fn: string, args: { p_tenant_id: string }) => {
      log.push(`user:${fn}:${args.p_tenant_id}`);
      return Promise.resolve({ data: options.canAccess ?? true, error: null });
    },
  };
  const connectionQuery = {
    eq: (_c: string, value: string) => {
      log.push(`service:newsletter_storefront_connections:${value}`);
      return connectionQuery;
    },
    order: () => connectionQuery,
    limit: () => connectionQuery,
    maybeSingle: () =>
      Promise.resolve({
        data: options.linked === false ? null : { site_id: LACOSTE_SITE_ID, origin: LACOSTE_ORIGIN },
        error: null,
      }),
  };
  const serviceClient = {
    from: (_table: "newsletter_storefront_connections") => ({ select: () => connectionQuery }),
    rpc: (fn: "bloomsites_public_config") => {
      log.push(`service:${fn}`);
      return Promise.resolve({ data: { url: BLOOMSITES_REST_URL, anon_key: "bloomsites-anon-key" }, error: null });
    },
  };
  return { log, userClient, serviceClient };
}

async function lacosteBridge(fetchImpl: typeof fetch) {
  const { userClient, serviceClient } = crmClients();
  return await openBloomSitesBridge(LACOSTE_TENANT_ID, {
    userClient,
    serviceClient,
    fetch: fetchImpl,
    now: () => FIXTURE_NOW,
  });
}

Deno.test("Lacoste brand returns primary colour #545F34, logo and fonts", async () => {
  const { calls, fetchImpl } = fakeBloomSites();
  const bridge = await lacosteBridge(fetchImpl);
  const brand = await bridge.getBrand();
  assertEquals(bridge.siteId, LACOSTE_SITE_ID);
  assertEquals(brand.colors.primary, "#545F34");
  assertEquals(brand.colors.accent, "#CBDF82");
  assertEquals(brand.logoUrl, LACOSTE_SITE.logo_url);
  assertEquals(brand.fonts.heading, "Evergreen");
  assertEquals(brand.fonts.brandHeading, "Raustila");
  // The publishable key and the site header gate every REST read.
  const restCall = calls.find((call) => call.url.pathname === "/rest/v1/sites");
  assertEquals(restCall?.headers.get("apikey"), "bloomsites-anon-key");
  assertEquals(restCall?.headers.get("x-site-id"), LACOSTE_SITE_ID);
});

Deno.test("Lacoste products include at least one Christmas tree with an image", async () => {
  const { fetchImpl } = fakeBloomSites();
  const bridge = await lacosteBridge(fetchImpl);
  const trees = await bridge.getProducts({ collection: "christmas-trees" });
  assert(trees.length >= 1);
  const withImage = trees.filter((tree) => tree.imageUrl?.startsWith("https://"));
  assert(withImage.length >= 1);
  for (const tree of trees) {
    assert(tree.url.startsWith(`${LACOSTE_ORIGIN}/products/`));
    assertEquals(tree.inStock, true);
    assert(typeof tree.price === "number");
  }
  // The primary product image (product_images.is_primary) wins over the
  // catalogue's first image.
  const grandis = trees.find((tree) => tree.name === "7.5 ft Grandis Fir");
  assert(grandis?.imageUrl?.includes("/images/products/d7bbee4d-"));
  // Collection members the public catalogue does not show are not returned.
  assertEquals(trees.length, CATALOG_PRODUCTS.length);

  const searched = await bridge.getProducts({ search: "christmas tree" });
  assert(searched.length >= 1 && searched.every((p) => p.imageUrl));
});

Deno.test("Lacoste events return only future dates, with the next occurrence", async () => {
  const { fetchImpl } = fakeBloomSites();
  const bridge = await lacosteBridge(fetchImpl);
  const events = await bridge.getEvents();
  assert(events.length >= 1);
  for (const event of events) {
    assert(Date.parse(event.nextOccurrence) > FIXTURE_NOW.getTime(), `${event.title} is not in the future`);
    assert(event.url.startsWith(`${LACOSTE_ORIGIN}/events/`));
  }
  // Jingle and Mingle (12 Nov only) is over.
  assert(!events.some((event) => event.title === "Jingle and Mingle"));
  // Planter Parties started 18 Nov; its next date is 27 Nov 23:00 UTC.
  const planter = events.find((event) => event.title === "Planter Parties");
  assertEquals(planter?.nextOccurrence, "2026-11-27T23:00:00.000Z");
  // Sorted by next date.
  const dates = events.map((event) => Date.parse(event.nextOccurrence));
  assertEquals(dates, [...dates].sort((a, b) => a - b));
  assertEquals(events.find((event) => event.title === "Santa Photos")?.imageUrl, EVENT_MEDIA[0].media_url);
});

Deno.test("the bridge never writes: every BloomSites request is a GET", async () => {
  const { calls, fetchImpl } = fakeBloomSites();
  const bridge = await lacosteBridge(fetchImpl);
  await bridge.getBrand();
  await bridge.getProducts({ collection: "christmas-trees" });
  await bridge.getProducts({ search: "fir" });
  await bridge.getEvents();
  assert(calls.length > 0);
  assertEquals(calls.filter((call) => call.method !== "GET").length, 0);
  assert(calls.every((call) => call.url.origin === BLOOMSITES_REST_URL || call.url.origin === "https://bloomsites.app"));
});

Deno.test("membership is checked before anything is read", async () => {
  const { calls, fetchImpl } = fakeBloomSites();
  const { log, userClient, serviceClient } = crmClients({ canAccess: false });
  const error = await assertRejects(
    () => openBloomSitesBridge(LACOSTE_TENANT_ID, { userClient, serviceClient, fetch: fetchImpl, now: () => FIXTURE_NOW }),
    BloomSitesBridgeError,
  );
  assertEquals(error.status, 403);
  assertEquals(log, [`user:bloom_can_access_tenant:${LACOSTE_TENANT_ID}`]);
  assertEquals(calls.length, 0);
});

Deno.test("an unlinked tenant gets 404 and no BloomSites call", async () => {
  const { calls, fetchImpl } = fakeBloomSites();
  const { userClient, serviceClient } = crmClients({ linked: false });
  const error = await assertRejects(
    () => openBloomSitesBridge(LACOSTE_TENANT_ID, { userClient, serviceClient, fetch: fetchImpl }),
    BloomSitesBridgeError,
  );
  assertEquals(error.status, 404);
  assertEquals(calls.length, 0);
});

Deno.test("generate-theme-newsletter tool answers brand, products and events calls", async () => {
  const { fetchImpl } = fakeBloomSites();
  const bridge = await lacosteBridge(fetchImpl);
  const brand = await runBloomSitesTool(bridge, "get_bloomsites_brand", "{}") as { colors: Record<string, string> };
  assertEquals(brand.colors.primary, "#545F34");
  const products = await runBloomSitesTool(bridge, "get_bloomsites_products", JSON.stringify({ collection: "Christmas Trees", limit: 2 })) as { products: unknown[] };
  assertEquals(products.products.length, 2);
  const events = await runBloomSitesTool(bridge, "get_bloomsites_events", "not json") as { events: unknown[] };
  assert(events.events.length >= 1);
});
