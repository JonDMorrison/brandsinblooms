import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import CircularProgress from "@mui/joy/CircularProgress";
import Grid from "@mui/joy/Grid";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { supabase } from "@/integrations/supabase/client";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { PageContainer } from "@/components/joy/PageContainer";
import { JoySearchInput } from "@/components/joy/JoySearchInput";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyStatusChip } from "@/components/joy/JoyChip";
import { useToast } from "@/hooks/use-toast";
import { Users, Building2, Calendar, DollarSign } from "lucide-react";
import { DomainReputationDashboard } from "@/components/admin/DomainReputationDashboard";
import { DeliverabilityMonitor } from "@/components/admin/DeliverabilityMonitor";

export default function AdminDashboard() {
  const [searchEmail, setSearchEmail] = useState("");
  const { data: isSuperAdmin, isLoading: checkingAdmin } = useIsSuperAdmin();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tenants, isLoading: loadingTenants } = useQuery({
    queryKey: ["admin-tenants", searchEmail],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_tenant_overview")
        .select("*")
        .ilike("primary_contact_email", `%${searchEmail}%`)
        .order("tenant_created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
    enabled: isSuperAdmin && searchEmail.length > 0,
  });

  const switchContextMutation = useMutation({
    mutationFn: async (tenantId: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("admin_session_context").upsert({
        admin_user_id: user.id,
        active_tenant_id: tenantId,
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Context switched",
        description: "You are now viewing data for the selected tenant",
      });
      queryClient.invalidateQueries({ queryKey: ["crm_customers"] });
      queryClient.invalidateQueries({ queryKey: ["crm_campaigns"] });
    },
    onError: (error) => {
      toast({
        title: "Error switching context",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (checkingAdmin) {
    return (
      <PageContainer fullWidth>
        <Stack
          minHeight="40vh"
          alignItems="center"
          justifyContent="center"
          spacing={2}
        >
          <CircularProgress size="md" />
          <Typography level="body-sm" color="neutral">
            Checking permissions...
          </Typography>
        </Stack>
      </PageContainer>
    );
  }

  if (!isSuperAdmin) {
    return (
      <PageContainer fullWidth>
        <JoyCard>
          <JoyCardHeader
            title="Access Denied"
            description="You do not have master admin privileges"
          />
        </JoyCard>
      </PageContainer>
    );
  }

  return (
    <PageContainer fullWidth>
      <Stack spacing={3}>
        <Stack spacing={0.75}>
          <Typography level="h2">Master Admin Dashboard</Typography>
          <Typography level="body-md" color="neutral">
            Search and manage tenant accounts
          </Typography>
        </Stack>

        <DomainReputationDashboard />

        <DeliverabilityMonitor />

        <JoyCard>
          <JoyCardHeader
            title="Search User by Email"
            description="Enter an email address to find their tenant information"
          />
          <JoyCardContent>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              flexWrap="wrap"
            >
              <JoySearchInput
                placeholder="christine@dwntoearth.com"
                value={searchEmail}
                onValueChange={setSearchEmail}
                sx={{ flex: 1, minWidth: { xs: "100%", sm: 280 } }}
              />
              <JoyButton
                onClick={() =>
                  queryClient.invalidateQueries({ queryKey: ["admin-tenants"] })
                }
                disabled={!searchEmail}
                sx={{ width: { xs: "100%", sm: "auto" } }}
              >
                Search
              </JoyButton>
            </Stack>
          </JoyCardContent>
        </JoyCard>

        {loadingTenants && (
          <JoyCard>
            <JoyCardContent sx={{ pt: 3 }}>
              <Stack
                alignItems="center"
                justifyContent="center"
                minHeight={120}
                spacing={1.5}
              >
                <CircularProgress size="sm" />
                <Typography level="body-sm" color="neutral">
                  Searching...
                </Typography>
              </Stack>
            </JoyCardContent>
          </JoyCard>
        )}

        {tenants && tenants.length === 0 && (
          <JoyCard>
            <JoyCardContent sx={{ pt: 3 }}>
              <Typography level="body-sm" color="neutral" textAlign="center">
                No tenants found for "{searchEmail}"
              </Typography>
            </JoyCardContent>
          </JoyCard>
        )}

        {tenants && tenants.length > 0 && (
          <Stack spacing={2}>
            {tenants.map((tenant) => (
              <JoyCard key={tenant.tenant_id}>
                <JoyCardHeader
                  title={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Building2 className="h-5 w-5" />
                      <span>{tenant.company_name || "Unnamed Company"}</span>
                    </Stack>
                  }
                  description={tenant.primary_contact_email}
                  actions={
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      {tenant.is_active ? (
                        <JoyStatusChip status="active" />
                      ) : (
                        <JoyStatusChip status="inactive" />
                      )}
                      {tenant.is_trialing ? (
                        <JoyStatusChip label="Trial" status="trial" />
                      ) : null}
                      {tenant.is_paid_active ? (
                        <JoyStatusChip status="paid" />
                      ) : null}
                    </Stack>
                  }
                />
                <JoyCardContent>
                  <Stack spacing={2}>
                    <Grid container spacing={2}>
                      <Grid xs={6} md={3}>
                        <Stack spacing={0.5}>
                          <Typography level="body-sm" color="neutral">
                            Plan
                          </Typography>
                          <Typography level="body-md" fontWeight="lg">
                            {tenant.plan || "N/A"}
                          </Typography>
                        </Stack>
                      </Grid>
                      <Grid xs={6} md={3}>
                        <Stack spacing={0.5}>
                          <Typography level="body-sm" color="neutral">
                            Status
                          </Typography>
                          <Typography level="body-md" fontWeight="lg">
                            {tenant.subscription_status || "N/A"}
                          </Typography>
                        </Stack>
                      </Grid>
                      <Grid xs={6} md={3}>
                        <Stack spacing={0.5}>
                          <Stack
                            direction="row"
                            spacing={0.5}
                            alignItems="center"
                          >
                            <Calendar className="h-3 w-3" />
                            <Typography level="body-sm" color="neutral">
                              Created
                            </Typography>
                          </Stack>
                          <Typography level="body-md" fontWeight="lg">
                            {tenant.tenant_created_at
                              ? new Date(
                                  tenant.tenant_created_at,
                                ).toLocaleDateString()
                              : "N/A"}
                          </Typography>
                        </Stack>
                      </Grid>
                      <Grid xs={6} md={3}>
                        <Stack spacing={0.5}>
                          <Typography level="body-sm" color="neutral">
                            Location
                          </Typography>
                          <Typography level="body-md" fontWeight="lg">
                            {[tenant.city, tenant.region, tenant.country]
                              .filter(Boolean)
                              .join(", ") || "N/A"}
                          </Typography>
                        </Stack>
                      </Grid>
                    </Grid>

                    {tenant.trial_end ? (
                      <Sheet
                        variant="soft"
                        color="warning"
                        sx={{ p: 1.5, borderRadius: "var(--joy-radius-md)" }}
                      >
                        <Typography level="body-sm">
                          <Typography component="span" fontWeight="lg">
                            Trial ends:
                          </Typography>{" "}
                          {new Date(tenant.trial_end).toLocaleDateString()}
                          {tenant.trial_not_expired ? " (Active)" : ""}
                        </Typography>
                      </Sheet>
                    ) : null}

                    <JoyButton
                      onClick={() =>
                        switchContextMutation.mutate(tenant.tenant_id!)
                      }
                      disabled={switchContextMutation.isPending}
                      fullWidth
                      startDecorator={<Users className="h-4 w-4" />}
                    >
                      View Tenant Data
                    </JoyButton>
                  </Stack>
                </JoyCardContent>
              </JoyCard>
            ))}
          </Stack>
        )}
      </Stack>
    </PageContainer>
  );
}
