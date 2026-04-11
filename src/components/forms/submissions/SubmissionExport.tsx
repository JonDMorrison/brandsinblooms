import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { fetchFormSubmissionsPage } from "@/hooks/useForms";
import {
  Form,
  FormSubmission,
  FormSubmissionMetadata,
  FormSubmissionSortColumn,
  SortDirection,
} from "@/types/formBuilder";
import { useToast } from "@/hooks/use-toast";
import {
  getSubmissionColumnValue,
  getSubmissionDisplaySource,
  getSubmissionExportColumns,
} from "@/lib/forms/submissionPresentation";

interface SubmissionExportProps {
  formId: string;
  form: Pick<Form, "fields_json">;
  tenantId?: string;
  formName: string;
  totalCount: number;
  sortColumn: FormSubmissionSortColumn;
  sortDirection: SortDirection;
  resultFilter?: string | null;
  searchQuery?: string;
  dateFrom?: string | null;
  dateTo?: string | null;
  hideTestSubmissions?: boolean;
}

const EXPORT_PAGE_SIZE = 500;

export function SubmissionExport({
  formId,
  form,
  tenantId,
  formName,
  totalCount,
  sortColumn,
  sortDirection,
  resultFilter,
  searchQuery = "",
  dateFrom = null,
  dateTo = null,
  hideTestSubmissions = true,
}: SubmissionExportProps) {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const formatValue = (value: unknown) => {
    if (value === null || value === undefined) {
      return "";
    }

    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return String(value);
    }

    return JSON.stringify(value);
  };

  const escapeCSV = (value: string) => {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }

    return value;
  };

  const downloadFile = (content: BlobPart, fileName: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getExportFileName = (extension: "csv" | "json") => {
    const safeFormName = formName.replace(/\s+/g, "_");
    const dateStamp = new Date().toISOString().split("T")[0];
    return `${safeFormName}_submissions_${dateStamp}.${extension}`;
  };

  const loadAllSubmissions = async (): Promise<FormSubmission[]> => {
    if (!tenantId) {
      return [];
    }

    const collected: FormSubmission[] = [];
    let currentPage = 1;
    let totalPages = 1;

    while (currentPage <= totalPages) {
      const page = await fetchFormSubmissionsPage({
        formId,
        tenantId,
        page: currentPage,
        pageSize: EXPORT_PAGE_SIZE,
        sortColumn,
        sortDirection,
        resultFilter,
        search: searchQuery,
        dateFrom,
        dateTo,
        hideTestSubmissions,
      });

      collected.push(...page.rows);
      totalPages = page.totalPages;

      if (totalPages === 0) {
        break;
      }

      currentPage += 1;
    }

    return collected;
  };

  const exportToCSV = async () => {
    setIsExporting(true);

    try {
      const submissions = await loadAllSubmissions();

      if (submissions.length === 0) {
        toast({
          title: "Nothing to export",
          description: "No submissions match the current filters.",
        });
        return;
      }

      const fieldColumns = getSubmissionExportColumns(form, submissions);

      const headers = [
        "Submitted At",
        "Result",
        "Reason",
        ...fieldColumns.map((column) => column.label),
        "Email Consent",
        "SMS Consent",
        "Source",
        "Page URL",
        "Referrer",
        "UTM Source",
        "UTM Campaign",
        "Customer ID",
        "Submission ID",
      ];

      const rows = submissions.map((sub) => {
        const metadata = (sub.metadata ||
          {}) as Partial<FormSubmissionMetadata>;

        return [
          new Date(sub.submitted_at).toISOString(),
          sub.result,
          sub.reason || "",
          ...fieldColumns.map((column) =>
            formatValue(getSubmissionColumnValue(sub, column)),
          ),
          metadata?.email_consent ? "Yes" : "No",
          metadata?.sms_consent ? "Yes" : "No",
          getSubmissionDisplaySource(sub),
          metadata?.page_url || "",
          metadata?.referrer || "",
          metadata?.utm_source || "",
          metadata?.utm_campaign || "",
          sub.customer_id || "",
          sub.id,
        ];
      });

      const csvContent = [
        headers.map(escapeCSV).join(","),
        ...rows.map((row) => row.map(escapeCSV).join(",")),
      ].join("\n");

      downloadFile(
        csvContent,
        getExportFileName("csv"),
        "text/csv;charset=utf-8;",
      );

      toast({
        title: "Export successful",
        description: `Exported ${submissions.length} submissions to CSV.`,
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Failed to export submissions. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const exportToJSON = async () => {
    setIsExporting(true);

    try {
      const submissions = await loadAllSubmissions();

      if (submissions.length === 0) {
        toast({
          title: "Nothing to export",
          description: "No submissions match the current filters.",
        });
        return;
      }

      const exportData = submissions.map((sub) => ({
        id: sub.id,
        submitted_at: sub.submitted_at,
        result: sub.result,
        reason: sub.reason,
        customer_id: sub.customer_id,
        data: sub.data,
        metadata: sub.metadata,
      }));

      const jsonContent = JSON.stringify(exportData, null, 2);

      downloadFile(jsonContent, getExportFileName("json"), "application/json");

      toast({
        title: "Export successful",
        description: `Exported ${submissions.length} submissions to JSON.`,
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Failed to export submissions. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  if (totalCount === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={isExporting || !tenantId}>
          {isExporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-background">
        <DropdownMenuLabel>Export Format</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void exportToCSV()}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void exportToJSON()}>
          <FileText className="h-4 w-4 mr-2" />
          Export as JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
