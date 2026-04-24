import * as React from "react";
import Alert from "@mui/joy/Alert";
import AspectRatio from "@mui/joy/AspectRatio";
import Button from "@mui/joy/Button";
import Card from "@mui/joy/Card";
import Chip from "@mui/joy/Chip";
import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import Input from "@mui/joy/Input";
import Option from "@mui/joy/Option";
import Select from "@mui/joy/Select";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { useQuery } from "@tanstack/react-query";
import { Eye, Search, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  renderSmsPreview,
  sendTestSms,
  type RenderPreviewResponse,
  type SampleCustomer,
} from "@/lib/sms/smsPreviewService";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";

interface SmsPreviewPanelProps {
  messageTemplate: string;
  mediaUrls?: string[];
  imageUrl?: string;
  campaignId?: string;
  segmentId?: string;
  recipientCount?: number;
}

interface CustomerOption {
  id: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
}

type PreviewMode = "sample" | "customer";

function getCustomerLabel(customer: CustomerOption) {
  const name = [customer.first_name, customer.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return name || customer.phone || customer.email || "Unknown customer";
}

export const SmsPreviewPanel: React.FC<SmsPreviewPanelProps> = ({
  messageTemplate,
  mediaUrls = [],
  imageUrl,
  recipientCount = 0,
}) => {
  const { tenant } = useTenant();
  const [previewMode, setPreviewMode] = React.useState<PreviewMode>("sample");
  const [sampleCustomer, setSampleCustomer] = React.useState<SampleCustomer>({
    first_name: "John",
    last_name: "Doe",
    email: "john@example.com",
    phone: "+15551234567",
  });
  const [customerSearch, setCustomerSearch] = React.useState("");
  const [selectedCustomerId, setSelectedCustomerId] = React.useState<
    string | null
  >(null);
  const [previewData, setPreviewData] =
    React.useState<RenderPreviewResponse | null>(null);
  const [loadingPreview, setLoadingPreview] = React.useState(false);
  const [testPhone, setTestPhone] = React.useState("");
  const [sendingTest, setSendingTest] = React.useState(false);

  const allMediaUrls = React.useMemo(
    () => (imageUrl ? [imageUrl, ...mediaUrls] : mediaUrls),
    [imageUrl, mediaUrls],
  );

  const customerOptionsQuery = useQuery({
    queryKey: ["sms-preview-customers", tenant?.id, customerSearch],
    enabled: Boolean(tenant?.id) && previewMode === "customer",
    staleTime: 15_000,
    queryFn: async () => {
      if (!tenant?.id) {
        return [] as CustomerOption[];
      }

      let query = supabase
        .from("crm_customers")
        .select("id, first_name, last_name, phone, email")
        .eq("tenant_id", tenant.id)
        .eq("sms_opt_in", true)
        .not("phone", "is", null)
        .limit(20);

      if (customerSearch.trim()) {
        const safeQuery = customerSearch.replace(/[,.()"'\\]/g, "");
        query = query.or(
          `first_name.ilike.%${safeQuery}%,last_name.ilike.%${safeQuery}%,phone.ilike.%${safeQuery}%`,
        );
      }

      const { data, error } = await query;
      if (error) {
        throw error;
      }

      return data || [];
    },
  });

  const fetchPreview = React.useCallback(async () => {
    if (!messageTemplate.trim()) {
      setPreviewData(null);
      return;
    }

    setLoadingPreview(true);
    try {
      const result = await renderSmsPreview({
        messageTemplate,
        mediaUrls: allMediaUrls,
        customerId:
          previewMode === "customer"
            ? selectedCustomerId || undefined
            : undefined,
        sampleCustomer: previewMode === "sample" ? sampleCustomer : undefined,
      });
      setPreviewData(result);
    } catch (error) {
      console.error("Failed to render preview", error);
    } finally {
      setLoadingPreview(false);
    }
  }, [
    allMediaUrls,
    messageTemplate,
    previewMode,
    sampleCustomer,
    selectedCustomerId,
  ]);

  React.useEffect(() => {
    const timeout = window.setTimeout(() => {
      void fetchPreview();
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [fetchPreview]);

  const handleSendTest = React.useCallback(async () => {
    if (!testPhone.trim()) {
      toast.error("Enter a phone number for the test send.");
      return;
    }

    setSendingTest(true);
    try {
      const result = await sendTestSms({
        messageTemplate,
        mediaUrls: allMediaUrls,
        testToPhone: testPhone,
        renderAsCustomerId:
          previewMode === "customer"
            ? selectedCustomerId || undefined
            : undefined,
        bypassConsentForTest: true,
      });

      if (!result.success) {
        throw new Error(
          result.twilioError || result.error || "Failed to send test SMS",
        );
      }

      toast.success("Test SMS sent.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to send test SMS",
      );
    } finally {
      setSendingTest(false);
    }
  }, [
    allMediaUrls,
    messageTemplate,
    previewMode,
    selectedCustomerId,
    testPhone,
  ]);

  return (
    <Card
      variant="outlined"
      sx={{ borderRadius: "28px", borderColor: "neutral.200", p: 2.5 }}
    >
      <Stack spacing={2}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.25}
          justifyContent="space-between"
          alignItems={{ md: "center" }}
        >
          <Stack spacing={0.35}>
            <Typography level="title-sm">Preview & Test</Typography>
            <Typography level="body-sm" color="neutral">
              Preview personalization and send a live test message before
              launching to {recipientCount.toLocaleString()} recipients.
            </Typography>
          </Stack>
          <Chip
            size="sm"
            variant="soft"
            color="neutral"
            startDecorator={<Eye size={14} />}
          >
            Live preview
          </Chip>
        </Stack>

        <Stack direction="row" spacing={1}>
          <Button
            size="sm"
            variant={previewMode === "sample" ? "solid" : "soft"}
            color="primary"
            onClick={() => setPreviewMode("sample")}
            sx={{ borderRadius: "12px" }}
          >
            Sample customer
          </Button>
          <Button
            size="sm"
            variant={previewMode === "customer" ? "solid" : "soft"}
            color="primary"
            onClick={() => setPreviewMode("customer")}
            sx={{ borderRadius: "12px" }}
          >
            Real customer
          </Button>
        </Stack>

        <Stack
          direction={{ xs: "column", xl: "row" }}
          spacing={2.5}
          alignItems="flex-start"
        >
          <Stack spacing={1.5} sx={{ flex: 1, minWidth: 0 }}>
            {previewMode === "sample" ? (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                <FormControl>
                  <FormLabel>First name</FormLabel>
                  <Input
                    value={sampleCustomer.first_name || ""}
                    onChange={(event) =>
                      setSampleCustomer((current) => ({
                        ...current,
                        first_name: event.target.value,
                      }))
                    }
                    sx={{ borderRadius: "12px" }}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Last name</FormLabel>
                  <Input
                    value={sampleCustomer.last_name || ""}
                    onChange={(event) =>
                      setSampleCustomer((current) => ({
                        ...current,
                        last_name: event.target.value,
                      }))
                    }
                    sx={{ borderRadius: "12px" }}
                  />
                </FormControl>
              </Stack>
            ) : (
              <Stack spacing={1.25}>
                <FormControl>
                  <FormLabel>Search recipients</FormLabel>
                  <Input
                    value={customerSearch}
                    onChange={(event) => setCustomerSearch(event.target.value)}
                    placeholder="Search by name or phone"
                    startDecorator={<Search size={14} />}
                    sx={{ borderRadius: "12px" }}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Select customer</FormLabel>
                  <Select
                    value={selectedCustomerId}
                    onChange={(_event, value) =>
                      setSelectedCustomerId(value ?? null)
                    }
                    placeholder={
                      customerOptionsQuery.isLoading
                        ? "Loading customers…"
                        : "Choose a customer"
                    }
                    sx={{ borderRadius: "12px" }}
                  >
                    {(customerOptionsQuery.data || []).map((customer) => (
                      <Option key={customer.id} value={customer.id}>
                        {getCustomerLabel(customer)}
                      </Option>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
            )}

            <Stack spacing={1}>
              <FormControl>
                <FormLabel>Test phone</FormLabel>
                <Input
                  value={testPhone}
                  onChange={(event) => setTestPhone(event.target.value)}
                  placeholder="+1 555 123 4567"
                  sx={{ borderRadius: "12px" }}
                />
              </FormControl>
              <Button
                variant="soft"
                color="primary"
                startDecorator={<Send size={14} />}
                loading={sendingTest}
                onClick={() => void handleSendTest()}
                sx={{ alignSelf: "flex-start", borderRadius: "12px" }}
              >
                Send test SMS
              </Button>
            </Stack>
          </Stack>

          <Sheet
            variant="outlined"
            sx={{
              width: { xs: "100%", xl: 340 },
              borderRadius: "32px",
              borderColor: "neutral.200",
              p: 1.5,
              backgroundColor: "background.level1",
            }}
          >
            <BoxShell>
              <Stack spacing={1.25}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <Typography level="title-sm">Phone Preview</Typography>
                  <Chip
                    size="sm"
                    variant="soft"
                    color="primary"
                    startDecorator={<Sparkles size={12} />}
                  >
                    Personalized
                  </Chip>
                </Stack>

                {allMediaUrls.length > 0 ? (
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    {allMediaUrls.map((url, index) => (
                      <AspectRatio
                        key={`${url}-${index}`}
                        ratio="1"
                        sx={{
                          width: 72,
                          borderRadius: "16px",
                          overflow: "hidden",
                        }}
                      >
                        <img
                          src={url}
                          alt={`Preview media ${index + 1}`}
                          style={{ objectFit: "cover" }}
                        />
                      </AspectRatio>
                    ))}
                  </Stack>
                ) : null}

                <Sheet
                  variant="solid"
                  color="primary"
                  sx={{
                    borderRadius: "22px 22px 8px 22px",
                    p: 1.5,
                    alignSelf: "flex-end",
                    maxWidth: "88%",
                  }}
                >
                  <Typography level="body-sm" sx={{ whiteSpace: "pre-wrap" }}>
                    {loadingPreview
                      ? "Rendering preview…"
                      : previewData?.renderedContent ||
                        messageTemplate ||
                        "Start typing to preview this SMS."}
                  </Typography>
                </Sheet>
              </Stack>
            </BoxShell>
          </Sheet>
        </Stack>

        {previewData?.warnings?.length ? (
          <Alert color="warning" variant="soft" sx={{ borderRadius: "18px" }}>
            {previewData.warnings.join(" ")}
          </Alert>
        ) : null}
      </Stack>
    </Card>
  );
};

function BoxShell({ children }: { children: React.ReactNode }) {
  return (
    <Sheet
      sx={{
        borderRadius: "28px",
        minHeight: 420,
        background:
          "linear-gradient(180deg, rgba(17,24,39,1) 0%, rgba(31,41,55,1) 100%)",
        p: 1.25,
      }}
    >
      <Sheet
        sx={{
          height: "100%",
          borderRadius: "24px",
          background:
            "linear-gradient(180deg, rgba(246,248,251,1) 0%, rgba(239,243,248,1) 100%)",
          p: 1.5,
        }}
      >
        {children}
      </Sheet>
    </Sheet>
  );
}
