import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui-legacy/dialog";
import { Button } from "@/components/ui-legacy/button";
import { NativeSelect } from "@/components/ui-legacy/NativeSelect";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-legacy/table";
import { Progress } from "@/components/ui-legacy/progress";
import { Alert, AlertDescription } from "@/components/ui-legacy/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Upload,
  CheckCircle,
  AlertCircle,
  Download,
  Loader2,
  X,
} from "lucide-react";
import { LoadingSpinner } from "@/components/ui-legacy/loading-spinner";
import {
  parseCSVFile,
  isValidEmail,
  generateCSVTemplate,
} from "@/utils/csvParser";
import type {
  ColumnMapping,
  ValidationResult,
  ImportResult,
  ImportProgress,
  DatabaseField,
  AIAnalysisResult,
} from "@/types/import";
import {
  CUSTOMER_FIELDS,
  applyCustomImportField,
  applyField,
  inferCustomFieldType,
  normalizeCustomFieldKey,
  parseValue,
  customerFieldByKey,
} from "@/lib/crm/customerImportSchema";
import {
  getRememberedImportField,
  rememberImportField,
} from "@/lib/crm/customerImportMappings";
import {
  DEFAULT_ATTESTATION_CHOICE,
  getAttestationOption,
  type ImportAttestationChoice,
} from "@/lib/crm/importConsent";
import { ImportConsentAttestationStep } from "@/components/crm/segments/ImportConsentAttestationStep";

interface EnhancedSegmentImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  segmentId?: string;
  segmentName?: string;
  onImportComplete?: () => void;
}

interface CustomerImportBatchResponse {
  imported: number;
  customers: Array<{ id: string; email: string }>;
  errors: Array<{ row: number; email: string | null; message: string }>;
}

interface BeginCustomerImportResponse {
  attestationId: string;
  tenantId: string;
}

const IMPORT_FIELD_ALIASES: Record<string, DatabaseField> = {
  email_address: "email",
  e_mail: "email",
  firstname: "first_name",
  first: "first_name",
  lastname: "last_name",
  last: "last_name",
  mobile: "phone",
  phone_number: "phone",
  interests: "tags",
  labels: "tags",
  text_opt_in: "sms_opt_in",
  sms_consent: "sms_opt_in",
};

function getDefaultImportField(header: string): DatabaseField {
  const key = normalizeCustomFieldKey(header);
  const known = CUSTOMER_FIELDS.find(
    (field) =>
      field.key === key || normalizeCustomFieldKey(field.label) === key,
  );

  return (
    (known?.key as DatabaseField) ||
    IMPORT_FIELD_ALIASES[key] ||
    `custom:${key}`
  );
}

function getImportErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const details = error as Record<string, unknown>;
    for (const key of ["message", "details", "hint"]) {
      if (typeof details[key] === "string" && details[key]) {
        return details[key];
      }
    }
  }
  return JSON.stringify(error) || "Unknown import error";
}

export const EnhancedSegmentImportDialog: React.FC<
  EnhancedSegmentImportDialogProps
> = ({ open, onOpenChange, segmentId, segmentName, onImportComplete }) => {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [dataRows, setDataRows] = useState<string[][]>([]);
  const [progress, setProgress] = useState<ImportProgress>({
    stage: "upload",
    progress: 0,
    message: "",
  });
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
  const [attestationChoice, setAttestationChoice] =
    useState<ImportAttestationChoice>(DEFAULT_ATTESTATION_CHOICE);

  // Build field options from CUSTOMER_FIELDS schema
  const standardFieldOptions = [
    { value: "skip", label: "-- Skip Column --" },
    ...CUSTOMER_FIELDS.map((field) => ({
      value: field.key,
      label: field.key === "email" ? `${field.label} (Required)` : field.label,
    })),
    // Additional fields not in schema but used by import
    { value: "phone", label: "Phone Number" },
    { value: "sms_opt_in", label: "SMS Opt-In (yes/no)" },
    { value: "tags", label: "Tags (comma-separated)" },
    { value: "persona", label: "Persona" },
    { value: "notes", label: "Notes/Memo" },
  ];

  const getFieldOptions = (mapping: ColumnMapping) => [
    ...standardFieldOptions,
    {
      value: `custom:${normalizeCustomFieldKey(mapping.csvHeader)}`,
      label: `Custom field: ${mapping.csvHeader}`,
    },
  ];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Only validate file type, no size or format restrictions
    if (!selectedFile.name.endsWith(".csv")) {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV file",
        variant: "destructive",
      });
      return;
    }

    setFile(selectedFile);
    setIsAnalyzing(true);
    setValidationErrors([]);
    setProgress({
      stage: "upload",
      progress: 30,
      message: "Parsing CSV file...",
    });

    try {
      // Step 1: Parse CSV
      const parsed = await parseCSVFile(selectedFile);

      setProgress({
        stage: "upload",
        progress: 50,
        message: "Analyzing data with AI...",
      });

      const { data: analysisResult, error: analysisError } =
        await supabase.functions.invoke("analyze-csv-intelligent", {
          body: {
            csvRows: [parsed.headers, ...parsed.firstFiveRows],
            delimiter: parsed.delimiter,
            columnCount: parsed.columnCount,
          },
        });
      setIsAnalyzing(false);

      // Step 3: Handle AI response
      let mappings: ColumnMapping[];

      if (analysisError || !analysisResult?.success) {
        console.error("❌ AI analysis failed:", {
          error: analysisError,
          result: analysisResult,
          errorMessage: analysisError?.message,
          resultError: analysisResult?.error,
        });
        toast({
          title: "AI analysis unavailable",
          description:
            analysisError?.message ||
            analysisResult?.error ||
            "Using basic column detection. You can manually adjust mappings.",
          variant: "destructive",
        });

        // Fallback: Use generic column names
        mappings = parsed.headers.map((header, index) => ({
          csvHeader: header,
          databaseField:
            getRememberedImportField(window.localStorage, header) ||
            getDefaultImportField(header),
          sampleData: parsed.sampleData[index].samples,
          sourceIndex: index,
        }));
      } else {
        // Success: Use AI suggestions
        setAiAnalysis(analysisResult);

        // The parsed file remains authoritative. AI can suggest a mapping, but
        // an omitted or malformed suggestion must never drop a CSV column.
        mappings = parsed.headers.map((header, columnIndex) => {
          const suggestion =
            analysisResult.analysis.suggestedMappings.find(
              (candidate) => candidate.columnIndex === columnIndex,
            );
          const suggestedField = suggestion?.suggestedField;

          return {
            csvHeader: header,
            databaseField:
              getRememberedImportField(window.localStorage, header) ||
              (!suggestedField || suggestedField === "skip"
                ? `custom:${normalizeCustomFieldKey(header)}`
                : suggestedField),
            sampleData: parsed.sampleData[columnIndex].samples,
            sourceIndex: columnIndex,
            aiConfidence: suggestion?.confidence,
            aiReasoning: suggestion?.reasoning,
          };
        });

        // Show warnings if data is inconsistent
        if (!analysisResult.analysis.dataConsistency.isConsistent) {
          setValidationErrors(analysisResult.analysis.dataConsistency.issues);
        }

        toast({
          title: "CSV analyzed successfully",
          description: `AI detected ${mappings.length} columns with ${
            analysisResult.analysis.dataConsistency.isConsistent
              ? "consistent"
              : "some inconsistent"
          } data`,
        });
      }

      setColumnMappings(mappings);
      setDataRows(parsed.dataRows);

      setProgress({
        stage: "mapping",
        progress: 0,
        message: `Loaded ${parsed.dataRows.length} rows. Please verify mappings.`,
      });
    } catch (error) {
      console.error("Error analyzing CSV:", error);
      setIsAnalyzing(false);
      toast({
        title: "Error processing CSV",
        description:
          error instanceof Error ? error.message : "Failed to process CSV file",
        variant: "destructive",
      });
      setFile(null);
      setProgress({ stage: "upload", progress: 0, message: "" });
    }
  };

  const handleFieldMappingChange = (index: number, value: string) => {
    setColumnMappings((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        databaseField: value as DatabaseField,
      };
      rememberImportField(
        window.localStorage,
        updated[index].csvHeader,
        updated[index].databaseField,
      );
      return updated;
    });
    setValidationErrors([]);
  };

  const validateMappings = (): ValidationResult => {
    const errors: string[] = [];

    // Check if email is mapped
    const hasEmail = columnMappings.some((m) => m.databaseField === "email");
    if (!hasEmail) {
      errors.push(
        "Email field is required. Please map at least one column to Email.",
      );
    }

    // Check for duplicate mappings (excluding skip)
    const nonSkipFields = columnMappings
      .filter((m) => m.databaseField !== "skip")
      .map((m) => m.databaseField);

    const duplicates = nonSkipFields.filter(
      (field, index) => nonSkipFields.indexOf(field) !== index,
    );

    if (duplicates.length > 0) {
      errors.push(
        `Duplicate mappings found for: ${[...new Set(duplicates)].join(", ")}`,
      );
    }

    const emailMapping = columnMappings.find(
      (mapping) => mapping.databaseField === "email",
    );
    if (emailMapping) {
      const emailIndex =
        emailMapping.sourceIndex ?? columnMappings.indexOf(emailMapping);
      const invalidEmailRows = dataRows
        .map((row, index) => ({
          value: String(row[emailIndex] ?? "").trim(),
          row: index + 2,
        }))
        .filter(({ value }) => !value || !isValidEmail(value));
      if (invalidEmailRows.length > 0) {
        const examples = invalidEmailRows
          .slice(0, 5)
          .map(({ row }) => row)
          .join(", ");
        errors.push(
          `${invalidEmailRows.length} row(s) have a missing or invalid email (CSV row${invalidEmailRows.length === 1 ? "" : "s"} ${examples}${invalidEmailRows.length > 5 ? ", …" : ""}).`,
        );
      }
    }

    for (const [mappingIndex, mapping] of columnMappings.entries()) {
      if (
        mapping.databaseField === "skip" ||
        mapping.databaseField === "email"
      ) {
        continue;
      }

      const custom = mapping.databaseField.startsWith("custom:");
      const schemaField = custom
        ? null
        : customerFieldByKey[mapping.databaseField];
      const type = custom
        ? inferCustomFieldType(mapping.csvHeader, mapping.sampleData)
        : schemaField?.type;
      if (!type) continue;

      const sourceIndex = mapping.sourceIndex ?? mappingIndex;
      const invalidValues = dataRows
        .map((row, index) => ({ value: row[sourceIndex], row: index + 2 }))
        .filter(
          ({ value }) =>
            String(value ?? "").trim() && parseValue(type, value) === null,
        );
      if (invalidValues.length > 0) {
        errors.push(
          `${mapping.csvHeader} has ${invalidValues.length} value(s) that are not valid ${type} data (first at CSV row ${invalidValues[0].row}).`,
        );
      }
    }

    return { isValid: errors.length === 0, errors };
  };

  const processImport = async (
    choice: ImportAttestationChoice,
  ): Promise<{
    result: ImportResult;
    affectedCustomerIds: string[];
    tenantId: string;
  }> => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("User not authenticated");

    const userId = user.user.id;

    // Build customers using applyField from shared schema
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const customers: any[] = [];
    let skippedNoEmail = 0;

    for (const row of dataRows) {
      // Find email mapping
      const emailMappingIndex = columnMappings.findIndex(
        (m) => m.databaseField === "email",
      );
      const emailMapping = columnMappings[emailMappingIndex];
      const rawEmail = emailMapping
        ? row[emailMapping.sourceIndex ?? emailMappingIndex]
        : null;
      const email = rawEmail ? String(rawEmail).trim().toLowerCase() : "";

      if (!email || !isValidEmail(email)) {
        skippedNoEmail++;
        continue;
      }

      const customer: Record<string, unknown> = {
        email,
        custom_fields: {},
      };

      // Apply all mapped fields using the shared schema
      columnMappings.forEach((mapping, index) => {
        const raw = row[mapping.sourceIndex ?? index];
        const fieldKey = mapping.databaseField;

        if (fieldKey === "skip" || fieldKey === "email") {
          // Skip already handled or explicitly skipped
          return;
        }

        if (fieldKey.startsWith("custom:")) {
          applyCustomImportField(
            customer,
            fieldKey.slice("custom:".length),
            raw,
            inferCustomFieldType(mapping.csvHeader, mapping.sampleData),
          );
          return;
        }

        // Use applyField for schema-defined fields
        applyField(customer, fieldKey, raw);

        // Handle fields not in schema (phone, tags, persona, sms_opt_in, notes)
        const value = raw ? String(raw).trim() : "";
        if (!value) return;

        if (fieldKey === "email_opt_in") {
          customer.email_opt_in_explicit = true;
        }

        switch (fieldKey) {
          case "phone":
            customer.phone = value.replace(/\D/g, "");
            break;
          case "tags":
            customer.tags = value
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean);
            break;
          case "persona":
            customer.persona = value;
            break;
          case "sms_opt_in":
            customer.sms_opt_in = [
              "true",
              "1",
              "yes",
              "y",
              "subscribed",
              "opted-in",
              "opted_in",
            ].includes(value.toLowerCase());
            customer.sms_opt_in_explicit = true;
            break;
          case "notes":
            (customer.custom_fields as Record<string, unknown>).notes = value;
            break;
        }
      });

      customers.push(customer);
    }
    // Deduplicate by email and merge data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const customerMap = new Map<string, any>();
    for (const customer of customers) {
      const email = String(customer.email).toLowerCase();
      const existing = customerMap.get(email);
      if (!existing) {
        customerMap.set(email, customer);
      } else {
        // Merge non-empty values
        for (const [key, value] of Object.entries(customer)) {
          if (value === null || value === undefined || value === "") continue;
          if (
            key === "custom_fields" &&
            typeof value === "object" &&
            value !== null
          ) {
            existing.custom_fields = {
              ...(existing.custom_fields || {}),
              ...(value as Record<string, unknown>),
            };
          } else if (
            existing[key] === null ||
            existing[key] === undefined ||
            existing[key] === ""
          ) {
            existing[key] = value;
          }
        }
      }
    }

    const deduplicatedCustomers = Array.from(customerMap.values());
    const duplicatesMerged = customers.length - deduplicatedCustomers.length;
    const BATCH_SIZE = 500;
    const totalBatches = Math.ceil(deduplicatedCustomers.length / BATCH_SIZE);
    const results: ImportResult = {
      total: dataRows.length,
      imported: 0,
      failed: 0,
      skipped: skippedNoEmail,
      duplicatesMerged,
      errors: [],
    };

    const attestation = getAttestationOption(choice);
    const { data: beginData, error: beginError } = await supabase.rpc(
      "begin_customer_csv_import",
      {
        p_attestation_type: choice,
        p_contact_count: deduplicatedCustomers.length,
        p_import_batch_id: file?.name ?? "customer-import.csv",
        p_attestation_wording: attestation.wording,
      },
    );
    if (beginError) throw beginError;

    const beginImport = beginData as unknown as BeginCustomerImportResponse;
    if (!beginImport?.attestationId || !beginImport?.tenantId) {
      throw new Error("The import consent record could not be created");
    }

    const tenantId = beginImport.tenantId;
    const affectedCustomerIds: string[] = [];

    for (let i = 0; i < deduplicatedCustomers.length; i += BATCH_SIZE) {
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const batch = deduplicatedCustomers.slice(i, i + BATCH_SIZE);

      setProgress({
        stage: "importing",
        progress: (batchNumber / totalBatches) * 100,
        message: `Importing batch ${batchNumber} of ${totalBatches}...`,
        currentBatch: batchNumber,
        totalBatches,
      });

      try {
        const { data, error } = await supabase.rpc(
          "import_crm_customer_batch",
          {
            p_customers: batch,
            p_attestation_id: beginImport.attestationId,
          },
        );
        if (error) throw error;

        const batchResult = data as unknown as CustomerImportBatchResponse;
        results.imported += batchResult.imported;
        results.failed += batchResult.errors.length;
        results.errors.push(
          ...batchResult.errors.map(
            (rowError) =>
              `CSV row ${i + rowError.row + 1}${rowError.email ? ` (${rowError.email})` : ""}: ${rowError.message}`,
          ),
        );
        for (const customer of batchResult.customers) {
          affectedCustomerIds.push(customer.id);
        }

        // If segment is specified, add customers to segment
        if (segmentId && batchResult.customers.length > 0) {
          const segmentAssignments = batchResult.customers.map((customer) => ({
            customer_id: customer.id,
            segment_id: segmentId,
            assigned_by_user_id: userId,
          }));

          const { error: assignmentError } = await supabase
            .from("customer_segments")
            .upsert(segmentAssignments, {
              onConflict: "customer_id,segment_id",
            });
          if (assignmentError) {
            results.errors.push(
              `Customers imported, but segment assignment failed: ${assignmentError.message}`,
            );
          }
        }
      } catch (error) {
        console.error("Batch import error:", error);
        results.failed += batch.length;
        // Extract actual error message from Supabase error object
        results.errors.push(getImportErrorMessage(error));
      }
    }

    return {
      result: results,
      affectedCustomerIds,
      tenantId,
    };
  };

  // From the mapping step, "Import N Customers" advances to the consent
  // attestation step rather than committing rows. The actual commit happens
  // from handleConfirmAttestation.
  const handleImport = () => {
    const validation = validateMappings();
    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      toast({
        title: "Invalid field mapping",
        description: validation.errors[0],
        variant: "destructive",
      });
      return;
    }

    setProgress({
      stage: "consent",
      progress: 0,
      message: "",
    });
  };

  const handleConfirmAttestation = async () => {
    setProgress({
      stage: "importing",
      progress: 0,
      message: "Starting import...",
    });

    try {
      const { result, affectedCustomerIds, tenantId } =
        await processImport(attestationChoice);

      if (affectedCustomerIds.length > 0) {
        const { error: segmentRefreshError } = await supabase.functions.invoke(
          "recompute-segment-memberships",
          {
            body: {
              tenant_id: tenantId,
              customer_ids: affectedCustomerIds,
            },
          },
        );
        if (segmentRefreshError) {
          result.errors.push(
            `Customers imported, but automatic segment refresh failed: ${segmentRefreshError.message}`,
          );
        }
      }

      setImportResult(result);
      setProgress({
        stage: "complete",
        progress: 100,
        message: "Import completed",
      });

      toast({
        title: "Import completed",
        description: `Successfully imported ${result.imported} customers${result.duplicatesMerged ? `, ${result.duplicatesMerged} duplicates merged` : ""}${result.failed > 0 ? `, ${result.failed} failed` : ""}${result.skipped > 0 ? `, ${result.skipped} skipped` : ""}`,
      });

      if (onImportComplete) {
        onImportComplete();
      }
    } catch (error) {
      console.error("Import error:", error);
      toast({
        title: "Import failed",
        description:
          error instanceof Error ? error.message : "Failed to import customers",
        variant: "destructive",
      });
      setProgress({ stage: "mapping", progress: 0, message: "" });
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent = generateCSVTemplate();
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "customer_import_template.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleClose = () => {
    if (progress.stage === "importing") {
      toast({
        title: "Import in progress",
        description: "Please wait for the import to complete",
        variant: "destructive",
      });
      return;
    }

    // Reset state
    setFile(null);
    setColumnMappings([]);
    setDataRows([]);
    setProgress({ stage: "upload", progress: 0, message: "" });
    setImportResult(null);
    setValidationErrors([]);
    setAttestationChoice(DEFAULT_ATTESTATION_CHOICE);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
          onClick={handleClose}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </Button>
        <DialogHeader>
          <DialogTitle>
            Import Customers {segmentName && `to "${segmentName}"`}
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file and map the columns to customer fields
          </DialogDescription>
        </DialogHeader>

        {/* Stage 1: File Upload */}
        {progress.stage === "upload" && (
          <div className="space-y-6">
            {/* Download Template Section */}
            <div className="bg-muted/30 rounded-lg p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Download className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Download Template</h3>
              </div>

              <p className="text-sm text-muted-foreground">
                Download our CSV template to ensure your data is formatted
                correctly for import.
              </p>

              <Button
                variant="outline"
                onClick={handleDownloadTemplate}
                className="gap-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
              >
                <Download className="h-4 w-4" />
                Download CSV Template
              </Button>
            </div>

            {/* Upload File Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Upload Customer File</h3>

              {!isAnalyzing ? (
                <div
                  className="border-2 border-dashed rounded-lg p-12 text-center transition-colors hover:border-primary/50 cursor-pointer"
                  onClick={() => document.getElementById("csv-upload")?.click()}
                >
                  <Upload className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="hidden"
                    id="csv-upload"
                  />
                  <p className="text-base font-medium text-foreground mb-2">
                    Drag & drop your customer file here, or click to browse
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Supports CSV files with any delimiter
                  </p>

                  {file && (
                    <div className="mt-4 p-3 bg-primary/10 rounded-md inline-block">
                      <p className="text-sm font-medium text-primary">
                        Selected: {file.name}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="border-2 border-dashed border-primary/50 rounded-lg p-12 text-center bg-muted/30">
                  <div className="flex flex-col items-center gap-4">
                    <LoadingSpinner size="lg" color="primary" />
                    <div className="text-center space-y-2">
                      <p className="text-base font-semibold text-foreground">
                        Analyzing file with AI
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {file?.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        This should only take a few seconds
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stage 2: Field Mapping */}
        {progress.stage === "mapping" && columnMappings.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {dataRows.length} rows found. Map CSV columns to database
                fields:
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFile(null);
                  setColumnMappings([]);
                  setDataRows([]);
                  setProgress({ stage: "upload", progress: 0, message: "" });
                  setAiAnalysis(null);
                }}
              >
                Change File
              </Button>
            </div>

            {aiAnalysis &&
              !aiAnalysis.analysis.dataConsistency.isConsistent && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-semibold mb-2">
                      Data Consistency Issues Detected:
                    </p>
                    <ul className="list-disc list-inside space-y-1">
                      {aiAnalysis.analysis.dataConsistency.issues.map(
                        (issue, idx) => (
                          <li key={idx} className="text-sm">
                            {issue}
                          </li>
                        ),
                      )}
                    </ul>
                    <p className="text-sm mt-2">
                      Please review the mappings carefully before importing.
                    </p>
                  </AlertDescription>
                </Alert>
              )}

            {validationErrors.length > 0 && !aiAnalysis && (
              <Alert variant="destructive">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>
                  <ul className="list-disc list-inside">
                    {validationErrors.map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">CSV Column</TableHead>
                    <TableHead className="w-[300px]">
                      Sample Data (5 rows)
                    </TableHead>
                    <TableHead className="w-[200px]">Map To Field</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {columnMappings.map((mapping, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span>{mapping.csvHeader}</span>
                          {mapping.aiConfidence && (
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                mapping.aiConfidence === "high"
                                  ? "bg-primary/10 text-primary"
                                  : mapping.aiConfidence === "medium"
                                    ? "bg-secondary/30 text-secondary-foreground"
                                    : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {mapping.aiConfidence}
                            </span>
                          )}
                        </div>
                        {mapping.aiReasoning && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            {mapping.aiReasoning}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm text-muted-foreground max-h-32 overflow-y-auto">
                          {mapping.sampleData.map((sample, idx) => (
                            <div
                              key={idx}
                              className="truncate max-w-xs"
                              title={sample}
                            >
                              {sample || (
                                <span className="italic text-muted-foreground/50">
                                  empty
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <NativeSelect
                          value={mapping.databaseField}
                          onChange={(e) =>
                            handleFieldMappingChange(index, e.target.value)
                          }
                          options={getFieldOptions(mapping)}
                          className="w-full"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleImport}>
                Import {dataRows.length} Customers
              </Button>
            </div>
          </div>
        )}

        {/* Stage 2.5: Consent attestation */}
        {progress.stage === "consent" && (
          <ImportConsentAttestationStep
            contactCount={dataRows.length}
            value={attestationChoice}
            onChange={setAttestationChoice}
            onBack={() =>
              setProgress({ stage: "mapping", progress: 0, message: "" })
            }
            onContinue={handleConfirmAttestation}
          />
        )}

        {/* Stage 3: Importing */}
        {progress.stage === "importing" && (
          <div className="space-y-4 py-8">
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin" />
              <p className="text-lg font-medium">{progress.message}</p>
            </div>
            <Progress value={progress.progress} className="w-full" />
            {progress.currentBatch && progress.totalBatches && (
              <p className="text-center text-sm text-muted-foreground">
                Processing batch {progress.currentBatch} of{" "}
                {progress.totalBatches}
              </p>
            )}
          </div>
        )}

        {/* Stage 4: Complete */}
        {progress.stage === "complete" && importResult && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-500">
              <CheckCircle className="w-8 h-8" />
              <h3 className="text-xl font-semibold">Import Complete</h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="border rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Total Rows</p>
                <p className="text-2xl font-bold">{importResult.total}</p>
              </div>
              <div className="border rounded-lg p-4">
                <p className="text-sm text-muted-foreground">
                  Successfully Imported
                </p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-500">
                  {importResult.imported}
                </p>
              </div>
              {importResult.duplicatesMerged &&
                importResult.duplicatesMerged > 0 && (
                  <div className="border rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">
                      Duplicates Merged
                    </p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-500">
                      {importResult.duplicatesMerged}
                    </p>
                  </div>
                )}
              {importResult.skipped > 0 && (
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">
                    Skipped (invalid email)
                  </p>
                  <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-500">
                    {importResult.skipped}
                  </p>
                </div>
              )}
              {importResult.failed > 0 && (
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Failed</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-500">
                    {importResult.failed}
                  </p>
                </div>
              )}
            </div>

            {attestationChoice === "unsure" && importResult.imported > 0 && (
              <Alert>
                <AlertCircle className="w-4 h-4" />
                <AlertDescription className="space-y-2">
                  <p className="font-semibold">
                    These contacts are paused until they confirm.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    You marked consent as unsure, so we&apos;ve held{" "}
                    {importResult.imported} contacts back from marketing sends.
                    Send a one-time permission campaign asking them to opt in —
                    only the people who confirm will become sendable. Open the
                    campaigns page when you&apos;re ready; we won&apos;t
                    auto-send anything on your behalf.
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {importResult.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>
                  <p className="font-semibold mb-2">
                    Errors occurred during import:
                  </p>
                  <ul className="list-disc list-inside space-y-1">
                    {importResult.errors.slice(0, 5).map((error, i) => (
                      <li key={i} className="text-sm">
                        {error}
                      </li>
                    ))}
                    {importResult.errors.length > 5 && (
                      <li className="text-sm italic">
                        ...and {importResult.errors.length - 5} more errors
                      </li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end">
              <Button onClick={handleClose}>Close</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
