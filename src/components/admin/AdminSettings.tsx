import { useState, useEffect } from "react";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyChip } from "@/components/joy/JoyChip";
import { JoyInput as Input } from "@/components/joy/JoyInput";
import {
  JoyTabs,
  JoyTabsContent,
  JoyTabsList,
  JoyTabsTrigger,
} from "@/components/joy/JoyTabs";
import { supabase } from "@/integrations/supabase/client";
// Removed sonner import - using global toast replacement
import { Settings, Upload, FileText, Database, Trash2 } from "lucide-react";
import * as XLSX from "xlsx";
import type { Database as DatabaseType } from "@/integrations/supabase/types";

type AIResource =
  DatabaseType["public"]["Tables"]["ai_generation_resources"]["Row"];

export const AdminSettings = () => {
  const [resources, setResources] = useState<AIResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const fetchResources = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("ai_generation_resources")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching AI resources:", error);
        toast.error("Failed to load AI resources");
      } else {
        setResources(data || []);
      }
    } catch (error) {
      console.error("Error fetching AI resources:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      let content = "";
      let fileType: "csv" | "pdf" | "text" = "text";

      if (file.name.endsWith(".csv") || file.name.endsWith(".txt")) {
        fileType = "csv";
        content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = () => reject(new Error("Failed to read file"));
          reader.readAsText(file);
        });
      } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
        fileType = "csv";
        const data = new Uint8Array(await file.arrayBuffer());
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        content = XLSX.utils.sheet_to_csv(worksheet);
      } else if (file.name.endsWith(".pdf")) {
        fileType = "pdf";
        // For PDF files, we'll store the base64 content
        content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = () => reject(new Error("Failed to read file"));
          reader.readAsDataURL(file);
        });
      } else {
        toast.error(
          "Unsupported file type.  Please upload CSV, Excel, or PDF files.",
        );
        setUploading(false);
        return;
      }

      const { data, error } = await supabase
        .from("ai_generation_resources")
        .insert([
          {
            name: file.name,
            type: fileType,
            content: content,
            description: `Uploaded ${fileType.toUpperCase()} file for AI generation guidance`,
          },
        ])
        .select();

      if (error) {
        throw error;
      }

      if (data && data[0]) {
        setResources((prev) => [data[0], ...prev]);
      }

      // Clear the input
      event.target.value = "";
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(`Failed to upload file: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteResource = async (id: string, name: string) => {
    try {
      const { error } = await supabase
        .from("ai_generation_resources")
        .delete()
        .eq("id", id);

      if (error) {
        throw error;
      }

      setResources((prev) => prev.filter((r) => r.id !== id));
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error(`Failed to delete resource: ${error.message}`);
    }
  };

  useEffect(() => {
    fetchResources();
  }, []);

  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Settings className="h-6 w-6 text-blue-600" />
        <Typography component="h1" level="h2">
          Master Admin Settings
        </Typography>
        <JoyChip bloomVariant="destructive" sx={{ ml: 1 }}>
          Admin Only
        </JoyChip>
      </Stack>

      <JoyTabs defaultValue="resources">
        <JoyTabsList
          sx={{
            display: "grid",
            width: "100%",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          }}
        >
          <JoyTabsTrigger value="resources">AI Resources</JoyTabsTrigger>
          <JoyTabsTrigger value="settings">System Settings</JoyTabsTrigger>
        </JoyTabsList>

        <JoyTabsContent value="resources" sx={{ display: "grid", gap: 6 }}>
          <JoyCard>
            <JoyCardHeader
              title="Upload AI Generation Resources"
              startDecorator={<Upload className="h-5 w-5" />}
            />
            <JoyCardContent>
              <Stack spacing={2}>
                <div>
                  <Input
                    id="resource-file"
                    label="Upload CSV, Excel, or PDF File"
                    helperText="Upload files containing content ideas, seasonal themes, or AI generation guidance"
                    type="file"
                    accept=".csv,.txt,.xlsx,.xls,.pdf"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    slotProps={{
                      input: {
                        className: "cursor-pointer",
                      },
                    }}
                  />
                </div>
              </Stack>
            </JoyCardContent>
          </JoyCard>

          <JoyCard>
            <JoyCardHeader
              title={`Current AI Resources (${resources.length})`}
              startDecorator={<Database className="h-5 w-5" />}
            />
            <JoyCardContent>
              {loading ? (
                <Stack
                  alignItems="center"
                  justifyContent="center"
                  sx={{ py: 8 }}
                >
                  <Typography level="body-md" color="neutral">
                    Loading resources...
                  </Typography>
                </Stack>
              ) : resources.length === 0 ? (
                <Stack
                  alignItems="center"
                  justifyContent="center"
                  spacing={1}
                  sx={{ py: 8 }}
                >
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-40" />
                  <Typography level="title-sm">
                    No AI resources found
                  </Typography>
                  <Typography level="body-sm" color="neutral">
                    Upload your first resource file to get started
                  </Typography>
                </Stack>
              ) : (
                <Stack spacing={1.5}>
                  {resources.map((resource) => (
                    <Sheet
                      key={resource.id}
                      color="neutral"
                      sx={{
                        p: 2,
                        borderRadius: "var(--joy-radius-lg)",
                        border: "1px solid",
                        borderColor: "neutral.200",
                        backgroundColor: "neutral.50",
                      }}
                    >
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="flex-start"
                        spacing={2}
                      >
                        <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                            sx={{ mb: 1 }}
                          >
                            <Typography level="title-sm">
                              {resource.name}
                            </Typography>
                            <JoyChip bloomVariant="outline">
                              {resource.type.toUpperCase()}
                            </JoyChip>
                          </Stack>
                          {resource.description && (
                            <Typography
                              level="body-sm"
                              color="neutral"
                              sx={{ mb: 1 }}
                            >
                              {resource.description}
                            </Typography>
                          )}
                          <Typography level="body-xs" color="neutral">
                            Uploaded:{" "}
                            {new Date(resource.created_at).toLocaleString()}
                          </Typography>
                        </Stack>
                        <JoyButton
                          aria-label={`Delete resource ${resource.name}`}
                          bloomVariant="destructive"
                          onClick={() =>
                            handleDeleteResource(resource.id, resource.name)
                          }
                          size="icon"
                          sx={{ width: 32, height: 32 }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </JoyButton>
                      </Stack>
                    </Sheet>
                  ))}
                </Stack>
              )}
            </JoyCardContent>
          </JoyCard>
        </JoyTabsContent>

        <JoyTabsContent value="settings" sx={{ display: "grid", gap: 6 }}>
          <JoyCard>
            <JoyCardHeader title="System Configuration" />
            <JoyCardContent>
              <Typography level="body-sm" color="neutral">
                Additional system settings and configurations will be added
                here.
              </Typography>
            </JoyCardContent>
          </JoyCard>
        </JoyTabsContent>
      </JoyTabs>
    </Stack>
  );
};
