import { useCallback, useEffect, useMemo, useState } from "react";
import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Chip from "@mui/joy/Chip";
import DialogActions from "@mui/joy/DialogActions";
import DialogContent from "@mui/joy/DialogContent";
import DialogTitle from "@mui/joy/DialogTitle";
import Divider from "@mui/joy/Divider";
import FormControl from "@mui/joy/FormControl";
import FormHelperText from "@mui/joy/FormHelperText";
import FormLabel from "@mui/joy/FormLabel";
import Grid from "@mui/joy/Grid";
import Input from "@mui/joy/Input";
import Modal from "@mui/joy/Modal";
import ModalClose from "@mui/joy/ModalClose";
import ModalDialog from "@mui/joy/ModalDialog";
import Option from "@mui/joy/Option";
import Select from "@mui/joy/Select";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Tab from "@mui/joy/Tab";
import TabList from "@mui/joy/TabList";
import TabPanel from "@mui/joy/TabPanel";
import Tabs from "@mui/joy/Tabs";
import Typography from "@mui/joy/Typography";
import { AlertTriangle, Building2 } from "lucide-react";
import { ProtectedPageWrapper } from "@/components/ProtectedPageWrapper";
import { BillingDashboard } from "@/components/billing/BillingDashboard";
import { UsageAnalytics } from "@/components/billing/UsageAnalytics";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription as useLegacySubscription } from "@/hooks/useSubscription";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type AccountTabValue = "general" | "business" | "billing" | "usage" | "danger";
type LoadStatus = "idle" | "loading" | "ready";

interface ProfileData {
  displayName: string;
  timezone: string;
}

interface BusinessData {
  companyName: string;
  companyPhone: string;
  companyEmail: string;
}

const DEFAULT_TIMEZONE = "America/New_York";

const TIMEZONE_OPTIONS = [
  { value: "America/New_York", label: "Eastern Time (EST/EDT)" },
  { value: "America/Chicago", label: "Central Time (CST/CDT)" },
  { value: "America/Denver", label: "Mountain Time (MST/MDT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PST/PDT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKST/AKDT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HST)" },
  { value: "America/Vancouver", label: "Pacific Time - Canada (PST/PDT)" },
  { value: "America/Toronto", label: "Eastern Time - Canada (EST/EDT)" },
  { value: "UTC", label: "UTC" },
] as const;

const panelSheetSx = {
  bgcolor: "background.surface",
  borderRadius: "md",
  borderColor: "divider",
  p: { xs: 2.5, sm: 3 },
  boxShadow: "none",
} as const;

const fieldSx = {
  "--Input-focusedThickness": "0px",
  "--Select-focusedThickness": "0px",
} as const;

const helperTextSx = {
  color: "neutral.500",
} as const;

function FieldSkeleton({ labelWidth = 88 }: { labelWidth?: number }) {
  return (
    <Stack spacing={1}>
      <Skeleton
        variant="rectangular"
        width={labelWidth}
        height={14}
        sx={{ borderRadius: "sm" }}
      />
      <Skeleton
        variant="rectangular"
        width="100%"
        height={40}
        sx={{ borderRadius: "sm" }}
      />
    </Stack>
  );
}

function AccountHeaderSkeleton() {
  return (
    <Stack spacing={1.5}>
      <Skeleton
        variant="rectangular"
        width={240}
        height={34}
        sx={{ borderRadius: "sm" }}
      />
      <Skeleton
        variant="rectangular"
        width={320}
        height={18}
        sx={{ borderRadius: "sm" }}
      />
    </Stack>
  );
}

function AccountTabsSkeleton() {
  return (
    <Box
      sx={{
        display: "flex",
        gap: 1.5,
        pb: 1.5,
        borderBottom: "1px solid",
        borderColor: "divider",
        overflowX: "auto",
      }}
    >
      <Skeleton
        variant="rectangular"
        width={84}
        height={24}
        sx={{ borderRadius: "sm", flexShrink: 0 }}
      />
      <Skeleton
        variant="rectangular"
        width={132}
        height={24}
        sx={{ borderRadius: "sm", flexShrink: 0 }}
      />
      <Skeleton
        variant="rectangular"
        width={112}
        height={24}
        sx={{ borderRadius: "sm", flexShrink: 0 }}
      />
      <Skeleton
        variant="rectangular"
        width={96}
        height={24}
        sx={{ borderRadius: "sm", flexShrink: 0 }}
      />
      <Skeleton
        variant="rectangular"
        width={108}
        height={24}
        sx={{ borderRadius: "sm", flexShrink: 0 }}
      />
    </Box>
  );
}

function GeneralPanelSkeleton() {
  return (
    <Stack spacing={3}>
      <Sheet variant="outlined" sx={panelSheetSx}>
        <Stack spacing={3}>
          <Stack spacing={1.5}>
            <Skeleton
              variant="rectangular"
              width={180}
              height={24}
              sx={{ borderRadius: "sm" }}
            />
            <Skeleton
              variant="rectangular"
              width={280}
              height={16}
              sx={{ borderRadius: "sm" }}
            />
          </Stack>
          <Divider />
          <Grid container spacing={2}>
            <Grid xs={12} sm={6}>
              <FieldSkeleton labelWidth={80} />
            </Grid>
            <Grid xs={12} sm={6}>
              <FieldSkeleton labelWidth={92} />
            </Grid>
          </Grid>
          <FieldSkeleton labelWidth={84} />
          <Stack direction="row" justifyContent="flex-end">
            <Skeleton
              variant="rectangular"
              width={120}
              height={36}
              sx={{ borderRadius: "sm" }}
            />
          </Stack>
        </Stack>
      </Sheet>

      <Sheet variant="outlined" sx={panelSheetSx}>
        <Stack spacing={2.5}>
          <Skeleton
            variant="rectangular"
            width={200}
            height={24}
            sx={{ borderRadius: "sm" }}
          />
          <Divider />
          <Skeleton
            variant="rectangular"
            width={264}
            height={16}
            sx={{ borderRadius: "sm" }}
          />
        </Stack>
      </Sheet>
    </Stack>
  );
}

function BusinessPanelSkeleton() {
  return (
    <Sheet variant="outlined" sx={panelSheetSx}>
      <Stack spacing={3}>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Skeleton variant="circular" width={20} height={20} />
            <Skeleton
              variant="rectangular"
              width={168}
              height={24}
              sx={{ borderRadius: "sm" }}
            />
          </Stack>
          <Skeleton
            variant="rectangular"
            width={300}
            height={16}
            sx={{ borderRadius: "sm" }}
          />
        </Stack>
        <Divider />
        <Stack spacing={1}>
          <FieldSkeleton labelWidth={112} />
          <Skeleton
            variant="rectangular"
            width={280}
            height={14}
            sx={{ borderRadius: "sm" }}
          />
        </Stack>
        <Grid container spacing={2}>
          <Grid xs={12} sm={6}>
            <FieldSkeleton labelWidth={96} />
          </Grid>
          <Grid xs={12} sm={6}>
            <FieldSkeleton labelWidth={92} />
          </Grid>
        </Grid>
        <Divider />
        <Stack direction="row" justifyContent="flex-end">
          <Skeleton
            variant="rectangular"
            width={168}
            height={36}
            sx={{ borderRadius: "sm" }}
          />
        </Stack>
      </Stack>
    </Sheet>
  );
}

function DangerPanelSkeleton() {
  return (
    <Sheet
      variant="outlined"
      sx={{ ...panelSheetSx, borderColor: "danger.200" }}
    >
      <Stack spacing={3}>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Skeleton variant="circular" width={20} height={20} />
            <Skeleton
              variant="rectangular"
              width={144}
              height={24}
              sx={{ borderRadius: "sm" }}
            />
          </Stack>
          <Skeleton
            variant="rectangular"
            width={320}
            height={16}
            sx={{ borderRadius: "sm" }}
          />
        </Stack>
        <Divider />
        <Skeleton
          variant="rectangular"
          width={112}
          height={20}
          sx={{ borderRadius: "sm" }}
        />
        <Skeleton
          variant="rectangular"
          width="100%"
          height={14}
          sx={{ borderRadius: "sm" }}
        />
        <Skeleton
          variant="rectangular"
          width="86%"
          height={14}
          sx={{ borderRadius: "sm" }}
        />
        <Skeleton
          variant="rectangular"
          width={148}
          height={36}
          sx={{ borderRadius: "sm" }}
        />
      </Stack>
    </Sheet>
  );
}

function AccountPageInitialSkeleton() {
  return (
    <ProtectedPageWrapper>
      <Stack spacing={4} sx={{ width: "100%" }}>
        <AccountHeaderSkeleton />
        <AccountTabsSkeleton />
        <GeneralPanelSkeleton />
      </Stack>
    </ProtectedPageWrapper>
  );
}

const getUserDisplayName = (fullName: unknown) =>
  typeof fullName === "string" ? fullName : "";

const AccountPage = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const { tenant } = useTenant();
  const {
    subscription: deletionSubscription,
    loading: isLoadingDeletionSubscription,
  } = useLegacySubscription();

  const [hasMounted, setHasMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<AccountTabValue>("general");
  const [profileStatus, setProfileStatus] = useState<LoadStatus>("loading");
  const [businessStatus, setBusinessStatus] = useState<LoadStatus>("idle");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingBusiness, setIsSavingBusiness] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [profileData, setProfileData] = useState<ProfileData>({
    displayName: "",
    timezone: DEFAULT_TIMEZONE,
  });
  const [businessData, setBusinessData] = useState<BusinessData>({
    companyName: "",
    companyPhone: "",
    companyEmail: "",
  });

  const userDisplayName = useMemo(
    () => getUserDisplayName(user?.user_metadata?.full_name),
    [user?.user_metadata?.full_name],
  );

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    let isActive = true;

    const loadProfileData = async () => {
      setProfileStatus("loading");

      try {
        const { data: profile, error } = await supabase
          .from("company_profiles")
          .select("feature_flags, compliance_settings")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (!isActive) {
          return;
        }

        const featureFlags =
          (profile?.feature_flags as Record<string, unknown> | null) ?? {};
        const complianceSettings =
          (profile?.compliance_settings as Record<string, unknown> | null) ??
          {};

        setProfileData({
          displayName:
            typeof featureFlags.display_name === "string"
              ? featureFlags.display_name
              : userDisplayName,
          timezone:
            typeof complianceSettings.timezone === "string"
              ? complianceSettings.timezone
              : DEFAULT_TIMEZONE,
        });
      } catch (error) {
        console.error("Error loading profile data:", error);

        if (!isActive) {
          return;
        }

        setProfileData({
          displayName: userDisplayName,
          timezone: DEFAULT_TIMEZONE,
        });
        toast.error("Failed to load profile information");
      } finally {
        if (isActive) {
          setProfileStatus("ready");
        }
      }
    };

    void loadProfileData();

    return () => {
      isActive = false;
    };
  }, [user?.id, userDisplayName]);

  useEffect(() => {
    setBusinessStatus("idle");
    setBusinessData({
      companyName: "",
      companyPhone: "",
      companyEmail: "",
    });
  }, [user?.id]);

  const loadBusinessData = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    setBusinessStatus("loading");

    try {
      const { data: profile, error } = await supabase
        .from("company_profiles")
        .select("company_name, company_phone, company_email")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (profile) {
        setBusinessData({
          companyName: profile.company_name ?? "",
          companyPhone: profile.company_phone ?? "",
          companyEmail: profile.company_email ?? "",
        });
      } else {
        setBusinessData((previousValue) => ({
          ...previousValue,
          companyName: previousValue.companyName || tenant?.name || "",
        }));
      }
    } catch (error) {
      console.error("Error loading business data:", error);
      setBusinessData((previousValue) => ({
        ...previousValue,
        companyName: previousValue.companyName || tenant?.name || "",
      }));
    } finally {
      setBusinessStatus("ready");
    }
  }, [tenant?.name, user?.id]);

  useEffect(() => {
    if (activeTab === "business" && businessStatus === "idle") {
      void loadBusinessData();
    }
  }, [activeTab, businessStatus, loadBusinessData]);

  useEffect(() => {
    if (!tenant?.name) {
      return;
    }

    setBusinessData((previousValue) => {
      if (previousValue.companyName.trim()) {
        return previousValue;
      }

      return {
        ...previousValue,
        companyName: tenant.name,
      };
    });
  }, [tenant?.name]);

  const handleProfileFieldChange = useCallback(
    (field: keyof ProfileData, value: string) => {
      setProfileData((previousValue) => ({
        ...previousValue,
        [field]: value,
      }));
    },
    [],
  );

  const handleBusinessFieldChange = useCallback(
    (field: keyof BusinessData, value: string) => {
      setBusinessData((previousValue) => ({
        ...previousValue,
        [field]: value,
      }));
    },
    [],
  );

  const handleSaveProfile = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    setIsSavingProfile(true);

    try {
      const { data: existingProfile, error: existingProfileError } =
        await supabase
          .from("company_profiles")
          .select("feature_flags, compliance_settings")
          .eq("user_id", user.id)
          .maybeSingle();

      if (existingProfileError) {
        throw existingProfileError;
      }

      const currentFeatureFlags =
        (existingProfile?.feature_flags as Record<string, unknown> | null) ??
        {};
      const currentComplianceSettings =
        (existingProfile?.compliance_settings as Record<
          string,
          unknown
        > | null) ?? {};

      const updatedFeatureFlags = {
        ...currentFeatureFlags,
        display_name: profileData.displayName,
      };

      const updatedComplianceSettings = {
        ...currentComplianceSettings,
        timezone: profileData.timezone,
      };

      if (existingProfile) {
        const { error } = await supabase
          .from("company_profiles")
          .update({
            feature_flags: updatedFeatureFlags,
            compliance_settings: updatedComplianceSettings,
          })
          .eq("user_id", user.id);

        if (error) {
          throw error;
        }
      } else {
        const { error } = await supabase.from("company_profiles").insert({
          user_id: user.id,
          feature_flags: updatedFeatureFlags,
          compliance_settings: updatedComplianceSettings,
        });

        if (error) {
          throw error;
        }
      }

      setProfileData((previousValue) => ({
        ...previousValue,
        displayName: profileData.displayName,
        timezone: profileData.timezone,
      }));
      toast.success("Profile updated successfully!");
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error("Failed to save profile changes");
    } finally {
      setIsSavingProfile(false);
    }
  }, [profileData.displayName, profileData.timezone, user?.id]);

  const handleSaveBusinessProfile = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    setIsSavingBusiness(true);

    try {
      const { data: existingProfile, error: existingProfileError } =
        await supabase
          .from("company_profiles")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

      if (existingProfileError) {
        throw existingProfileError;
      }

      const profilePayload = {
        user_id: user.id,
        company_name: businessData.companyName || null,
        company_phone: businessData.companyPhone || null,
        company_email: businessData.companyEmail || null,
      };

      if (existingProfile?.id) {
        const { error } = await supabase
          .from("company_profiles")
          .update(profilePayload)
          .eq("id", existingProfile.id);

        if (error) {
          throw error;
        }
      } else {
        const { error } = await supabase
          .from("company_profiles")
          .insert(profilePayload);

        if (error) {
          throw error;
        }
      }

      if (tenant?.id && businessData.companyName.trim()) {
        const { error: tenantError } = await supabase
          .from("tenants")
          .update({
            name: businessData.companyName,
            fallback_from_name: businessData.companyName,
          })
          .eq("id", tenant.id);

        if (tenantError) {
          console.error("Error updating tenant name:", tenantError);
        }
      }

      setBusinessData((previousValue) => ({
        ...previousValue,
        companyName: businessData.companyName,
        companyPhone: businessData.companyPhone,
        companyEmail: businessData.companyEmail,
      }));
      toast.success(
        "Business profile updated! Your email campaigns will now use this name.",
      );
    } catch (error) {
      console.error("Error saving business profile:", error);
      toast.error("Failed to save business profile");
    } finally {
      setIsSavingBusiness(false);
    }
  }, [
    businessData.companyEmail,
    businessData.companyName,
    businessData.companyPhone,
    tenant?.id,
    user?.id,
  ]);

  const hasActiveSubscription = useMemo(() => {
    if (!deletionSubscription) {
      return false;
    }

    return (
      deletionSubscription.plan !== "free_trial" &&
      new Date(deletionSubscription.end_date) > new Date()
    );
  }, [deletionSubscription]);

  const handleCloseDeleteModal = useCallback(() => {
    if (isDeletingAccount) {
      return;
    }

    setIsDeleteModalOpen(false);
    setConfirmText("");
  }, [isDeletingAccount]);

  const handleDeleteAccount = useCallback(async () => {
    if (confirmText !== "DELETE" || !user?.id) {
      return;
    }

    setIsDeletingAccount(true);

    try {
      const { error } = await supabase.functions.invoke("delete-account", {
        body: { userId: user.id },
      });

      if (error) {
        console.error("Delete account error:", error);
        return;
      }

      await signOut();
    } catch (error) {
      console.error("Unexpected error:", error);
    } finally {
      setIsDeletingAccount(false);
      setIsDeleteModalOpen(false);
      setConfirmText("");
    }
  }, [confirmText, signOut, user?.id]);

  if (!hasMounted || authLoading) {
    return <AccountPageInitialSkeleton />;
  }

  return (
    <ProtectedPageWrapper>
      <Stack spacing={4} sx={{ width: "100%" }}>
        <Stack spacing={1.5} sx={{ mb: 0.5 }}>
          <Typography
            level="h3"
            sx={{ fontWeight: 700, letterSpacing: "-0.02em" }}
          >
            Account
          </Typography>
          <Typography level="body-sm" color="neutral">
            Manage your profile, business details, billing, and account
            settings.
          </Typography>
        </Stack>

        <Tabs
          value={activeTab}
          onChange={(_event, value) => {
            if (typeof value === "string") {
              setActiveTab(value as AccountTabValue);
            }
          }}
          variant="plain"
          color="neutral"
          sx={{ width: "100%" }}
        >
          <TabList
            variant="plain"
            sx={{
              p: 0,
              gap: 0,
              borderBottom: "1px solid",
              borderColor: "divider",
              borderRadius: 0,
              bgcolor: "transparent",
              overflowX: "auto",
            }}
          >
            {[
              { value: "general", label: "General" },
              { value: "business", label: "Business" },
              { value: "billing", label: "Billing" },
              { value: "usage", label: "Usage" },
              { value: "danger", label: "Danger Zone", danger: true },
            ].map((tab) => (
              <Tab
                key={tab.value}
                value={tab.value}
                disableIndicator
                color={tab.danger ? "danger" : "neutral"}
                sx={{
                  flex: "0 0 auto",
                  px: 0,
                  py: 1.5,
                  mr: { xs: 2.5, sm: 3.5 },
                  minHeight: "unset",
                  borderRadius: 0,
                  borderBottom: "2px solid transparent",
                  bgcolor: "transparent",
                  color: tab.danger ? "danger.600" : "neutral.600",
                  fontWeight: 500,
                  boxShadow: "none",
                  "&:hover": {
                    bgcolor: "transparent",
                    color: tab.danger ? "danger.700" : "neutral.800",
                  },
                  "&.Mui-selected": {
                    bgcolor: "transparent",
                    color: tab.danger ? "danger.700" : "neutral.900",
                    borderBottomColor: tab.danger
                      ? "danger.600"
                      : "neutral.800",
                    fontWeight: 600,
                    boxShadow: "none",
                  },
                }}
              >
                {tab.label}
              </Tab>
            ))}
          </TabList>

          <TabPanel value="general" sx={{ px: 0, pt: 3, pb: 0 }}>
            {profileStatus !== "ready" ? (
              <GeneralPanelSkeleton />
            ) : (
              <Stack spacing={3}>
                <Sheet variant="outlined" sx={panelSheetSx}>
                  <Stack spacing={3}>
                    <Stack spacing={1}>
                      <Typography level="title-md">
                        Profile Information
                      </Typography>
                      <Typography level="body-sm" color="neutral">
                        Update your personal information and preferences.
                      </Typography>
                    </Stack>

                    <Divider />

                    <Grid container spacing={2}>
                      <Grid xs={12} sm={6}>
                        <FormControl>
                          <FormLabel>Email</FormLabel>
                          <Input
                            type="email"
                            value={user?.email || ""}
                            disabled
                            variant="soft"
                            sx={fieldSx}
                          />
                          <FormHelperText sx={helperTextSx}>
                            Your sign-in email is managed through
                            authentication.
                          </FormHelperText>
                        </FormControl>
                      </Grid>

                      <Grid xs={12} sm={6}>
                        <FormControl>
                          <FormLabel>Display Name</FormLabel>
                          <Input
                            type="text"
                            placeholder="Enter your display name"
                            value={profileData.displayName}
                            onChange={(event) =>
                              handleProfileFieldChange(
                                "displayName",
                                event.target.value,
                              )
                            }
                            sx={fieldSx}
                          />
                        </FormControl>
                      </Grid>
                    </Grid>

                    <FormControl>
                      <FormLabel>Timezone</FormLabel>
                      <Select
                        value={profileData.timezone}
                        onChange={(_event, newValue) => {
                          if (newValue) {
                            handleProfileFieldChange("timezone", newValue);
                          }
                        }}
                        sx={fieldSx}
                      >
                        {TIMEZONE_OPTIONS.map((timezone) => (
                          <Option key={timezone.value} value={timezone.value}>
                            {timezone.label}
                          </Option>
                        ))}
                      </Select>
                    </FormControl>

                    <Divider />

                    <Stack direction="row" justifyContent="flex-end">
                      <Button
                        variant="solid"
                        color="neutral"
                        size="sm"
                        loading={isSavingProfile}
                        onClick={handleSaveProfile}
                      >
                        Save Changes
                      </Button>
                    </Stack>
                  </Stack>
                </Sheet>

                <Sheet variant="outlined" sx={panelSheetSx}>
                  <Stack spacing={2.5}>
                    <Typography level="title-md">
                      Notification Preferences
                    </Typography>
                    <Divider />
                    <Typography level="body-sm" color="neutral">
                      Notification settings coming soon...
                    </Typography>
                  </Stack>
                </Sheet>
              </Stack>
            )}
          </TabPanel>

          <TabPanel value="business" sx={{ px: 0, pt: 3, pb: 0 }}>
            {businessStatus !== "ready" ? (
              <BusinessPanelSkeleton />
            ) : (
              <Sheet variant="outlined" sx={panelSheetSx}>
                <Stack spacing={3}>
                  <Stack spacing={1.5}>
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <Building2
                        size={20}
                        color="var(--joy-palette-neutral-600)"
                      />
                      <Typography level="title-md">Business Profile</Typography>
                    </Stack>
                    <Typography level="body-sm" color="neutral">
                      Keep your sender details up to date so campaigns feel
                      polished, consistent, and unmistakably yours.
                    </Typography>
                  </Stack>

                  <Divider />

                  <FormControl>
                    <FormLabel>Business Name</FormLabel>
                    <Input
                      type="text"
                      placeholder="Enter your business name"
                      value={businessData.companyName}
                      onChange={(event) =>
                        handleBusinessFieldChange(
                          "companyName",
                          event.target.value,
                        )
                      }
                      sx={fieldSx}
                    />
                    <FormHelperText sx={helperTextSx}>
                      This name will appear as the sender on your email
                      campaigns.
                    </FormHelperText>
                  </FormControl>

                  <Grid container spacing={2}>
                    <Grid xs={12} sm={6}>
                      <FormControl>
                        <FormLabel>Business Phone</FormLabel>
                        <Input
                          type="tel"
                          placeholder="(555) 123-4567"
                          value={businessData.companyPhone}
                          onChange={(event) =>
                            handleBusinessFieldChange(
                              "companyPhone",
                              event.target.value,
                            )
                          }
                          sx={fieldSx}
                        />
                      </FormControl>
                    </Grid>

                    <Grid xs={12} sm={6}>
                      <FormControl>
                        <FormLabel>Business Email</FormLabel>
                        <Input
                          type="email"
                          placeholder="hello@yourbusiness.com"
                          value={businessData.companyEmail}
                          onChange={(event) =>
                            handleBusinessFieldChange(
                              "companyEmail",
                              event.target.value,
                            )
                          }
                          sx={fieldSx}
                        />
                      </FormControl>
                    </Grid>
                  </Grid>

                  <Divider />

                  <Stack direction="row" justifyContent="flex-end">
                    <Button
                      variant="solid"
                      color="neutral"
                      size="sm"
                      loading={isSavingBusiness}
                      disabled={!businessData.companyName.trim()}
                      onClick={handleSaveBusinessProfile}
                    >
                      Save Business Profile
                    </Button>
                  </Stack>
                </Stack>
              </Sheet>
            )}
          </TabPanel>

          <TabPanel value="billing" sx={{ px: 0, pt: 3, pb: 0 }}>
            <BillingDashboard />
          </TabPanel>

          <TabPanel value="usage" sx={{ px: 0, pt: 3, pb: 0 }}>
            <UsageAnalytics />
          </TabPanel>

          <TabPanel value="danger" sx={{ px: 0, pt: 3, pb: 0 }}>
            {isLoadingDeletionSubscription ? (
              <DangerPanelSkeleton />
            ) : (
              <Sheet
                variant="outlined"
                sx={{
                  ...panelSheetSx,
                  borderColor: "danger.200",
                }}
              >
                <Stack spacing={3}>
                  <Stack spacing={1.5}>
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <AlertTriangle
                        size={20}
                        color="var(--joy-palette-danger-500)"
                      />
                      <Typography level="title-md" color="danger">
                        Danger Zone
                      </Typography>
                      <Chip size="sm" variant="soft" color="danger">
                        Permanent
                      </Chip>
                    </Stack>
                    <Typography level="body-sm" color="neutral">
                      Sensitive actions that permanently affect access, history,
                      and connected services.
                    </Typography>
                  </Stack>

                  <Divider />

                  <Stack spacing={2}>
                    <Typography level="title-sm">Delete Account</Typography>
                    <Typography level="body-sm" color="neutral">
                      Permanently delete your BloomSuite account and all
                      associated data. This action cannot be undone after 30
                      days.
                    </Typography>
                    <Box
                      component="ul"
                      sx={{
                        m: 0,
                        pl: 2.5,
                        display: "grid",
                        gap: 0.75,
                        color: "neutral.600",
                        typography: "body-sm",
                      }}
                    >
                      <li>All your content and campaigns will be deleted.</li>
                      <li>Social media connections will be revoked.</li>
                      <li>Analytics data will be permanently lost.</li>
                      <li>Active subscriptions will be cancelled.</li>
                    </Box>
                  </Stack>

                  {hasActiveSubscription ? (
                    <Alert
                      variant="soft"
                      color="warning"
                      startDecorator={<AlertTriangle size={18} />}
                    >
                      You have an active subscription. Please cancel your
                      subscription first before deleting your account.
                    </Alert>
                  ) : null}

                  <Stack direction="row" justifyContent="flex-start">
                    <Button
                      variant="solid"
                      color="danger"
                      size="sm"
                      disabled={hasActiveSubscription || isDeletingAccount}
                      onClick={() => setIsDeleteModalOpen(true)}
                    >
                      Delete Account
                    </Button>
                  </Stack>
                </Stack>
              </Sheet>
            )}
          </TabPanel>
        </Tabs>

        <Modal open={isDeleteModalOpen} onClose={handleCloseDeleteModal}>
          <ModalDialog
            variant="outlined"
            layout="center"
            sx={{
              bgcolor: "background.surface",
              maxWidth: 480,
              width: "calc(100vw - 32px)",
              borderColor: "danger.200",
              borderRadius: "md",
            }}
          >
            {!isDeletingAccount ? <ModalClose /> : null}
            <DialogTitle>
              <Stack direction="row" spacing={1} alignItems="center">
                <AlertTriangle
                  size={18}
                  color="var(--joy-palette-danger-500)"
                />
                <span>Delete Account Confirmation</span>
              </Stack>
            </DialogTitle>

            <DialogContent>
              <Stack spacing={2.5}>
                <Typography level="body-sm" color="neutral">
                  This action is irreversible after 30 days. Deleting your
                  account removes access to your content, campaigns, connected
                  channels, and subscription history.
                </Typography>
                <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                  Type DELETE to confirm.
                </Typography>

                <FormControl>
                  <FormLabel>Confirmation</FormLabel>
                  <Input
                    value={confirmText}
                    placeholder="Type DELETE to confirm"
                    color={confirmText === "DELETE" ? "danger" : "neutral"}
                    onChange={(event) => setConfirmText(event.target.value)}
                    sx={fieldSx}
                  />
                </FormControl>
              </Stack>
            </DialogContent>

            <Divider />

            <DialogActions>
              <Button
                variant="plain"
                color="neutral"
                disabled={isDeletingAccount}
                onClick={handleCloseDeleteModal}
              >
                Cancel
              </Button>
              <Button
                variant="solid"
                color="danger"
                loading={isDeletingAccount}
                disabled={confirmText !== "DELETE"}
                onClick={handleDeleteAccount}
              >
                Permanently Delete Account
              </Button>
            </DialogActions>
          </ModalDialog>
        </Modal>
      </Stack>
    </ProtectedPageWrapper>
  );
};

export default AccountPage;
