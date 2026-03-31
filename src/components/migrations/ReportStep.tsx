import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Download, CheckCircle2, Unplug } from "lucide-react";

interface ReportStepProps {
  jobId: string;
  report: any;
  onDisconnect: () => void;
}

interface ImportReportSummary {
  contacts_imported: number;
  contacts_skipped: number;
  contacts_failed: number;
  segments_created: number;
  tags_created: number;
  consents_recorded: number;
  errors: string[];
  batches_processed: number;
}

export const ReportStep = ({
  jobId,
  report,
  onDisconnect,
}: ReportStepProps) => {
  const { toast } = useToast();
  const [disconnecting, setDisconnecting] = useState(false);

  const handleDownloadReport = () => {
    const summary = normalizeReport(report);
    const reportData = {
      jobId,
      timestamp: new Date().toISOString(),
      summary,
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `migration-report-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Report Downloaded",
      description: "Migration report has been saved",
    });
  };

  const normalizeReport = (rawReport: any): ImportReportSummary => ({
    contacts_imported: Number(rawReport?.contacts_imported ?? 0),
    contacts_skipped: Number(rawReport?.contacts_skipped ?? 0),
    contacts_failed: Number(rawReport?.contacts_failed ?? 0),
    segments_created: Number(rawReport?.segments_created ?? 0),
    tags_created: Number(rawReport?.tags_created ?? 0),
    consents_recorded: Number(rawReport?.consents_recorded ?? 0),
    errors: Array.isArray(rawReport?.errors)
      ? rawReport.errors.filter(
          (entry: unknown): entry is string => typeof entry === "string",
        )
      : [],
    batches_processed: Number(rawReport?.batches_processed ?? 0),
  });

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      // Get job to find provider
      const { data: job } = await supabase
        .from("import_jobs")
        .select("provider")
        .eq("id", jobId)
        .single();

      if (!job) throw new Error("Job not found");

      const provider = job.provider;

      // Call appropriate revoke-token edge function
      const revokeFunction =
        provider === "constant_contact"
          ? "constant-contact-revoke-token"
          : "mailchimp-revoke-token";

      const { data, error } = await supabase.functions.invoke(revokeFunction, {
        body: { provider },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.message);

      toast({
        title: "Provider Disconnected",
        description:
          data?.message || "OAuth tokens have been revoked successfully",
      });

      onDisconnect();
    } catch (error: any) {
      console.error("Disconnect error:", error);
      toast({
        title: "Disconnect Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDisconnecting(false);
    }
  };

  const summary = normalizeReport(report);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Migration Complete</h2>
        <p className="text-muted-foreground">
          Your migration has been completed successfully. Review the summary
          below.
        </p>
      </div>

      <Card className="p-6 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
        <div className="flex items-center gap-3 mb-4">
          <CheckCircle2 className="w-6 h-6 text-green-600" />
          <h3 className="text-lg font-semibold">Import Successful</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          All data has been imported and is now available in BloomSuite.
        </p>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold mb-4">Summary</h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div>
            <p className="text-sm text-muted-foreground">Contacts Imported</p>
            <p className="text-2xl font-bold">
              {summary.contacts_imported.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Contacts Skipped</p>
            <p className="text-2xl font-bold">
              {summary.contacts_skipped.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Contacts Failed</p>
            <p className="text-2xl font-bold text-destructive">
              {summary.contacts_failed.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Consents Recorded</p>
            <p className="text-2xl font-bold">
              {summary.consents_recorded.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Tags Created</p>
            <p className="text-2xl font-bold">
              {summary.tags_created.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Segments Created</p>
            <p className="text-2xl font-bold">
              {summary.segments_created.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Batches Processed</p>
            <p className="text-2xl font-bold">
              {summary.batches_processed.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Errors</p>
            <p className="text-2xl font-bold text-destructive">
              {summary.errors.length}
            </p>
          </div>
        </div>

        {summary.errors.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <Accordion type="single" collapsible>
              <AccordionItem value="errors">
                <AccordionTrigger>
                  Review import warnings ({summary.errors.length})
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">
                    {summary.errors.map((error: string, i: number) => (
                      <p key={i} className="text-sm text-destructive">
                        {error}
                      </p>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )}
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={handleDownloadReport}>
          <Download className="w-4 h-4 mr-2" />
          Download Report
        </Button>
        <Button
          variant="destructive"
          onClick={handleDisconnect}
          disabled={disconnecting}
        >
          <Unplug className="w-4 h-4 mr-2" />
          {disconnecting ? "Disconnecting..." : "Disconnect Provider"}
        </Button>
      </div>
    </div>
  );
};
