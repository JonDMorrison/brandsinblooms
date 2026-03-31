import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import {
  CheckCircle2,
  ChevronRight,
  Loader2,
  Mail,
  RefreshCw,
  Sparkles,
  Users,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { getUserFacingIntegrationError } from "@/components/integrations/integrationDetailModel";
import type { MarketingImportDetailData } from "@/hooks/useIntegrationDetailData";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type MailchimpImportDialogMode = "import" | "preview";
type MailchimpImportStep = "select" | "preview" | "validate" | "started";

type ArtifactRow = {
  id: string;
  artifact_type: string;
  external_id: string;
  name: string | null;
  member_count: number | null;
  data: unknown;
  created_at: string | null;
};

type MailchimpSelectableSegment = {
  id: string;
  compositeId: string;
  name: string;
  memberCount: number;
};

type MailchimpSelectableList = {
  id: string;
  name: string;
  memberCount: number;
  createdAt: string | null;
  segments: MailchimpSelectableSegment[];
};

type MailchimpPreviewContact = {
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: string;
};

type MailchimpPreviewResult = {
  listInfo?: {
    id?: string;
    name?: string;
    totalMembers?: number;
  };
  selectedSegments: Array<{
    id: string;
    name: string;
    memberCount: number;
  }>;
  sampleContacts: MailchimpPreviewContact[];
  estimatedImportCount: number;
  estimatedDuration: string;
  alreadyInCRM: number;
  newContacts: number;
};

type MailchimpValidationResult = {
  valid?: boolean;
  validationErrors?: string[];
  error?: string;
  details?: string;
};

const STEP_ORDER: Array<{
  id: MailchimpImportStep;
  label: string;
}> = [
  { id: "select", label: "Select" },
  { id: "preview", label: "Preview" },
  { id: "validate", label: "Validate & Confirm" },
  { id: "started", label: "Import Started" },
];

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function getStringValue(
  source: Record<string, unknown> | null,
  keys: string[],
) {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  return null;
}

function getNumberValue(
  source: Record<string, unknown> | null,
  keys: string[],
) {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

function getListCreatedAt(data: unknown, artifactCreatedAt: string | null) {
  const source = asObject(data);

  return (
    getStringValue(source, ["date_created", "created_at", "dateCreated"]) ??
    artifactCreatedAt
  );
}

function formatListCreatedAt(value: string | null) {
  if (!value) {
    return "Creation date unavailable";
  }

  try {
    return `Created ${format(new Date(value), "MMM d, yyyy")}`;
  } catch {
    return "Creation date unavailable";
  }
}

function formatCount(value: number) {
  return value.toLocaleString();
}

function buildListSelections(rows: ArtifactRow[]) {
  const lists = new Map<string, MailchimpSelectableList>();

  for (const row of rows) {
    if (row.artifact_type !== "list") {
      continue;
    }

    lists.set(row.external_id, {
      id: row.external_id,
      name: row.name ?? "Untitled audience",
      memberCount: row.member_count ?? 0,
      createdAt: getListCreatedAt(row.data, row.created_at),
      segments: [],
    });
  }

  for (const row of rows) {
    if (row.artifact_type !== "segment") {
      continue;
    }

    const data = asObject(row.data);
    const parentListId =
      getStringValue(data, ["parent_list_id"]) ??
      row.external_id.split(":")[0] ??
      null;

    if (!parentListId || !lists.has(parentListId)) {
      continue;
    }

    const segmentId = row.external_id.includes(":")
      ? row.external_id.split(":").slice(1).join(":")
      : row.external_id;

    lists.get(parentListId)?.segments.push({
      id: segmentId,
      compositeId: row.external_id,
      name: row.name ?? "Untitled segment",
      memberCount:
        row.member_count ?? getNumberValue(data, ["member_count"]) ?? 0,
    });
  }

  return Array.from(lists.values())
    .map((list) => ({
      ...list,
      segments: [...list.segments].sort((left, right) =>
        left.name.localeCompare(right.name),
      ),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function buildSelectionEstimate(
  lists: MailchimpSelectableList[],
  selectedListIds: Set<string>,
  selectedSegmentIds: Set<string>,
) {
  return lists.reduce((total, list) => {
    let nextTotal = total;

    if (selectedListIds.has(list.id)) {
      nextTotal += list.memberCount;
    }

    for (const segment of list.segments) {
      if (selectedSegmentIds.has(segment.compositeId)) {
        nextTotal += segment.memberCount;
      }
    }

    return nextTotal;
  }, 0);
}

function getStepIndex(step: MailchimpImportStep) {
  return STEP_ORDER.findIndex((entry) => entry.id === step);
}

export function MailchimpImportOnboardingDialog({
  open,
  mode,
  marketingImportDetail,
  onOpenChange,
  onOpenConnectDialog,
  onStateChanged,
}: {
  open: boolean;
  mode: MailchimpImportDialogMode;
  marketingImportDetail: MarketingImportDetailData;
  onOpenChange: (open: boolean) => void;
  onOpenConnectDialog: () => void;
  onStateChanged?: (jobId?: string | null) => Promise<void>;
}) {
  const { user } = useAuth();
  const { tenant, loading: tenantLoading } = useTenant();
  const [activeStep, setActiveStep] = useState<MailchimpImportStep>("select");
  const [availableLists, setAvailableLists] = useState<
    MailchimpSelectableList[]
  >([]);
  const [selectedListIds, setSelectedListIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedSegmentIds, setSelectedSegmentIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [artifactError, setArtifactError] = useState<string | null>(null);
  const [isLoadingArtifacts, setIsLoadingArtifacts] = useState(false);
  const [isRefreshingArtifacts, setIsRefreshingArtifacts] = useState(false);
  const [showRefreshListsButton, setShowRefreshListsButton] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<MailchimpPreviewResult | null>(
    null,
  );
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [validationData, setValidationData] =
    useState<MailchimpValidationResult | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isLoadingValidation, setIsLoadingValidation] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [isStartingImport, setIsStartingImport] = useState(false);
  const [cleanupError, setCleanupError] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const isConnected = marketingImportDetail.connectionStatus === "connected";
  const importStartedRef = useRef(false);
  const artifactPollIntervalRef = useRef<number | null>(null);
  const refreshTimeoutRef = useRef<number | null>(null);
  const autoCloseTimeoutRef = useRef<number | null>(null);
  const selectionReady =
    selectedListIds.size > 0 || selectedSegmentIds.size > 0;
  const selectionEstimate = useMemo(
    () =>
      buildSelectionEstimate(
        availableLists,
        selectedListIds,
        selectedSegmentIds,
      ),
    [availableLists, selectedListIds, selectedSegmentIds],
  );
  const selectedLists = useMemo(
    () => availableLists.filter((list) => selectedListIds.has(list.id)),
    [availableLists, selectedListIds],
  );
  const selectedSegments = useMemo(
    () =>
      availableLists.flatMap((list) =>
        list.segments.filter((segment) =>
          selectedSegmentIds.has(segment.compositeId),
        ),
      ),
    [availableLists, selectedSegmentIds],
  );
  const duplicateWarnings = useMemo(() => {
    if (!previewData || previewData.alreadyInCRM <= 0) {
      return [];
    }

    return [
      `${formatCount(previewData.alreadyInCRM)} contacts already exist in BloomSuite and will be updated or skipped during import.`,
    ];
  }, [previewData]);

  const clearArtifactPolling = () => {
    if (artifactPollIntervalRef.current !== null) {
      window.clearInterval(artifactPollIntervalRef.current);
      artifactPollIntervalRef.current = null;
    }

    if (refreshTimeoutRef.current !== null) {
      window.clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
  };

  const clearAutoCloseTimeout = () => {
    if (autoCloseTimeoutRef.current !== null) {
      window.clearTimeout(autoCloseTimeoutRef.current);
      autoCloseTimeoutRef.current = null;
    }
  };

  const resetDialogState = () => {
    clearArtifactPolling();
    clearAutoCloseTimeout();
    importStartedRef.current = false;
    setActiveStep("select");
    setAvailableLists([]);
    setSelectedListIds(new Set());
    setSelectedSegmentIds(new Set());
    setArtifactError(null);
    setIsLoadingArtifacts(false);
    setIsRefreshingArtifacts(false);
    setShowRefreshListsButton(false);
    setJobId(null);
    setPreviewData(null);
    setPreviewError(null);
    setIsLoadingPreview(false);
    setValidationData(null);
    setValidationError(null);
    setIsLoadingValidation(false);
    setImportError(null);
    setIsStartingImport(false);
    setCleanupError(null);
    setIsClosing(false);
  };

  const loadArtifacts = async () => {
    if (!tenant?.id) {
      return [] as MailchimpSelectableList[];
    }

    const { data, error } = await supabase
      .from("provider_artifacts")
      .select(
        "id, artifact_type, external_id, name, member_count, data, created_at",
      )
      .eq("tenant_id", tenant.id)
      .eq("provider", "mailchimp")
      .in("artifact_type", ["list", "segment"])
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    const parsed = buildListSelections((data ?? []) as ArtifactRow[]);
    setAvailableLists(parsed);

    if (parsed.length > 0) {
      setIsLoadingArtifacts(false);
      setArtifactError(null);
      setShowRefreshListsButton(false);
      clearArtifactPolling();
    }

    return parsed;
  };

  const startEmptyCacheWatch = () => {
    clearArtifactPolling();

    refreshTimeoutRef.current = window.setTimeout(() => {
      if (availableLists.length === 0) {
        setShowRefreshListsButton(true);
      }
    }, 15000);

    artifactPollIntervalRef.current = window.setInterval(() => {
      void loadArtifacts().catch(() => undefined);
    }, 2000);
  };

  const refreshArtifacts = async () => {
    setIsRefreshingArtifacts(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "mailchimp-fetch-lists",
      );

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const parsed = await loadArtifacts();

      if (parsed.length === 0) {
        startEmptyCacheWatch();
      }

      return parsed;
    } catch (error) {
      setArtifactError(
        getUserFacingIntegrationError(
          error,
          "Mailchimp lists could not be refreshed. Try again in a moment.",
        ),
      );
      startEmptyCacheWatch();
      return [] as MailchimpSelectableList[];
    } finally {
      setIsRefreshingArtifacts(false);
      setIsLoadingArtifacts(false);
    }
  };

  useEffect(() => {
    if (!open) {
      resetDialogState();
      return;
    }

    resetDialogState();
    setActiveStep("select");

    if (!isConnected) {
      return;
    }

    setIsLoadingArtifacts(true);

    void (async () => {
      try {
        const parsed = await loadArtifacts();

        if (parsed.length === 0) {
          startEmptyCacheWatch();
        }
      } catch (error) {
        setArtifactError(
          getUserFacingIntegrationError(
            error,
            "Mailchimp lists could not be loaded from the cache.",
          ),
        );
        startEmptyCacheWatch();
      } finally {
        void refreshArtifacts();
      }
    })();

    return () => {
      clearArtifactPolling();
      clearAutoCloseTimeout();
    };
  }, [isConnected, open, mode, tenant?.id]);

  useEffect(() => {
    if (!open || activeStep !== "started") {
      clearAutoCloseTimeout();
      return;
    }

    autoCloseTimeoutRef.current = window.setTimeout(() => {
      void handleRequestClose();
    }, 2000);

    return () => {
      clearAutoCloseTimeout();
    };
  }, [activeStep, open]);

  const handleListToggle = (listId: string) => {
    setSelectedListIds((current) => {
      const next = new Set(current);

      if (next.has(listId)) {
        next.delete(listId);
      } else {
        next.add(listId);
      }

      return next;
    });
  };

  const handleSegmentToggle = (segmentCompositeId: string) => {
    setSelectedSegmentIds((current) => {
      const next = new Set(current);

      if (next.has(segmentCompositeId)) {
        next.delete(segmentCompositeId);
      } else {
        next.add(segmentCompositeId);
      }

      return next;
    });
  };

  const ensurePendingJob = async () => {
    if (!user?.id || !tenant?.id) {
      throw new Error("Your session is still loading. Please try again.");
    }

    const config = {
      listIds: Array.from(selectedListIds),
      segmentIds: Array.from(selectedSegmentIds),
    };

    if (jobId) {
      const { data, error } = await supabase
        .from("import_jobs")
        .update({
          config,
          status: "pending",
          error_details: null,
        })
        .eq("id", jobId)
        .eq("tenant_id", tenant.id)
        .eq("user_id", user.id)
        .eq("provider", "mailchimp")
        .eq("status", "pending")
        .select("id")
        .single();

      if (error) {
        throw error;
      }

      return String(data.id);
    }

    const { data, error } = await supabase
      .from("import_jobs")
      .insert({
        user_id: user.id,
        tenant_id: tenant.id,
        provider: "mailchimp",
        status: "pending",
        config,
      })
      .select("id")
      .single();

    if (error) {
      throw error;
    }

    const nextJobId = String(data.id);
    setJobId(nextJobId);
    return nextJobId;
  };

  const handleLoadPreview = async () => {
    if (!isConnected) {
      setPreviewError(
        "Reconnect Mailchimp before previewing cached audiences or starting an import.",
      );
      return;
    }

    setIsLoadingPreview(true);
    setPreviewError(null);
    setPreviewData(null);

    try {
      const nextJobId = await ensurePendingJob();
      const { data, error } = await supabase.functions.invoke(
        "mailchimp-fetch-preview",
        {
          body: { jobId: nextJobId },
        },
      );

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setPreviewData(data as MailchimpPreviewResult);
      setActiveStep("preview");
    } catch (error) {
      setPreviewError(
        getUserFacingIntegrationError(
          error,
          "Mailchimp preview could not be generated. Try again.",
        ),
      );
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleRunValidation = async () => {
    if (!isConnected) {
      setValidationError("Reconnect Mailchimp before validating a new import.");
      return;
    }

    if (!jobId) {
      setValidationError("Create a preview before validating the import.");
      return;
    }

    setIsLoadingValidation(true);
    setValidationError(null);
    setValidationData(null);

    try {
      const { data, error } = await supabase.functions.invoke(
        "mailchimp-validate",
        {
          body: { jobId },
        },
      );

      if (error) {
        throw error;
      }

      const nextData = (data ?? {}) as MailchimpValidationResult;

      if (nextData.error) {
        throw new Error(nextData.error);
      }

      setValidationData(nextData);
      setActiveStep("validate");
    } catch (error) {
      setValidationError(
        getUserFacingIntegrationError(
          error,
          "Mailchimp validation could not be completed. Check the connection and try again.",
        ),
      );
      setActiveStep("validate");
    } finally {
      setIsLoadingValidation(false);
    }
  };

  const handleStartImport = async () => {
    if (!isConnected) {
      setImportError("Reconnect Mailchimp before starting a new import.");
      return;
    }

    if (!jobId) {
      setImportError(
        "Create and validate a preview before starting the import.",
      );
      return;
    }

    setIsStartingImport(true);
    setImportError(null);

    try {
      const { data, error } = await supabase.functions.invoke(
        "mailchimp-import",
        {
          body: { jobId },
        },
      );

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      importStartedRef.current = true;
      setActiveStep("started");

      if (onStateChanged) {
        await onStateChanged(jobId);
      }
    } catch (error) {
      setImportError(
        getUserFacingIntegrationError(
          error,
          "Mailchimp import could not be started. Check the Mailchimp connection status and try again.",
        ),
      );
    } finally {
      setIsStartingImport(false);
    }
  };

  async function handleRequestClose() {
    if (isClosing) {
      return;
    }

    setIsClosing(true);
    setCleanupError(null);

    try {
      if (jobId && !importStartedRef.current && user?.id && tenant?.id) {
        const { error } = await supabase
          .from("import_jobs")
          .update({
            status: "failed",
            error_details: "Import cancelled by user before start",
          })
          .eq("id", jobId)
          .eq("tenant_id", tenant.id)
          .eq("user_id", user.id)
          .eq("provider", "mailchimp")
          .eq("status", "pending");

        if (error) {
          throw error;
        }

        if (onStateChanged) {
          await onStateChanged(jobId);
        }
      }

      onOpenChange(false);
    } catch (error) {
      setCleanupError(
        getUserFacingIntegrationError(
          error,
          "The dialog could not close cleanly because the pending import job could not be updated.",
        ),
      );
    } finally {
      setIsClosing(false);
    }
  }

  const handleOpenConnectFlow = useCallback(() => {
    void (async () => {
      await handleRequestClose();
      onOpenConnectDialog();
    })();
  }, [onOpenConnectDialog]);

  const warnings = validationData?.validationErrors ?? [];
  const blockingValidationError = validationError;
  const startImportDisabled =
    isStartingImport ||
    Boolean(blockingValidationError) ||
    marketingImportDetail.hasRunningImport;
  const confirmImportLabel = `Import ${formatCount(
    previewData?.estimatedImportCount ?? 0,
  )} Contacts`;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          void handleRequestClose();
          return;
        }

        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[760px]">
        <DialogHeader className="space-y-4 text-left">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-amber-700">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Mailchimp Import Onboarding</DialogTitle>
              <DialogDescription className="mt-1">
                Select cached audiences, review the preview, validate the
                import, and start the Mailchimp sync without leaving this page.
              </DialogDescription>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {STEP_ORDER.map((entry, index) => {
              const currentIndex = getStepIndex(activeStep);
              const isActive = entry.id === activeStep;
              const isComplete = index < currentIndex;

              return (
                <div
                  key={entry.id}
                  className={`rounded-2xl border px-3 py-3 text-left ${
                    isActive
                      ? "border-brand-teal bg-brand-teal/5"
                      : isComplete
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-border bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                        isActive
                          ? "bg-brand-teal text-white"
                          : isComplete
                            ? "bg-emerald-500 text-white"
                            : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {isComplete ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <span>{entry.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {cleanupError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
              {cleanupError}
            </div>
          ) : null}

          {activeStep === "select" ? (
            !isConnected ? (
              <div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-6 text-sm text-amber-950">
                <div className="space-y-2">
                  <div className="text-base font-semibold text-amber-950">
                    Mailchimp authorization is required
                  </div>
                  <div>
                    {marketingImportDetail.authorizationSummary ||
                      "Reconnect Mailchimp to refresh audiences, preview contacts, and start a new import."}
                  </div>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-white/70 p-4 text-amber-900">
                  BloomSuite cannot load Mailchimp audiences or initialize a new
                  import until OAuth is reconnected for this workspace.
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={handleOpenConnectFlow}>
                    Connect with Mailchimp
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-border/70 bg-slate-50/70 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Available Lists
                    </div>
                    <div className="mt-3 text-3xl font-semibold text-slate-950">
                      {formatCount(availableLists.length)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-slate-50/70 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Available Segments
                    </div>
                    <div className="mt-3 text-3xl font-semibold text-slate-950">
                      {formatCount(
                        availableLists.reduce(
                          (total, list) => total + list.segments.length,
                          0,
                        ),
                      )}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-slate-50/70 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Estimated Contacts
                    </div>
                    <div className="mt-3 text-3xl font-semibold text-slate-950">
                      {formatCount(selectionEstimate)}
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      Actual totals may differ once overlaps are deduplicated.
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/70 bg-slate-50/70 p-4 text-sm text-muted-foreground">
                  Select full Mailchimp lists, individual segments, or both.
                  Segment selections remain independent from their parent lists
                  and keep the existing composite{" "}
                  <span className="font-mono">listId:segmentId</span> contract.
                </div>

                {artifactError ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
                    {artifactError}
                  </div>
                ) : null}

                {previewError ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
                    {previewError}
                  </div>
                ) : null}

                {tenantLoading || isLoadingArtifacts ? (
                  <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5 text-sm text-sky-900">
                    <div className="flex items-center gap-3">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <div>
                        <div className="font-medium">
                          Loading Mailchimp audiences…
                        </div>
                        <div className="mt-1 text-sky-800/80">
                          BloomSuite is checking the cached Mailchimp list and
                          segment artifacts for this tenant.
                        </div>
                      </div>
                    </div>
                  </div>
                ) : availableLists.length === 0 ? (
                  <div className="space-y-4 rounded-2xl border border-dashed border-border bg-slate-50/70 p-6 text-center text-sm text-muted-foreground">
                    <div>
                      Mailchimp audiences are still being cached for this page.
                      BloomSuite will keep retrying automatically.
                    </div>
                    {showRefreshListsButton ? (
                      <div className="flex justify-center">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void refreshArtifacts()}
                          disabled={isRefreshingArtifacts}
                        >
                          {isRefreshingArtifacts ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Refreshing Lists
                            </>
                          ) : (
                            <>
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Refresh Lists
                            </>
                          )}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {availableLists.map((list) => (
                      <div
                        key={list.id}
                        className="rounded-2xl border border-border/70 bg-white p-4 shadow-sm shadow-brand-navy/5"
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedListIds.has(list.id)}
                            onCheckedChange={() => handleListToggle(list.id)}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <div className="text-base font-semibold text-slate-950">
                                  {list.name}
                                </div>
                                <div className="mt-1 text-sm text-muted-foreground">
                                  {formatCount(list.memberCount)} members ·{" "}
                                  {formatListCreatedAt(list.createdAt)}
                                </div>
                              </div>
                              <Badge
                                variant="outline"
                                className="border-slate-200 bg-slate-50 text-slate-700"
                              >
                                {formatCount(list.segments.length)} segments
                              </Badge>
                            </div>

                            {list.segments.length > 0 ? (
                              <div className="mt-4 space-y-2 rounded-2xl border border-border/70 bg-slate-50/70 p-4">
                                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                  Segments
                                </div>
                                {list.segments.map((segment) => (
                                  <label
                                    key={segment.compositeId}
                                    className="flex items-center gap-3 rounded-xl border border-transparent px-2 py-2 hover:border-border"
                                  >
                                    <Checkbox
                                      checked={selectedSegmentIds.has(
                                        segment.compositeId,
                                      )}
                                      onCheckedChange={() =>
                                        handleSegmentToggle(segment.compositeId)
                                      }
                                    />
                                    <div className="min-w-0 flex-1">
                                      <div className="text-sm font-medium text-slate-950">
                                        {segment.name}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        {formatCount(segment.memberCount)}{" "}
                                        members
                                      </div>
                                    </div>
                                  </label>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          ) : null}

          {activeStep === "preview" ? (
            <div className="space-y-5">
              {previewError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
                  {previewError}
                </div>
              ) : null}

              {previewData ? (
                <>
                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="rounded-2xl border border-border/70 bg-slate-50/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Estimated Import
                      </div>
                      <div className="mt-3 text-3xl font-semibold text-slate-950">
                        {formatCount(previewData.estimatedImportCount)}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-slate-50/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        New Contacts
                      </div>
                      <div className="mt-3 text-3xl font-semibold text-slate-950">
                        {formatCount(previewData.newContacts)}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-slate-50/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Existing in CRM
                      </div>
                      <div className="mt-3 text-3xl font-semibold text-slate-950">
                        {formatCount(previewData.alreadyInCRM)}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-slate-50/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Estimated Duration
                      </div>
                      <div className="mt-3 text-3xl font-semibold text-slate-950">
                        {previewData.estimatedDuration}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-white p-4 shadow-sm shadow-brand-navy/5">
                    <div className="text-sm font-semibold text-slate-950">
                      Selected Lists
                    </div>
                    <div className="mt-3 overflow-hidden rounded-xl border border-border/70">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-muted-foreground">
                          <tr>
                            <th className="px-4 py-3 font-medium">List</th>
                            <th className="px-4 py-3 font-medium">Members</th>
                            <th className="px-4 py-3 font-medium">Created</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedLists.map((list) => (
                            <tr
                              key={list.id}
                              className="border-t border-border/70"
                            >
                              <td className="px-4 py-3 text-slate-950">
                                {list.name}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">
                                {formatCount(list.memberCount)}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">
                                {formatListCreatedAt(list.createdAt)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {selectedSegments.length > 0 ? (
                    <div className="rounded-2xl border border-border/70 bg-white p-4 shadow-sm shadow-brand-navy/5">
                      <div className="text-sm font-semibold text-slate-950">
                        Selected Segments
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedSegments.map((segment) => (
                          <Badge key={segment.compositeId} variant="outline">
                            {segment.name} · {formatCount(segment.memberCount)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded-2xl border border-border/70 bg-white p-4 shadow-sm shadow-brand-navy/5">
                    <div className="text-sm font-semibold text-slate-950">
                      Sample Contacts
                    </div>
                    {previewData.sampleContacts.length > 0 ? (
                      <div className="mt-3 overflow-hidden rounded-xl border border-border/70">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-slate-50 text-muted-foreground">
                            <tr>
                              <th className="px-4 py-3 font-medium">Email</th>
                              <th className="px-4 py-3 font-medium">Name</th>
                              <th className="px-4 py-3 font-medium">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {previewData.sampleContacts.map(
                              (contact, index) => (
                                <tr
                                  key={`${contact.email}-${index}`}
                                  className="border-t border-border/70"
                                >
                                  <td className="px-4 py-3 text-slate-950">
                                    {contact.email}
                                  </td>
                                  <td className="px-4 py-3 text-muted-foreground">
                                    {[contact.firstName, contact.lastName]
                                      .filter(Boolean)
                                      .join(" ") || "Not available"}
                                  </td>
                                  <td className="px-4 py-3 text-muted-foreground">
                                    {contact.status}
                                  </td>
                                </tr>
                              ),
                            )}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                        This preview returned zero contacts. Go back and adjust
                        the selected lists or segments before continuing.
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          ) : null}

          {activeStep === "validate" ? (
            <div className="space-y-5">
              {isLoadingValidation ? (
                <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5 text-sm text-sky-900">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <div>
                      <div className="font-medium">
                        Validating Mailchimp import…
                      </div>
                      <div className="mt-1 text-sky-800/80">
                        BloomSuite is checking the selected Mailchimp scopes
                        before starting the import.
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {blockingValidationError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
                  <div className="font-medium">
                    Validation could not be completed
                  </div>
                  <div className="mt-2">{blockingValidationError}</div>
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-border/70 bg-slate-50/70 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Import Summary
                  </div>
                  <div className="mt-3 text-sm text-slate-950">
                    {formatCount(previewData?.estimatedImportCount ?? 0)}{" "}
                    contacts from {selectedLists.length} list
                    {selectedLists.length === 1 ? "" : "s"} and{" "}
                    {selectedSegments.length} segment
                    {selectedSegments.length === 1 ? "" : "s"}
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    BloomSuite will create or update CRM customers, tags,
                    segments, and consent records available in Mailchimp.
                  </div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-slate-50/70 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Estimated Duration
                  </div>
                  <div className="mt-3 text-3xl font-semibold text-slate-950">
                    {previewData?.estimatedDuration ?? "Pending"}
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    Existing contacts may be updated or skipped when BloomSuite
                    deduplicates the import.
                  </div>
                </div>
              </div>

              {warnings.length > 0 || duplicateWarnings.length > 0 ? (
                <details className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                  <summary className="cursor-pointer font-medium">
                    Review validation warnings
                  </summary>
                  <ul className="mt-3 space-y-2 text-amber-900/90">
                    {duplicateWarnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                    {warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </details>
              ) : null}

              {marketingImportDetail.hasRunningImport ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  An import is already in progress. You can review this
                  validation summary, but a new Mailchimp import cannot start
                  until the current run finishes.
                </div>
              ) : null}

              {importError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
                  {importError}
                </div>
              ) : null}
            </div>
          ) : null}

          {activeStep === "started" ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5" />
                <div>
                  <div className="font-medium">Import started successfully</div>
                  <div className="mt-2 text-sm text-emerald-900/80">
                    Import started successfully. You can track progress on this
                    page.
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => void handleRequestClose()}
            disabled={isClosing || isStartingImport}
          >
            {isClosing ? "Closing..." : "Cancel"}
          </Button>

          <div className="flex flex-wrap justify-end gap-2">
            {activeStep === "preview" ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveStep("select")}
                disabled={isLoadingValidation || isStartingImport}
              >
                Back
              </Button>
            ) : null}

            {activeStep === "validate" ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveStep("preview")}
                disabled={isLoadingValidation || isStartingImport}
              >
                Back
              </Button>
            ) : null}

            {activeStep === "select" ? (
              !isConnected ? (
                <Button type="button" onClick={handleOpenConnectFlow}>
                  Connect with Mailchimp
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => void handleLoadPreview()}
                  disabled={
                    !selectionReady ||
                    isLoadingPreview ||
                    isLoadingArtifacts ||
                    availableLists.length === 0 ||
                    tenantLoading
                  }
                >
                  {isLoadingPreview ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading Preview
                    </>
                  ) : (
                    <>
                      Next
                      <ChevronRight className="ml-1.5 h-4 w-4" />
                    </>
                  )}
                </Button>
              )
            ) : null}

            {activeStep === "preview" ? (
              <Button
                type="button"
                onClick={() => void handleRunValidation()}
                disabled={
                  isLoadingValidation ||
                  isLoadingPreview ||
                  (previewData?.estimatedImportCount ?? 0) === 0
                }
              >
                {isLoadingValidation ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Validating
                  </>
                ) : (
                  <>
                    Validate & Confirm
                    <Sparkles className="ml-1.5 h-4 w-4" />
                  </>
                )}
              </Button>
            ) : null}

            {activeStep === "validate" ? (
              <Button
                type="button"
                onClick={() => void handleStartImport()}
                disabled={startImportDisabled}
              >
                {isStartingImport ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Starting Import
                  </>
                ) : (
                  <>
                    {confirmImportLabel}
                    <Users className="ml-1.5 h-4 w-4" />
                  </>
                )}
              </Button>
            ) : null}

            {activeStep === "started" ? (
              <Button type="button" onClick={() => void handleRequestClose()}>
                Done
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
