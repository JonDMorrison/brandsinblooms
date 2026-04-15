import { useId, useRef, useState } from "react";
import Box from "@mui/joy/Box";
import { useAdmin } from "@/contexts/AdminContext";
import { useAdminTenantActions } from "@/hooks/useAdminTenantActions";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { Upload, FileText, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export const AdminCSVImport = () => {
  const { activeTenantId } = useAdmin();
  const { importCustomers } = useAdminTenantActions();
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (
        selectedFile.type !== "text/csv" &&
        !selectedFile.name.endsWith(".csv")
      ) {
        toast.error("Please select a CSV file");
        return;
      }
      setFile(selectedFile);
    }
  };

  const parseCSV = (text: string): any[] => {
    const lines = text.split("\n");
    const headers = lines[0].split(",").map((h) => h.trim());

    const customers = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;

      const values = lines[i].split(",").map((v) => v.trim());
      const customer: any = {};

      headers.forEach((header, index) => {
        const value = values[index] || "";

        // Map common CSV headers to our schema
        switch (header.toLowerCase()) {
          case "email":
          case "email address":
            customer.email = value;
            break;
          case "first name":
          case "firstname":
            customer.first_name = value;
            break;
          case "last name":
          case "lastname":
            customer.last_name = value;
            break;
          case "phone":
          case "phone number":
            customer.phone = value;
            break;
          case "sms opt-in":
          case "sms_opt_in":
            customer.sms_opt_in =
              value.toLowerCase() === "true" || value === "1";
            break;
          default:
            // Store unknown fields in custom_fields
            if (!customer.custom_fields) customer.custom_fields = {};
            customer.custom_fields[header] = value;
        }
      });

      if (customer.email) {
        customers.push(customer);
      }
    }

    return customers;
  };

  const handleImport = async () => {
    if (!file) {
      toast.error("Please select a file first");
      return;
    }

    if (!activeTenantId) {
      toast.error("Please select a tenant first");
      return;
    }

    setIsProcessing(true);

    try {
      const text = await file.text();
      const customers = parseCSV(text);

      if (customers.length === 0) {
        toast.error("No valid customer records found in CSV");
        setIsProcessing(false);
        return;
      }

      const result = await importCustomers(customers);

      if (!result.error) {
        setFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    } catch (error: any) {
      console.error("CSV import error:", error);
      toast.error(error.message || "Failed to import CSV");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <JoyCard>
      <JoyCardHeader
        title="Import Customers from CSV"
        description="Upload a CSV file to import customers for the selected tenant"
        startDecorator={<Upload className="h-5 w-5" />}
      />
      <JoyCardContent>
        {!activeTenantId ? (
          <Sheet
            variant="soft"
            color="warning"
            sx={{ p: 2, borderRadius: "var(--joy-radius-lg)" }}
          >
            <Stack direction="row" spacing={1.25} alignItems="flex-start">
              <AlertCircle className="h-5 w-5" />
              <Stack spacing={0.25}>
                <Typography level="title-sm">
                  Select a tenant before importing
                </Typography>
                <Typography level="body-sm" color="neutral">
                  Tenant context determines where the imported customer records
                  will be written.
                </Typography>
              </Stack>
            </Stack>
          </Sheet>
        ) : (
          <Stack spacing={2}>
            <Sheet
              variant="outlined"
              sx={{
                p: 3,
                borderRadius: "var(--joy-radius-xl)",
                borderStyle: "dashed",
                borderWidth: 2,
                textAlign: "center",
              }}
            >
              <input
                ref={fileInputRef}
                id={fileInputId}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                hidden
              />
              <Stack spacing={1.5} alignItems="center">
                <Sheet
                  variant="soft"
                  color="primary"
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: 999,
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <FileText className="h-7 w-7" />
                </Sheet>
                <Stack spacing={0.5} alignItems="center">
                  <Typography level="title-sm">
                    {file ? file.name : "Choose a CSV file to import"}
                  </Typography>
                  <Typography level="body-sm" color="neutral">
                    Supported columns include email, first_name, last_name,
                    phone, and sms_opt_in.
                  </Typography>
                </Stack>
                <JoyButton
                  bloomVariant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Select CSV
                </JoyButton>
              </Stack>
            </Sheet>

            {file && (
              <Stack spacing={1}>
                <Sheet
                  variant="soft"
                  color="neutral"
                  sx={{ p: 1.5, borderRadius: "var(--joy-radius-lg)" }}
                >
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    spacing={2}
                  >
                    <Stack direction="row" spacing={1} alignItems="center">
                      <FileText className="h-4 w-4" />
                      <Stack spacing={0.25}>
                        <Typography level="body-sm" fontWeight="lg">
                          {file.name}
                        </Typography>
                        <Typography level="body-xs" color="neutral">
                          Ready for import
                        </Typography>
                      </Stack>
                    </Stack>
                    <Typography level="body-xs" color="neutral">
                      {(file.size / 1024).toFixed(2)} KB
                    </Typography>
                  </Stack>
                </Sheet>

                <JoyButton
                  onClick={handleImport}
                  disabled={isProcessing}
                  loading={isProcessing}
                  loadingPosition="start"
                  fullWidth
                >
                  {isProcessing ? "Importing customers..." : "Import Customers"}
                </JoyButton>
              </Stack>
            )}

            <Sheet
              variant="soft"
              color="neutral"
              sx={{ p: 2, borderRadius: "var(--joy-radius-lg)" }}
            >
              <Typography level="body-sm" fontWeight="lg" sx={{ mb: 1 }}>
                CSV Format Example
              </Typography>
              <Box
                component="pre"
                sx={{
                  m: 0,
                  p: 1.5,
                  borderRadius: "var(--joy-radius-md)",
                  backgroundColor: "background.surface",
                  fontSize: "var(--joy-fontSize-xs)",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  whiteSpace: "pre-wrap",
                }}
              >
                {"email,first_name,last_name,phone,sms_opt_in\n"}
                {"john@example.com,John,Doe,+15551234567,true\n"}
                {"jane@example.com,Jane,Smith,+15557654321,false"}
              </Box>
            </Sheet>
          </Stack>
        )}
      </JoyCardContent>
    </JoyCard>
  );
};
