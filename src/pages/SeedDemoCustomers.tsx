import { useState } from "react";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import Sheet from "@mui/joy/Sheet";
import Button from "@mui/joy/Button";
import Alert from "@mui/joy/Alert";
import List from "@mui/joy/List";
import ListItem from "@mui/joy/ListItem";
import { CheckCircle, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer } from "@/components/joy/PageContainer";
import { useAskDialog } from "@/components/bloomSupport/useAskDialog";

interface SeedResult { tenantId: string; personasCreated: number; customersCreated: number }

export default function SeedDemoCustomers() {
  const [isSeeding, setIsSeeding] = useState(false);
  const [result, setResult] = useState<SeedResult | null>(null);
  const { ask, dialog } = useAskDialog();

  const handleSeedCustomers = async () => {
    const ok = await ask({
      title: "Add 500 made-up customers?",
      description: "This writes demo data into the Plant Addicts account. Only do this on a demo account.",
      confirmLabel: "Add demo customers",
      tone: "danger",
    });
    if (!ok) return;
    setIsSeeding(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("seed-demo-customers", {
        body: { userId: "4d993313-c925-4c96-a8ee-3ab5be5c54cf", count: 500 },
      });
      if (error) throw error;
      setResult(data as SeedResult);
      toast.success(`Added ${data.customersCreated} demo customers.`);
    } catch (error: unknown) {
      console.error("Seeding error:", error);
      toast.error(`Demo customers were not added: ${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <PageContainer>
      {dialog}
      <Stack spacing={3}>
        <Stack spacing={0.5}>
          <Typography level="h2">Demo data</Typography>
          <Typography level="body-md" textColor="text.secondary">
            For developers: fill the Plant Addicts demo account with made-up customers so features can be shown with realistic data.
          </Typography>
        </Stack>
        <Alert color="warning" variant="soft">This adds data to a real account (richard.anderson@plantaddicts.com). Never run it on a client's account.</Alert>
        <Sheet variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, borderRadius: "xl", bgcolor: "background.surface" }}>
          <Stack spacing={2.5}>
            <div>
              <Typography level="title-md">What it does</Typography>
              <List size="sm" marker="disc">
                <ListItem>Creates the Plant Addicts account if it does not exist, and adds Richard to it</ListItem>
                <ListItem>Creates 8 garden centre customer types</ListItem>
                <ListItem>Creates 500 made-up customers with varied names, contact details, purchases, email/SMS choices and time zones</ListItem>
              </List>
            </div>
            {result && (
              <Sheet variant="soft" color="success" sx={{ p: 2, borderRadius: "lg" }}>
                <Typography level="title-sm" startDecorator={<CheckCircle size={16} />}>Done</Typography>
                <Typography level="body-sm">{result.personasCreated} customer types and {result.customersCreated} customers added.</Typography>
              </Sheet>
            )}
            <Button size="lg" color="neutral" loading={isSeeding} startDecorator={<Users size={18} />} onClick={handleSeedCustomers} sx={{ borderRadius: "xl", alignSelf: "flex-start" }}>
              {isSeeding ? "Adding customers, this takes 1–2 minutes" : "Add 500 demo customers"}
            </Button>
          </Stack>
        </Sheet>
      </Stack>
    </PageContainer>
  );
}
