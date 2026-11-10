import * as React from "react";
import { Button, FormControl, FormLabel, Input, Sheet, Stack, Typography } from "@mui/joy";
import { Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type StoreLink = { storefront_site_id: string; enabled: boolean; reviewed_at: string | null };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Requires both store-owner proof and CRM administrator authentication. */
export function StorefrontLinkPanel() {
  const [siteId, setSiteId] = React.useState("");
  const [code, setCode] = React.useState("");
  const [links, setLinks] = React.useState<StoreLink[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState("");

  const refresh = React.useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("link-storefront-tenant", {
      body: { action: "list" },
    });
    if (error) throw error;
    setLinks(Array.isArray(data?.sites) ? data.sites : []);
  }, []);

  React.useEffect(() => {
    void refresh().catch(() => setMessage("Storefront connections are not available yet."));
  }, [refresh]);

  async function connect() {
    if (!UUID.test(siteId) || !/^[A-F0-9]{24}$/.test(code.toUpperCase()) || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const { data, error } = await supabase.functions.invoke("link-storefront-tenant", {
        body: { action: "connect", siteId: siteId.trim(), code: code.trim().toUpperCase() },
      });
      if (error || data?.status !== "connected") throw Error("Store connection was not verified.");
      setCode("");
      setMessage("Storefront linked to your CRM. Customer identities still require individual review.");
      await refresh();
    } catch {
      setMessage("Could not connect the store. Confirm its site ID, ownership code, and CRM admin access.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet variant="soft" sx={{ borderRadius: "lg", p: 2.5 }}>
      <Stack spacing={2}>
        <Stack direction="row" alignItems="center" gap={1}>
          <Link2 size={20} aria-hidden="true" />
          <Typography level="title-md">Connect your BloomSites storefront</Typography>
        </Stack>
        <Typography level="body-sm">
          Open BloomSites Store details as an owner. Generate your private CRM connection code
          and enter it here. This verifies store ownership without matching customer emails.
        </Typography>
        <FormControl>
          <FormLabel>BloomSites site ID</FormLabel>
          <Input value={siteId} placeholder="Store UUID"
            onChange={(event) => setSiteId(event.target.value.trim())} />
        </FormControl>
        <FormControl>
          <FormLabel>24-character connection code</FormLabel>
          <Input value={code} placeholder="Paste your short-lived code"
            onChange={(event) => setCode(event.target.value.trim().toUpperCase())} />
        </FormControl>
        <Button disabled={!UUID.test(siteId) || !/^[A-F0-9]{24}$/.test(code) || busy}
          loading={busy} onClick={() => void connect()}>
          Verify and connect store
        </Button>
        {message ? <Typography role="status" level="body-sm">{message}</Typography> : null}
        {links.length ? <div>
          <Typography level="title-sm">Connected storefronts</Typography>
          {links.map(link => (
            <Typography key={link.storefront_site_id} level="body-xs"
              sx={{ overflowWrap: "anywhere" }}>
              {link.storefront_site_id} · {link.enabled ? "Enabled" : "Disabled"}
            </Typography>
          ))}
        </div> : null}
      </Stack>
    </Sheet>
  );
}
