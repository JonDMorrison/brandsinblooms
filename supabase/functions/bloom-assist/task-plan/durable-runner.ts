// Durable execution of approved Ask Bloom task plans.
//
// Each approved step is one bloom_support.jobs row (kind 'chat_plan_step'),
// created before anything runs. The job carries the approved tool call, the
// lease, the attempt count, the retry time and the dead letter. Steps run in
// the person's own request (their session and permissions), one at a time, in
// dependency order. The plan on the message is saved after every step, so a
// crash loses at most the step that was in flight.
//
// Exactly-once: before a step runs it takes its bloom_action_claims row
// ('plan:<plan_id>:<task_id>'). On resume a step whose claim is "completed" is
// marked done without running again, and a step whose claim is still
// "executing" (the request died mid-change) is shown as "outcome unknown" and
// never retried automatically.

import type { ClaimOutcome } from "../action-claims.ts";
import type { JsonObject, JsonValue } from "../types.ts";
import type {
  TaskExecutionResult,
  TaskPlan,
  TaskPlanItem,
  TaskPlanItemStatus,
  TaskProgressEmitter,
} from "./types.ts";

export const STEP_RETRY_DELAY_SECONDS = 2;
const MAX_RETRY_WAIT_MS = 15_000;
const PUBLIC_ERROR_MAX_LENGTH = 240;

export const OUTCOME_UNKNOWN_MESSAGE =
  "Bloom couldn't confirm whether this step was applied. Check the record before asking Bloom again.";
export const CANCELLED_MESSAGE = "Cancelled before it ran.";
export const BLOCKED_MESSAGE = "A required earlier task did not complete.";

export type PlanJobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "dead"
  | "cancelled";

export type PlanStepJob = {
  job_id: string;
  task_id: string;
  tool_name: string;
  tool_params: JsonObject;
  status: PlanJobStatus;
  attempts: number;
  max_attempts: number;
  run_after: string;
  lease_until: string | null;
  last_error: string | null;
};

export type StepFinish =
  | { outcome: "succeeded"; result: JsonObject }
  | { outcome: "failed"; error: string; permanent: boolean; retryIn: number | null };

/** The plan's slice of bloom_support.jobs, already scoped to the plan owner. */
export interface PlanStepQueue {
  enqueue(steps: Array<{ task_id: string; tool_name: string; tool_params: JsonObject }>): Promise<PlanStepJob[]>;
  steps(): Promise<PlanStepJob[]>;
  claim(taskId: string, worker: string): Promise<PlanStepJob | null>;
  finish(job: PlanStepJob, worker: string, finish: StepFinish): Promise<"succeeded" | "queued" | "dead">;
  cancel(taskIds: string[] | null, reason: string): Promise<string[]>;
  requeue(taskId: string): Promise<PlanStepJob | null>;
}

/** bloom_action_claims, bound to the plan's tenant/user/conversation/message. */
export interface StepClaims {
  claim(mutationId: string, toolName: string): Promise<ClaimOutcome>;
  finish(mutationId: string, status: "completed" | "failed", result: string | null): Promise<void>;
}

export type StepExecution =
  | { kind: "completed"; result: JsonValue | null; message: string | null }
  | { kind: "failed"; transient: boolean; result: JsonValue | null; message: string }
  | { kind: "unknown"; message: string };

export type PlanOwner = { tenantId: string; userId: string };

export class PlanAccessError extends Error {
  readonly status = 403;
  constructor() {
    super("This plan belongs to someone else.");
    this.name = "PlanAccessError";
  }
}

export class PlanBusyError extends Error {
  readonly status = 409;
  constructor() {
    super("Bloom is already running this plan.");
    this.name = "PlanBusyError";
  }
}

/** Same person, same company that the plan was made for. */
export function assertPlanOwner(planOwner: PlanOwner, caller: PlanOwner): void {
  if (planOwner.tenantId !== caller.tenantId || planOwner.userId !== caller.userId) {
    throw new PlanAccessError();
  }
}

export function stepMutationId(planId: string, taskId: string): string {
  return `plan:${planId}:${taskId}`;
}

export function toPublicErrorMessage(value: unknown): string {
  const message = value instanceof Error
    ? value.message
    : typeof value === "string"
    ? value
    : "Task execution failed.";
  return message.replace(/\s+/g, " ").trim().slice(0, PUBLIC_ERROR_MAX_LENGTH) || "Task execution failed.";
}

const STOPPED: ReadonlySet<TaskPlanItemStatus> = new Set(["failed", "blocked", "skipped", "cancelled", "unknown"]);

function dependencyStopped(task: TaskPlanItem, byId: Map<string, TaskPlanItem>): boolean {
  return task.depends_on.some((id) => {
    const status = byId.get(id)?.status;
    return status !== undefined && STOPPED.has(status);
  });
}

function dependenciesComplete(task: TaskPlanItem, byId: Map<string, TaskPlanItem>): boolean {
  return task.depends_on.every((id) => byId.get(id)?.status === "completed");
}

/** Approved tasks whose dependency stopped become blocked (transitively). */
export function markBlockedTasks(tasks: TaskPlanItem[]): { tasks: TaskPlanItem[]; newlyBlocked: string[] } {
  let next = tasks;
  const newlyBlocked: string[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    const byId = new Map(next.map((task) => [task.task_id, task]));
    next = next.map((task) => {
      if ((task.status === "approved" || task.status === "executing") && dependencyStopped(task, byId)) {
        changed = true;
        newlyBlocked.push(task.task_id);
        return { ...task, status: "blocked" as const, error_message: BLOCKED_MESSAGE };
      }
      return task;
    });
  }
  return { tasks: next, newlyBlocked };
}

/** Steps still to run: approved, or caught mid-run by a crash. */
export function remainingTaskIds(plan: TaskPlan): string[] {
  return plan.tasks
    .filter((task) => task.status === "approved" || task.status === "executing")
    .map((task) => task.task_id);
}

export type RunDependencies = {
  queue: PlanStepQueue;
  claims: StepClaims;
  execute: (task: TaskPlanItem, params: JsonObject) => Promise<StepExecution>;
  persist: (plan: TaskPlan) => Promise<void>;
  emit: TaskProgressEmitter;
  worker: string;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
};

export type RunOutcome = {
  plan: TaskPlan;
  results: TaskExecutionResult[];
};

function setTask(
  tasks: TaskPlanItem[],
  taskId: string,
  status: TaskPlanItemStatus,
  errorMessage: string | null,
): TaskPlanItem[] {
  return tasks.map((task) => task.task_id === taskId ? { ...task, status, error_message: errorMessage } : task);
}

/** Creates the job rows for every approved step that has none yet. */
export async function enqueueRemainingSteps(plan: TaskPlan, queue: PlanStepQueue): Promise<PlanStepJob[]> {
  const steps = plan.tasks
    .filter((task) => task.status === "approved" || task.status === "executing")
    .map((task) => ({ task_id: task.task_id, tool_name: task.tool_name, tool_params: task.tool_params }));
  return steps.length > 0 ? await queue.enqueue(steps) : await queue.steps();
}

/**
 * Runs the plan's remaining steps. Safe to call again after a crash: finished
 * steps are not run twice, cancelled steps are not run, and a step whose
 * outcome is unknown is surfaced instead of retried.
 */
export async function runPlanSteps(initial: TaskPlan, deps: RunDependencies): Promise<RunOutcome> {
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const now = deps.now ?? (() => Date.now());
  const planId = initial.plan_id;
  const results: TaskExecutionResult[] = [];
  let tasks = initial.tasks;

  const save = async () => {
    await deps.persist({ ...initial, tasks });
  };
  const report = (taskId: string, status: TaskPlanItemStatus, errorMessage: string | null) => {
    deps.emit({ plan_id: planId, task_id: taskId, status, error_message: errorMessage });
  };
  const block = async () => {
    const blocked = markBlockedTasks(tasks);
    tasks = blocked.tasks;
    if (blocked.newlyBlocked.length > 0) {
      await deps.queue.cancel(blocked.newlyBlocked, `blocked: ${BLOCKED_MESSAGE}`);
      for (const id of blocked.newlyBlocked) report(id, "blocked", BLOCKED_MESSAGE);
    }
  };
  const record = (task: TaskPlanItem, status: TaskPlanItemStatus, result: JsonValue | null, error: string | null, started: number) => {
    results.push({
      task_id: task.task_id,
      tool_name: task.tool_name,
      status,
      result,
      error_message: error,
      execution_time_ms: now() - started,
    });
  };

  await block();
  await save();

  for (;;) {
    const byId = new Map(tasks.map((task) => [task.task_id, task]));
    const ready = tasks.find((task) =>
      (task.status === "approved" || task.status === "executing") && dependenciesComplete(task, byId)
    );
    if (!ready) break;

    const started = now();
    const job = await deps.queue.claim(ready.task_id, deps.worker);

    if (!job) {
      // Not claimable: look at why.
      const current = (await deps.queue.steps()).find((step) => step.task_id === ready.task_id);
      if (!current) {
        tasks = setTask(tasks, ready.task_id, "failed", "This step was never queued. Approve the plan again.");
        report(ready.task_id, "failed", "This step was never queued. Approve the plan again.");
      } else if (current.status === "cancelled") {
        // The person cancelled the plan: every step whose job was cancelled stops here.
        const cancelledIds = new Set(
          (await deps.queue.steps()).filter((step) => step.status === "cancelled").map((step) => step.task_id),
        );
        for (const task of tasks) {
          if ((task.status === "approved" || task.status === "executing") && cancelledIds.has(task.task_id)) {
            tasks = setTask(tasks, task.task_id, "cancelled", CANCELLED_MESSAGE);
            report(task.task_id, "cancelled", CANCELLED_MESSAGE);
          }
        }
      } else if (current.status === "succeeded") {
        tasks = setTask(tasks, ready.task_id, "completed", null);
        report(ready.task_id, "completed", null);
      } else if (current.status === "dead" || current.status === "failed") {
        const message = toPublicErrorMessage(current.last_error ?? "This step failed.");
        tasks = setTask(tasks, ready.task_id, "failed", message);
        report(ready.task_id, "failed", message);
      } else if (current.status === "running") {
        // Another request holds a live lease on this step.
        await save();
        throw new PlanBusyError();
      } else {
        // Queued for a retry that is not due yet: wait briefly, then try again.
        const waitMs = Math.max(0, Date.parse(current.run_after) - now());
        if (waitMs > MAX_RETRY_WAIT_MS) {
          await save();
          throw new PlanBusyError();
        }
        await sleep(waitMs + 50);
        continue;
      }
      await block();
      await save();
      continue;
    }

    tasks = setTask(tasks, ready.task_id, "executing", null);
    report(ready.task_id, "executing", null);
    await save();

    const mutationId = stepMutationId(planId, ready.task_id);
    let claim: ClaimOutcome;
    try {
      claim = await deps.claims.claim(mutationId, job.tool_name);
    } catch (error) {
      // Nothing ran; give the step back to the queue for a later attempt.
      const status = await deps.queue.finish(job, deps.worker, {
        outcome: "failed",
        error: toPublicErrorMessage(error),
        permanent: false,
        retryIn: STEP_RETRY_DELAY_SECONDS,
      });
      if (status === "dead") {
        const message = toPublicErrorMessage(error);
        tasks = setTask(tasks, ready.task_id, "failed", message);
        report(ready.task_id, "failed", message);
        record(ready, "failed", null, message, started);
      } else {
        tasks = setTask(tasks, ready.task_id, "approved", null);
      }
      await block();
      await save();
      continue;
    }

    if (claim.kind === "already_done") {
      // It ran before the interruption. Do not run it again.
      await deps.queue.finish(job, deps.worker, { outcome: "succeeded", result: { note: "already applied", replayed: true } });
      tasks = setTask(tasks, ready.task_id, "completed", null);
      report(ready.task_id, "completed", null);
      record(ready, "completed", claim.result, null, started);
      await save();
      continue;
    }

    if (claim.kind === "in_progress") {
      // An earlier attempt started this change and never reported back.
      await deps.queue.finish(job, deps.worker, { outcome: "failed", error: "outcome unknown", permanent: true, retryIn: null });
      tasks = setTask(tasks, ready.task_id, "unknown", OUTCOME_UNKNOWN_MESSAGE);
      report(ready.task_id, "unknown", OUTCOME_UNKNOWN_MESSAGE);
      record(ready, "unknown", null, OUTCOME_UNKNOWN_MESSAGE, started);
      await block();
      await save();
      continue;
    }

    // Run exactly the tool call stored when the plan was approved.
    let execution: StepExecution;
    try {
      execution = await deps.execute(ready, job.tool_params);
    } catch (error) {
      console.error("[bloom-assist] plan step outcome unknown", mutationId, toPublicErrorMessage(error));
      execution = { kind: "unknown", message: OUTCOME_UNKNOWN_MESSAGE };
    }

    if (execution.kind === "completed") {
      await deps.claims.finish(mutationId, "completed", execution.message);
      await deps.queue.finish(job, deps.worker, { outcome: "succeeded", result: { note: execution.message ?? "completed" } });
      tasks = setTask(tasks, ready.task_id, "completed", null);
      report(ready.task_id, "completed", null);
      record(ready, "completed", execution.result, null, started);
    } else if (execution.kind === "failed") {
      // A reported failure changed nothing (same rule as single approvals), so it may be retried.
      const message = toPublicErrorMessage(execution.message);
      await deps.claims.finish(mutationId, "failed", message);
      const status = await deps.queue.finish(job, deps.worker, {
        outcome: "failed",
        error: message,
        permanent: !execution.transient,
        retryIn: STEP_RETRY_DELAY_SECONDS,
      });
      if (status === "queued") {
        tasks = setTask(tasks, ready.task_id, "approved", null);
        report(ready.task_id, "approved", `Retrying: ${message}`);
      } else {
        const finalMessage = execution.transient
          ? toPublicErrorMessage(`Bloom tried ${job.attempts} times. ${message}`)
          : message;
        tasks = setTask(tasks, ready.task_id, "failed", finalMessage);
        report(ready.task_id, "failed", finalMessage);
        record(ready, "failed", execution.result, finalMessage, started);
      }
    } else {
      // Leave the claim "executing" so the change can never run twice.
      await deps.queue.finish(job, deps.worker, { outcome: "failed", error: "outcome unknown", permanent: true, retryIn: null });
      tasks = setTask(tasks, ready.task_id, "unknown", OUTCOME_UNKNOWN_MESSAGE);
      report(ready.task_id, "unknown", OUTCOME_UNKNOWN_MESSAGE);
      record(ready, "unknown", null, OUTCOME_UNKNOWN_MESSAGE, started);
    }

    await block();
    await save();
  }

  await block();
  await save();
  return { plan: { ...initial, tasks }, results };
}

/**
 * Stops the steps that have not started. A step that is running finishes.
 * Returns the plan with cancelled steps marked.
 */
export async function cancelPlanSteps(
  plan: TaskPlan,
  queue: PlanStepQueue,
): Promise<{ plan: TaskPlan; cancelledTaskIds: string[]; runningTaskIds: string[] }> {
  const cancelled = new Set(await queue.cancel(null, "cancelled by person"));
  const jobs = new Map((await queue.steps()).map((step) => [step.task_id, step]));
  const runningTaskIds: string[] = [];
  const tasks = plan.tasks.map((task) => {
    if (task.status !== "approved" && task.status !== "executing") return task;
    const job = jobs.get(task.task_id);
    if (cancelled.has(task.task_id) || job?.status === "cancelled" || !job) {
      return { ...task, status: "cancelled" as const, error_message: CANCELLED_MESSAGE };
    }
    if (job.status === "succeeded") return { ...task, status: "completed" as const, error_message: null };
    if (job.status === "dead" || job.status === "failed") {
      return { ...task, status: "failed" as const, error_message: toPublicErrorMessage(job.last_error ?? "This step failed.") };
    }
    runningTaskIds.push(task.task_id);
    return task;
  });
  return { plan: { ...plan, tasks }, cancelledTaskIds: [...cancelled], runningTaskIds };
}
