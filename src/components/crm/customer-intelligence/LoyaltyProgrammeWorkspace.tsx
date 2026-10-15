import * as React from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionGroup,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  Sheet,
  Stack,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Typography,
} from "@mui/joy";
import { useSearchParams } from "react-router-dom";
import { Gift, Plus, RefreshCw } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import {
  programmeCommand,
  type ProgrammeDetail,
  type ProgrammeSummary,
} from "@/lib/loyalty/programmeApi";
import type {
  LoyaltyCurrency,
  ProgrammeDraft,
} from "../../../../supabase/functions/_shared/loyalty/programme-planning";
import { LoyaltyProgrammePlanner } from "./LoyaltyProgrammePlanner";
import { ProgrammeBaselinePanel } from "./ProgrammeBaselinePanel";

export function LoyaltyProgrammeWorkspace(props: {
  tenantId: string;
  timezone: string;
  currency?: LoyaltyCurrency;
}) {
  const { role, hasPermission } = useUserRole();
  if (
    !["owner_admin", "marketing"].includes(role ?? "") ||
    !hasPermission("loyalty.write")
  )
    return <LoyaltyProgrammePlanner {...props} />;
  return <ProgrammeWorkspaceBody key={props.tenantId} {...props} />;
}
export function ProgrammeWorkspaceBody({
  tenantId,
  timezone,
  currency = "CAD",
}: {
  tenantId: string;
  timezone: string;
  currency?: LoyaltyCurrency;
}) {
  const [params] = useSearchParams();
  const requestedProgramme = params.get("programme");
  const [open, setOpen] = React.useState(Boolean(requestedProgramme)),
    [programmes, setProgrammes] = React.useState<ProgrammeSummary[]>([]),
    [count, setCount] = React.useState(0),
    [page, setPage] = React.useState(1);
  const [detail, setDetail] = React.useState<ProgrammeDetail | null>(null),
    [editing, setEditing] = React.useState(false),
    [tab, setTab] = React.useState<string | number>(0),
    [busy, setBusy] = React.useState(false),
    [error, setError] = React.useState("");
  const active = React.useRef(true),
    request = React.useRef(0),
    saveKey = React.useRef<{ serialized: string; key: string } | null>(null);
  React.useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const load = React.useCallback(
    async (n = 1) => {
      const data = await programmeCommand<{
        programmes: ProgrammeSummary[];
        count: number;
      }>(tenantId, { action: "list", page: n });
      if (active.current) {
        setProgrammes(data.programmes);
        setCount(data.count);
        setPage(n);
      }
    },
    [tenantId],
  );
  React.useEffect(() => {
    if (open)
      void load().catch((e) => {
        if (active.current) setError(e.message);
      });
  }, [open, load]);
  const select = React.useCallback(
    async (id: string) => {
      const token = ++request.current;
      setBusy(true);
      setError("");
      try {
        const data = await programmeCommand<ProgrammeDetail>(tenantId, {
          action: "get",
          programmeId: id,
        });
        if (active.current && token === request.current) {
          setDetail(data);
          setTab(1);
          setEditing(false);
        }
      } catch (e) {
        if (active.current && token === request.current)
          setError(
            e instanceof Error ? e.message : "Programme could not be loaded.",
          );
      } finally {
        if (active.current && token === request.current) setBusy(false);
      }
    },
    [tenantId],
  );
  React.useEffect(() => {
    if (requestedProgramme && /^[a-f0-9-]{36}$/i.test(requestedProgramme)) {
      setOpen(true);
      void select(requestedProgramme);
    }
  }, [requestedProgramme, select]);
  async function refreshSelected() {
    if (!detail) return;
    const data = await programmeCommand<ProgrammeDetail>(tenantId, {
      action: "get",
      programmeId: detail.programme.id,
    });
    if (active.current) {
      setDetail(data);
      await load(page);
    }
  }
  async function save(draft: ProgrammeDraft) {
    const serialized = JSON.stringify([
      draft,
      editing ? detail?.version.id : null,
    ]);
    if (saveKey.current?.serialized !== serialized)
      saveKey.current = { serialized, key: crypto.randomUUID() };
    const data = await programmeCommand<{ saved: { programmeId: string } }>(
      tenantId,
      {
        action: "save_draft",
        definition: draft,
        requestKey: saveKey.current.key,
        programmeId: editing ? detail?.programme.id : null,
        expectedVersionId: editing ? detail?.version.id : null,
      },
    );
    if (active.current) {
      await load();
      await select(data.saved.programmeId);
    }
  }
  return (
    <Sheet variant="outlined" sx={{ borderRadius: "xl" }}>
      <AccordionGroup>
        <Accordion
          expanded={open}
          onChange={(_, expanded) => setOpen(expanded)}
        >
          <AccordionSummary>
            <Stack direction="row" gap={1} alignItems="center">
              <Gift size={20} />
              <Typography level="title-lg">
                Loyalty programmes · Plan, rewards and results
              </Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={2} sx={{ py: 1 }}>
              <Typography
                level="h2"
                sx={{ fontSize: { xs: "1.5rem", md: "2rem" } }}
              >
                Give customers a reason to return—and see what changed.
              </Typography>
              <Typography level="body-md">
                Use a rewards-led template, save its exact terms, freeze a
                reviewed customer group and compare their later behaviour.
                Customer consent and existing points balances stay separate.
              </Typography>
              <Tabs
                value={tab}
                onChange={(_, value) => value !== null && setTab(value)}
                sx={{ background: "transparent" }}
              >
                <TabList variant="soft" sx={{ borderRadius: "lg" }}>
                  <Tab value={0}>Plan a programme</Tab>
                  <Tab value={1}>Saved programmes & results</Tab>
                </TabList>
                <TabPanel value={0} sx={{ px: 0 }}>
                  <Stack spacing={1}>
                    {editing && detail && (
                      <Alert>
                        Editing {detail.programme.name}, version{" "}
                        {detail.version.version_number}. Saving creates a new
                        version; existing baselines and issued terms are not
                        rewritten.
                      </Alert>
                    )}
                    <LoyaltyProgrammePlanner
                      key={editing ? detail?.version.id : "new"}
                      tenantId={tenantId}
                      timezone={timezone}
                      currency={currency}
                      initialDraft={
                        editing ? detail?.version.definition : undefined
                      }
                      onSaveDraft={save}
                    />
                  </Stack>
                </TabPanel>
                <TabPanel value={1} sx={{ px: 0 }}>
                  <Stack spacing={2}>
                    <Stack direction="row" gap={1} flexWrap="wrap">
                      <Button
                        variant="outlined"
                        startDecorator={<Plus size={16} />}
                        onClick={() => {
                          setEditing(false);
                          setTab(0);
                        }}
                      >
                        New programme
                      </Button>
                      <Button
                        variant="plain"
                        startDecorator={<RefreshCw size={16} />}
                        disabled={busy}
                        onClick={() =>
                          void load(page).catch((e) => setError(e.message))
                        }
                      >
                        Refresh
                      </Button>
                      <Typography level="body-sm" sx={{ alignSelf: "center" }}>
                        {count} saved programmes
                      </Typography>
                    </Stack>
                    {programmes.length === 0 && !error && (
                      <Sheet variant="soft" sx={{ p: 3, borderRadius: "lg" }}>
                        <Typography level="title-md">
                          Start with one clear goal.
                        </Typography>
                        <Typography level="body-sm">
                          Save a welcome, win-back or spend-and-gift programme
                          in the planning tab. Your saved versions and customer
                          results appear here.
                        </Typography>
                      </Sheet>
                    )}
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: { xs: "1fr", md: "repeat(2,1fr)" },
                        gap: 1,
                      }}
                    >
                      {programmes.map((p) => (
                        <Button
                          key={p.id}
                          variant={
                            detail?.programme.id === p.id ? "soft" : "outlined"
                          }
                          color="neutral"
                          disabled={busy}
                          sx={{
                            justifyContent: "space-between",
                            textAlign: "left",
                            p: 2,
                          }}
                          onClick={() => void select(p.id)}
                        >
                          <span>{p.name}</span>
                          <Chip size="sm">
                            {p.status === "ready" ? "Baseline saved" : p.status}
                          </Chip>
                        </Button>
                      ))}
                    </Box>
                    {count > 50 && (
                      <Stack direction="row" gap={1}>
                        <Button
                          variant="outlined"
                          disabled={page <= 1 || busy}
                          onClick={() =>
                            void load(page - 1).catch((e) =>
                              setError(e.message),
                            )
                          }
                        >
                          Previous programmes
                        </Button>
                        <Typography>Page {page}</Typography>
                        <Button
                          variant="outlined"
                          disabled={page * 50 >= count || busy}
                          onClick={() =>
                            void load(page + 1).catch((e) =>
                              setError(e.message),
                            )
                          }
                        >
                          Next programmes
                        </Button>
                      </Stack>
                    )}
                    {detail && (
                      <>
                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          justifyContent="space-between"
                          gap={1}
                        >
                          <Stack>
                            <Typography level="h3">
                              {detail.programme.name}
                            </Typography>
                            <Typography level="body-sm">
                              Terms version {detail.version.version_number} ·{" "}
                              {detail.version.definition.currency} ·{" "}
                              {detail.version.definition.timezone}
                            </Typography>
                          </Stack>
                          <Button
                            variant="outlined"
                            onClick={() => {
                              setEditing(true);
                              setTab(0);
                            }}
                          >
                            Edit as a new version
                          </Button>
                        </Stack>
                        <ProgrammeBaselinePanel
                          key={detail.version.id}
                          tenantId={tenantId}
                          detail={detail}
                          onSaved={refreshSelected}
                        />
                      </>
                    )}
                  </Stack>
                </TabPanel>
              </Tabs>
              {error && (
                <Alert role="alert" color="danger">
                  {error}
                </Alert>
              )}
            </Stack>
          </AccordionDetails>
        </Accordion>
      </AccordionGroup>
    </Sheet>
  );
}
