import { assertEquals } from "@std/assert";

import { buildWorkItems, processBatch, runMailchimpImport } from "../index.ts";
import { createMockSupabaseClient } from "../../_shared/testing/testHarness.ts";

Deno.test(
  "mailchimp-import buildWorkItems imports only selected segments and skips full-list scope",
  async () => {
    let getSegmentsCalls = 0;
    let getListCalls = 0;

    const workItems = await buildWorkItems(
      {
        getSegments: async () => {
          getSegmentsCalls += 1;
          return [{ id: 10, name: "VIP", member_count: 4 }];
        },
        getList: async () => {
          getListCalls += 1;
          return {
            id: "list-1",
            name: "Audience",
            stats: { member_count: 100 },
          };
        },
      } as never,
      {
        listIds: ["list-1"],
        segmentIds: ["list-1:10"],
      },
      {
        listCounts: new Map([["list-1", 100]]),
        listNames: new Map([["list-1", "Audience"]]),
        segmentCounts: new Map([["list-1:10", 4]]),
        segmentNames: new Map([["list-1:10", "VIP"]]),
      },
    );

    assertEquals(workItems.length, 1);
    assertEquals(workItems[0].mode, "segment");
    assertEquals(workItems[0].segmentCompositeId, "list-1:10");
    assertEquals(getSegmentsCalls, 1);
    assertEquals(getListCalls, 0);
  },
);

Deno.test(
  "mailchimp-import processBatch skips invalid emails and records them in report errors",
  async () => {
    const { client, recorder } = createMockSupabaseClient({});

    const outcome = await processBatch(
      client as never,
      [
        {
          id: "member-1",
          email_address: "bad-email",
          status: "subscribed",
          merge_fields: {},
          tags: [],
        },
      ],
      "list-1",
      "tenant-1",
      "user-1",
      {
        knownTagNames: new Set<string>(),
        seenEmails: new Set<string>(),
      },
    );

    assertEquals(outcome.importedCount, 0);
    assertEquals(outcome.failedCount, 1);
    assertEquals(outcome.errorMessages[0], "Invalid email format: bad-email");
    assertEquals(recorder.length, 0);
  },
);

Deno.test(
  "mailchimp-import processBatch lowercases emails and writes consents, suppressions, tags, and sources",
  async () => {
    const { client, recorder } = createMockSupabaseClient({
      "crm_customers:upsert": {
        data: [
          { id: "cust-1", email: "subscribed@example.com" },
          { id: "cust-2", email: "cleaned@example.com" },
        ],
        error: null,
      },
      "customer_consents:upsert": { data: null, error: null },
      "suppression_list:upsert": { data: null, error: null },
      "crm_tags:select": { data: [], error: null },
      "crm_tags:upsert": {
        data: [{ id: "tag-1", name: "VIP" }],
        error: null,
      },
      "customer_tags:upsert": { data: null, error: null },
      "customer_sources:upsert": { data: null, error: null },
    });

    const outcome = await processBatch(
      client as never,
      [
        {
          id: "member-1",
          email_address: "Subscribed@Example.com",
          status: "subscribed",
          merge_fields: { FNAME: "Sub", LNAME: "Scriber", CITY: "Paris" },
          tags: [{ id: 1, name: "VIP" }],
          timestamp_opt: "2026-03-30T00:00:00.000Z",
        },
        {
          id: "member-2",
          email_address: "cleaned@example.com",
          status: "cleaned",
          merge_fields: {},
          tags: [],
        },
      ],
      "list-1",
      "tenant-1",
      "user-1",
      {
        knownTagNames: new Set<string>(),
        seenEmails: new Set<string>(),
      },
    );

    assertEquals(outcome.importedCount, 2);
    assertEquals(outcome.consentsRecorded, 2);
    assertEquals(outcome.tagsCreated, 1);

    const customersUpsert = recorder.find(
      (entry) =>
        entry.table === "crm_customers" && entry.operation === "upsert",
    );
    const customerPayload = customersUpsert?.payload as Array<
      Record<string, unknown>
    >;
    assertEquals(customerPayload[0].email, "subscribed@example.com");
    assertEquals(customerPayload[0].custom_fields, { CITY: "Paris" });

    const suppressionUpsert = recorder.find(
      (entry) =>
        entry.table === "suppression_list" && entry.operation === "upsert",
    );
    const suppressionPayload = suppressionUpsert?.payload as Array<
      Record<string, unknown>
    >;
    assertEquals(suppressionPayload[0].suppression_type, "bounced");
  },
);

Deno.test(
  "mailchimp-import runMailchimpImport uses segment members only and writes normalized final report",
  async () => {
    const { client, recorder } = createMockSupabaseClient({
      "provider_artifacts:select": [
        {
          data: [{ external_id: "list-1", name: "Audience", member_count: 20 }],
          error: null,
        },
        {
          data: [{ external_id: "list-1:10", name: "VIP", member_count: 1 }],
          error: null,
        },
      ],
      "crm_segments:select": { data: null, error: null },
      "crm_segments:insert": { data: { id: "segment-1" }, error: null },
      "crm_customers:upsert": {
        data: [{ id: "cust-1", email: "vip@example.com" }],
        error: null,
      },
      "customer_consents:upsert": { data: null, error: null },
      "crm_tags:select": { data: [], error: null },
      "crm_tags:upsert": { data: [], error: null },
      "customer_sources:upsert": { data: null, error: null },
      "customer_segments:select": { data: [], error: null },
      "customer_segments:insert": { data: null, error: null },
      "import_jobs:update": [
        { data: null, error: null },
        { data: null, error: null },
        { data: null, error: null },
        { data: null, error: null },
      ],
      "migration_jobs:update": [
        { data: null, error: null },
        { data: null, error: null },
        { data: null, error: null },
        { data: null, error: null },
      ],
      "rpc:record_contact_import_event": { data: null, error: null },
    });

    let listMembersCalls = 0;
    let segmentMembersCalls = 0;

    await runMailchimpImport({
      supabase: client as never,
      job: {
        id: "job-1",
        config: { listIds: ["list-1"], segmentIds: ["list-1:10"] },
        inserted_rows: 0,
        skipped_rows: 0,
        failed_rows: 0,
        fetched_rows: 0,
        current_page: 0,
        batch_stats: null,
      },
      connection: {
        encrypted_access_token: "encrypted",
        metadata: { dc: "us1" },
      },
      tenantId: "tenant-1",
      userId: "user-1",
      migrationJobId: "migration-1",
      client: {
        getSegments: async () => [{ id: 10, name: "VIP", member_count: 1 }],
        getListMembers: async () => {
          listMembersCalls += 1;
          return { total_items: 1, members: [] };
        },
        getSegmentMembers: async (
          _listId: string,
          _segmentId: string,
          offset: number,
        ) => {
          segmentMembersCalls += 1;
          if (offset > 0) {
            return { total_items: 1, members: [] };
          }
          return {
            total_items: 1,
            members: [
              {
                id: "member-1",
                email_address: "vip@example.com",
                status: "subscribed",
                merge_fields: {},
                tags: [],
              },
            ],
          };
        },
      } as never,
    });

    assertEquals(listMembersCalls, 0);
    assertEquals(segmentMembersCalls, 1);

    const importJobUpdates = recorder.filter(
      (entry) => entry.table === "import_jobs" && entry.operation === "update",
    );
    const finalUpdate = importJobUpdates.at(-1)?.payload as Record<
      string,
      unknown
    >;
    const finalReport = finalUpdate.report as Record<string, unknown>;
    assertEquals(finalUpdate.status, "completed");
    assertEquals(finalReport.contacts_imported, 1);
    assertEquals(finalReport.contacts_skipped, 0);
    assertEquals(finalReport.contacts_failed, 0);
    assertEquals(finalReport.segments_created, 1);
    assertEquals(finalReport.tags_created, 0);
    assertEquals(finalReport.consents_recorded, 1);
    assertEquals(finalReport.batches_processed, 1);
    assertEquals(Array.isArray(finalReport.errors), true);
  },
);
