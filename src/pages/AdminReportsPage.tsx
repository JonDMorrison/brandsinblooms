import { useState } from "react";
import { Navigate } from "react-router-dom";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import Sheet from "@mui/joy/Sheet";
import Button from "@mui/joy/Button";
import List from "@mui/joy/List";
import ListItem from "@mui/joy/ListItem";
import Skeleton from "@mui/joy/Skeleton";
import { FileText, Mail, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import { PageContainer } from "@/components/joy/PageContainer";

const INCLUDED = ["Email addresses", "Full names", "Company names", "Sign-up dates", "Trial end dates", "Days left", "Whether the trial is active or has ended"];

export const AdminReportsPage = () => {
  const { user } = useAuth();
  const { data: isSuperAdmin, isLoading: isAdminLoading } = useIsSuperAdmin();
  const [sending, setSending] = useState(false);

  if (!user) return <Navigate to="/dashboard" replace />;
  if (isAdminLoading) {
    return (
      <PageContainer>
        <Skeleton variant="text" level="h2" width="40%" />
        <Skeleton variant="rectangular" height={240} sx={{ mt: 2, borderRadius: "lg" }} />
      </PageContainer>
    );
  }
  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;

  const sendTrialUsersReport = async () => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-trial-users-report");
      if (error) throw error;
      toast.success(`Report sent. It lists ${data.totalUsers} people on a trial.`);
    } catch (error: unknown) {
      console.error("Error sending report:", error);
      toast.error(error instanceof Error ? error.message : "The report could not be sent. Try again in a minute.");
    } finally {
      setSending(false);
    }
  };

  return (
    <PageContainer>
      <Stack spacing={3}>
        <Stack spacing={0.5}>
          <Typography level="h2">Trial reports</Typography>
          <Typography level="body-md" textColor="text.secondary">
            Email Jon and Jeff a list of everyone on a free trial, so you can follow up before trials end.
          </Typography>
        </Stack>

        <Sheet variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, borderRadius: "xl", bgcolor: "background.surface" }}>
          <Stack spacing={2.5}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Users size={20} aria-hidden />
              <Typography level="title-lg">People on a trial</Typography>
            </Stack>
            <div>
              <Typography level="title-sm">What's in the report</Typography>
              <List size="sm" marker="disc" sx={{ "--ListItem-minHeight": "28px" }}>
                {INCLUDED.map((item) => <ListItem key={item}>{item}</ListItem>)}
              </List>
            </div>
            <Sheet variant="soft" color="neutral" sx={{ p: 2, borderRadius: "lg" }}>
              <Stack direction="row" spacing={1.25} alignItems="flex-start">
                <Mail size={18} aria-hidden />
                <div>
                  <Typography level="title-sm">Who gets it</Typography>
                  <Typography level="body-sm">jon@brandsinblooms.com, jeff@brandsinblooms.com</Typography>
                </div>
              </Stack>
            </Sheet>
            <Button size="lg" loading={sending} startDecorator={<FileText size={18} />} onClick={sendTrialUsersReport} sx={{ borderRadius: "xl", alignSelf: "flex-start" }}>
              Email the trial report
            </Button>
          </Stack>
        </Sheet>
      </Stack>
    </PageContainer>
  );
};
