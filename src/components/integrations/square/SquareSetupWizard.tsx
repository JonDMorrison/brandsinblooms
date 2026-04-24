import { useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle,
  Package,
  PartyPopper,
  ShoppingCart,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";

import { getUserFacingIntegrationError } from "@/components/integrations/integrationDetailModel";
import { SQUARE_QUICK_AUTOMATIONS } from "@/lib/automation/squareQuickAutomations";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Modal,
  ModalClose,
  ModalDialog,
  Sheet,
  Stack,
  Typography,
} from "@mui/joy";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type WizardStep = "sync" | "overview" | "automations" | "complete";

interface SyncEntityProgress {
  synced: number;
  total: number;
  status: "pending" | "syncing" | "complete" | "error";
}

interface SyncProgress {
  customers: SyncEntityProgress;
  sales: SyncEntityProgress;
  products: SyncEntityProgress;
}

interface SyncResults {
  customersCount: number;
  salesCount: number;
  productsCount: number;
  totalRevenue: number;
}

interface SquareSetupWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  merchantName?: string;
  connectionId?: string;
}

const STEPS: { id: WizardStep; label: string }[] = [
  { id: "sync", label: "Sync Data" },
  { id: "overview", label: "Overview" },
  { id: "automations", label: "Automations" },
  { id: "complete", label: "Done" },
];

const ICON_MAP: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  Users,
  ShoppingCart,
  Package,
  Sparkles,
  Zap,
};

export const SquareSetupWizard = ({
  open,
  onOpenChange,
  merchantName,
  connectionId,
}: SquareSetupWizardProps) => {
  const [currentStep, setCurrentStep] = useState<WizardStep>("sync");
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({
    customers: { synced: 0, total: 0, status: "pending" },
    sales: { synced: 0, total: 0, status: "pending" },
    products: { synced: 0, total: 0, status: "pending" },
  });
  const [syncResults, setSyncResults] = useState<SyncResults>({
    customersCount: 0,
    salesCount: 0,
    productsCount: 0,
    totalRevenue: 0,
  });
  const [selectedAutomations, setSelectedAutomations] = useState<Set<string>>(
    new Set(
      SQUARE_QUICK_AUTOMATIONS.filter((a) => a.recommended).map((a) => a.id),
    ),
  );
  const [creatingAutomations, setCreatingAutomations] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);

  useEffect(() => {
    if (open && currentStep === "sync" && !isSyncing) {
      startSync();
    }
  }, [open, currentStep]);

  const fetchActualCounts = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return { customers: 0, sales: 0, products: 0 };

      const { data: user } = await supabase
        .from("users")
        .select("tenant_id")
        .eq("id", userData.user.id)
        .single();

      if (!user?.tenant_id) return { customers: 0, sales: 0, products: 0 };

      const [customersResult, productsResult, salesResult] = await Promise.all([
        supabase
          .from("crm_customers")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", user.tenant_id)
          .eq("pos_source", "square"),
        supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", user.tenant_id)
          .eq("source", "square"),
        supabase
          .from("pos_orders")
          .select("id", { count: "exact", head: true })
          .eq("pos_connection_id", connectionId),
      ]);

      return {
        customers: customersResult.count || 0,
        sales: salesResult.count || 0,
        products: productsResult.count || 0,
      };
    } catch {
      return { customers: 0, sales: 0, products: 0 };
    }
  };

  const startSync = async () => {
    setIsSyncing(true);
    setSyncProgress({
      customers: { synced: 0, total: 0, status: "syncing" },
      sales: { synced: 0, total: 0, status: "pending" },
      products: { synced: 0, total: 0, status: "pending" },
    });

    try {
      setSyncProgress((prev) => ({
        ...prev,
        customers: { ...prev.customers, status: "syncing" },
      }));
      try { await supabase.functions.invoke("square-sync-customers"); } catch {}
      setSyncProgress((prev) => ({
        ...prev,
        customers: { ...prev.customers, status: "complete" },
        sales: { ...prev.sales, status: "syncing" },
      }));

      try { await supabase.functions.invoke("square-sync-sales"); } catch {}
      setSyncProgress((prev) => ({
        ...prev,
        sales: { ...prev.sales, status: "complete" },
        products: { ...prev.products, status: "syncing" },
      }));

      try { await supabase.functions.invoke("square-sync-products"); } catch {}
      setSyncProgress((prev) => ({
        ...prev,
        products: { ...prev.products, status: "complete" },
      }));

      await new Promise((resolve) => setTimeout(resolve, 2000));
      const actualCounts = await fetchActualCounts();

      setSyncResults({
        customersCount: actualCounts.customers,
        salesCount: actualCounts.sales,
        productsCount: actualCounts.products,
        totalRevenue: 0,
      });
      setSyncProgress({
        customers: { synced: actualCounts.customers, total: actualCounts.customers, status: "complete" },
        sales: { synced: actualCounts.sales, total: actualCounts.sales, status: "complete" },
        products: { synced: actualCounts.products, total: actualCounts.products, status: "complete" },
      });

      const hasData = actualCounts.customers > 0 || actualCounts.sales > 0 || actualCounts.products > 0;
      toast({
        title: "Sync complete!",
        description: hasData
          ? `Imported ${actualCounts.customers} customers, ${actualCounts.sales} sales, ${actualCounts.products} products`
          : "No data found to import. You can proceed to set up automations.",
      });

      setTimeout(() => setCurrentStep("overview"), 1500);
    } catch (error: unknown) {
      console.error("Sync error:", error);
      toast({
        title: "Sync encountered issues",
        description: "Some data may have synced. You can retry or proceed.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const toggleAutomation = (id: string) => {
    setSelectedAutomations((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const createSelectedAutomations = async () => {
    if (selectedAutomations.size === 0) {
      setCurrentStep("complete");
      return;
    }
    setCreatingAutomations(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");
      const { data: user } = await supabase
        .from("users")
        .select("tenant_id")
        .eq("id", userData.user.id)
        .single();
      if (!user?.tenant_id) throw new Error("No tenant found");

      const automationsToCreate = SQUARE_QUICK_AUTOMATIONS.filter((a) =>
        selectedAutomations.has(a.id),
      ).map((a) => ({
        name: a.name,
        trigger_type: a.trigger_type,
        is_active: true,
        tenant_id: user.tenant_id,
        user_id: userData.user.id,
        template_source: "square_wizard",
        workflow_steps: JSON.stringify([
          { type: a.default_channel, delay: a.delay_days ? { days: a.delay_days } : null },
        ]),
      }));

      const { error } = await supabase.from("crm_automations").insert(automationsToCreate);
      if (error) throw error;

      toast({ title: "Automations created", description: `${automationsToCreate.length} automation(s) activated` });
      setCurrentStep("complete");
    } catch (error: unknown) {
      console.error("Error creating automations:", error);
      toast({
        title: "Failed to create automations",
        description: getUserFacingIntegrationError(error, "The automations could not be created."),
        variant: "destructive",
      });
    } finally {
      setCreatingAutomations(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    if (connectionId) {
      void supabase
        .from("square_connections")
        .update({ setup_wizard_completed_at: new Date().toISOString() })
        .eq("id", connectionId);
    }
  };

  const goNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) setCurrentStep(STEPS[nextIndex].id);
  };

  const goBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) setCurrentStep(STEPS[prevIndex].id);
  };

  const getEntityProgress = (entity: SyncEntityProgress) => {
    if (entity.status === "complete") return 100;
    if (entity.status === "syncing") return 50;
    return 0;
  };

  const renderSyncStep = () => (
    <Stack spacing={3} sx={{ py: 1 }}>
      <Stack alignItems="center" spacing={1}>
        <Box
          sx={{
            width: 56, height: 56, borderRadius: "xl",
            bgcolor: "neutral.softBg",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <Zap style={{ width: 28, height: 28 }} />
        </Box>
        <Typography level="title-lg" fontWeight="xl">Syncing Your Data</Typography>
        <Typography level="body-sm" textColor="text.tertiary">
          We're importing your customers, sales, and products from Square.
        </Typography>
        {merchantName && (
          <Typography level="body-xs" textColor="text.tertiary">
            Connected to <strong>{merchantName}</strong>
          </Typography>
        )}
      </Stack>

      {(
        [
          { key: "customers", label: "Customers", Icon: Users },
          { key: "sales", label: "Sales History", Icon: ShoppingCart },
          { key: "products", label: "Products", Icon: Package },
        ] as Array<{ key: keyof SyncProgress; label: string; Icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }>
      ).map(({ key, label, Icon }) => {
        const entity = syncProgress[key];
        return (
          <Box key={key}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.75}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Icon style={{ width: 14, height: 14 }} />
                <Typography level="body-sm">{label}</Typography>
              </Stack>
              {entity.status === "complete" ? (
                <CheckCircle style={{ width: 14, height: 14, color: "var(--joy-palette-success-500)" }} />
              ) : entity.status === "syncing" ? (
                <CircularProgress size="sm" />
              ) : null}
            </Stack>
            <LinearProgress
              determinate
              value={getEntityProgress(entity)}
              color={entity.status === "complete" ? "success" : "neutral"}
              size="sm"
            />
          </Box>
        );
      })}

      {syncProgress.customers.status === "error" && (
        <Button variant="outlined" color="neutral" onClick={() => void startSync()} size="sm">
          Retry Sync
        </Button>
      )}
    </Stack>
  );

  const renderOverviewStep = () => (
    <Stack spacing={3} sx={{ py: 1 }}>
      <Stack alignItems="center" spacing={1}>
        <Box
          sx={{
            width: 56, height: 56, borderRadius: "xl",
            bgcolor: "success.softBg",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <CheckCircle style={{ width: 28, height: 28, color: "var(--joy-palette-success-500)" }} />
        </Box>
        <Typography level="title-lg" fontWeight="xl">Import Complete!</Typography>
        <Typography level="body-sm" textColor="text.tertiary">
          Here's what we found in your Square account.
        </Typography>
      </Stack>

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1.5 }}>
        {[
          { label: "Customers", value: syncResults.customersCount, Icon: Users },
          { label: "Sales", value: syncResults.salesCount, Icon: ShoppingCart },
          { label: "Products", value: syncResults.productsCount, Icon: Package },
        ].map(({ label, value, Icon }) => (
          <Sheet key={label} variant="soft" color="neutral" sx={{ borderRadius: "lg", p: 2, textAlign: "center" }}>
            <Icon style={{ width: 20, height: 20, margin: "0 auto 8px" }} />
            <Typography level="title-lg" fontWeight="xl">{value.toLocaleString()}</Typography>
            <Typography level="body-xs" textColor="text.tertiary">{label}</Typography>
          </Sheet>
        ))}
      </Box>

      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <Button variant="solid" color="neutral" onClick={goNext} endDecorator={<ArrowRight style={{ width: 14, height: 14 }} />}>
          Set Up Automations
        </Button>
      </Box>
    </Stack>
  );

  const renderAutomationsStep = () => (
    <Stack spacing={2.5} sx={{ py: 1 }}>
      <Stack alignItems="center" spacing={1}>
        <Box
          sx={{
            width: 56, height: 56, borderRadius: "xl",
            bgcolor: "neutral.softBg",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <Sparkles style={{ width: 28, height: 28 }} />
        </Box>
        <Typography level="title-lg" fontWeight="xl">Quick Automations</Typography>
        <Typography level="body-sm" textColor="text.tertiary">
          Enable automated campaigns to engage your customers.
        </Typography>
      </Stack>

      <Stack spacing={1} sx={{ maxHeight: 320, overflowY: "auto" }}>
        {SQUARE_QUICK_AUTOMATIONS.map((automation) => {
          const IconComponent = ICON_MAP[automation.icon] ?? Sparkles;
          const isSelected = selectedAutomations.has(automation.id);
          return (
            <Sheet
              key={automation.id}
              variant="soft"
              color={isSelected ? "neutral" : "neutral"}
              sx={{
                borderRadius: "lg",
                p: 1.5,
                cursor: "pointer",
                border: "1px solid",
                borderColor: isSelected ? "neutral.outlinedHoverBorder" : "transparent",
                "&:hover": { bgcolor: "neutral.softHoverBg" },
              }}
              onClick={() => toggleAutomation(automation.id)}
            >
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box
                  sx={{
                    flexShrink: 0,
                    width: 36, height: 36, borderRadius: "md",
                    bgcolor: isSelected ? "neutral.700" : "neutral.200",
                    color: isSelected ? "white" : "neutral.600",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <IconComponent style={{ width: 16, height: 16 }} />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <Typography level="body-sm" fontWeight="md" noWrap>{automation.name}</Typography>
                    {automation.recommended && (
                      <Chip size="sm" color="primary" variant="soft">Recommended</Chip>
                    )}
                  </Stack>
                  <Typography level="body-xs" textColor="text.tertiary" noWrap>
                    {automation.description}
                  </Typography>
                </Box>
                <Checkbox
                  checked={isSelected}
                  onChange={() => toggleAutomation(automation.id)}
                  onClick={(e) => e.stopPropagation()}
                  size="sm"
                />
              </Stack>
            </Sheet>
          );
        })}
      </Stack>

      <Stack direction="row" justifyContent="space-between">
        <Button variant="plain" color="neutral" onClick={goBack}>
          Back
        </Button>
        <Button
          variant="solid"
          color="neutral"
          onClick={() => void createSelectedAutomations()}
          disabled={creatingAutomations}
          startDecorator={creatingAutomations ? <CircularProgress size="sm" /> : null}
          endDecorator={!creatingAutomations ? <ArrowRight style={{ width: 14, height: 14 }} /> : null}
        >
          {creatingAutomations
            ? "Creating..."
            : selectedAutomations.size > 0
              ? `Activate ${selectedAutomations.size} Automation${selectedAutomations.size > 1 ? "s" : ""}`
              : "Skip"}
        </Button>
      </Stack>
    </Stack>
  );

  const renderCompleteStep = () => (
    <Stack spacing={3} sx={{ py: 1, textAlign: "center" }}>
      <Stack alignItems="center" spacing={1.5}>
        <Box
          sx={{
            width: 68, height: 68, borderRadius: "xl",
            bgcolor: "success.softBg",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <PartyPopper style={{ width: 32, height: 32, color: "var(--joy-palette-success-600)" }} />
        </Box>
        <Typography level="title-lg" fontWeight="xl">You're All Set! 🎉</Typography>
        <Typography level="body-sm" textColor="text.tertiary">
          Your Square integration is ready to go.
        </Typography>
      </Stack>

      <Sheet variant="soft" color="neutral" sx={{ borderRadius: "lg", p: 2, textAlign: "left" }}>
        <Stack spacing={0.75}>
          {[
            `${syncResults.customersCount} customers synced`,
            `${syncResults.salesCount} sales imported`,
            ...(selectedAutomations.size > 0
              ? [`${selectedAutomations.size} automation${selectedAutomations.size > 1 ? "s" : ""} activated`]
              : []),
          ].map((line) => (
            <Stack key={line} direction="row" spacing={1} alignItems="center">
              <CheckCircle style={{ width: 14, height: 14, color: "var(--joy-palette-success-500)", flexShrink: 0 }} />
              <Typography level="body-sm">{line}</Typography>
            </Stack>
          ))}
        </Stack>
      </Sheet>

      <Button variant="solid" color="neutral" onClick={handleClose} size="lg" sx={{ width: "100%" }}>
        Get Started
      </Button>
    </Stack>
  );

  return (
    <Modal open={open} onClose={() => {}}>
      <ModalDialog
        variant="outlined"
        sx={{ maxWidth: 600, borderRadius: "lg", p: 3, bgcolor: "background.surface" }}
      >
        <ModalClose onClick={handleClose} />
        <DialogTitle sx={{ sr: "only" }}>Square Setup Wizard</DialogTitle>

        {/* Step indicator */}
        <Stack direction="row" alignItems="center" justifyContent="center" spacing={0} mb={2.5}>
          {STEPS.map((step, index) => (
            <Stack key={step.id} direction="row" alignItems="center">
              <Stack alignItems="center" spacing={0.5}>
                <Box
                  sx={{
                    width: 28, height: 28, borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    bgcolor: index <= currentStepIndex ? "neutral.800" : "neutral.200",
                    color: index <= currentStepIndex ? "white" : "neutral.500",
                    fontSize: 12, fontWeight: "bold",
                    transition: "background-color 0.2s",
                  }}
                >
                  {index < currentStepIndex
                    ? <CheckCircle style={{ width: 14, height: 14 }} />
                    : index + 1}
                </Box>
                <Typography
                  level="body-xs"
                  fontWeight={index === currentStepIndex ? "md" : "normal"}
                  textColor={index === currentStepIndex ? "text.primary" : "text.tertiary"}
                  sx={{ whiteSpace: "nowrap" }}
                >
                  {step.label}
                </Typography>
              </Stack>
              {index < STEPS.length - 1 && (
                <Box
                  sx={{
                    width: 48, height: 2, mx: 0.75, mb: 2,
                    bgcolor: index < currentStepIndex ? "neutral.600" : "neutral.200",
                    transition: "background-color 0.2s",
                  }}
                />
              )}
            </Stack>
          ))}
        </Stack>

        <DialogContent sx={{ overflow: "visible" }}>
          {currentStep === "sync" && renderSyncStep()}
          {currentStep === "overview" && renderOverviewStep()}
          {currentStep === "automations" && renderAutomationsStep()}
          {currentStep === "complete" && renderCompleteStep()}
        </DialogContent>
      </ModalDialog>
    </Modal>
  );
};
