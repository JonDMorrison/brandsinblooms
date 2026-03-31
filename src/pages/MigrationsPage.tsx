import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Check } from "lucide-react";
import { ConnectStep } from "@/components/migrations/ConnectStep";
import { ChooseStep } from "@/components/migrations/ChooseStep";
import { PreviewStep } from "@/components/migrations/PreviewStep";
import { AnalyzeStep } from "@/components/migrations/AnalyzeStep";
import { ApplyStep } from "@/components/migrations/ApplyStep";
import { ImportStep } from "@/components/migrations/ImportStep";
import { ReportStep } from "@/components/migrations/ReportStep";
import { supabase } from "@/integrations/supabase/client";
import { useLocation, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

type Provider = "klaviyo" | "constant_contact";

type Step =
  | "connect"
  | "choose"
  | "preview"
  | "analyze"
  | "apply"
  | "import"
  | "report";

const steps: { id: Step; label: string; description: string }[] = [
  {
    id: "connect",
    label: "Connect",
    description: "Connect to Klaviyo or Constant Contact",
  },
  {
    id: "choose",
    label: "Choose",
    description: "Select lists, segments, and tags",
  },
  { id: "preview", label: "Preview", description: "Review sample data" },
  {
    id: "analyze",
    label: "Analyze (AI)",
    description: "AI recommends mappings",
  },
  { id: "apply", label: "Apply", description: "Review and apply mappings" },
  { id: "import", label: "Import", description: "Import contacts and data" },
  {
    id: "report",
    label: "Report",
    description: "View final report and disconnect",
  },
];

const MigrationsPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const supportedProviders: Provider[] = ["klaviyo", "constant_contact"];
  const selectedProvider = useMemo<Provider | null>(() => {
    const providerFromSearch = new URLSearchParams(location.search).get(
      "provider",
    );
    const providerFromState =
      typeof location.state === "object" && location.state !== null
        ? (location.state as { provider?: string }).provider
        : null;
    const provider = providerFromSearch ?? providerFromState ?? null;

    if (provider === "klaviyo" || provider === "constant_contact") {
      return provider;
    }

    return null;
  }, [location.search, location.state]);
  const [currentStep, setCurrentStep] = useState<Step>(() => {
    const step = new URLSearchParams(location.search).get("step");
    return step === "choose" && selectedProvider ? "choose" : "connect";
  });
  const [importSelection, setImportSelection] = useState<{
    listIds: string[];
    segmentIds: string[];
  } | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [importReport, setImportReport] = useState<any>(null);

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  const handleConnectComplete = () => {
    setCurrentStep("choose");
  };

  const handleChooseComplete = async (selection: {
    listIds: string[];
    segmentIds: string[];
  }) => {
    setImportSelection(selection);

    // Create import job
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from("users")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!userData?.tenant_id) return;

      // Determine provider from connection
      let connectionQuery = supabase
        .from("provider_connections")
        .select("provider")
        .eq("status", "connected");

      const { data: connections, error: connectionError } = selectedProvider
        ? await connectionQuery.eq("provider", selectedProvider)
        : await connectionQuery.in("provider", supportedProviders);

      if (connectionError) {
        throw connectionError;
      }

      const resolvedProvider =
        selectedProvider ??
        (connections?.[0]?.provider as Provider | undefined);

      if (!resolvedProvider) {
        toast({
          title: "No Connected Provider",
          description: selectedProvider
            ? "Connect the selected provider before starting an import."
            : "Connect a provider before starting an import.",
          variant: "destructive",
        });
        return;
      }

      const { data: jobData, error: jobError } = await supabase
        .from("import_jobs")
        .insert({
          user_id: user.id,
          tenant_id: userData.tenant_id, // Add tenant_id to fix RLS
          provider: resolvedProvider,
          status: "pending",
          config: selection,
        })
        .select()
        .single();

      if (jobError) {
        console.error("Error creating job:", jobError);
        toast({
          title: "Failed to Create Import Job",
          description: jobError.message,
          variant: "destructive",
        });
        return;
      }

      if (jobData) {
        setJobId(jobData.id);
        setCurrentStep("preview");
      }
    } catch (error: any) {
      console.error("Error creating job:", error);
      toast({
        title: "Failed to Create Import Job",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  const handlePreviewComplete = () => {
    setCurrentStep("analyze");
  };

  const handleAnalyzeComplete = (suggestions: any[]) => {
    setAiSuggestions(suggestions);
    setCurrentStep("apply");
  };

  const handleApplyComplete = () => {
    setCurrentStep("import");
  };

  const handleImportComplete = (report: any) => {
    setImportReport(report);
    setCurrentStep("report");
  };

  const handleDisconnect = () => {
    // Reset wizard and navigate back
    setCurrentStep("connect");
    setImportSelection(null);
    setJobId(null);
    setAiSuggestions([]);
    setImportReport(null);
    navigate("/integrations");
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">One-Time Migration</h1>
        <p className="text-muted-foreground">
          Import contacts, consent, tags, and segments from Klaviyo or Constant
          Contact
        </p>
      </div>

      {/* Progress Steps */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                    index < currentStepIndex
                      ? "bg-primary border-primary text-primary-foreground"
                      : index === currentStepIndex
                        ? "border-primary text-primary"
                        : "border-muted text-muted-foreground"
                  }`}
                >
                  {index < currentStepIndex ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                <div className="mt-2 text-center">
                  <div
                    className={`font-medium text-sm ${
                      index <= currentStepIndex
                        ? "text-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {step.label}
                  </div>
                  <div className="text-xs text-muted-foreground max-w-[120px]">
                    {step.description}
                  </div>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 transition-colors ${
                    index < currentStepIndex ? "bg-primary" : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Step Content */}
      <Card className="p-8">
        {currentStep === "connect" && (
          <ConnectStep
            allowedProviders={supportedProviders}
            onComplete={handleConnectComplete}
          />
        )}
        {currentStep === "choose" && (
          <ChooseStep
            provider={selectedProvider}
            onComplete={handleChooseComplete}
            onBack={() => setCurrentStep("connect")}
          />
        )}
        {currentStep === "preview" && jobId && (
          <PreviewStep
            jobId={jobId}
            onComplete={handlePreviewComplete}
            onBack={() => setCurrentStep("choose")}
          />
        )}
        {currentStep === "analyze" && jobId && (
          <AnalyzeStep
            jobId={jobId}
            onComplete={handleAnalyzeComplete}
            onBack={() => setCurrentStep("preview")}
          />
        )}
        {currentStep === "apply" && (
          <ApplyStep
            suggestions={aiSuggestions}
            onComplete={handleApplyComplete}
            onBack={() => setCurrentStep("analyze")}
          />
        )}
        {currentStep === "import" && jobId && (
          <ImportStep
            jobId={jobId}
            suggestions={aiSuggestions}
            onComplete={handleImportComplete}
            onBack={() => setCurrentStep("apply")}
          />
        )}
        {currentStep === "report" && jobId && (
          <ReportStep
            jobId={jobId}
            report={importReport}
            onDisconnect={handleDisconnect}
          />
        )}
      </Card>
    </div>
  );
};

export default MigrationsPage;
