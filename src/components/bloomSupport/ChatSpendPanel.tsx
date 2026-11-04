import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import Button from "@mui/joy/Button";
import Chip from "@mui/joy/Chip";
import Sheet from "@mui/joy/Sheet";
import Table from "@mui/joy/Table";
import Alert from "@mui/joy/Alert";
import Skeleton from "@mui/joy/Skeleton";
import LinearProgress from "@mui/joy/LinearProgress";
import { bloomSupport, type ChatSpendRow } from "@/lib/bloomSupport/api";
import { useAskDialog } from "./useAskDialog";

const usd = (micros: number) =>
  (micros / 1_000_000).toLocaleString(undefined, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Parses a dollar amount typed by an admin; null when blank or invalid. */
function parseCapUsd(value: unknown): number | null {
  const text = String(value ?? "").replace(/[$,\s]/g, "");
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Bloom chat model spend per company, this month, against its cap. Platform
 * admins only: the database refuses everyone else, and only they see the panel.
 */
export function ChatSpendPanel() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["bloom-support", "chat-spend"], queryFn: () => bloomSupport.chatSpend() });
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => { setError(null); qc.invalidateQueries({ queryKey: ["bloom-support", "chat-spend"] }); qc.invalidateQueries({ queryKey: ["bloom-support", "settings"] }); },
    onError: (e: Error) => setError(e.message),
  });
  const { ask, dialog } = useAskDialog();

  const editCap = async (row: Pick<ChatSpendRow, "tenant_id" | "tenant_name" | "override" | "override_note" | "cap_micros"> | null) => {
    const r = await ask({
      title: row ? `Chat limit for ${row.tenant_name ?? "this company"}` : "Set a company's chat limit",
      description: "Monthly limit on Bloom chat model spend. Leave the amount blank to use the platform default. This does not change what the company is charged.",
      fields: [
        ...(row ? [] : [{ name: "tenant_id", label: "Company (CRM tenant) ID", kind: "text" as const, required: true }]),
        { name: "cap", label: "Monthly limit (USD)", kind: "text", initial: row?.override ? String(row.cap_micros / 1_000_000) : "", helper: "Blank = platform default." },
        { name: "note", label: "Why", kind: "text", initial: row?.override_note ?? "" },
      ],
      confirmLabel: "Save",
    });
    if (!r) return;
    const raw = String(r.cap ?? "").trim();
    const cap = parseCapUsd(raw);
    if (raw && cap === null) { setError("Enter the limit as a dollar amount, for example 50."); return; }
    const tenantId = row?.tenant_id ?? String(r.tenant_id ?? "").trim();
    save.mutate(() => bloomSupport.setChatSpendCap(tenantId, cap, String(r.note ?? "").trim() || undefined));
  };

  const editDefault = async () => {
    const current = q.data ? q.data.default_cap_micros / 1_000_000 : 25;
    const r = await ask({
      title: "Platform default chat limit",
      description: "Applies to every company without its own limit.",
      fields: [{ name: "cap", label: "Monthly limit (USD)", kind: "text", required: true, initial: String(current) }],
      confirmLabel: "Save",
    });
    if (!r) return;
    const cap = parseCapUsd(r.cap);
    if (cap === null) { setError("Enter the limit as a dollar amount, for example 25."); return; }
    save.mutate(() => bloomSupport.setSetting("chat_spend", { default_monthly_cap_usd: cap }));
  };

  return (
    <Sheet variant="outlined" sx={{ p: 2, borderRadius: "md" }}>
      {dialog}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" useFlexGap spacing={1}>
        <div>
          <Typography level="title-sm">Bloom chat usage{q.data ? ` · ${q.data.month}` : ""}</Typography>
          <Typography level="body-xs">
            Model spend per company this month against its limit. Over the limit, Bloom chat answers with a plain notice and makes no model call; everything else keeps working.
            {q.data ? ` Default limit: ${usd(q.data.default_cap_micros)} a month.` : ""}
          </Typography>
        </div>
        <Stack direction="row" spacing={1}>
          <Button size="sm" variant="outlined" onClick={editDefault} disabled={!q.data}>Default limit</Button>
          <Button size="sm" variant="outlined" onClick={() => editCap(null)}>Set a company limit</Button>
        </Stack>
      </Stack>
      {error && <Alert color="danger" sx={{ mt: 1 }}>{error}</Alert>}
      {q.isLoading && <Stack spacing={1} sx={{ mt: 1 }}><Skeleton variant="text" /><Skeleton variant="rectangular" height={80} /></Stack>}
      {q.error && <Alert color="warning" variant="soft" sx={{ mt: 1 }}>{(q.error as Error).message}</Alert>}
      {q.data && q.data.tenants.length === 0 && <Typography level="body-sm" sx={{ mt: 1 }}>No Bloom chat usage yet this month.</Typography>}
      {q.data && q.data.tenants.length > 0 && (
        <Table size="sm" sx={{ mt: 1 }}>
          <thead><tr><th>Company</th><th>Spent</th><th>Limit</th><th>Calls</th><th>Tokens in / out</th><th /></tr></thead>
          <tbody>
            {q.data.tenants.map((row) => {
              const pct = row.cap_micros > 0 ? Math.min(100, (row.committed_micros / row.cap_micros) * 100) : 100;
              return (
                <tr key={row.tenant_id}>
                  <td>{row.tenant_name ?? row.tenant_id}{row.override_note && <Typography level="body-xs">{row.override_note}</Typography>}</td>
                  <td>
                    {usd(row.committed_micros)}
                    <LinearProgress determinate value={pct} color={pct >= 100 ? "danger" : pct >= 80 ? "warning" : "primary"} sx={{ mt: 0.5 }} />
                    {row.in_flight_micros > 0 && <Typography level="body-xs">{usd(row.in_flight_micros)} reserved for calls in progress</Typography>}
                  </td>
                  <td>{usd(row.cap_micros)} {row.override ? <Chip size="sm" variant="soft">Custom</Chip> : <Chip size="sm" variant="plain" color="neutral">Default</Chip>}</td>
                  <td>{row.calls}</td>
                  <td>{row.input_tokens.toLocaleString()} / {row.output_tokens.toLocaleString()}</td>
                  <td><Button size="sm" variant="plain" onClick={() => editCap(row)}>Change limit</Button></td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </Sheet>
  );
}
