import * as React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
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
import { SYSTEM_PERSONAS } from "@/config/systemPersonas";
import { useCampaignSending } from "@/hooks/useCampaignSending";
import { useTenant } from "@/hooks/useTenant";
import { useSenderConfiguration } from "@/hooks/useSenderConfiguration";
import { supabase } from "@/integrations/supabase/client";
import type { ContentBlock } from "@/types/emailBuilder";

type Segment = CampaignSegmentSummary;
type Persona = CampaignPersonaSummary;

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
  isLocked: boolean;
  sourceContentTaskId: string | null;
  sourceSegmentId: string | null;
  sourcePersonaId: string | null;
}

interface CampaignEditorContextValue extends CampaignEditorState {
  isLoading: boolean;
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
  activate: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  cancel: () => Promise<void>;
  reload: () => Promise<void>;
}

const AUTO_SAVE_MS = 1200;
const AUDIENCE_RECALC_MS = 300;
const LOCKED_STATUSES = new Set<CampaignStatus>([
  "scheduled",
  "queued",
  "partially_queued",
  "sending",
  "sent",
  "sent_with_errors",
  "paused",
  "failed",
]);

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
  const autosaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const hasHydratedRef = React.useRef(false);
  const lastSavedFingerprintRef = React.useRef<string | null>(null);

  const sending = useCampaignSending({
    navigateOnSuccess: false,
    onSuccess: (savedCampaignId) => {
      setState((current) => ({
        ...current,
        campaignId: savedCampaignId,
        status: "sent",
        isDirty: false,
        sendBlockedReason: null,
        isLocked: true,
      }));
      navigate(`/crm/campaigns/${savedCampaignId}/report`);
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
        isLocked: LOCKED_STATUSES.has(record.status),
        sourceContentTaskId:
          nextState.sourceContentTaskId ?? current.sourceContentTaskId,
        sourceSegmentId: current.sourceSegmentId,
        sourcePersonaId: current.sourcePersonaId,
      }));
    },
    [senderConfig?.fromEmailDomainId],
  );

  const reload = React.useCallback(async () => {
    if (!campaignId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
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

      if (
        state.selectedSegments.length === 0 &&
        state.selectedPersonas.length === 0
      ) {
        setState((current) => ({
          ...current,
          audienceCount: 0,
          isAudienceLoading: false,
        }));
        return;
      }

      setState((current) => ({ ...current, isAudienceLoading: true }));
      try {
        const count = await computeAudienceRecipientCount({
          tenantId: tenant.id,
          segmentIds: state.selectedSegments.map((segment) => segment.id),
          personaIds: state.selectedPersonas.map((persona) => persona.id),
        });

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

  const saveDraft = React.useCallback(
    async (options?: { silent?: boolean; status?: CampaignStatus }) => {
      const requestedStatus = options?.status ?? draftPayload.status;
      const nextFingerprint = buildDraftFingerprint({
        ...draftPayload,
        status: requestedStatus,
      });

      if (
        nextFingerprint === lastSavedFingerprintRef.current &&
        requestedStatus === state.status
      ) {
        return state.campaignId;
      }

      setState((current) => ({ ...current, isSaving: true }));
      try {
        const saved = await persistCampaignDraft({
          ...draftPayload,
          status: requestedStatus,
        });

        lastSavedFingerprintRef.current = nextFingerprint;

        setState((current) => ({
          ...current,
          campaignId: saved.id,
          status: saved.status,
          isDirty: false,
          isSaving: false,
          lastSavedAt: new Date(),
          isLocked: LOCKED_STATUSES.has(saved.status),
        }));
        return saved.id;
      } catch (error) {
        setState((current) => ({ ...current, isSaving: false }));
        console.error("Failed to save campaign draft", error);
        return null;
      }
    },
    [draftPayload, state.campaignId, state.status],
  );

  React.useEffect(() => {
    if (
      !state.isDirty ||
      state.isLocked ||
      isLoading ||
      draftFingerprint === lastSavedFingerprintRef.current
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
  }, [draftFingerprint, isLoading, saveDraft, state.isDirty, state.isLocked]);

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
      };
    });
  }, []);

  const activate = React.useCallback(async () => {
    const savedCampaignId = await saveDraft({ silent: true });
    if (!savedCampaignId) {
      return;
    }

    if (!state.sendImmediately && state.sendAt) {
      const scheduled = await updateCampaignStatus(
        savedCampaignId,
        "scheduled",
        {
          scheduled_at: state.sendAt.toISOString(),
        },
      );
      setState((current) => ({
        ...current,
        status: scheduled.status,
        isDirty: false,
        isLocked: LOCKED_STATUSES.has(scheduled.status),
      }));
      toast.success("Campaign scheduled");
      return;
    }

    if (state.campaignType === "sms") {
      await updateCampaignStatus(savedCampaignId, "queued");
      setState((current) => ({
        ...current,
        status: "queued",
        isDirty: false,
        isLocked: true,
      }));
      toast.success("SMS campaign queued");
      return;
    }

    await sending.sendCampaign({
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
  }, [saveDraft, sending, state]);

  const pause = React.useCallback(async () => {
    if (!state.campaignId) return;
    const paused = await updateCampaignStatus(state.campaignId, "paused", {
      send_blocked_reason: "paused_by_user",
    });
    setState((current) => ({
      ...current,
      status: paused.status,
      sendBlockedReason: paused.sendBlockedReason,
      isLocked: LOCKED_STATUSES.has(paused.status),
    }));
    toast.success("Campaign paused");
  }, [state.campaignId]);

  const resume = React.useCallback(async () => {
    if (!state.campaignId) return;
    const resumed = await updateCampaignStatus(state.campaignId, "sending", {
      send_blocked_reason: null,
    });
    setState((current) => ({
      ...current,
      status: resumed.status,
      sendBlockedReason: resumed.sendBlockedReason,
      isLocked: LOCKED_STATUSES.has(resumed.status),
    }));
    toast.success("Campaign resumed");
  }, [state.campaignId]);

  const cancel = React.useCallback(async () => {
    if (!state.campaignId) return;
    const cancelled = await updateCampaignStatus(state.campaignId, "failed", {
      send_blocked_reason: "cancelled_by_user",
    });
    setState((current) => ({
      ...current,
      status: cancelled.status,
      sendBlockedReason: cancelled.sendBlockedReason,
      isLocked: LOCKED_STATUSES.has(cancelled.status),
    }));
    toast.success("Campaign cancelled");
  }, [state.campaignId]);

  const value = React.useMemo<CampaignEditorContextValue>(
    () => ({
      ...state,
      isLoading,
      updateSetup,
      updateAudience,
      updateContent,
      updateSchedule,
      saveDraft,
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
