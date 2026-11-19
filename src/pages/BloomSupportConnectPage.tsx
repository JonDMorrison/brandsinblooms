import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
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

// crm-r2-F07: Allow works only after the consent has been visible, with the window focused, for this long.
const ALLOW_ARM_DELAY_MS = 500;

// crm-r2-F08: the page navigates only to a redirect the OAuth server could have registered (https, or
// http on localhost/127.0.0.1, as bloom_support.oauth_register_client allows); never a script URL.
function safeRedirect(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol === "https:") return url;
    if (url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1")) return url;
    return null;
  } catch {
    return null;
  }
}

// crm-r2-F204: a consent page shown inside another page's frame offers no choice at all.
function isFramed(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

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
  const redirect = useMemo(() => safeRedirect(request.redirect_uri), [request.redirect_uri]);
  const valid = Boolean(request.client_id && request.code_challenge && redirect);
  const redirectHost = redirect?.host ?? "";
  const [framed] = useState(isFramed);
  const showConsent = !framed && valid && Boolean(me.data && me.data.role !== "client");

  // crm-r2-F07: Allow is armed only once the consent has been shown, with the page visible and the
  // window focused, for ALLOW_ARM_DELAY_MS. Hiding or blurring the page disarms it, and a press that
  // began before arming (a click carried over from another window) is ignored.
  const [armed, setArmed] = useState(false);
  const armedAtRef = useRef<number | null>(null);
  const lastPointerDownAtRef = useRef<number>(Number.NEGATIVE_INFINITY);

  useEffect(() => {
    if (!showConsent) {
      armedAtRef.current = null;
      setArmed(false);
      return undefined;
    }
    let focused = document.hasFocus();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      if (document.visibilityState === "visible" && focused) {
        timer = setTimeout(() => {
          armedAtRef.current = performance.now();
          setArmed(true);
        }, ALLOW_ARM_DELAY_MS);
      } else {
        armedAtRef.current = null;
        setArmed(false);
      }
    };
    const onFocus = () => {
      focused = true;
      update();
    };
    const onBlur = () => {
      focused = false;
      update();
    };
    const onPointerDown = () => {
      lastPointerDownAtRef.current = performance.now();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("pointerdown", onPointerDown, true);
    update();
    return () => {
      if (timer !== undefined) clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [showConsent]);

  const onAllowClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    const armedAt = armedAtRef.current;
    if (!armed || armedAt === null) return;
    // detail is 0 for a keyboard activation, which has no pointer press to check.
    if (event.detail > 0 && lastPointerDownAtRef.current < armedAt) return;
    void approve();
  };

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
    if (!valid || !redirect) return;
    const back = new URL(redirect.href);
    back.searchParams.set("error", "access_denied");
    if (request.state) back.searchParams.set("state", request.state);
    window.location.assign(back.toString());
  };

  return (
    <PageContainer sx={{ maxWidth: 560 }}>
      <Sheet variant="outlined" sx={{ p: 3, borderRadius: "lg" }}>
        <Stack spacing={2}>
          <Typography level="h3">Connect {request.client_name} to Bloom Support</Typography>
          {framed && (
            <Alert color="danger">
              This page cannot be used inside a frame or embedded in another site. Open it directly in your browser to connect the assistant.
            </Alert>
          )}
          {!framed && !valid && <Alert color="danger">This link is incomplete. Start the connection again from your assistant.</Alert>}
          {!framed && me.isLoading && <Skeleton variant="rectangular" height={80} />}
          {!framed && me.data && me.data.role === "client" && <Alert color="danger">Only Brands in Blooms staff can connect an assistant to Bloom Support.</Alert>}
          {!framed && me.data && me.data.role !== "client" && (
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
                <Button loading={busy} disabled={!valid || !armed} onClick={onAllowClick}>Allow</Button>
              </Stack>
            </>
          )}
          {me.error && <Alert color="danger">{(me.error as Error).message}</Alert>}
        </Stack>
      </Sheet>
    </PageContainer>
  );
}
