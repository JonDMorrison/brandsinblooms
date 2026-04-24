import { useState, useEffect } from "react";
import { Button } from "@/components/ui-legacy/button";
import { Card } from "@/components/ui-legacy/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Users, Mail, Clock3, AlertCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-legacy/table";

interface PreviewStepProps {
  jobId: string;
  onComplete: () => void;
  onBack: () => void;
}

interface PreviewData {
  listInfo: {
    id: string;
    name: string;
    totalMembers: number;
  };
  selectedSegments: Array<{
    id: string;
    name: string;
    memberCount: number;
  }>;
  sampleContacts: Array<{
    email: string;
    firstName: string | null;
    lastName: string | null;
    status: string;
    tags: string[];
  }>;
  estimatedImportCount: number;
  estimatedDuration: string;
  alreadyInCRM: number;
  newContacts: number;
}

interface SelectionSummary {
  listCount: number;
  segmentCount: number;
}

export const PreviewStep = ({
  jobId,
  onComplete,
  onBack,
}: PreviewStepProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectionSummary, setSelectionSummary] = useState<SelectionSummary>({
    listCount: 0,
    segmentCount: 0,
  });

  useEffect(() => {
    fetchPreview();
  }, [jobId]); // fetchPreview is stable, no need to include

  const fetchPreview = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get job details
      const { data: job } = await supabase
        .from("import_jobs")
        .select("provider, config")
        .eq("id", jobId)
        .single();

      if (!job) {
        throw new Error("Job not found");
      }

      const config =
        job.config &&
        typeof job.config === "object" &&
        !Array.isArray(job.config)
          ? (job.config as { listIds?: unknown; segmentIds?: unknown })
          : {};
      const listIds = Array.isArray(config.listIds)
        ? config.listIds.filter(
            (value): value is string => typeof value === "string",
          )
        : [];
      const segmentIds = Array.isArray(config.segmentIds)
        ? config.segmentIds.filter(
            (value): value is string => typeof value === "string",
          )
        : [];

      setSelectionSummary({
        listCount: listIds.length,
        segmentCount: segmentIds.length,
      });

      const functionName =
        job.provider === "mailchimp"
          ? "mailchimp-fetch-preview"
          : job.provider === "klaviyo"
            ? "klaviyo-fetch-preview"
            : "constant-contact-fetch-preview";

      // Fetch preview data
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { jobId },
      });

      if (error) throw error;

      setPreview(data);
    } catch (err: any) {
      console.error("Preview error:", err);
      setError(err.message);
      toast({
        title: "Preview Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Card className="p-6">
          <div className="flex items-start gap-3 text-destructive">
            <AlertCircle className="w-5 h-5 mt-0.5" />
            <div>
              <p className="font-medium">Unable to fetch preview</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        </Card>
        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button onClick={fetchPreview}>Retry</Button>
        </div>
      </div>
    );
  }

  if (!preview) return null;

  const previewIsRepresentative =
    selectionSummary.listCount + selectionSummary.segmentCount > 1;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Preview Import Data</h2>
        <p className="text-muted-foreground">
          Review sample data before importing. This preview shows the first 10
          contacts from the previewed scope.
        </p>
      </div>

      <Card className="p-4 bg-muted/40">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium">Previewing audience</p>
            <p className="text-sm text-muted-foreground">
              {preview.listInfo.name} with {selectionSummary.listCount} selected
              list
              {selectionSummary.listCount === 1 ? "" : "s"} and{" "}
              {selectionSummary.segmentCount} selected segment
              {selectionSummary.segmentCount === 1 ? "" : "s"}
            </p>
          </div>
          {previewIsRepresentative && (
            <p className="text-sm text-muted-foreground md:max-w-xs md:text-right">
              This sample represents the first selected Mailchimp scope. The
              full import still processes every selected list and segment.
            </p>
          )}
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">
                {preview.estimatedImportCount.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">Estimated Import</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Mail className="w-8 h-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">
                {preview.newContacts.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">New Contacts</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Mail className="w-8 h-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">
                {preview.alreadyInCRM.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">Already In CRM</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Clock3 className="w-8 h-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{preview.estimatedDuration}</p>
              <p className="text-sm text-muted-foreground">
                Estimated Duration
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-4 space-y-2">
        <p className="text-sm">
          <span className="font-medium">Previewed List:</span>{" "}
          {preview.listInfo.name} (
          {preview.listInfo.totalMembers.toLocaleString()} total members)
        </p>
        <p className="text-sm">
          <span className="font-medium">Import estimate:</span>{" "}
          {preview.estimatedImportCount.toLocaleString()} contacts before
          dedupe.
        </p>
      </Card>

      {/* Sample Contacts */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">
          Sample Contacts (First 10)
        </h3>
        {preview.sampleContacts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No contacts found in selected lists/segments</p>
            <p className="text-sm mt-2">
              Please go back and select different data sources
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>First Name</TableHead>
                  <TableHead>Last Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tags</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.sampleContacts.map((contact, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-sm">
                      {contact.email}
                    </TableCell>
                    <TableCell>{contact.firstName || "—"}</TableCell>
                    <TableCell>{contact.lastName || "—"}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                          contact.status === "subscribed"
                            ? "bg-success/10 text-success"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {contact.status || "unknown"}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {contact.tags.length > 0 ? contact.tags.join(", ") : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Previewed List</h3>
        <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
          <span className="font-medium">{preview.listInfo.name}</span>
          <span className="text-sm text-muted-foreground">
            {preview.listInfo.totalMembers.toLocaleString()} members
          </span>
        </div>
      </Card>

      {/* Segments */}
      {preview.selectedSegments.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Segments to Import</h3>
          <div className="space-y-2">
            {preview.selectedSegments.map((segment) => (
              <div
                key={segment.id}
                className="flex justify-between items-center p-3 bg-muted rounded-lg"
              >
                <span className="font-medium">{segment.name}</span>
                <span className="text-sm text-muted-foreground">
                  {segment.memberCount.toLocaleString()} members
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onComplete}>Continue to Analysis</Button>
      </div>
    </div>
  );
};
