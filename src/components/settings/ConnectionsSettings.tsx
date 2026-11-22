import { useCallback, useMemo, useRef, useState } from "react";
import Divider from "@mui/joy/Divider";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { ArrowUpRight, LayoutGrid, Plug, Plus, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { POSSetupWizard } from "@/components/crm/pos/POSSetupWizard";
import { POSConnectionHelp } from "@/components/crm/pos/POSConnectionHelp";
import { useLightspeedConnectionSummary } from "@/hooks/useLightspeedConnectionSummary";
import { usePOSPurchaseHealth } from '@/hooks/usePOSPurchaseHealth';
import { POSPurchaseHealth } from './connections/POSPurchaseHealth';
import { usePOSConnections } from "@/hooks/usePOSConnections";
import { JoyAlertDialog } from "@/components/joy/JoyAlertDialog";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyDialog, JoyDialogActions, JoyDialogContent } from "@/components/joy/JoyDialog";
import { useToast } from "@/hooks/use-toast";
import { SettingsEmptyState, SettingsInlineError, SettingsSectionCard } from "./SettingsSurface";
import {
  comingSoonIntegrations,
  getConnectionInsight,
  getConnectionsOverview,
  getLightspeedInsight,
  getPlatformEntry,
  hubIntegrations,
  type OverviewIssue,
  wizardPlatforms,
} from "./connections/connectionsModel";
import {
  ConnectedIntegrationCard,
  ConnectedIntegrationCardSkeleton,
} from "./connections/ConnectedIntegrationCard";
import {
  ConnectionsHealthOverview,
  ConnectionsHealthOverviewSkeleton,
} from "./connections/ConnectionsHealthOverview";
import { HubConnectionCard } from "./connections/HubConnectionCard";
import { IntegrationCatalog } from "./connections/IntegrationCatalog";
import { softPressSx } from "./connections/connectionsStyles";
import { SyncHistoryDialog } from "./connections/SyncHistoryDialog";

export const ConnectionsSettings = () => {
  const [wizardPlatform, setWizardPlatform] = useState<string | null>(null);
  const [helpPlatform, setHelpPlatform] = useState<string | null>(null);
  const [historyConnectionId, setHistoryConnectionId] = useState<string | null>(null);
  const [disconnectConnectionId, setDisconnectConnectionId] = useState<string | null>(null);
  const purchaseHealth=usePOSPurchaseHealth();
  const cardRefs = useRef(new Map<string, HTMLDivElement>());

  const {
    connections,
    isLoading,
    isError,
    refetch,
    isSyncing,
    syncingConnectionId,
    disconnectingConnectionId,
    runSync,
    disconnectPOS,
  } = usePOSConnections();
  const {
    connection: lightspeedConnection,
    isLoading: lightspeedLoading,
    isError: lightspeedError,
    refetch: refetchLightspeed,
  } = useLightspeedConnectionSummary();
  const { toast } = useToast();
  const navigate = useNavigate();

  const insights = useMemo(
    () => (connections ?? []).map((connection) => getConnectionInsight(connection, syncingConnectionId)),
    [connections, syncingConnectionId],
  );
  const hubInsights = useMemo(
    () => (lightspeedConnection ? [getLightspeedInsight(lightspeedConnection)] : []),
    [lightspeedConnection],
  );
  const overview = useMemo(() => {
    const value=getConnectionsOverview(insights, hubInsights);
    const missing=(purchaseHealth.data??[]).filter(row=>row.missing_original_sales>0);
    return {...value,needsAttention:[...value.needsAttention,...(purchaseHealth.isError&&insights.some(i=>i.connection.platform==='bloomsuite')?[{id:'native-history-unavailable',name:'BloomSuite POS purchase history'}]:[]),...missing.map(row=>({id:'native-history:'+row.connection_id,name:row.connection_name+' purchase history'}))]};
  }, [insights, hubInsights,purchaseHealth.data,purchaseHealth.isError]);
  const totalConnections = insights.length + hubInsights.length;
  const connectedPlatformIds = useMemo(
    () => new Set(insights.map((insight) => insight.connection.platform)),
    [insights],
  );
  const availableCatalog = useMemo(
    () =>
      [
        ...wizardPlatforms.filter((platform) => !connectedPlatformIds.has(platform.id)),
        ...hubIntegrations.filter((entry) => !(entry.id === "lightspeed" && lightspeedConnection)),
      ].sort(
        // Point-of-sale systems first; otherwise keep the declared order.
        (left, right) => Number(right.category === "Point of sale") - Number(left.category === "Point of sale"),
      ),
    [connectedPlatformIds, lightspeedConnection],
  );

  const historyInsight = insights.find((insight) => insight.connection.id === historyConnectionId) ?? null;
  const disconnectInsight = insights.find((insight) => insight.connection.id === disconnectConnectionId) ?? null;
  const showLoading = (isLoading && !connections) || lightspeedLoading;
  const loadFailed = isError && !connections;

  const handleConnect = (platformId: string) => {
    setHelpPlatform(null);
    setWizardPlatform(platformId);
  };

  const handleConnectionSuccess = () => {
    setWizardPlatform(null);
    toast({
      title: "POS Connected",
      description: "Your POS system has been successfully connected and is ready to sync data.",
    });
  };

  const handleFix = useCallback((issue: OverviewIssue) => {
    if(issue.id==='native-history-unavailable'){void purchaseHealth.refetch();return;}
    const card = cardRefs.current.get(issue.id);
    if (card) {
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      card.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "center" });
      card.focus({ preventScroll: true });
      return;
    }
    setHistoryConnectionId(issue.id);
  }, [purchaseHealth.refetch]);

  const handleConfirmDisconnect = () => {
    if (!disconnectInsight) return;
    const connectionId = disconnectInsight.connection.id;
    disconnectPOS(connectionId, {
      onSuccess: () => {
        setDisconnectConnectionId(null);
        if (historyConnectionId === connectionId) setHistoryConnectionId(null);
      },
    });
  };

  const disconnectName = disconnectInsight
    ? disconnectInsight.connection.name || disconnectInsight.platform.name
    : "";

  return (
    <Stack spacing={3}>
      {showLoading ? (
        <ConnectionsHealthOverviewSkeleton />
      ) : !loadFailed && totalConnections > 0 ? (
        <ConnectionsHealthOverview onFix={handleFix} overview={overview} />
      ) : null}

      {purchaseHealth.data?.length?<SettingsSectionCard title="BloomSuite POS purchase history" description="Checks received sales, returns and voids for the selected business.">
        {purchaseHealth.data.map(row=><div key={row.connection_id} tabIndex={-1} ref={node=>{if(node)cardRefs.current.set('native-history:'+row.connection_id,node);else cardRefs.current.delete('native-history:'+row.connection_id);}}><POSPurchaseHealth rows={[row]}/></div>)}
      </SettingsSectionCard>:purchaseHealth.isError?<SettingsInlineError message="Native POS purchase history could not be checked. Current owner or marketing access is required." onRetry={()=>void purchaseHealth.refetch()}/>:null}

      <SettingsSectionCard
        description="The systems feeding customer, catalog and sales data into BloomSuite."
        startDecorator={<Plug size={18} />}
        title="Connected integrations"
      >
        {showLoading ? (
          <Stack spacing={1.5}>
            <ConnectedIntegrationCardSkeleton />
            <ConnectedIntegrationCardSkeleton />
          </Stack>
        ) : loadFailed || lightspeedError ? (
          <SettingsInlineError
            message="We couldn't load your connections. Nothing has changed with them — try again in a moment."
            onRetry={() => {
              if (loadFailed) void refetch();
              if (lightspeedError) void refetchLightspeed();
            }}
          />
        ) : totalConnections > 0 ? (
          <Stack spacing={1.5}>
            {hubInsights.map((insight) => (
              <HubConnectionCard
                key={insight.id}
                ref={(node) => {
                  if (node) cardRefs.current.set(insight.id, node);
                  else cardRefs.current.delete(insight.id);
                }}
                insight={insight}
              />
            ))}
            {insights.map((insight) => (
              <ConnectedIntegrationCard
                key={insight.connection.id}
                ref={(node) => {
                  if (node) cardRefs.current.set(insight.connection.id, node);
                  else cardRefs.current.delete(insight.connection.id);
                }}
                insight={insight}
                onDisconnect={() => setDisconnectConnectionId(insight.connection.id)}
                onOpenGuide={() => setHelpPlatform(insight.connection.platform)}
                onOpenHistory={() => setHistoryConnectionId(insight.connection.id)}
                onSync={() => runSync(insight.connection.id)}
                syncDisabled={isSyncing}
              />
            ))}
          </Stack>
        ) : (
          <SettingsEmptyState
            description="Connect your point of sale so BloomSuite can see who your customers are and what they buy."
            icon={Plug}
            primaryAction={{
              label: "Connect Lightspeed",
              onClick: () => navigate("/integrations/lightspeed/connect"),
              startDecorator: <ArrowUpRight size={16} />,
            }}
            secondaryAction={{
              label: "Import from VMX or CSV",
              onClick: () => handleConnect("vmx"),
              startDecorator: <Plus size={16} />,
              variant: "outline",
              color: "neutral",
            }}
            title="Nothing connected yet"
          />
        )}
      </SettingsSectionCard>

      <SettingsSectionCard
        description="Bring more of your business into BloomSuite. Each connection takes a few minutes."
        startDecorator={<LayoutGrid size={18} />}
        title="Add an integration"
      >
        <IntegrationCatalog
          available={availableCatalog}
          comingSoon={comingSoonIntegrations}
          onConnect={handleConnect}
          onOpenGuide={setHelpPlatform}
        />
      </SettingsSectionCard>

      <Stack direction="row" spacing={1.25} alignItems="flex-start" sx={{ px: { xs: 0.5, md: 1 }, color: "text.tertiary" }}>
        <ShieldCheck aria-hidden size={16} style={{ flexShrink: 0, marginTop: 2 }} />
        <Typography level="body-xs" sx={{ color: "text.tertiary", maxWidth: 760 }}>
          BloomSuite uses each connection only to import the customer, catalog and sales records shown above. Access is
          scoped to your account, and you can disconnect at any time to stop syncing immediately.
        </Typography>
      </Stack>

      {wizardPlatform ? (
        <POSSetupWizard
          onCancel={() => setWizardPlatform(null)}
          onSuccess={handleConnectionSuccess}
          platform={wizardPlatform}
        />
      ) : null}

      <JoyDialog
        description="Step-by-step instructions for connecting your system."
        onClose={() => setHelpPlatform(null)}
        open={Boolean(helpPlatform)}
        size="xl"
        title={helpPlatform ? `${getPlatformEntry(helpPlatform).name} setup guide` : "Setup guide"}
      >
        <JoyDialogContent>{helpPlatform ? <POSConnectionHelp platform={helpPlatform} /> : null}</JoyDialogContent>
        <JoyDialogActions>
          <JoyButton color="neutral" onClick={() => setHelpPlatform(null)} sx={softPressSx} variant="plain">
            Close
          </JoyButton>
          {helpPlatform &&
          !connectedPlatformIds.has(helpPlatform) &&
          wizardPlatforms.some((platform) => platform.id === helpPlatform) ? (
            <JoyButton onClick={() => handleConnect(helpPlatform)} startDecorator={<Plus size={16} />} sx={softPressSx}>
              Start setup
            </JoyButton>
          ) : null}
        </JoyDialogActions>
      </JoyDialog>

      <SyncHistoryDialog
        insight={historyInsight}
        onClose={() => setHistoryConnectionId(null)}
        onOpenGuide={() => {
          if (!historyInsight) return;
          setHelpPlatform(historyInsight.connection.platform);
          setHistoryConnectionId(null);
        }}
        onSync={() => {
          if (historyInsight) runSync(historyInsight.connection.id);
        }}
        syncDisabled={isSyncing}
      />

      <JoyAlertDialog
        confirmLabel="Disconnect"
        description={`BloomSuite will stop syncing from ${disconnectName}.`}
        loading={Boolean(disconnectingConnectionId)}
        onClose={() => setDisconnectConnectionId(null)}
        onConfirm={handleConfirmDisconnect}
        open={Boolean(disconnectInsight)}
        size="md"
        title={`Disconnect ${disconnectName}?`}
        variant="danger"
      >
        <Typography level="body-sm" sx={{ color: "text.secondary" }}>
          The raw records imported through this connection — orders, receipts, product catalog and sync history — are
          removed from BloomSuite. Customer profiles already in your CRM stay.
        </Typography>
        <Divider />
        <Typography level="body-sm" sx={{ color: "text.secondary" }}>
          You can reconnect any time. A fresh sync will import your data again.
        </Typography>
      </JoyAlertDialog>
    </Stack>
  );
};
