import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import Input from "@mui/joy/Input";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { ArrowLeft, RefreshCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIntegrationsHubData } from "@/hooks/useIntegrationsHubData";
import { POSCheckoutSmsConsentDialog } from "@/components/integrations/pos/POSCheckoutSmsConsentDialog";
import { SUPPORT_EMAIL } from "@/lib/bloomSupport/constants";
import { getUserFacingIntegrationError } from "@/components/integrations/integrationDetailModel";
import { PageTitle } from "@/components/joy/PageHeader";

const VALID_VMX_URL = /^https:\/\/[a-z0-9-]+\.vmxllc\.com\/pos\/api\/?$/i;

type VmxConnection = {
  id: string;
  name?: string | null;
  is_active?: boolean | null;
  sync_status?: string | null;
  last_sync_at?: string | null;
};

export default function VMXSetupPage() {
  const { connections, canUseActions, isLoading, refetch } = useIntegrationsHubData();
  const current = (connections?.vmxConnection ?? null) as VmxConnection | null;
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [name, setName] = useState("");
  const [consentOpen, setConsentOpen] = useState(false);
  const [consentBusy, setConsentBusy] = useState(false);
  const [consentSaved, setConsentSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const status = current?.is_active === false ? "Paused"
    : current?.sync_status === "error" ? "Needs attention"
    : current?.sync_status === "success" ? "Last sync succeeded"
    : current ? "Sync pending" : "Not connected";

  async function confirmConsent() {
    if (consentBusy) return;
    setConsentBusy(true);
    setError("");
    try {
      const { error: policyError, data } = await supabase.functions.invoke("configure-pos-sms-consent", {
        body: { provider: "vmx", checkout_phone_consent: true },
      });
      if (policyError || data?.error) throw policyError ?? new Error("Could not save checkout disclosure.");
      setConsentSaved(true);
      setConsentOpen(false);
      setMessage("Checkout disclosure saved. You can now connect VMX.");
    } catch (err) {
      setError(getUserFacingIntegrationError(err, "Could not save checkout disclosure."));
    } finally {
      setConsentBusy(false);
    }
  }

  async function connect() {
    if (busy || !canUseActions) return;
    setError("");
    setMessage("");
    if (!VALID_VMX_URL.test(apiUrl.trim())) {
      setError("Use the store-specific HTTPS /pos/api URL provided by VMX.");
      return;
    }
    if (!apiKey.trim()) {
      setError("Enter the API Client ID provided by VMX.");
      return;
    }
    if (!consentSaved) {
      setConsentOpen(true);
      return;
    }
    setBusy(true);
    try {
      const { data, error: connectError } = await supabase.functions.invoke("vmx-connect", {
        body: { api_url: apiUrl.trim(), api_key: apiKey.trim(), connection_name: name.trim() || "VMX POS" },
      });
      if (connectError || data?.error || !data?.connection_id) {
        throw connectError ?? new Error("VMX could not verify the connection.");
      }
      setApiKey("");
      setMessage("VMX credentials verified and saved. Select Sync customers to check the first import.");
      await refetch();
    } catch (err) {
      setError(getUserFacingIntegrationError(err, "Could not verify VMX. Check the store URL and API Client ID with VMX."));
    } finally {
      setBusy(false);
    }
  }

  async function syncCustomers() {
    if (!current?.id || !canUseActions || syncBusy) return;
    setSyncBusy(true);
    setMessage("");
    setError("");
    try {
      const { data, error: syncError } = await supabase.functions.invoke("vmx-sync-customers", {
        body: { connection_id: current.id, full_sync: false },
      });
      if (syncError || data?.error) throw syncError ?? new Error("VMX sync failed.");
      setMessage("Customer sync finished. Review the updated connection status before using the data.");
      await refetch();
    } catch (err) {
      setError(getUserFacingIntegrationError(err, "VMX sync failed. Check the connection and try again."));
      await refetch();
    } finally {
      setSyncBusy(false);
    }
  }

  return (
    <Box sx={{ width: "100%", maxWidth: 940, mx: "auto", py: 3, px: { xs: 2, md: 3 } }}>
      <Stack spacing={2.5}>
        <Button component={RouterLink} to="/integrations" color="neutral" variant="plain" startDecorator={<ArrowLeft size={16} />} sx={{ alignSelf: "flex-start" }}>
          All integrations
        </Button>
        <Stack spacing={0.5}>
          <PageTitle>VMX POS</PageTitle>
          <Typography level="body-sm" sx={{ color: "neutral.600" }}>
            Connect a VMX point-of-sale system to BloomSuite using the API details VMX supplies for this garden centre.
          </Typography>
        </Stack>

        <Sheet variant="outlined" sx={{ p: 2.5, borderRadius: "lg" }}>
          <Stack spacing={1}>
            <Typography level="title-md">Connection status: {isLoading ? "Checking…" : status}</Typography>
            {current?.name ? <Typography level="body-sm">Store: {current.name}</Typography> : null}
            {current?.last_sync_at ? (
              <Typography level="body-sm" sx={{ color: "neutral.600" }}>
                Last recorded sync: {new Date(current.last_sync_at).toLocaleString()}
              </Typography>
            ) : <Typography level="body-sm" sx={{ color: "neutral.600" }}>No successful sync time recorded.</Typography>}
            {status === "Needs attention" ? (
              <Typography level="body-sm" sx={{ color: "neutral.700" }}>
                The saved connection needs attention. Recheck its API access before relying on CRM data.
              </Typography>
            ) : null}
            {current?.id && current.is_active !== false && canUseActions ? (
              <Button variant="outlined" color="neutral" size="sm" loading={syncBusy} onClick={() => void syncCustomers()} startDecorator={<RefreshCcw size={16} />} sx={{ alignSelf: "flex-start", mt: 1 }}>
                Sync customers
              </Button>
            ) : null}
          </Stack>
        </Sheet>

        <Sheet variant="outlined" sx={{ p: 2.5, borderRadius: "lg" }}>
          <Stack spacing={2}>
            <Typography level="title-md">{current ? "Update VMX connection" : "Connect VMX"}</Typography>
            <Typography level="body-sm" sx={{ color: "neutral.600" }}>
              Ask your VMX representative for the store-specific API address and API Client ID. We encrypt credentials and test the connection before saving it.
            </Typography>
            <FormControl>
              <FormLabel>Store API URL</FormLabel>
              <Input type="url" autoComplete="off" placeholder="https://your-store.vmxllc.com/pos/api" value={apiUrl} onChange={(event) => setApiUrl(event.target.value)} disabled={busy || !canUseActions} />
            </FormControl>
            <FormControl>
              <FormLabel>API Client ID</FormLabel>
              <Input type="password" autoComplete="new-password" placeholder="VMX-issued Client ID" value={apiKey} onChange={(event) => setApiKey(event.target.value)} disabled={busy || !canUseActions} />
            </FormControl>
            <FormControl>
              <FormLabel>Connection name (optional)</FormLabel>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="VMX POS" disabled={busy || !canUseActions} />
            </FormControl>
            {!canUseActions ? <Typography level="body-sm">Only users with integration management permission can change this connection.</Typography> : null}
            {error ? <Typography role="alert" color="danger" level="body-sm">{error}</Typography> : null}
            {message ? <Typography role="status" level="body-sm">{message}</Typography> : null}
            <Button disabled={!canUseActions || !apiUrl.trim() || !apiKey.trim()} loading={busy} onClick={() => void connect()} sx={{ alignSelf: "flex-start", minHeight: 44 }}>
              Test and save connection
            </Button>
            <Typography level="body-xs" sx={{ color: "neutral.600" }}>
              VMX CSV migration requires source review. Contact <a href={`mailto:${SUPPORT_EMAIL}?subject=VMX%20POS%20migration`}>{SUPPORT_EMAIL}</a> rather than importing customer records into an unverified account.
            </Typography>
          </Stack>
        </Sheet>
      </Stack>
      <POSCheckoutSmsConsentDialog
        open={consentOpen}
        providerName="VMX POS"
        isSaving={consentBusy}
        onClose={() => setConsentOpen(false)}
        onConfirm={confirmConsent}
      />
    </Box>
  );
}
