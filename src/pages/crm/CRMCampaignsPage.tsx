import React, { useEffect, useState } from "react";
import Box from "@mui/joy/Box";
import CircularProgress from "@mui/joy/CircularProgress";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { useNavigate } from "react-router-dom";
import { JoyAlertDialog } from "@/components/joy/JoyAlertDialog";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoyChip, JoyStatusChip } from "@/components/joy/JoyChip";
import { JoyStatCard } from "@/components/joy/JoyStatCard";
import {
  BarChart3,
  Calendar,
  Eye,
  Mail,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DomainHealthBanner } from "@/components/crm/email/DomainHealthBanner";

export const CRMCampaignsPage: React.FC = () => {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchCRMCampaigns = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (userError) throw userError;
      if (!userData?.tenant_id) {
        setCampaigns([]);
        return;
      }

      const { data, error } = await supabase
        .from("crm_campaigns")
        .select("*")
        .eq("tenant_id", userData.tenant_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
    } catch (error) {
      console.error("Error fetching CRM campaigns:", error);
      toast({
        title: "Error",
        description: "Failed to load campaigns",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (campaign: any) => {
    setCampaignToDelete(campaign);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!campaignToDelete) return;

    // FIX: [issue #43] - Prevent deleting campaigns that are currently sending
    if (campaignToDelete.status === "sending") {
      toast({
        title: "Cannot delete",
        description:
          "This campaign is currently sending and cannot be deleted.",
        variant: "destructive",
      });
      setDeleteDialogOpen(false);
      setCampaignToDelete(null);
      return;
    }

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("crm_campaigns")
        .delete()
        .eq("id", campaignToDelete.id);

      if (error) throw error;

      setCampaigns(campaigns.filter((c) => c.id !== campaignToDelete.id));
      toast({
        title: "Campaign deleted",
        description: `${campaignToDelete.name} has been deleted successfully.`,
      });
      setDeleteDialogOpen(false);
      setCampaignToDelete(null);
    } catch (error) {
      console.error("Error deleting campaign:", error);
      toast({
        title: "Error deleting campaign",
        description:
          "There was an error deleting the campaign. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchCRMCampaigns();
    }
  }, [user]);

  const activeCampaigns = campaigns.filter(
    (c) => c.status === "active" || c.status === "sent",
  ).length;
  const scheduledCampaigns = campaigns.filter(
    (c) => c.status === "scheduled",
  ).length;
  const draftCampaigns = campaigns.filter(
    (c) => c.status === "draft" || !c.status,
  ).length;

  const canViewRecipients = (status: string | null | undefined) =>
    ["sent", "sending", "sent_with_errors"].includes(status || "");

  const getStatusTone = (status: string | null | undefined) => {
    switch (status) {
      case "sent":
        return "success" as const;
      case "sending":
      case "scheduled":
        return "warning" as const;
      case "draft":
      default:
        return "neutral" as const;
    }
  };

  return (
    <Stack spacing={3.5}>
      <DomainHealthBanner />

      <Sheet
        variant="plain"
        sx={{
          p: { xs: 3, md: 4 },
          borderRadius: "24px",
          border: "1px solid",
          borderColor: "neutral.200",
          background:
            "linear-gradient(135deg, rgba(12, 74, 110, 0.08) 0%, rgba(255, 251, 235, 0.8) 45%, rgba(255, 255, 255, 1) 100%)",
        }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", md: "center" }}
        >
          <Stack spacing={1}>
            <Typography level="h1">Campaigns</Typography>
            <Typography level="body-md" color="neutral">
              Review drafts, scheduled sends, and live campaign performance from
              one Joy workspace.
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <JoyChip color="primary" variant="soft">
                CRM email
              </JoyChip>
              <JoyChip color="warning" variant="soft">
                Tenant scoped
              </JoyChip>
            </Stack>
          </Stack>

          <JoyButton
            onClick={() => navigate("/crm/campaigns/new")}
            startDecorator={<Plus />}
          >
            Create Campaign
          </JoyButton>
        </Stack>
      </Sheet>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            md: "repeat(3, minmax(0, 1fr))",
          },
          gap: 3,
        }}
      >
        <JoyStatCard
          icon={<Mail />}
          iconColor="primary"
          label="Active campaigns"
          value={activeCampaigns}
        />
        <JoyStatCard
          icon={<Calendar />}
          iconColor="warning"
          label="Scheduled"
          value={scheduledCampaigns}
        />
        <JoyStatCard
          icon={<BarChart3 />}
          iconColor="neutral"
          label="Draft campaigns"
          value={draftCampaigns}
        />
      </Box>

      {loading ? (
        <JoyCard>
          <JoyCardContent>
            <Stack
              direction="row"
              spacing={1.5}
              alignItems="center"
              sx={{ py: 4 }}
            >
              <CircularProgress size="sm" />
              <Typography level="body-md">Loading campaigns...</Typography>
            </Stack>
          </JoyCardContent>
        </JoyCard>
      ) : (
        <>
          {campaigns.length > 0 && (
            <JoyCard>
              <JoyCardHeader
                title="Your CRM campaigns"
                description="Current email campaigns and automation sends for this tenant."
                startDecorator={
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: "14px",
                      display: "grid",
                      placeItems: "center",
                      backgroundColor: "primary.50",
                      color: "primary.700",
                    }}
                  >
                    <Mail className="h-5 w-5" />
                  </Box>
                }
              />
              <JoyCardContent>
                <Stack spacing={2}>
                  {campaigns.map((campaign) => (
                    <Sheet
                      key={campaign.id}
                      variant="outlined"
                      sx={{
                        p: 2.5,
                        borderRadius: "18px",
                        borderColor: "neutral.200",
                      }}
                    >
                      <Stack spacing={2}>
                        <Stack
                          direction={{ xs: "column", lg: "row" }}
                          spacing={2}
                          justifyContent="space-between"
                          alignItems={{ xs: "flex-start", lg: "center" }}
                        >
                          <Stack spacing={0.75} sx={{ minWidth: 0 }}>
                            <Typography level="title-md">
                              {campaign.name}
                            </Typography>
                            <Typography level="body-sm" color="neutral">
                              {campaign.subject_line || "No subject line yet"}
                            </Typography>
                            <Stack
                              direction="row"
                              spacing={1}
                              useFlexGap
                              flexWrap="wrap"
                            >
                              <JoyStatusChip
                                status={campaign.status || "draft"}
                                tone={getStatusTone(campaign.status)}
                              />
                              <JoyChip color="neutral" variant="soft">
                                Created{" "}
                                {new Date(
                                  campaign.created_at,
                                ).toLocaleDateString()}
                              </JoyChip>
                            </Stack>
                          </Stack>

                          <Stack
                            direction={{ xs: "column", sm: "row" }}
                            spacing={1}
                            useFlexGap
                          >
                            {campaign.status === "sent" && (
                              <JoyButton
                                bloomVariant="outline"
                                size="sm"
                                startDecorator={<BarChart3 />}
                                onClick={() =>
                                  navigate(
                                    `/crm/campaigns/${campaign.id}/analytics`,
                                  )
                                }
                              >
                                Performance
                              </JoyButton>
                            )}
                            {canViewRecipients(campaign.status) && (
                              <JoyButton
                                bloomVariant="outline"
                                size="sm"
                                startDecorator={<Users />}
                                onClick={() =>
                                  navigate(
                                    `/dashboard/campaigns/${campaign.id}/recipients`,
                                  )
                                }
                              >
                                Recipients
                              </JoyButton>
                            )}
                            <JoyButton
                              bloomVariant="outline"
                              size="sm"
                              startDecorator={<Eye />}
                              onClick={() =>
                                navigate(`/crm/campaigns/${campaign.id}`)
                              }
                            >
                              Edit
                            </JoyButton>
                            {campaign.status === "draft" && (
                              <JoyButton
                                bloomVariant="destructiveOutline"
                                size="sm"
                                onClick={() => handleDeleteClick(campaign)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </JoyButton>
                            )}
                          </Stack>
                        </Stack>
                      </Stack>
                    </Sheet>
                  ))}
                </Stack>
              </JoyCardContent>
            </JoyCard>
          )}

          {campaigns.length === 0 && (
            <JoyCard>
              <JoyCardHeader
                title="Campaign management"
                description="Create, schedule, and monitor email campaigns for your customer lists."
              />
              <JoyCardContent>
                <Stack spacing={2} alignItems="flex-start">
                  <Typography level="body-sm" color="neutral">
                    Build your first campaign to start sending newsletters,
                    launches, and seasonal promotions.
                  </Typography>
                  <JoyButton
                    bloomVariant="outline"
                    onClick={() => navigate("/crm/campaigns/new")}
                    startDecorator={<Plus />}
                  >
                    Get started with your first campaign
                  </JoyButton>
                </Stack>
              </JoyCardContent>
            </JoyCard>
          )}
        </>
      )}

      <JoyAlertDialog
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setCampaignToDelete(null);
        }}
        title="Delete Campaign"
        description={`Are you sure you want to delete "${campaignToDelete?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDeleteConfirm}
        loading={isDeleting}
        variant="danger"
      />
    </Stack>
  );
};
