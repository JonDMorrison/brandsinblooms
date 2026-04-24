import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import {
  CheckCircle2,
  ChevronRight,
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
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  DialogActions,
  DialogContent,
  DialogTitle,
  Modal,
  ModalClose,
  ModalDialog,
  Sheet,
  Stack,
  Table,
  Typography,
} from "@mui/joy";

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
  listInfo?: { id?: string; name?: string; totalMembers?: number };
  selectedSegments: Array<{ id: string; name: string; memberCount: number }>;
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

const STEP_ORDER: Array<{ id: MailchimpImportStep; label: string }> = [
  { id: "select", label: "Select" },
  { id: "preview", label: "Preview" },
  { id: "validate", label: "Validate & Confirm" },
  { id: "started", label: "Import Started" },
];

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function getStringValue(source: Record<string, unknown> | null, keys: string[]) {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === "string" && value.trim().length > 0) return value;
  }
  return null;
}

function getNumberValue(source: Record<string, unknown> | null, keys: string[]) {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function getListCreatedAt(data: unknown, artifactCreatedAt: string | null) {
  const source = asObject(data);
  return getStringValue(source, ["date_created", "created_at", "dateCreated"]) ?? artifactCreatedAt;
}

function formatListCreatedAt(value: string | null) {
  if (!value) return "Creation date unavailable";
  try { return `Created ${format(new Date(value), "MMM d, yyyy")}`; }
  catch { return "Creation date unavailable"; }
}

function formatCount(value: number) { return value.toLocaleString(); }

function buildListSelections(rows: ArtifactRow[]) {
  const lists = new Map<string, MailchimpSelectableList>();
  for (const row of rows) {
    if (row.artifact_type !== "list") continue;
    lists.set(row.external_id, {
      id: row.external_id,
      name: row.name ?? "Untitled audience",
      memberCount: row.member_count ?? 0,
      createdAt: getListCreatedAt(row.data, row.created_at),
      segments: [],
    });
  }
  for (const row of rows) {
    if (row.artifact_type !== "segment") continue;
    const data = asObject(row.data);
    const parentListId = getStringValue(data, ["parent_list_id"]) ?? row.external_id.split(":")[0] ?? null;
    if (!parentListId || !lists.has(parentListId)) continue;
    const segmentId = row.external_id.includes(":") ? row.external_id.split(":").slice(1).join(":") : row.external_id;
    lists.get(parentListId)?.segments.push({
      id: segmentId,
      compositeId: row.external_id,
      name: row.name ?? "Untitled segment",
      memberCount: row.member_count ?? getNumberValue(data, ["member_count"]) ?? 0,
    });
  }
  return Array.from(lists.values())
    .map((list) => ({ ...list, segments: [...list.segments].sort((a, b) => a.name.localeCompare(b.name)) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function buildSelectionEstimate(
  lists: MailchimpSelectableList[],
  selectedListIds: Set<string>,
  selectedSegmentIds: Set<string>,
) {
  return lists.reduce((total, list) => {
    let next = total;
    if (selectedListIds.has(list.id)) next += list.memberCount;
    for (const seg of list.segments) {
      if (selectedSegmentIds.has(seg.compositeId)) next += seg.memberCount;
    }
    return next;
  }, 0);
}

function getStepIndex(step: MailchimpImportStep) {
  return STEP_ORDER.findIndex((e) => e.id === step);
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
  const [availableLists, setAvailableLists] = useState<MailchimpSelectableList[]>([]);
  const [selectedListIds, setSelectedListIds] = useState<Set<string>>(() => new Set());
  const [selectedSegmentIds, setSelectedSegmentIds] = useState<Set<string>>(() => new Set());
  const [artifactError, setArtifactError] = useState<string | null>(null);
  const [isLoadingArtifacts, setIsLoadingArtifacts] = useState(false);
  const [isRefreshingArtifacts, setIsRefreshingArtifacts] = useState(false);
  const [showRefreshListsButton, setShowRefreshListsButton] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<MailchimpPreviewResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [validationData, setValidationData] = useState<MailchimpValidationResult | null>(null);
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
  const selectionReady = selectedListIds.size > 0 || selectedSegmentIds.size > 0;
  const selectionEstimate = useMemo(
    () => buildSelectionEstimate(availableLists, selectedListIds, selectedSegmentIds),
    [availableLists, selectedListIds, selectedSegmentIds],
  );
  const selectedLists = useMemo(
    () => availableLists.filter((l) => selectedListIds.has(l.id)),
    [availableLists, selectedListIds],
  );
  const selectedSegments = useMemo(
    () => availableLists.flatMap((l) => l.segments.filter((s) => selectedSegmentIds.has(s.compositeId))),
    [availableLists, selectedSegmentIds],
  );
  const duplicateWarnings = useMemo(() => {
    if (!previewData || previewData.alreadyInCRM <= 0) return [];
    return [`${formatCount(previewData.alreadyInCRM)} contacts already exist in BloomSuite and will be updated or skipped during import.`];
  }, [previewData]);

  const clearArtifactPolling = () => {
    if (artifactPollIntervalRef.current !== null) { window.clearInterval(artifactPollIntervalRef.current); artifactPollIntervalRef.current = null; }
    if (refreshTimeoutRef.current !== null) { window.clearTimeout(refreshTimeoutRef.current); refreshTimeoutRef.current = null; }
  };

  const clearAutoCloseTimeout = () => {
    if (autoCloseTimeoutRef.current !== null) { window.clearTimeout(autoCloseTimeoutRef.current); autoCloseTimeoutRef.current = null; }
  };

  const resetDialogState = () => {
    clearArtifactPolling(); clearAutoCloseTimeout();
    importStartedRef.current = false;
    setActiveStep("select"); setAvailableLists([]); setSelectedListIds(new Set()); setSelectedSegmentIds(new Set());
    setArtifactError(null); setIsLoadingArtifacts(false); setIsRefreshingArtifacts(false); setShowRefreshListsButton(false);
    setJobId(null); setPreviewData(null); setPreviewError(null); setIsLoadingPreview(false);
    setValidationData(null); setValidationError(null); setIsLoadingValidation(false);
    setImportError(null); setIsStartingImport(false); setCleanupError(null); setIsClosing(false);
  };

  const loadArtifacts = async () => {
    if (!tenant?.id) return [] as MailchimpSelectableList[];
    const { data, error } = await supabase
      .from("provider_artifacts")
      .select("id, artifact_type, external_id, name, member_count, data, created_at")
      .eq("tenant_id", tenant.id)
      .eq("provider", "mailchimp")
      .in("artifact_type", ["list", "segment"])
      .order("created_at", { ascending: false });
    if (error) throw error;
    const parsed = buildListSelections((data ?? []) as ArtifactRow[]);
    setAvailableLists(parsed);
    if (parsed.length > 0) { setIsLoadingArtifacts(false); setArtifactError(null); setShowRefreshListsButton(false); clearArtifactPolling(); }
    return parsed;
  };

  const startEmptyCacheWatch = () => {
    clearArtifactPolling();
    refreshTimeoutRef.current = window.setTimeout(() => { if (availableLists.length === 0) setShowRefreshListsButton(true); }, 15000);
    artifactPollIntervalRef.current = window.setInterval(() => { void loadArtifacts().catch(() => undefined); }, 2000);
  };

  const refreshArtifacts = async () => {
    setIsRefreshingArtifacts(true);
    try {
      const { data, error } = await supabase.functions.invoke("mailchimp-fetch-lists");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const parsed = await loadArtifacts();
      if (parsed.length === 0) startEmptyCacheWatch();
      return parsed;
    } catch (error) {
      setArtifactError(getUserFacingIntegrationError(error, "Mailchimp lists could not be refreshed. Try again in a moment."));
      startEmptyCacheWatch();
      return [] as MailchimpSelectableList[];
    } finally {
      setIsRefreshingArtifacts(false);
      setIsLoadingArtifacts(false);
    }
  };

  useEffect(() => {
    if (!open) { resetDialogState(); return; }
    resetDialogState();
    setActiveStep("select");
    if (!isConnected) return;
    setIsLoadingArtifacts(true);
    void (async () => {
      try {
        const parsed = await loadArtifacts();
        if (parsed.length === 0) startEmptyCacheWatch();
      } catch (error) {
        setArtifactError(getUserFacingIntegrationError(error, "Mailchimp lists could not be loaded from the cache."));
        startEmptyCacheWatch();
      } finally {
        void refreshArtifacts();
      }
    })();
    return () => { clearArtifactPolling(); clearAutoCloseTimeout(); };
  }, [isConnected, open, mode, tenant?.id]);

  useEffect(() => {
    if (!open || activeStep !== "started") { clearAutoCloseTimeout(); return; }
    autoCloseTimeoutRef.current = window.setTimeout(() => { void handleRequestClose(); }, 2000);
    return () => { clearAutoCloseTimeout(); };
  }, [activeStep, open]);

  const handleListToggle = (listId: string) => {
    setSelectedListIds((cur) => { const n = new Set(cur); n.has(listId) ? n.delete(listId) : n.add(listId); return n; });
  };

  const handleSegmentToggle = (compositeId: string) => {
    setSelectedSegmentIds((cur) => { const n = new Set(cur); n.has(compositeId) ? n.delete(compositeId) : n.add(compositeId); return n; });
  };

  const ensurePendingJob = async () => {
    if (!user?.id || !tenant?.id) throw new Error("Your session is still loading. Please try again.");
    const config = { listIds: Array.from(selectedListIds), segmentIds: Array.from(selectedSegmentIds) };
    if (jobId) {
      const { data, error } = await supabase.from("import_jobs")
        .update({ config, status: "pending", error_details: null })
        .eq("id", jobId).eq("tenant_id", tenant.id).eq("user_id", user.id).eq("provider", "mailchimp").eq("status", "pending")
        .select("id").single();
      if (error) throw error;
      return String(data.id);
    }
    const { data, error } = await supabase.from("import_jobs")
      .insert({ user_id: user.id, tenant_id: tenant.id, provider: "mailchimp", status: "pending", config })
      .select("id").single();
    if (error) throw error;
    const nextJobId = String(data.id);
    setJobId(nextJobId);
    return nextJobId;
  };

  const handleLoadPreview = async () => {
    if (!isConnected) { setPreviewError("Reconnect Mailchimp before previewing cached audiences or starting an import."); return; }
    setIsLoadingPreview(true); setPreviewError(null); setPreviewData(null);
    try {
      const nextJobId = await ensurePendingJob();
      const { data, error } = await supabase.functions.invoke("mailchimp-fetch-preview", { body: { jobId: nextJobId } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPreviewData(data as MailchimpPreviewResult);
      setActiveStep("preview");
    } catch (error) {
      setPreviewError(getUserFacingIntegrationError(error, "Mailchimp preview could not be generated. Try again."));
    } finally { setIsLoadingPreview(false); }
  };

  const handleRunValidation = async () => {
    if (!isConnected) { setValidationError("Reconnect Mailchimp before validating a new import."); return; }
    if (!jobId) { setValidationError("Create a preview before validating the import."); return; }
    setIsLoadingValidation(true); setValidationError(null); setValidationData(null);
    try {
      const { data, error } = await supabase.functions.invoke("mailchimp-validate", { body: { jobId } });
      if (error) throw error;
      const nextData = (data ?? {}) as MailchimpValidationResult;
      if (nextData.error) throw new Error(nextData.error);
      setValidationData(nextData);
      setActiveStep("validate");
    } catch (error) {
      setValidationError(getUserFacingIntegrationError(error, "Mailchimp validation could not be completed. Check the connection and try again."));
      setActiveStep("validate");
    } finally { setIsLoadingValidation(false); }
  };

  const handleStartImport = async () => {
    if (!isConnected) { setImportError("Reconnect Mailchimp before starting a new import."); return; }
    if (!jobId) { setImportError("Create and validate a preview before starting the import."); return; }
    setIsStartingImport(true); setImportError(null);
    try {
      const { data, error } = await supabase.functions.invoke("mailchimp-import", { body: { jobId } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      importStartedRef.current = true;
      setActiveStep("started");
      if (onStateChanged) await onStateChanged(jobId);
    } catch (error) {
      setImportError(getUserFacingIntegrationError(error, "Mailchimp import could not be started. Check the Mailchimp connection status and try again."));
    } finally { setIsStartingImport(false); }
  };

  async function handleRequestClose() {
    if (isClosing) return;
    setIsClosing(true); setCleanupError(null);
    try {
      if (jobId && !importStartedRef.current && user?.id && tenant?.id) {
        const { error } = await supabase.from("import_jobs")
          .update({ status: "failed", error_details: "Import cancelled by user before start" })
          .eq("id", jobId).eq("tenant_id", tenant.id).eq("user_id", user.id).eq("provider", "mailchimp").eq("status", "pending");
        if (error) throw error;
        if (onStateChanged) await onStateChanged(jobId);
      }
      onOpenChange(false);
    } catch (error) {
      setCleanupError(getUserFacingIntegrationError(error, "The dialog could not close cleanly because the pending import job could not be updated."));
    } finally { setIsClosing(false); }
  }

  const handleOpenConnectFlow = useCallback(() => {
    void (async () => { await handleRequestClose(); onOpenConnectDialog(); })();
  }, [onOpenConnectDialog]);

  const warnings = validationData?.validationErrors ?? [];
  const blockingValidationError = validationError;
  const startImportDisabled = isStartingImport || Boolean(blockingValidationError) || marketingImportDetail.hasRunningImport;
  const confirmImportLabel = `Import ${formatCount(previewData?.estimatedImportCount ?? 0)} Contacts`;

  return (
    <Modal
      open={open}
      onClose={() => { void handleRequestClose(); }}
    >
      <ModalDialog
        variant="outlined"
        sx={{ maxWidth: 760, width: "100%", borderRadius: "lg", bgcolor: "background.surface", maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column" }}
      >
        <ModalClose onClick={() => void handleRequestClose()} />

        <DialogTitle>
          <Stack direction="row" spacing={2} alignItems="center">
            <Box sx={{ width: 44, height: 44, borderRadius: "xl", border: "1px solid", borderColor: "warning.200", bgcolor: "warning.50", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Mail style={{ width: 18, height: 18 }} />
            </Box>
            <Box>
              <Typography level="title-md" fontWeight="xl">Mailchimp Import Onboarding</Typography>
              <Typography level="body-xs" textColor="text.tertiary">
                Select cached audiences, review the preview, validate the import, and start the Mailchimp sync.
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>

        {/* Step indicator */}
        <Box sx={{ px: 0, pb: 1, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1 }}>
          {STEP_ORDER.map((entry, index) => {
            const currentIndex = getStepIndex(activeStep);
            const isActive = entry.id === activeStep;
            const isComplete = index < currentIndex;
            return (
              <Sheet
                key={entry.id}
                variant={isActive ? "soft" : isComplete ? "soft" : "outlined"}
                color={isActive ? "primary" : isComplete ? "success" : "neutral"}
                sx={{ borderRadius: "lg", px: 1.5, py: 1.25 }}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box sx={{
                    width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: "bold", flexShrink: 0,
                    bgcolor: isActive ? "primary.500" : isComplete ? "success.500" : "neutral.300",
                    color: isActive || isComplete ? "white" : "neutral.700",
                  }}>
                    {isComplete ? <CheckCircle2 style={{ width: 12, height: 12 }} /> : index + 1}
                  </Box>
                  <Typography level="body-xs" fontWeight="md">{entry.label}</Typography>
                </Stack>
              </Sheet>
            );
          })}
        </Box>

        <DialogContent sx={{ overflowY: "auto", py: 1 }}>
          <Stack spacing={2.5}>
            {cleanupError && <Alert color="danger" variant="soft">{cleanupError}</Alert>}

            {/* SELECT STEP */}
            {activeStep === "select" && (
              !isConnected ? (
                <Alert color="warning" variant="soft">
                  <Stack spacing={1.5}>
                    <Typography level="body-sm" fontWeight="md">Mailchimp authorization is required</Typography>
                    <Typography level="body-sm">
                      {marketingImportDetail.authorizationSummary || "Reconnect Mailchimp to refresh audiences, preview contacts, and start a new import."}
                    </Typography>
                    <Sheet variant="outlined" sx={{ borderRadius: "md", p: 1.5, bgcolor: "background.surface" }}>
                      <Typography level="body-xs">BloomSuite cannot load Mailchimp audiences or initialize a new import until OAuth is reconnected for this workspace.</Typography>
                    </Sheet>
                    <Button size="sm" variant="solid" color="neutral" onClick={handleOpenConnectFlow} sx={{ alignSelf: "flex-start" }}>
                      Connect with Mailchimp
                    </Button>
                  </Stack>
                </Alert>
              ) : (
                <Stack spacing={2.5}>
                  <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1.5 }}>
                    {[
                      { label: "Available Lists", value: formatCount(availableLists.length) },
                      { label: "Available Segments", value: formatCount(availableLists.reduce((t, l) => t + l.segments.length, 0)) },
                      { label: "Estimated Contacts", value: formatCount(selectionEstimate), note: "Actual totals may differ once overlaps are deduplicated." },
                    ].map(({ label, value, note }) => (
                      <Sheet key={label} variant="soft" color="neutral" sx={{ borderRadius: "lg", p: 2 }}>
                        <Typography level="body-xs" textColor="text.tertiary" sx={{ textTransform: "uppercase", letterSpacing: 1, fontWeight: "bold" }}>{label}</Typography>
                        <Typography level="h3" fontWeight="xl" mt={0.75}>{value}</Typography>
                        {note && <Typography level="body-xs" textColor="text.tertiary" mt={0.5}>{note}</Typography>}
                      </Sheet>
                    ))}
                  </Box>

                  <Sheet variant="soft" color="neutral" sx={{ borderRadius: "md", p: 2 }}>
                    <Typography level="body-sm" textColor="text.secondary">
                      Select full Mailchimp lists, individual segments, or both. Segment selections remain independent from their parent lists and keep the existing composite <code>listId:segmentId</code> contract.
                    </Typography>
                  </Sheet>

                  {artifactError && <Alert color="danger" variant="soft">{artifactError}</Alert>}
                  {previewError && <Alert color="danger" variant="soft">{previewError}</Alert>}

                  {tenantLoading || isLoadingArtifacts ? (
                    <Alert color="primary" variant="soft" startDecorator={<CircularProgress size="sm" />}>
                      <Box>
                        <Typography level="body-sm" fontWeight="md">Loading Mailchimp audiences…</Typography>
                        <Typography level="body-xs">BloomSuite is checking the cached Mailchimp list and segment artifacts for this tenant.</Typography>
                      </Box>
                    </Alert>
                  ) : availableLists.length === 0 ? (
                    <Sheet variant="outlined" sx={{ borderRadius: "lg", p: 3, textAlign: "center", borderStyle: "dashed" }}>
                      <Typography level="body-sm" textColor="text.secondary" mb={1.5}>
                        Mailchimp audiences are still being cached for this page. BloomSuite will keep retrying automatically.
                      </Typography>
                      {showRefreshListsButton && (
                        <Button
                          variant="outlined"
                          color="neutral"
                          size="sm"
                          onClick={() => void refreshArtifacts()}
                          disabled={isRefreshingArtifacts}
                          startDecorator={isRefreshingArtifacts ? <CircularProgress size="sm" /> : <RefreshCw style={{ width: 14, height: 14 }} />}
                        >
                          {isRefreshingArtifacts ? "Refreshing Lists" : "Refresh Lists"}
                        </Button>
                      )}
                    </Sheet>
                  ) : (
                    <Stack spacing={1.5}>
                      {availableLists.map((list) => (
                        <Sheet key={list.id} variant="outlined" sx={{ borderRadius: "lg", p: 2.5, bgcolor: "background.surface" }}>
                          <Stack direction="row" spacing={1.5} alignItems="flex-start">
                            <Checkbox
                              checked={selectedListIds.has(list.id)}
                              onChange={() => handleListToggle(list.id)}
                              sx={{ mt: 0.25 }}
                            />
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1}>
                                <Box>
                                  <Typography level="body-sm" fontWeight="xl">{list.name}</Typography>
                                  <Typography level="body-xs" textColor="text.tertiary">
                                    {formatCount(list.memberCount)} members · {formatListCreatedAt(list.createdAt)}
                                  </Typography>
                                </Box>
                                <Chip size="sm" variant="outlined" color="neutral">{formatCount(list.segments.length)} segments</Chip>
                              </Stack>
                              {list.segments.length > 0 && (
                                <Sheet variant="soft" color="neutral" sx={{ borderRadius: "md", p: 2, mt: 1.5 }}>
                                  <Typography level="body-xs" textColor="text.tertiary" mb={1} sx={{ textTransform: "uppercase", letterSpacing: 1, fontWeight: "bold" }}>Segments</Typography>
                                  <Stack spacing={0.5}>
                                    {list.segments.map((seg) => (
                                      <Stack key={seg.compositeId} component="label" direction="row" spacing={1.5} alignItems="center" sx={{ cursor: "pointer", px: 1, py: 0.75, borderRadius: "sm", "&:hover": { bgcolor: "neutral.softBg" } }}>
                                        <Checkbox
                                          checked={selectedSegmentIds.has(seg.compositeId)}
                                          onChange={() => handleSegmentToggle(seg.compositeId)}
                                        />
                                        <Box>
                                          <Typography level="body-sm" fontWeight="md">{seg.name}</Typography>
                                          <Typography level="body-xs" textColor="text.tertiary">{formatCount(seg.memberCount)} members</Typography>
                                        </Box>
                                      </Stack>
                                    ))}
                                  </Stack>
                                </Sheet>
                              )}
                            </Box>
                          </Stack>
                        </Sheet>
                      ))}
                    </Stack>
                  )}
                </Stack>
              )
            )}

            {/* PREVIEW STEP */}
            {activeStep === "preview" && (
              <Stack spacing={2.5}>
                {previewError && <Alert color="danger" variant="soft">{previewError}</Alert>}
                {previewData && (
                  <>
                    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1.5 }}>
                      {[
                        { label: "Estimated Import", value: formatCount(previewData.estimatedImportCount) },
                        { label: "New Contacts", value: formatCount(previewData.newContacts) },
                        { label: "Existing in CRM", value: formatCount(previewData.alreadyInCRM) },
                        { label: "Est. Duration", value: previewData.estimatedDuration },
                      ].map(({ label, value }) => (
                        <Sheet key={label} variant="soft" color="neutral" sx={{ borderRadius: "lg", p: 2 }}>
                          <Typography level="body-xs" textColor="text.tertiary" sx={{ textTransform: "uppercase", letterSpacing: 1, fontWeight: "bold" }}>{label}</Typography>
                          <Typography level="title-lg" fontWeight="xl" mt={0.75}>{value}</Typography>
                        </Sheet>
                      ))}
                    </Box>

                    <Sheet variant="outlined" sx={{ borderRadius: "lg", p: 2, bgcolor: "background.surface" }}>
                      <Typography level="body-sm" fontWeight="xl" mb={1.5}>Selected Lists</Typography>
                      <Table size="sm" borderAxis="xBetween">
                        <thead><tr><th>List</th><th>Members</th><th>Created</th></tr></thead>
                        <tbody>
                          {selectedLists.map((l) => (
                            <tr key={l.id}>
                              <td>{l.name}</td>
                              <td><Typography level="body-xs" textColor="text.tertiary">{formatCount(l.memberCount)}</Typography></td>
                              <td><Typography level="body-xs" textColor="text.tertiary">{formatListCreatedAt(l.createdAt)}</Typography></td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </Sheet>

                    {selectedSegments.length > 0 && (
                      <Sheet variant="outlined" sx={{ borderRadius: "lg", p: 2, bgcolor: "background.surface" }}>
                        <Typography level="body-sm" fontWeight="xl" mb={1.5}>Selected Segments</Typography>
                        <Stack direction="row" flexWrap="wrap" gap={0.75}>
                          {selectedSegments.map((seg) => (
                            <Chip key={seg.compositeId} variant="outlined" color="neutral" size="sm">
                              {seg.name} · {formatCount(seg.memberCount)}
                            </Chip>
                          ))}
                        </Stack>
                      </Sheet>
                    )}

                    <Sheet variant="outlined" sx={{ borderRadius: "lg", p: 2, bgcolor: "background.surface" }}>
                      <Typography level="body-sm" fontWeight="xl" mb={1.5}>Sample Contacts</Typography>
                      {previewData.sampleContacts.length > 0 ? (
                        <Table size="sm" borderAxis="xBetween">
                          <thead><tr><th>Email</th><th>Name</th><th>Status</th></tr></thead>
                          <tbody>
                            {previewData.sampleContacts.map((c, i) => (
                              <tr key={`${c.email}-${i}`}>
                                <td>{c.email}</td>
                                <td><Typography level="body-xs" textColor="text.tertiary">{[c.firstName, c.lastName].filter(Boolean).join(" ") || "Not available"}</Typography></td>
                                <td><Typography level="body-xs" textColor="text.tertiary">{c.status}</Typography></td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      ) : (
                        <Alert color="warning" variant="soft">
                          This preview returned zero contacts. Go back and adjust the selected lists or segments before continuing.
                        </Alert>
                      )}
                    </Sheet>
                  </>
                )}
              </Stack>
            )}

            {/* VALIDATE STEP */}
            {activeStep === "validate" && (
              <Stack spacing={2.5}>
                {isLoadingValidation && (
                  <Alert color="primary" variant="soft" startDecorator={<CircularProgress size="sm" />}>
                    <Box>
                      <Typography level="body-sm" fontWeight="md">Validating Mailchimp import…</Typography>
                      <Typography level="body-xs">BloomSuite is checking the selected Mailchimp scopes before starting the import.</Typography>
                    </Box>
                  </Alert>
                )}
                {blockingValidationError && (
                  <Alert color="danger" variant="soft">
                    <Box>
                      <Typography level="body-sm" fontWeight="md">Validation could not be completed</Typography>
                      <Typography level="body-sm">{blockingValidationError}</Typography>
                    </Box>
                  </Alert>
                )}
                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
                  <Sheet variant="soft" color="neutral" sx={{ borderRadius: "lg", p: 2 }}>
                    <Typography level="body-xs" textColor="text.tertiary" sx={{ textTransform: "uppercase", letterSpacing: 1, fontWeight: "bold" }}>Import Summary</Typography>
                    <Typography level="body-sm" mt={1}>
                      {formatCount(previewData?.estimatedImportCount ?? 0)} contacts from {selectedLists.length} list{selectedLists.length === 1 ? "" : "s"} and {selectedSegments.length} segment{selectedSegments.length === 1 ? "" : "s"}
                    </Typography>
                    <Typography level="body-xs" textColor="text.tertiary" mt={0.5}>BloomSuite will create or update CRM customers, tags, segments, and consent records available in Mailchimp.</Typography>
                  </Sheet>
                  <Sheet variant="soft" color="neutral" sx={{ borderRadius: "lg", p: 2 }}>
                    <Typography level="body-xs" textColor="text.tertiary" sx={{ textTransform: "uppercase", letterSpacing: 1, fontWeight: "bold" }}>Estimated Duration</Typography>
                    <Typography level="h3" fontWeight="xl" mt={0.75}>{previewData?.estimatedDuration ?? "Pending"}</Typography>
                    <Typography level="body-xs" textColor="text.tertiary" mt={0.5}>Existing contacts may be updated or skipped when BloomSuite deduplicates the import.</Typography>
                  </Sheet>
                </Box>
                {(warnings.length > 0 || duplicateWarnings.length > 0) && (
                  <Alert color="warning" variant="soft">
                    <Stack spacing={0.5}>
                      <Typography level="body-sm" fontWeight="md">Validation warnings</Typography>
                      {[...duplicateWarnings, ...warnings].map((w) => (
                        <Typography key={w} level="body-xs">{w}</Typography>
                      ))}
                    </Stack>
                  </Alert>
                )}
                {marketingImportDetail.hasRunningImport && (
                  <Alert color="warning" variant="soft">
                    An import is already in progress. You can review this validation summary, but a new Mailchimp import cannot start until the current run finishes.
                  </Alert>
                )}
                {importError && <Alert color="danger" variant="soft">{importError}</Alert>}
              </Stack>
            )}

            {/* STARTED STEP */}
            {activeStep === "started" && (
              <Alert color="success" variant="soft" startDecorator={<CheckCircle2 style={{ width: 18, height: 18 }} />}>
                <Box>
                  <Typography level="body-sm" fontWeight="md">Import started successfully</Typography>
                  <Typography level="body-xs">You can track progress on this page.</Typography>
                </Box>
              </Alert>
            )}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ justifyContent: "space-between", pt: 1 }}>
          <Button
            variant="plain"
            color="neutral"
            onClick={() => void handleRequestClose()}
            disabled={isClosing || isStartingImport}
          >
            {isClosing ? "Closing..." : "Cancel"}
          </Button>

          <Stack direction="row" spacing={1}>
            {(activeStep === "preview" || activeStep === "validate") && (
              <Button
                variant="outlined"
                color="neutral"
                onClick={() => setActiveStep(activeStep === "preview" ? "select" : "preview")}
                disabled={isLoadingValidation || isStartingImport}
              >
                Back
              </Button>
            )}

            {activeStep === "select" && (
              !isConnected ? (
                <Button variant="solid" color="neutral" onClick={handleOpenConnectFlow}>
                  Connect with Mailchimp
                </Button>
              ) : (
                <Button
                  variant="solid"
                  color="neutral"
                  onClick={() => void handleLoadPreview()}
                  disabled={!selectionReady || isLoadingPreview || isLoadingArtifacts || availableLists.length === 0 || tenantLoading}
                  startDecorator={isLoadingPreview ? <CircularProgress size="sm" /> : null}
                  endDecorator={!isLoadingPreview ? <ChevronRight style={{ width: 14, height: 14 }} /> : null}
                >
                  {isLoadingPreview ? "Loading Preview" : "Next"}
                </Button>
              )
            )}

            {activeStep === "preview" && (
              <Button
                variant="solid"
                color="neutral"
                onClick={() => void handleRunValidation()}
                disabled={isLoadingValidation || isLoadingPreview || (previewData?.estimatedImportCount ?? 0) === 0}
                startDecorator={isLoadingValidation ? <CircularProgress size="sm" /> : null}
                endDecorator={!isLoadingValidation ? <Sparkles style={{ width: 14, height: 14 }} /> : null}
              >
                {isLoadingValidation ? "Validating" : "Validate & Confirm"}
              </Button>
            )}

            {activeStep === "validate" && (
              <Button
                variant="solid"
                color="neutral"
                onClick={() => void handleStartImport()}
                disabled={startImportDisabled}
                startDecorator={isStartingImport ? <CircularProgress size="sm" /> : null}
                endDecorator={!isStartingImport ? <Users style={{ width: 14, height: 14 }} /> : null}
              >
                {isStartingImport ? "Starting Import" : confirmImportLabel}
              </Button>
            )}

            {activeStep === "started" && (
              <Button variant="solid" color="neutral" onClick={() => void handleRequestClose()}>
                Done
              </Button>
            )}
          </Stack>
        </DialogActions>
      </ModalDialog>
    </Modal>
  );
}
