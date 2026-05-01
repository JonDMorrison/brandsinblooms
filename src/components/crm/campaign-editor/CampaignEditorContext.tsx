import * as React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  LOCKED_STATUSES,
  isLockedCampaignStatus,
} from "@/constants/campaignStatuses";
import { computeAudienceRecipientCount } from "@/lib/computeAudienceRecipientCount";
import {
  fetchCampaignEditorRecord,
  persistCampaignDraft,
  updateCampaignStatus,
  type CampaignEditorRecord,
  type CampaignPersonaSummary,
  type CampaignSegmentSummary,
  type CampaignStatus,
  type EditorCampaignType,
} from "@/lib/crm/campaignEditor";
import {
  CampaignDraftConflictError,
  writeCampaignDraftSnapshot,
  type DraftSnapshotTrigger,
} from "@/lib/crm/campaignDraftPersistence";
import { SYSTEM_PERSONAS } from "@/config/systemPersonas";
import {
  AUTO_SAVE_MAX_RETRIES,
  AUTO_SAVE_RETRY_DELAYS_MS,
  decideAutoSaveFailure,
} from "./autoSaveRetryPolicy";
import {
  useCampaignSending,
  type CampaignSendResult,
} from "@/hooks/useCampaignSending";
import { useTenant } from "@/hooks/useTenant";
import { useSenderConfiguration } from "@/hooks/useSenderConfiguration";
import { supabase } from "@/integrations/supabase/client";
import type { SendError } from "@/utils/campaignSendingErrors";
import type { ContentBlock } from "@/types/emailBuilder";

type Segment = CampaignSegmentSummary;
type Persona = CampaignPersonaSummary;
type AutoSaveStatus =
  | "idle"
  | "saving"
  | "saved"
  | "error"
  | "conflict"
  // The user-facing "we tried 3 times and gave up" terminal state. Distinct
  // from "error" so the UI can render a different (clearer, scarier) message.
  | "failed";

export interface CampaignEditorState {
  campaignId: string | null;
  campaignType: EditorCampaignType;
  status: CampaignStatus;
  sendBlockedReason: string | null;
  name: string;
  subjectLine: string;
  preheaderText: string;
  senderName: string;
  senderEmail: string;
  replyTo: string;
  selectedSegments: Segment[];
  selectedPersonas: Persona[];
  audienceCount: number | null;
  isAudienceLoading: boolean;
  contentBlocks: ContentBlock[];
  smsMessage: string;
  sendAt: Date | null;
  sendImmediately: boolean;
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: Date | null;
  autoSaveStatus: AutoSaveStatus;
  autoSaveMessage: string | null;
  isLocked: boolean;
  sourceContentTaskId: string | null;
  sourceSegmentId: string | null;
  sourcePersonaId: string | null;
}

export type CampaignActivationResult =
  | CampaignSendResult
  | {
      success: true;
      campaignId: string;
      recipientCount: number;
      status: CampaignStatus;
      complianceWarnings: string[];
    }
  | {
      success: false;
      error: SendError;
      campaignId?: string;
    };

interface CampaignActivationOptions {
  suppressToasts?: boolean;
  sendImmediately?: boolean;
  sendAt?: Date | null;
}

interface CampaignEditorContextValue extends CampaignEditorState {
  isLoading: boolean;
  syncLiveCampaign: (
    next: Partial<
      Pick<CampaignEditorState, "campaignId" | "status" | "sendBlockedReason">
    >,
  ) => void;
  updateSetup: (
    next: Partial<
      Pick<
        CampaignEditorState,
        | "name"
        | "campaignType"
        | "subjectLine"
        | "preheaderText"
        | "senderName"
        | "senderEmail"
        | "replyTo"
      >
    >,
  ) => void;
  updateAudience: (next: {
    selectedSegments?: Segment[];
    selectedPersonas?: Persona[];
  }) => void;
  updateContent: (
    next: Partial<Pick<CampaignEditorState, "contentBlocks" | "smsMessage">>,
  ) => void;
  updateSchedule: (
    next: Partial<Pick<CampaignEditorState, "sendAt" | "sendImmediately">>,
  ) => void;
  saveDraft: (options?: {
    silent?: boolean;
    status?: CampaignStatus;
  }) => Promise<string | null>;
  setAutoSavePaused: (paused: boolean) => void;
  captureDraftSnapshot: (trigger: DraftSnapshotTrigger) => Promise<void>;
  activate: (
    options?: CampaignActivationOptions,
  ) => Promise<CampaignActivationResult>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  cancel: () => Promise<void>;
  reload: () => Promise<void>;
}

const AUTO_SAVE_MS = 3000;
// Retry policy lives in autoSaveRetryPolicy.ts (extracted for unit testing).
// New edits cancel pending retries via the keystroke debounce effect — when
// the user edits, status flips off "error", which fires the retry effect's
// cleanup and clearTimeout's the queued retry.
const AUTO_SAVE_SUCCESS_VISIBILITY_MS = 2000;
const AUDIENCE_RECALC_MS = 300;

const CampaignEditorContext =
  React.createContext<CampaignEditorContextValue | null>(null);

function areIdListsEqual(
  left: Array<{ id: string }>,
  right: Array<{ id: string }>,
) {
  if (left === right) return true;
  if (left.length !== right.length) return false;

  for (let index = 0; index < left.length; index += 1) {
    if (left[index]?.id !== right[index]?.id) {
      return false;
    }
  }

  return true;
}

function areDatesEqual(left: Date | null, right: Date | null) {
  if (left === right) return true;
  if (!left || !right) return left === right;
  return left.getTime() === right.getTime();
}

function areContentBlocksEqual(left: ContentBlock[], right: ContentBlock[]) {
  if (left === right) return true;
  return JSON.stringify(left) === JSON.stringify(right);
}

function buildDraftFingerprint(input: {
  campaignId: string | null;
  campaignType: EditorCampaignType;
  status: CampaignStatus;
  name: string;
  subjectLine: string;
  preheaderText: string;
  senderName: string;
  senderEmail: string;
  fromEmailDomainId: string | null;
  replyTo: string;
  contentBlocks: ContentBlock[];
  smsMessage: string;
  sendAt: Date | null;
  sendImmediately: boolean;
  segments: Segment[];
  personas: Persona[];
  sourceContentTaskId: string | null;
  sourceSegmentId: string | null;
  sourcePersonaId: string | null;
}) {
  return JSON.stringify({
    campaignId: input.campaignId,
    campaignType: input.campaignType,
    status: input.status,
    name: input.name,
    subjectLine: input.subjectLine,
    preheaderText: input.preheaderText,
    senderName: input.senderName,
    senderEmail: input.senderEmail,
    fromEmailDomainId: input.fromEmailDomainId,
    replyTo: input.replyTo,
    contentBlocks: input.contentBlocks,
    smsMessage: input.smsMessage,
    sendAt: input.sendAt?.toISOString() ?? null,
    sendImmediately: input.sendImmediately,
    segments: input.segments.map((segment) => segment.id),
    personas: input.personas.map((persona) => persona.id),
    sourceContentTaskId: input.sourceContentTaskId,
    sourceSegmentId: input.sourceSegmentId,
    sourcePersonaId: input.sourcePersonaId,
  });
}

function createInitialState(
  searchParams: URLSearchParams,
): CampaignEditorState {
  return {
    campaignId: null,
    campaignType: "email",
    status: "draft",
    sendBlockedReason: null,
    name: "",
    subjectLine: "",
    preheaderText: "",
    senderName: "",
    senderEmail: "",
    replyTo: "",
    selectedSegments: [],
    selectedPersonas: [],
    audienceCount: null,
    isAudienceLoading: false,
    contentBlocks: [],
    smsMessage: "",
    sendAt: null,
    sendImmediately: true,
    isDirty: false,
    isSaving: false,
    lastSavedAt: null,
    autoSaveStatus: "idle",
    autoSaveMessage: null,
    isLocked: false,
    sourceContentTaskId: searchParams.get("contentTaskId"),
    sourceSegmentId: searchParams.get("segment"),
    sourcePersonaId: searchParams.get("persona"),
  };
}

function toEditorCampaignType(
  record: CampaignEditorRecord,
): EditorCampaignType {
  return record.channel === "sms" ? "sms" : "email";
}

export function CampaignEditorProvider({
  children,
  campaignId,
}: {
  children: React.ReactNode;
  campaignId?: string | null;
}) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { tenant } = useTenant();
  const { senderConfig } = useSenderConfiguration();
  const [state, setState] = React.useState<CampaignEditorState>(() =>
    createInitialState(searchParams),
  );
  const [isLoading, setIsLoading] = React.useState(Boolean(campaignId));
  const campaignIdRef = React.useRef<string | null>(state.campaignId);
  const campaignStatusRef = React.useRef<CampaignStatus>(state.status);
  const autosaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const saveQueueRef = React.useRef<Promise<void>>(Promise.resolve());
  const autoSaveRetryTimerRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const autoSaveSuccessTimerRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const hasHydratedRef = React.useRef(false);
  const lastSavedFingerprintRef = React.useRef<string | null>(null);
  const lastUpdatedAtRef = React.useRef<string | null>(null);
  // Number of consecutive failures for the current draft fingerprint.
  // 0 = no failures (or last save succeeded). Bumped in the saveDraft catch
  // and read by the retry effect to pick the next backoff delay. Reset when
  // saveDraft fires for a different fingerprint (i.e., user edited) or when
  // a save succeeds.
  const autoSaveAttemptRef = React.useRef(0);
  // The fingerprint of the draft that the current retry sequence is trying
  // to save. When saveDraft is invoked with a different fingerprint, we
  // treat it as a fresh attempt and reset autoSaveAttemptRef.
  const autoSaveLastTriedFingerprintRef = React.useRef<string | null>(null);
  const [autoSavePaused, setAutoSavePausedState] = React.useState(false);

  React.useEffect(() => {
    campaignIdRef.current = state.campaignId;
  }, [state.campaignId]);

  React.useEffect(() => {
    campaignStatusRef.current = state.status;
  }, [state.status]);

  const sending = useCampaignSending({
    navigateOnSuccess: false,
    suppressToasts: true,
    onSuccess: (savedCampaignId) => {
      setState((current) => ({
        ...current,
        campaignId: savedCampaignId,
        status: "queued",
        isDirty: false,
        sendBlockedReason: null,
        isLocked: true,
      }));
      if (campaignId !== savedCampaignId) {
        navigate(`/crm/campaigns/${savedCampaignId}`, { replace: true });
      }
    },
  });

  const applyLoadedCampaign = React.useCallback(
    (record: CampaignEditorRecord) => {
      const nextState = {
        campaignId: record.id,
        campaignType: toEditorCampaignType(record),
        status: record.status,
        name: record.name,
        subjectLine: record.subjectLine,
        preheaderText: record.preheaderText,
        senderName: record.senderName,
        senderEmail: record.senderEmail,
        replyTo: record.replyTo,
        contentBlocks: record.contentBlocks,
        smsMessage: record.smsMessage,
        sendAt: record.scheduledAt ? new Date(record.scheduledAt) : null,
        sendImmediately: !record.scheduledAt,
        segments: record.segments,
        personas: record.personas,
        sourceContentTaskId: record.sourceContentTaskId,
        sourceSegmentId: null,
        sourcePersonaId: null,
      };

      lastSavedFingerprintRef.current = buildDraftFingerprint({
        ...nextState,
        fromEmailDomainId: senderConfig?.fromEmailDomainId ?? null,
      });
      lastUpdatedAtRef.current = record.updatedAt;

      setState((current) => ({
        ...current,
        campaignId: nextState.campaignId,
        campaignType: nextState.campaignType,
        status: nextState.status,
        sendBlockedReason: record.sendBlockedReason,
        name: nextState.name,
        subjectLine: nextState.subjectLine,
        preheaderText: nextState.preheaderText,
        senderName: nextState.senderName,
        senderEmail: nextState.senderEmail,
        replyTo: nextState.replyTo,
        selectedSegments: nextState.segments,
        selectedPersonas: nextState.personas,
        contentBlocks: nextState.contentBlocks,
        smsMessage: nextState.smsMessage,
        sendAt: nextState.sendAt,
        sendImmediately: nextState.sendImmediately,
        isDirty: false,
        isSaving: false,
        lastSavedAt: record.updatedAt ? new Date(record.updatedAt) : null,
        autoSaveStatus: "idle",
        autoSaveMessage: null,
        isLocked: LOCKED_STATUSES.includes(record.status),
        sourceContentTaskId:
          nextState.sourceContentTaskId ?? current.sourceContentTaskId,
        sourceSegmentId: current.sourceSegmentId,
        sourcePersonaId: current.sourcePersonaId,
      }));
    },
    [senderConfig?.fromEmailDomainId],
  );

  const syncLiveCampaign = React.useCallback<
    CampaignEditorContextValue["syncLiveCampaign"]
  >((next) => {
    setState((current) => {
      const hasCampaignId = Object.prototype.hasOwnProperty.call(
        next,
        "campaignId",
      );
      const hasStatus = Object.prototype.hasOwnProperty.call(next, "status");
      const hasSendBlockedReason = Object.prototype.hasOwnProperty.call(
        next,
        "sendBlockedReason",
      );

      const nextCampaignId = hasCampaignId
        ? (next.campaignId ?? null)
        : current.campaignId;
      const nextStatus = hasStatus
        ? (next.status ?? current.status)
        : current.status;
      const nextSendBlockedReason = hasSendBlockedReason
        ? (next.sendBlockedReason ?? null)
        : current.sendBlockedReason;
      const nextIsLocked = hasStatus
        ? isLockedCampaignStatus(nextStatus)
        : current.isLocked;

      if (
        nextCampaignId === current.campaignId &&
        nextStatus === current.status &&
        nextSendBlockedReason === current.sendBlockedReason &&
        nextIsLocked === current.isLocked
      ) {
        return current;
      }

      return {
        ...current,
        campaignId: nextCampaignId,
        status: nextStatus,
        sendBlockedReason: nextSendBlockedReason,
        isLocked: nextIsLocked,
      };
    });
  }, []);

  const reload = React.useCallback(async () => {
    if (!campaignId) {
      setIsLoading(false);
      return;
    }

    const shouldShowInitialLoading = !hasHydratedRef.current;

    if (shouldShowInitialLoading) {
      setIsLoading(true);
    }

    try {
      const record = await fetchCampaignEditorRecord(campaignId);
      applyLoadedCampaign(record);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load campaign",
      );
    } finally {
      hasHydratedRef.current = true;
      setIsLoading(false);
    }
  }, [applyLoadedCampaign, campaignId]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  React.useEffect(() => {
    if (!campaignId && senderConfig && !hasHydratedRef.current) {
      hasHydratedRef.current = true;
      setState((current) => {
        const nextState = {
          ...current,
          senderName: current.senderName || senderConfig.displayName || "",
          senderEmail: current.senderEmail || senderConfig.senderEmail || "",
          replyTo:
            current.replyTo ||
            senderConfig.replyToEmail ||
            senderConfig.senderEmail ||
            "",
        };

        lastSavedFingerprintRef.current = buildDraftFingerprint({
          campaignId: nextState.campaignId,
          campaignType: nextState.campaignType,
          status: nextState.status,
          name: nextState.name,
          subjectLine: nextState.subjectLine,
          preheaderText: nextState.preheaderText,
          senderName: nextState.senderName,
          senderEmail: nextState.senderEmail,
          fromEmailDomainId: senderConfig.fromEmailDomainId ?? null,
          replyTo: nextState.replyTo,
          contentBlocks: nextState.contentBlocks,
          smsMessage: nextState.smsMessage,
          sendAt: nextState.sendAt,
          sendImmediately: nextState.sendImmediately,
          segments: nextState.selectedSegments,
          personas: nextState.selectedPersonas,
          sourceContentTaskId: nextState.sourceContentTaskId,
          sourceSegmentId: nextState.sourceSegmentId,
          sourcePersonaId: nextState.sourcePersonaId,
        });

        return nextState;
      });
      setIsLoading(false);
    }
  }, [campaignId, senderConfig]);

  React.useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
      if (autoSaveRetryTimerRef.current) {
        clearTimeout(autoSaveRetryTimerRef.current);
      }
      if (autoSaveSuccessTimerRef.current) {
        clearTimeout(autoSaveSuccessTimerRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    const hydratePrefillSelections = async () => {
      const prefillSegmentId = state.sourceSegmentId;
      const prefillPersonaId = state.sourcePersonaId;

      if (!prefillSegmentId && !prefillPersonaId) {
        return;
      }

      const next: {
        selectedSegments?: Segment[];
        selectedPersonas?: Persona[];
      } = {};

      if (
        prefillSegmentId &&
        state.selectedSegments.length === 0 &&
        tenant?.id
      ) {
        const { data, error } = await supabase
          .from("crm_segments")
          .select("id, name, description, customer_count")
          .eq("id", prefillSegmentId)
          .eq("tenant_id", tenant.id)
          .maybeSingle();

        if (!error && data) {
          next.selectedSegments = [
            {
              id: data.id,
              name: data.name,
              description: data.description,
              customer_count: data.customer_count ?? 0,
            },
          ];
        }
      }

      if (prefillPersonaId && state.selectedPersonas.length === 0) {
        const systemPersona = SYSTEM_PERSONAS.find(
          (persona) => persona.id === prefillPersonaId,
        );

        if (systemPersona) {
          next.selectedPersonas = [
            {
              id: systemPersona.id,
              name: systemPersona.persona_name,
              description: systemPersona.persona_description,
            },
          ];
        } else if (tenant?.id) {
          const { data, error } = await supabase
            .from("crm_personas")
            .select("id, persona_name, persona_description")
            .eq("id", prefillPersonaId)
            .eq("tenant_id", tenant.id)
            .maybeSingle();

          if (!error && data) {
            next.selectedPersonas = [
              {
                id: data.id,
                name: data.persona_name,
                description: data.persona_description,
              },
            ];
          }
        }
      }

      if (!cancelled && (next.selectedSegments || next.selectedPersonas)) {
        setState((current) => ({
          ...current,
          selectedSegments: next.selectedSegments ?? current.selectedSegments,
          selectedPersonas: next.selectedPersonas ?? current.selectedPersonas,
        }));
      }
    };

    void hydratePrefillSelections();

    return () => {
      cancelled = true;
    };
  }, [
    state.selectedPersonas.length,
    state.selectedSegments.length,
    state.sourcePersonaId,
    state.sourceSegmentId,
    tenant?.id,
  ]);

  React.useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const computeAudience = async () => {
      if (!tenant?.id) {
        setState((current) => ({
          ...current,
          audienceCount: 0,
          isAudienceLoading: false,
        }));
        return;
      }

      setState((current) => ({ ...current, isAudienceLoading: true }));
      try {
        let count: number;

        if (
          state.selectedSegments.length === 0 &&
          state.selectedPersonas.length === 0
        ) {
          // "All Contacts" mode — count all emailable customers for this tenant
          const { count: total } = await supabase
            .from("crm_customers")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tenant.id)
            .not("email", "is", null)
            .not("email_opt_in", "is", false);
          count = total ?? 0;
        } else {
          count = await computeAudienceRecipientCount({
            tenantId: tenant.id,
            segmentIds: state.selectedSegments.map((segment) => segment.id),
            personaIds: state.selectedPersonas.map((persona) => persona.id),
          });
        }

        if (!cancelled) {
          setState((current) => ({
            ...current,
            audienceCount: count,
            isAudienceLoading: false,
          }));
        }
      } catch (error) {
        console.error("Failed to compute exact audience count", error);
        if (!cancelled) {
          setState((current) => ({
            ...current,
            audienceCount: null,
            isAudienceLoading: false,
          }));
        }
      }
    };

    timer = setTimeout(() => {
      void computeAudience();
    }, AUDIENCE_RECALC_MS);

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [state.selectedPersonas, state.selectedSegments, tenant?.id]);

  const draftPayload = React.useMemo(
    () => ({
      campaignId: state.campaignId,
      campaignType: state.campaignType,
      status: state.status,
      name: state.name,
      subjectLine: state.subjectLine,
      preheaderText: state.preheaderText,
      senderName: state.senderName,
      senderEmail: state.senderEmail,
      fromEmailDomainId: senderConfig?.fromEmailDomainId ?? null,
      replyTo: state.replyTo,
      contentBlocks: state.contentBlocks,
      smsMessage: state.smsMessage,
      sendAt: state.sendAt,
      sendImmediately: state.sendImmediately,
      segments: state.selectedSegments,
      personas: state.selectedPersonas,
      sourceContentTaskId: state.sourceContentTaskId,
      sourceSegmentId: state.sourceSegmentId,
      sourcePersonaId: state.sourcePersonaId,
    }),
    [
      senderConfig?.fromEmailDomainId,
      state.campaignId,
      state.campaignType,
      state.contentBlocks,
      state.name,
      state.preheaderText,
      state.replyTo,
      state.selectedPersonas,
      state.selectedSegments,
      state.sendAt,
      state.sendImmediately,
      state.senderEmail,
      state.senderName,
      state.smsMessage,
      state.sourceContentTaskId,
      state.sourcePersonaId,
      state.sourceSegmentId,
      state.status,
      state.subjectLine,
    ],
  );

  const draftFingerprint = React.useMemo(
    () =>
      buildDraftFingerprint({
        ...draftPayload,
      }),
    [draftPayload],
  );

  const syncPersistedCampaignVersion = React.useCallback(
    ({
      campaignId: nextCampaignId,
      status: nextStatus,
      updatedAt,
    }: {
      campaignId?: string | null;
      status?: CampaignStatus;
      updatedAt?: string | null;
    }) => {
      if (typeof nextCampaignId === "string" || nextCampaignId === null) {
        campaignIdRef.current = nextCampaignId;
      }

      if (nextStatus) {
        campaignStatusRef.current = nextStatus;
      }

      if (updatedAt !== undefined) {
        lastUpdatedAtRef.current = updatedAt;
      }
    },
    [],
  );

  const runDraftSave = React.useCallback(
    async ({
      payload,
      fingerprint,
      requestedStatus,
    }: {
      payload: typeof draftPayload;
      fingerprint: string;
      requestedStatus: CampaignStatus;
    }) => {
      if (
        fingerprint === lastSavedFingerprintRef.current &&
        requestedStatus === campaignStatusRef.current
      ) {
        return campaignIdRef.current;
      }

      // Treat this as a fresh save attempt (counter reset) whenever the
      // draft fingerprint differs from what the retry sequence was working
      // on. Retries call saveDraft with the same fingerprint and preserve
      // the counter. New edits (or unrelated user-initiated saves) restart
      // the budget at zero.
      if (autoSaveLastTriedFingerprintRef.current !== fingerprint) {
        autoSaveAttemptRef.current = 0;
        autoSaveLastTriedFingerprintRef.current = fingerprint;
      }

      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }

      // Clear any pending retry timer — we're firing a save NOW. Without
      // this, an in-flight save and a queued retry of the same content
      // could double-fire. Idempotent upserts make that harmless but wasteful.
      if (autoSaveRetryTimerRef.current) {
        clearTimeout(autoSaveRetryTimerRef.current);
        autoSaveRetryTimerRef.current = null;
      }

      if (autoSaveSuccessTimerRef.current) {
        clearTimeout(autoSaveSuccessTimerRef.current);
        autoSaveSuccessTimerRef.current = null;
      }

      setState((current) => ({
        ...current,
        isSaving: true,
        autoSaveStatus: "saving",
        autoSaveMessage: null,
      }));

      try {
        const saved = await persistCampaignDraft({
          ...payload,
          expectedUpdatedAt: lastUpdatedAtRef.current,
          status: requestedStatus,
        });

        lastSavedFingerprintRef.current = fingerprint;
        syncPersistedCampaignVersion({
          campaignId: saved.id,
          status: saved.status,
          updatedAt: saved.updatedAt,
        });
        // Reset the retry budget on success so the next failure starts
        // from a fresh attempt count.
        autoSaveAttemptRef.current = 0;
        autoSaveLastTriedFingerprintRef.current = null;

        setState((current) => ({
          ...current,
          campaignId: saved.id,
          status: saved.status,
          isDirty: false,
          isSaving: false,
          lastSavedAt: saved.updatedAt ? new Date(saved.updatedAt) : new Date(),
          autoSaveStatus: "saved",
          autoSaveMessage: null,
          isLocked: isLockedCampaignStatus(saved.status),
        }));

        autoSaveSuccessTimerRef.current = setTimeout(() => {
          setState((current) =>
            current.autoSaveStatus === "saved"
              ? { ...current, autoSaveStatus: "idle" }
              : current,
          );
        }, AUTO_SAVE_SUCCESS_VISIBILITY_MS);

        return saved.id;
      } catch (error) {
        if (error instanceof CampaignDraftConflictError) {
          setState((current) => ({
            ...current,
            isSaving: false,
            autoSaveStatus: "conflict",
            autoSaveMessage: error.message,
          }));
          return null;
        }

        autoSaveAttemptRef.current += 1;
        const decision = decideAutoSaveFailure(autoSaveAttemptRef.current);

        if (decision.kind === "failed") {
          setState((current) => ({
            ...current,
            isSaving: false,
            autoSaveStatus: "failed",
            autoSaveMessage: decision.message,
          }));
          console.error(
            `Failed to save campaign draft after ${AUTO_SAVE_MAX_RETRIES} retries`,
            error,
          );
          return null;
        }

        setState((current) => ({
          ...current,
          isSaving: false,
          autoSaveStatus: "error",
          autoSaveMessage: decision.message,
        }));
        console.error(
          `Failed to save campaign draft (attempt ${decision.attempt} of ${AUTO_SAVE_MAX_RETRIES})`,
          error,
        );
        return null;
      }
    },
    [syncPersistedCampaignVersion],
  );

  const saveDraft = React.useCallback(
    async (options?: { silent?: boolean; status?: CampaignStatus }) => {
      const requestedStatus = options?.status ?? draftPayload.status;
      const nextFingerprint = buildDraftFingerprint({
        ...draftPayload,
        status: requestedStatus,
      });

      const queuedSave = saveQueueRef.current
        .catch(() => undefined)
        .then(() =>
          runDraftSave({
            payload: draftPayload,
            fingerprint: nextFingerprint,
            requestedStatus,
          }),
        );

      saveQueueRef.current = queuedSave.then(
        () => undefined,
        () => undefined,
      );

      return queuedSave;
    },
    [draftPayload, runDraftSave],
  );

  const setAutoSavePaused = React.useCallback((paused: boolean) => {
    setAutoSavePausedState((current) =>
      current === paused ? current : paused,
    );
  }, []);

  const captureDraftSnapshot = React.useCallback(
    async (trigger: DraftSnapshotTrigger) => {
      const savedCampaignId = await saveDraft({ silent: true });
      if (!savedCampaignId) {
        return;
      }

      try {
        await writeCampaignDraftSnapshot({
          campaignId: savedCampaignId,
          campaignType: state.campaignType,
          trigger,
          subjectLine: state.subjectLine,
          preheaderText: state.preheaderText,
          smsMessage: state.smsMessage,
          contentBlocks: state.contentBlocks,
          segmentIds: state.selectedSegments.map((segment) => segment.id),
          personaIds: state.selectedPersonas.map((persona) => persona.id),
        });
      } catch (error) {
        console.error("Failed to write draft snapshot", error);
      }
    },
    [
      saveDraft,
      state.campaignType,
      state.contentBlocks,
      state.preheaderText,
      state.selectedPersonas,
      state.selectedSegments,
      state.smsMessage,
      state.subjectLine,
    ],
  );

  React.useEffect(() => {
    if (
      !state.isDirty ||
      state.isLocked ||
      isLoading ||
      draftFingerprint === lastSavedFingerprintRef.current ||
      autoSavePaused ||
      state.autoSaveStatus === "conflict"
    ) {
      return;
    }

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      void saveDraft({ silent: true });
    }, AUTO_SAVE_MS);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [
    autoSavePaused,
    draftFingerprint,
    isLoading,
    saveDraft,
    state.autoSaveStatus,
    state.isDirty,
    state.isLocked,
  ]);

  // Schedule the next retry after a failed save. Uses the exponential-style
  // backoff in AUTO_SAVE_RETRY_DELAYS_MS, indexed by the current attempt
  // count. Once attempt > AUTO_SAVE_MAX_RETRIES the saveDraft catch sets
  // status to "failed" instead of "error", so this effect's guard exits
  // early and no further retries are scheduled. New edits flip status away
  // from "error" via updateSetup/updateAudience/etc., which fires the
  // cleanup below and clears the pending timer.
  React.useEffect(() => {
    if (
      state.autoSaveStatus !== "error" ||
      !state.isDirty ||
      state.isLocked ||
      isLoading ||
      autoSavePaused
    ) {
      return;
    }

    if (autoSaveRetryTimerRef.current) {
      clearTimeout(autoSaveRetryTimerRef.current);
    }

    const attempt = autoSaveAttemptRef.current;
    if (attempt < 1 || attempt > AUTO_SAVE_MAX_RETRIES) {
      return;
    }
    const delay = AUTO_SAVE_RETRY_DELAYS_MS[attempt - 1];

    autoSaveRetryTimerRef.current = setTimeout(() => {
      autoSaveRetryTimerRef.current = null;
      void saveDraft({ silent: true });
    }, delay);

    return () => {
      if (autoSaveRetryTimerRef.current) {
        clearTimeout(autoSaveRetryTimerRef.current);
        autoSaveRetryTimerRef.current = null;
      }
    };
  }, [
    autoSavePaused,
    isLoading,
    saveDraft,
    state.autoSaveStatus,
    state.isDirty,
    state.isLocked,
  ]);

  const updateSetup = React.useCallback<
    CampaignEditorContextValue["updateSetup"]
  >((next) => {
    setState((current) => {
      const changed = Object.entries(next).some(
        ([key, value]) => current[key as keyof CampaignEditorState] !== value,
      );

      if (!changed) {
        return current;
      }

      return {
        ...current,
        ...next,
        isDirty: true,
        autoSaveStatus:
          current.autoSaveStatus === "conflict" ? "conflict" : "idle",
        autoSaveMessage:
          current.autoSaveStatus === "conflict"
            ? current.autoSaveMessage
            : null,
      };
    });
  }, []);

  const updateAudience = React.useCallback<
    CampaignEditorContextValue["updateAudience"]
  >((next) => {
    setState((current) => {
      const nextSegments = next.selectedSegments ?? current.selectedSegments;
      const nextPersonas = next.selectedPersonas ?? current.selectedPersonas;

      if (
        areIdListsEqual(current.selectedSegments, nextSegments) &&
        areIdListsEqual(current.selectedPersonas, nextPersonas)
      ) {
        return current;
      }

      return {
        ...current,
        selectedSegments: nextSegments,
        selectedPersonas: nextPersonas,
        isDirty: true,
        autoSaveStatus:
          current.autoSaveStatus === "conflict" ? "conflict" : "idle",
        autoSaveMessage:
          current.autoSaveStatus === "conflict"
            ? current.autoSaveMessage
            : null,
      };
    });
  }, []);

  const updateContent = React.useCallback<
    CampaignEditorContextValue["updateContent"]
  >((next) => {
    setState((current) => {
      const nextBlocks = next.contentBlocks ?? current.contentBlocks;
      const nextSmsMessage = next.smsMessage ?? current.smsMessage;

      if (
        areContentBlocksEqual(current.contentBlocks, nextBlocks) &&
        current.smsMessage === nextSmsMessage
      ) {
        return current;
      }

      return {
        ...current,
        ...next,
        isDirty: true,
        autoSaveStatus:
          current.autoSaveStatus === "conflict" ? "conflict" : "idle",
        autoSaveMessage:
          current.autoSaveStatus === "conflict"
            ? current.autoSaveMessage
            : null,
      };
    });
  }, []);

  const updateSchedule = React.useCallback<
    CampaignEditorContextValue["updateSchedule"]
  >((next) => {
    setState((current) => {
      const nextSendAt = next.sendAt ?? current.sendAt;
      const nextSendImmediately =
        next.sendImmediately ?? current.sendImmediately;

      if (
        areDatesEqual(current.sendAt, nextSendAt) &&
        current.sendImmediately === nextSendImmediately
      ) {
        return current;
      }

      return {
        ...current,
        ...next,
        isDirty: true,
        autoSaveStatus:
          current.autoSaveStatus === "conflict" ? "conflict" : "idle",
        autoSaveMessage:
          current.autoSaveStatus === "conflict"
            ? current.autoSaveMessage
            : null,
      };
    });
  }, []);

  const activate = React.useCallback(
    async (
      options?: CampaignActivationOptions,
    ): Promise<CampaignActivationResult> => {
      const toSendError = (error: unknown, fallback: string): SendError => ({
        code: "UNKNOWN_ERROR",
        title: "Activation failed",
        description: error instanceof Error ? error.message : fallback,
        recoverable: true,
      });

      try {
        const effectiveSendImmediately =
          options?.sendImmediately ?? state.sendImmediately;
        const effectiveSendAt =
          "sendAt" in (options ?? {})
            ? (options?.sendAt ?? null)
            : state.sendAt;
        const savedCampaignId = await saveDraft({ silent: true });
        if (!savedCampaignId) {
          return {
            success: false,
            error: {
              code: "CAMPAIGN_SAVE_FAILED",
              title: "Failed to save campaign",
              description: "Could not save your campaign before sending.",
              recoverable: true,
            },
          };
        }

        await captureDraftSnapshot("pre-send");

        if (!effectiveSendImmediately && effectiveSendAt) {
          const scheduled = await updateCampaignStatus(
            savedCampaignId,
            "scheduled",
            {
              scheduled_at: effectiveSendAt.toISOString(),
            },
          );
          syncPersistedCampaignVersion({
            campaignId: savedCampaignId,
            status: scheduled.status,
            updatedAt: scheduled.updatedAt,
          });
          setState((current) => ({
            ...current,
            campaignId: savedCampaignId,
            status: scheduled.status,
            isDirty: false,
            isLocked: isLockedCampaignStatus(scheduled.status),
            lastSavedAt: scheduled.updatedAt
              ? new Date(scheduled.updatedAt)
              : current.lastSavedAt,
          }));
          if (!options?.suppressToasts) {
            toast.success("Campaign scheduled");
          }
          if (campaignId !== savedCampaignId) {
            navigate(`/crm/campaigns/${savedCampaignId}`, { replace: true });
          }
          return {
            success: true,
            campaignId: savedCampaignId,
            recipientCount: state.audienceCount ?? 0,
            status: scheduled.status,
            complianceWarnings: [],
          };
        }

        if (state.campaignType === "sms") {
          const queued = await updateCampaignStatus(savedCampaignId, "queued");
          syncPersistedCampaignVersion({
            campaignId: savedCampaignId,
            status: queued.status,
            updatedAt: queued.updatedAt,
          });
          setState((current) => ({
            ...current,
            campaignId: savedCampaignId,
            status: queued.status,
            isDirty: false,
            isLocked: true,
            lastSavedAt: queued.updatedAt
              ? new Date(queued.updatedAt)
              : current.lastSavedAt,
          }));
          if (!options?.suppressToasts) {
            toast.success("SMS campaign queued");
          }
          if (campaignId !== savedCampaignId) {
            navigate(`/crm/campaigns/${savedCampaignId}`, { replace: true });
          }
          return {
            success: true,
            campaignId: savedCampaignId,
            recipientCount: state.audienceCount ?? 0,
            status: queued.status,
            complianceWarnings: [],
          };
        }

        return await sending.sendCampaign({
          campaignId: savedCampaignId,
          campaignName: state.name,
          subjectLine: state.subjectLine,
          preheaderText: state.preheaderText,
          senderName: state.senderName,
          senderEmail: state.senderEmail,
          content: "",
          blocks: state.contentBlocks,
          segments: state.selectedSegments,
        });
      } catch (error) {
        const sendError = toSendError(
          error,
          "The campaign could not be activated.",
        );
        if (!options?.suppressToasts) {
          toast.error(sendError.description);
        }
        return {
          success: false,
          error: sendError,
          campaignId: state.campaignId ?? undefined,
        };
      }
    },
    [
      campaignId,
      captureDraftSnapshot,
      navigate,
      saveDraft,
      sending,
      state,
      syncPersistedCampaignVersion,
    ],
  );

  const pause = React.useCallback(async () => {
    if (!state.campaignId) return;
    const { error } = await supabase.rpc("pause_email_campaign_sending", {
      p_campaign_id: state.campaignId,
    });
    if (error) throw error;
    setState((current) => ({
      ...current,
      status: "paused",
      sendBlockedReason: "paused_by_user",
      isLocked: true,
    }));
    toast.success("Campaign paused");
  }, [state.campaignId]);

  const resume = React.useCallback(async () => {
    if (!state.campaignId) return;
    const { error } = await supabase.rpc("resume_email_campaign_sending", {
      p_campaign_id: state.campaignId,
    });
    if (error) throw error;
    setState((current) => ({
      ...current,
      status: "sending",
      sendBlockedReason: null,
      isLocked: true,
    }));
    toast.success("Campaign resumed");
  }, [state.campaignId]);

  const cancel = React.useCallback(async () => {
    if (!state.campaignId) return;
    const cancelled = await updateCampaignStatus(state.campaignId, "failed", {
      send_blocked_reason: "cancelled_by_user",
    });
    syncPersistedCampaignVersion({
      campaignId: state.campaignId,
      status: cancelled.status,
      updatedAt: cancelled.updatedAt,
    });
    setState((current) => ({
      ...current,
      status: cancelled.status,
      sendBlockedReason: cancelled.sendBlockedReason,
      isLocked: isLockedCampaignStatus(cancelled.status),
      lastSavedAt: cancelled.updatedAt
        ? new Date(cancelled.updatedAt)
        : current.lastSavedAt,
    }));
    toast.success("Campaign cancelled");
  }, [state.campaignId, syncPersistedCampaignVersion]);

  const value = React.useMemo<CampaignEditorContextValue>(
    () => ({
      ...state,
      isLoading,
      syncLiveCampaign,
      updateSetup,
      updateAudience,
      updateContent,
      updateSchedule,
      saveDraft,
      setAutoSavePaused,
      captureDraftSnapshot,
      activate,
      pause,
      resume,
      cancel,
      reload,
    }),
    [
      activate,
      cancel,
      isLoading,
      reload,
      resume,
      saveDraft,
      setAutoSavePaused,
      captureDraftSnapshot,
      syncLiveCampaign,
      state,
      updateAudience,
      updateContent,
      updateSchedule,
      updateSetup,
      pause,
    ],
  );

  return (
    <CampaignEditorContext.Provider value={value}>
      {children}
    </CampaignEditorContext.Provider>
  );
}

export function useCampaignEditor() {
  const context = React.useContext(CampaignEditorContext);
  if (!context) {
    throw new Error(
      "useCampaignEditor must be used within CampaignEditorProvider",
    );
  }
  return context;
}
