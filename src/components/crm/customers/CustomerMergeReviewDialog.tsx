import { useEffect, useMemo, useState } from "react";
import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Card from "@mui/joy/Card";
import Chip from "@mui/joy/Chip";
import DialogContent from "@mui/joy/DialogContent";
import DialogTitle from "@mui/joy/DialogTitle";
import Divider from "@mui/joy/Divider";
import Modal from "@mui/joy/Modal";
import ModalClose from "@mui/joy/ModalClose";
import ModalDialog from "@mui/joy/ModalDialog";
import Option from "@mui/joy/Option";
import Radio from "@mui/joy/Radio";
import Select from "@mui/joy/Select";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { useQuery } from "@tanstack/react-query";
import { GitMerge, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type MergeCandidate = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  createdAt: string;
  lastPurchaseDate: string | null;
  totalSpent: number;
  emailOptIn: boolean;
  smsOptIn: boolean;
  suppressed: boolean;
  posOrders: number;
  emailSends: number;
  smsMessages: number;
  loyaltyEntries: number;
  identityLinks: number;
};

type MergeSuggestion = {
  id: string;
  provider: string;
  reason: string;
  normalizedEmail: string | null;
  normalizedPhone: string | null;
  createdAt: string;
  customers: MergeCandidate[];
};

type MergeQueue = {
  openCount: number;
  limit: number;
  offset: number;
  items: MergeSuggestion[];
};

type Choice = { survivorId: string; duplicateId: string };
type RpcResult = Promise<{
  data: unknown;
  error: { message: string } | null;
}>;

const PAGE_SIZE = 10;

const identityRpc = (name: string, args: Record<string, unknown>): RpcResult =>
  (
    supabase.rpc as unknown as (
      rpcName: string,
      rpcArgs: Record<string, unknown>,
    ) => RpcResult
  )(name, args);

const candidateName = (candidate: MergeCandidate) =>
  [candidate.firstName, candidate.lastName].filter(Boolean).join(" ") ||
  candidate.email;

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString() : "Never";

export const CustomerMergeReviewDialog = ({
  open,
  onOpenChange,
  onCustomersChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCustomersChanged: () => void;
}) => {
  const [offset, setOffset] = useState(0);
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const queueQuery = useQuery({
    queryKey: ["customer-merge-review", offset],
    enabled: open,
    queryFn: async (): Promise<MergeQueue> => {
      const { data, error } = await identityRpc(
        "get_customer_merge_review_queue",
        { p_limit: PAGE_SIZE, p_offset: offset },
      );
      if (error) throw new Error(error.message);
      return data as MergeQueue;
    },
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!open) {
      setOffset(0);
      setChoices({});
    }
  }, [open]);

  useEffect(() => {
    if (!queueQuery.data?.items) return;
    setChoices((current) => {
      const next = { ...current };
      for (const suggestion of queueQuery.data.items) {
        if (!next[suggestion.id] && suggestion.customers.length >= 2) {
          next[suggestion.id] = {
            survivorId: suggestion.customers[0].id,
            duplicateId: suggestion.customers[1].id,
          };
        }
      }
      return next;
    });
  }, [queueQuery.data?.items]);

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pageCount = Math.max(
    1,
    Math.ceil((queueQuery.data?.openCount ?? 0) / PAGE_SIZE),
  );
  const items = useMemo(() => queueQuery.data?.items ?? [], [queueQuery.data]);

  const scanAgain = async () => {
    setScanning(true);
    const { data, error } = await identityRpc(
      "scan_current_tenant_customer_duplicates",
      { p_limit: 5000 },
    );
    setScanning(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const result = data as { inserted?: number } | null;
    toast.success(
      result?.inserted
        ? `${result.inserted.toLocaleString()} new review groups found`
        : "No new duplicate groups found",
    );
    setOffset(0);
    await queueQuery.refetch();
  };

  const resolveSuggestion = async (
    suggestion: MergeSuggestion,
    action: "merge" | "dismiss",
  ) => {
    const choice = choices[suggestion.id];
    if (action === "merge" && (!choice?.survivorId || !choice.duplicateId)) {
      toast.error("Choose the record to keep and the record to merge");
      return;
    }

    setSavingKey(`${suggestion.id}:${action}`);
    const { error } = await identityRpc("resolve_customer_merge_review", {
      p_suggestion_id: suggestion.id,
      p_survivor_customer_id: action === "merge" ? choice.survivorId : null,
      p_duplicate_customer_id: action === "merge" ? choice.duplicateId : null,
      p_action: action,
      p_reason:
        action === "merge"
          ? "Owner reviewed identity, consent, purchase, and communication evidence"
          : "Owner confirmed these records represent different customers",
    });
    setSavingKey(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(
      action === "merge"
        ? "Customer records merged with audit history"
        : "Duplicate suggestion dismissed",
    );
    if (action === "merge") onCustomersChanged();
    await queueQuery.refetch();
  };

  return (
    <Modal open={open} onClose={() => onOpenChange(false)}>
      <ModalDialog
        layout="fullscreen"
        sx={{ width: "min(1120px, 100vw)", mx: "auto" }}
      >
        <ModalClose />
        <DialogTitle>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <ShieldCheck size={21} />
            <Box>
              <Typography level="title-lg">
                Review duplicate customers
              </Typography>
              <Typography level="body-xs" sx={{ color: "text.secondary" }}>
                Nothing is merged until an owner chooses the canonical record.
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2.25}>
            <Alert color="warning" variant="soft">
              BloomSuite preserves the strictest consent status and moves linked
              history in one reversible transaction. If activity cannot be
              consolidated safely, the merge stops without changing either
              record.
            </Alert>

            <Stack
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              alignItems={{ sm: "center" }}
              spacing={1}
            >
              <Typography level="title-md">
                {(queueQuery.data?.openCount ?? 0).toLocaleString()} groups to
                review
              </Typography>
              <Button
                size="sm"
                variant="outlined"
                startDecorator={<RefreshCw size={15} />}
                loading={scanning}
                onClick={() => void scanAgain()}
              >
                Scan for new duplicates
              </Button>
            </Stack>

            {queueQuery.isLoading ? (
              <Typography level="body-sm">
                Loading duplicate evidence…
              </Typography>
            ) : queueQuery.error ? (
              <Alert color="danger">{queueQuery.error.message}</Alert>
            ) : items.length === 0 ? (
              <Alert color="success">
                No unresolved duplicate groups remain.
              </Alert>
            ) : (
              <Stack spacing={2}>
                {items.map((suggestion) => {
                  const choice = choices[suggestion.id];
                  return (
                    <Card key={suggestion.id} variant="outlined">
                      <Stack spacing={1.5}>
                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          justifyContent="space-between"
                          spacing={1}
                        >
                          <Stack
                            direction="row"
                            spacing={0.75}
                            flexWrap="wrap"
                            useFlexGap
                          >
                            {suggestion.normalizedEmail ? (
                              <Chip size="sm" color="primary">
                                Matching email
                              </Chip>
                            ) : null}
                            {suggestion.normalizedPhone ? (
                              <Chip size="sm" color="success">
                                Matching mobile
                              </Chip>
                            ) : null}
                            <Chip size="sm" variant="outlined">
                              {suggestion.customers.length} records
                            </Chip>
                          </Stack>
                          <Typography
                            level="body-xs"
                            sx={{ color: "text.secondary" }}
                          >
                            Source: {suggestion.provider.replaceAll("_", " ")}
                          </Typography>
                        </Stack>

                        <Box
                          sx={{
                            display: "grid",
                            gridTemplateColumns: {
                              xs: "1fr",
                              md: "repeat(2, minmax(0, 1fr))",
                            },
                            gap: 1,
                          }}
                        >
                          {suggestion.customers.map((candidate) => (
                            <Card
                              key={candidate.id}
                              variant="soft"
                              color={
                                choice?.survivorId === candidate.id
                                  ? "primary"
                                  : "neutral"
                              }
                            >
                              <Radio
                                label="Keep this record"
                                checked={choice?.survivorId === candidate.id}
                                onChange={() =>
                                  setChoices((current) => ({
                                    ...current,
                                    [suggestion.id]: {
                                      survivorId: candidate.id,
                                      duplicateId:
                                        current[suggestion.id]?.duplicateId ===
                                        candidate.id
                                          ? (suggestion.customers.find(
                                              (item) =>
                                                item.id !== candidate.id,
                                            )?.id ?? "")
                                          : (current[suggestion.id]
                                              ?.duplicateId ?? ""),
                                    },
                                  }))
                                }
                              />
                              <Divider />
                              <Typography level="title-sm">
                                {candidateName(candidate)}
                              </Typography>
                              <Typography level="body-xs">
                                {candidate.email}
                              </Typography>
                              <Typography level="body-xs">
                                {candidate.phone || "No mobile"}
                              </Typography>
                              <Typography
                                level="body-xs"
                                sx={{ color: "text.secondary" }}
                              >
                                Added {formatDate(candidate.createdAt)} · Last
                                purchase{" "}
                                {formatDate(candidate.lastPurchaseDate)}
                              </Typography>
                              <Stack
                                direction="row"
                                spacing={0.5}
                                flexWrap="wrap"
                                useFlexGap
                              >
                                <Chip size="sm">
                                  $
                                  {Number(
                                    candidate.totalSpent,
                                  ).toLocaleString()}
                                </Chip>
                                <Chip size="sm">
                                  {candidate.posOrders} orders
                                </Chip>
                                <Chip size="sm">
                                  {candidate.emailSends} emails
                                </Chip>
                                <Chip size="sm">
                                  {candidate.smsMessages} texts
                                </Chip>
                                <Chip size="sm">
                                  {candidate.loyaltyEntries} loyalty entries
                                </Chip>
                                <Chip size="sm">
                                  {candidate.identityLinks} POS links
                                </Chip>
                                {candidate.suppressed ? (
                                  <Chip size="sm" color="danger">
                                    Suppressed
                                  </Chip>
                                ) : null}
                              </Stack>
                            </Card>
                          ))}
                        </Box>

                        <Stack
                          direction={{ xs: "column", md: "row" }}
                          spacing={1}
                          alignItems={{ md: "center" }}
                        >
                          <Select
                            size="sm"
                            placeholder="Record to merge"
                            value={choice?.duplicateId ?? null}
                            onChange={(_, duplicateId) => {
                              if (!duplicateId || !choice) return;
                              setChoices((current) => ({
                                ...current,
                                [suggestion.id]: { ...choice, duplicateId },
                              }));
                            }}
                            sx={{ minWidth: 260 }}
                          >
                            {suggestion.customers
                              .filter(
                                (candidate) =>
                                  candidate.id !== choice?.survivorId,
                              )
                              .map((candidate) => (
                                <Option key={candidate.id} value={candidate.id}>
                                  Merge {candidateName(candidate)}
                                </Option>
                              ))}
                          </Select>
                          <Button
                            size="sm"
                            startDecorator={<GitMerge size={15} />}
                            loading={savingKey === `${suggestion.id}:merge`}
                            disabled={
                              !choice?.survivorId || !choice.duplicateId
                            }
                            onClick={() =>
                              void resolveSuggestion(suggestion, "merge")
                            }
                          >
                            Merge into kept record
                          </Button>
                          <Button
                            size="sm"
                            variant="plain"
                            color="neutral"
                            loading={savingKey === `${suggestion.id}:dismiss`}
                            onClick={() =>
                              void resolveSuggestion(suggestion, "dismiss")
                            }
                          >
                            These are different people
                          </Button>
                        </Stack>
                      </Stack>
                    </Card>
                  );
                })}
              </Stack>
            )}

            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
            >
              <Button
                size="sm"
                variant="outlined"
                disabled={offset === 0 || queueQuery.isFetching}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                Previous
              </Button>
              <Typography level="body-sm">
                Page {page} of {pageCount}
              </Typography>
              <Button
                size="sm"
                variant="outlined"
                disabled={page >= pageCount || queueQuery.isFetching}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                Next
              </Button>
            </Stack>
          </Stack>
        </DialogContent>
      </ModalDialog>
    </Modal>
  );
};
