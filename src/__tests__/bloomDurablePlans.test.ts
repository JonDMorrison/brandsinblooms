import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { claimAction, finishClaim } from "../../supabase/functions/bloom-assist/action-claims";
import {
  assertPlanOwner,
  cancelPlanSteps,
  enqueueRemainingSteps,
  OUTCOME_UNKNOWN_MESSAGE,
  PlanAccessError,
  PlanBusyError,
  type PlanStepJob,
  type PlanStepQueue,
  runPlanSteps,
  type StepClaims,
  type StepExecution,
  stepMutationId,
} from "../../supabase/functions/bloom-assist/task-plan/durable-runner";
import type { TaskPlan, TaskPlanItem } from "../../supabase/functions/bloom-assist/task-plan/types";
import type { JsonObject, PersistenceClient } from "../../supabase/functions/bloom-assist/types";

type Row = Record<string, unknown>;
const TENANT = "11111111-1111-1111-1111-111111111111";
const USER = "22222222-2222-2222-2222-222222222222";
const OTHER_USER = "33333333-3333-3333-3333-333333333333";
const PLAN = "44444444-4444-4444-4444-444444444444";

/** In-memory bloom_action_claims with a primary key on mutation_id (as in bloomActionClaims.test). */
function claimsTable() {
  const rows = new Map<string, Row>();
  const client = {
    from: () => {
      let mode: "select" | "update" | null = null;
      let patch: Row = {};
      const filters: [string, unknown][] = [];
      const match = (r: Row) => filters.every(([k, v]) => r[k] === v);
      const q = {
        insert: async (row: Row) => {
          const id = row.mutation_id as string;
          if (rows.has(id)) return { error: { code: "23505", message: "duplicate key" } };
          rows.set(id, { ...row });
          return { error: null };
        },
        select: () => {
          if (mode !== "update") mode = "select";
          return q;
        },
        update: (p: Row) => { mode = "update"; patch = p; return q; },
        eq: (k: string, v: unknown) => { filters.push([k, v]); return q; },
        maybeSingle: async () => ({ data: [...rows.values()].find(match) ?? null, error: null }),
        then: (resolve: (v: unknown) => void) => {
          if (mode === "update") {
            const hit = [...rows.values()].filter(match);
            hit.forEach((r) => Object.assign(r, patch));
            resolve({ data: hit.map((r) => ({ mutation_id: r.mutation_id })), error: null });
          } else resolve({ data: null, error: null });
        },
      };
      return q;
    },
  } as unknown as Pick<PersistenceClient, "from">;
  return { rows, client };
}

type JobRow = PlanStepJob & { tenant: string; user: string; locked_by: string | null };

/**
 * In-memory bloom_support.jobs for chat plan steps, mirroring the SQL in
 * 20261104120000_bloom_chat_plan_jobs.sql and fail_job/complete_job: owner
 * scoping, leases, attempts, retry time, dead letter and pending-only cancel.
 */
function jobStore(clock: { now: number }, claims: Map<string, Row>) {
  const jobs = new Map<string, JobRow>();
  const key = (taskId: string) => `chat-plan:${PLAN}:${taskId}`;
  const view = ({ tenant: _t, user: _u, locked_by: _l, ...job }: JobRow): PlanStepJob => ({ ...job, tool_params: { ...job.tool_params } });
  const iso = (ms: number) => new Date(ms).toISOString();

  function queueFor(tenant: string, user: string): PlanStepQueue {
    const owned = (j: JobRow | undefined): j is JobRow => !!j && j.tenant === tenant && j.user === user;
    const steps = () => [...jobs.values()].filter(owned).map(view);
    return {
      enqueue: async (list) => {
        for (const s of list) {
          const existing = jobs.get(key(s.task_id));
          if (existing && !owned(existing)) throw new Error("forbidden: plan");
          if (!existing) {
            jobs.set(key(s.task_id), {
              job_id: `job_${s.task_id}`, task_id: s.task_id, tool_name: s.tool_name, tool_params: { ...s.tool_params },
              status: "queued", attempts: 0, max_attempts: 3, run_after: iso(clock.now), lease_until: null, last_error: null,
              tenant, user, locked_by: null,
            });
          }
        }
        return steps();
      },
      steps: async () => steps(),
      claim: async (taskId, worker) => {
        const j = jobs.get(key(taskId));
        if (!owned(j)) return null;
        const due = j.status === "queued" && Date.parse(j.run_after) <= clock.now;
        const expired = j.status === "running" && Date.parse(j.lease_until ?? "") < clock.now && j.attempts < j.max_attempts;
        if (!due && !expired) return null;
        Object.assign(j, { status: "running", attempts: j.attempts + 1, locked_by: worker, lease_until: iso(clock.now + 120_000) });
        return view(j);
      },
      finish: async (job, worker, finish) => {
        const j = jobs.get(key(job.task_id));
        if (!owned(j)) throw new Error("forbidden: plan step");
        if (j.status !== "running" || j.locked_by !== worker) throw new Error("conflict: job lease lost");
        if (finish.outcome === "succeeded") {
          Object.assign(j, { status: "succeeded", lease_until: null });
          return "succeeded";
        }
        const status = finish.permanent || j.attempts >= j.max_attempts ? "dead" : "queued";
        Object.assign(j, {
          status, last_error: finish.error, lease_until: null, locked_by: null,
          run_after: iso(clock.now + 1000 * (finish.retryIn ?? Math.min(1800, 15 * 2 ** j.attempts))),
        });
        return status;
      },
      cancel: async (taskIds, reason) => {
        const out: string[] = [];
        for (const j of jobs.values()) {
          if (!owned(j) || (taskIds && !taskIds.includes(j.task_id))) continue;
          const claim = claims.get(stepMutationId(PLAN, j.task_id));
          const neverStarted = !claim || claim.status === "failed";
          const pending = j.status === "queued" ||
            (j.status === "running" && Date.parse(j.lease_until ?? "") < clock.now && neverStarted);
          if (!pending) continue;
          Object.assign(j, { status: "cancelled", last_error: reason, lease_until: null, locked_by: null });
          out.push(j.task_id);
        }
        return out.sort();
      },
      requeue: async (taskId) => {
        const j = jobs.get(key(taskId));
        if (!owned(j) || !["failed", "dead", "cancelled"].includes(j.status)) return null;
        Object.assign(j, { status: "queued", attempts: 0, run_after: iso(clock.now), lease_until: null, locked_by: null });
        return view(j);
      },
    };
  }
  return { jobs, queueFor, key };
}

function task(id: string, dependsOn: string[] = []): TaskPlanItem {
  return {
    task_id: id, action: "update", entity_type: "customer", entity_id: `cust_${id}`, entity_name: `Customer ${id}`,
    tool_name: "update_customer", tool_params: { customer_id: `cust_${id}`, notes: `note ${id}` },
    description: `Update ${id}`, field_changes: null, risk_level: "low", depends_on: dependsOn,
    editable_fields: [], validation_annotations: [], status: "approved", error_message: null,
  };
}

function approvedPlan(ids: string[], chained = true): TaskPlan {
  return {
    plan_id: PLAN, originating_message_id: "m1", summary: "three updates", risk_level: "low", compact: false,
    compact_confirmation: null, created_at: "2026-11-04T00:00:00.000Z",
    tasks: ids.map((id, i) => task(id, chained && i > 0 ? [ids[i - 1]] : [])),
  };
}

class ProcessDied extends Error {}

function harness(options: { user?: string } = {}) {
  const clock = { now: Date.parse("2026-11-04T10:00:00.000Z") };
  const claims = claimsTable();
  const store = jobStore(clock, claims.rows);
  const user = options.user ?? USER;
  let saved: TaskPlan | null = null;
  const executed: string[] = [];
  const stepClaims = (): StepClaims => ({
    claim: (mutationId, toolName) =>
      claimAction(claims.client, { mutationId, tenantId: TENANT, userId: user, conversationId: "c1", messageId: "m1", toolName }),
    finish: (mutationId, status, result) => finishClaim(claims.client, mutationId, status, result),
  });
  const run = (plan: TaskPlan, execute: (t: TaskPlanItem, params: JsonObject) => Promise<StepExecution>, hooks: Partial<{ queue: PlanStepQueue; claims: StepClaims }> = {}) =>
    runPlanSteps(plan, {
      queue: hooks.queue ?? store.queueFor(TENANT, user),
      claims: hooks.claims ?? stepClaims(),
      execute: async (t, params) => {
        executed.push(t.task_id);
        return await execute(t, params);
      },
      persist: async (p) => { saved = JSON.parse(JSON.stringify(p)); },
      emit: () => undefined,
      worker: `w-${Math.random()}`,
      sleep: async (ms) => { clock.now += ms; },
      now: () => clock.now,
    });
  return { clock, claims, store, run, executed, stepClaims, saved: () => saved, user };
}

const ok = async (): Promise<StepExecution> => ({ kind: "completed", result: { success: true }, message: "Saved" });

describe("durable Ask Bloom plans", () => {
  it("crash mid-plan, then resume runs only the remaining steps", async () => {
    const h = harness();
    const plan = approvedPlan(["task_1", "task_2", "task_3"]);
    await enqueueRemainingSteps(plan, h.store.queueFor(TENANT, USER));

    // The request dies right after task_2's change was saved and its claim recorded,
    // before the job or the plan message caught up.
    const base = h.stepClaims();
    const queue = h.store.queueFor(TENANT, USER);
    const dying: PlanStepQueue = {
      ...queue,
      finish: async (job, worker, finish) => {
        if (job.task_id === "task_2") throw new ProcessDied("process died");
        return await queue.finish(job, worker, finish);
      },
    };
    await expect(h.run(plan, ok, { queue: dying, claims: base })).rejects.toBeInstanceOf(ProcessDied);
    expect(h.executed).toEqual(["task_1", "task_2"]);
    const afterCrash = h.saved()!;
    expect(afterCrash.tasks.map((t) => t.status)).toEqual(["completed", "executing", "approved"]);
    expect(h.store.jobs.get(h.store.key("task_2"))?.status).toBe("running");

    // The lease runs out; the person presses Resume.
    h.clock.now += 121_000;
    h.executed.length = 0;
    const resumed = await h.run(afterCrash, ok);
    expect(h.executed).toEqual(["task_3"]);
    expect(resumed.plan.tasks.map((t) => t.status)).toEqual(["completed", "completed", "completed"]);
    expect([...h.store.jobs.values()].map((j) => j.status)).toEqual(["succeeded", "succeeded", "succeeded"]);
  });

  it("a step interrupted mid-change is surfaced as unknown on resume, never re-run", async () => {
    const h = harness();
    const plan = approvedPlan(["task_1", "task_2"]);
    await enqueueRemainingSteps(plan, h.store.queueFor(TENANT, USER));
    // The request is killed while task_1's change is in flight: nothing after the
    // tool call is recorded (the queue update never happens).
    const queue = h.store.queueFor(TENANT, USER);
    const dying: PlanStepQueue = { ...queue, finish: async () => { throw new ProcessDied("killed"); } };
    await expect(h.run(plan, async () => { throw new ProcessDied("killed"); }, { queue: dying }))
      .rejects.toBeInstanceOf(ProcessDied);
    expect(h.saved()!.tasks[0].status).toBe("executing");
    expect(h.claims.rows.get(stepMutationId(PLAN, "task_1"))?.status).toBe("executing");

    h.clock.now += 121_000;
    h.executed.length = 0;
    const resumed = await h.run(h.saved()!, ok);
    expect(h.executed).toEqual([]);
    expect(resumed.plan.tasks[0]).toMatchObject({ status: "unknown", error_message: OUTCOME_UNKNOWN_MESSAGE });
    expect(resumed.plan.tasks[1].status).toBe("blocked");
    expect(h.store.jobs.get(h.store.key("task_1"))?.status).toBe("dead");
    expect(h.store.jobs.get(h.store.key("task_2"))?.status).toBe("cancelled");
  });

  it("cancel stops pending steps only; the running step finishes", async () => {
    const h = harness();
    const plan = approvedPlan(["task_1", "task_2", "task_3"]);
    const queue = h.store.queueFor(TENANT, USER);
    await enqueueRemainingSteps(plan, queue);

    let cancelOutcome: Awaited<ReturnType<typeof cancelPlanSteps>> | null = null;
    const result = await h.run(plan, async (t) => {
      if (t.task_id === "task_1") {
        // The person presses Cancel while task_1 is running.
        cancelOutcome = await cancelPlanSteps(h.saved()!, queue);
      }
      return await ok();
    });
    expect(cancelOutcome!.cancelledTaskIds).toEqual(["task_2", "task_3"]);
    expect(cancelOutcome!.runningTaskIds).toEqual(["task_1"]);
    expect(h.executed).toEqual(["task_1"]);
    expect(result.plan.tasks.map((t) => t.status)).toEqual(["completed", "cancelled", "cancelled"]);

    // Resuming a cancelled plan runs nothing.
    h.executed.length = 0;
    await h.run(result.plan, ok);
    expect(h.executed).toEqual([]);
  });

  it("retries a transient failure and completes", async () => {
    const h = harness();
    const plan = approvedPlan(["task_1", "task_2"]);
    await enqueueRemainingSteps(plan, h.store.queueFor(TENANT, USER));
    let calls = 0;
    const result = await h.run(plan, async (t) => {
      if (t.task_id === "task_1" && calls++ === 0) {
        return { kind: "failed", transient: true, result: null, message: "The data lookup timed out before it finished." };
      }
      return await ok();
    });
    expect(h.executed).toEqual(["task_1", "task_1", "task_2"]);
    expect(result.plan.tasks.map((t) => t.status)).toEqual(["completed", "completed"]);
    expect(h.store.jobs.get(h.store.key("task_1"))).toMatchObject({ status: "succeeded", attempts: 2 });
    expect(h.claims.rows.get(stepMutationId(PLAN, "task_1"))?.status).toBe("completed");
  });

  it("dead-letters after the maximum attempts and blocks dependent steps", async () => {
    const h = harness();
    const plan = approvedPlan(["task_1", "task_2"]);
    await enqueueRemainingSteps(plan, h.store.queueFor(TENANT, USER));
    const result = await h.run(plan, async () => ({ kind: "failed", transient: true, result: null, message: "Network error" }));
    expect(h.executed).toEqual(["task_1", "task_1", "task_1"]);
    expect(h.store.jobs.get(h.store.key("task_1"))).toMatchObject({ status: "dead", attempts: 3 });
    expect(result.plan.tasks[0]).toMatchObject({ status: "failed", error_message: "Bloom tried 3 times. Network error" });
    expect(result.plan.tasks[1].status).toBe("blocked");
    expect(h.store.jobs.get(h.store.key("task_2"))?.status).toBe("cancelled");
  });

  it("a permanent failure is not retried", async () => {
    const h = harness();
    const plan = approvedPlan(["task_1"]);
    await enqueueRemainingSteps(plan, h.store.queueFor(TENANT, USER));
    const result = await h.run(plan, async () => ({ kind: "failed", transient: false, result: null, message: "customer_id: required" }));
    expect(h.executed).toEqual(["task_1"]);
    expect(result.plan.tasks[0]).toMatchObject({ status: "failed", error_message: "customer_id: required" });
  });

  it("runs the stored approved arguments, not later edits to the plan message", async () => {
    const h = harness();
    const plan = approvedPlan(["task_1"]);
    await enqueueRemainingSteps(plan, h.store.queueFor(TENANT, USER));
    const tampered = { ...plan, tasks: plan.tasks.map((t) => ({ ...t, tool_params: { customer_id: "someone_else" } })) };
    let seen: JsonObject | null = null;
    await h.run(tampered, async (_t, params) => { seen = params; return await ok(); });
    expect(seen).toEqual({ customer_id: "cust_task_1", notes: "note task_1" });
  });

  it("another person cannot resume or cancel the plan", async () => {
    expect(() => assertPlanOwner({ tenantId: TENANT, userId: USER }, { tenantId: TENANT, userId: OTHER_USER }))
      .toThrow(PlanAccessError);
    expect(() => assertPlanOwner({ tenantId: TENANT, userId: USER }, { tenantId: "other-tenant", userId: USER }))
      .toThrow(PlanAccessError);
    expect(new PlanAccessError().status).toBe(403);

    const h = harness();
    const plan = approvedPlan(["task_1", "task_2"]);
    await enqueueRemainingSteps(plan, h.store.queueFor(TENANT, USER));
    const otherQueue = h.store.queueFor(TENANT, OTHER_USER);
    await expect(otherQueue.enqueue([{ task_id: "task_1", tool_name: "update_customer", tool_params: {} }])).rejects.toThrow("forbidden");
    expect(await otherQueue.steps()).toEqual([]);
    expect(await otherQueue.cancel(null, "x")).toEqual([]);
    expect(await otherQueue.claim("task_1", "w")).toBeNull();

    // Even a direct run with the other person's queue executes nothing.
    const other = harness({ user: OTHER_USER });
    const outcome = await runPlanSteps(plan, {
      queue: otherQueue, claims: other.stepClaims(), execute: ok, persist: async () => undefined,
      emit: () => undefined, worker: "w", sleep: async () => undefined, now: () => h.clock.now,
    });
    expect(outcome.plan.tasks[0]).toMatchObject({ status: "failed" });
    expect([...h.store.jobs.values()].map((j) => j.status)).toEqual(["queued", "queued"]);
  });

  it("a second runner on a live plan is told it is busy instead of running steps twice", async () => {
    const h = harness();
    const plan = approvedPlan(["task_1"]);
    const queue = h.store.queueFor(TENANT, USER);
    await enqueueRemainingSteps(plan, queue);
    await queue.claim("task_1", "first-request");
    await expect(h.run(plan, ok)).rejects.toBeInstanceOf(PlanBusyError);
    expect(h.executed).toEqual([]);
  });

  it("the worker never claims chat plan steps and the gateway is service-role only", () => {
    const sql = fs.readFileSync(path.resolve(__dirname, "../../supabase/migrations/20261104120000_bloom_chat_plan_jobs.sql"), "utf8");
    expect(sql).toMatch(/AND q\.kind <> 'chat_plan_step'/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.bloom_chat_plan_rpc\(text, jsonb\) FROM PUBLIC, anon, authenticated/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.bloom_chat_plan_rpc\(text, jsonb\) TO service_role/);
  });
});
