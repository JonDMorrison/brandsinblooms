import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import Button from "@mui/joy/Button";
import Sheet from "@mui/joy/Sheet";
import Alert from "@mui/joy/Alert";
import Radio from "@mui/joy/Radio";
import RadioGroup from "@mui/joy/RadioGroup";
import Skeleton from "@mui/joy/Skeleton";
import { PageContainer } from "@/components/joy/PageContainer";
import { bloomSupport } from "@/lib/bloomSupport/api";
import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_URL } from "@/integrations/supabase/config";

const ROLE_LABEL: Record<string, string> = {
  platform_admin: "Platform administrator",
  platform_operator: "Platform operator",
  support: "Support",
};

/**
 * OAuth approval for connecting ChatGPT (or another MCP client) to Bloom
 * Support as the signed-in person. The connection carries exactly this
 * person's role; the backend enforces it on every call.
 */
export default function BloomSupportConnectPage() {
  const [params] = useSearchParams();
  const [scope, setScope] = useState<"write" | "read">(params.get("scope") === "read" ? "read" : "write");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const me = useQuery({ queryKey: ["bloom-support", "me"], queryFn: () => bloomSupport.me() });
  const request = useMemo(() => ({
    client_id: params.get("client_id") ?? "",
    client_name: params.get("client_name") ?? "an assistant",
    redirect_uri: params.get("redirect_uri") ?? "",
    code_challenge: params.get("code_challenge") ?? "",
    state: params.get("state") ?? undefined,
  }), [params]);
  const valid = request.client_id && request.redirect_uri && request.code_challenge;
  let redirectHost = "";
  try {
    redirectHost = new URL(request.redirect_uri).host;
  } catch {
    redirectHost = "";
  }

  const approve = async () => {
    setBusy(true);
    setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/bloom-support-api/oauth/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
        body: JSON.stringify({ ...request, scope }),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out?.message ?? "Approval failed");
      window.location.assign(out.redirect_to);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approval failed");
      setBusy(false);
    }
  };

  const deny = () => {
    if (!valid) return;
    const back = new URL(request.redirect_uri);
    back.searchParams.set("error", "access_denied");
    if (request.state) back.searchParams.set("state", request.state);
    window.location.assign(back.toString());
  };

  return (
    <PageContainer sx={{ maxWidth: 560 }}>
      <Sheet variant="outlined" sx={{ p: 3, borderRadius: "lg" }}>
        <Stack spacing={2}>
          <Typography level="h3">Connect {request.client_name} to Bloom Support</Typography>
          {!valid && <Alert color="danger">This link is incomplete. Start the connection again from your assistant.</Alert>}
          {me.isLoading && <Skeleton variant="rectangular" height={80} />}
          {me.data && me.data.role === "client" && <Alert color="danger">Only Brands in Blooms staff can connect an assistant to Bloom Support.</Alert>}
          {me.data && me.data.role !== "client" && (
            <>
              <Typography level="body-md">
                {request.client_name} will act as <strong>{me.data.name ?? me.data.email}</strong> ({ROLE_LABEL[me.data.role] ?? me.data.role}) and can do only what you can do.
                Every action is recorded under your name.
              </Typography>
              <RadioGroup value={scope} onChange={(e) => setScope(e.target.value as "write" | "read")}>
                <Radio value="write" label="Read and act (reply, update tickets, preview and execute changes you are allowed to make)" />
                <Radio value="read" label="Read only" />
              </RadioGroup>
              <Typography level="body-xs" textColor="text.tertiary">
                You will be returned to {redirectHost || "the assistant"}. Revoke the connection any time in Bloom Support → Settings → API keys.
                Model usage by the assistant is billed by its provider; Bloom's own background work uses the Brands in Blooms OpenAI API account.
              </Typography>
              {error && <Alert color="danger">{error}</Alert>}
              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Button variant="plain" color="neutral" onClick={deny} disabled={!valid}>Deny</Button>
                <Button loading={busy} disabled={!valid} onClick={approve}>Allow</Button>
              </Stack>
            </>
          )}
          {me.error && <Alert color="danger">{(me.error as Error).message}</Alert>}
        </Stack>
      </Sheet>
    </PageContainer>
  );
}
