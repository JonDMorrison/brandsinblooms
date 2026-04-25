import React, { useCallback, useEffect, useMemo, useState } from "react";
import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
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
import Tab, { tabClasses } from "@mui/joy/Tab";
import TabList from "@mui/joy/TabList";
import TabPanel from "@mui/joy/TabPanel";
import Tabs from "@mui/joy/Tabs";
import Typography from "@mui/joy/Typography";
import { AlertTriangle, Building2, Trash2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { ProtectedPageWrapper } from "@/components/ProtectedPageWrapper";
import { BillingDashboard } from "@/components/billing/BillingDashboard";
import { UsageAnalytics } from "@/components/billing/UsageAnalytics";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
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

const ACCOUNT_TABS: Array<{ value: AccountTabValue; label: string; danger?: boolean }> = [
  { value: "general", label: "General" },
  { value: "business", label: "Business" },
  { value: "billing", label: "Billing" },
  { value: "usage", label: "Usage" },
  { value: "danger", label: "Danger Zone", danger: true },
];

const validAccountTabs = new Set<AccountTabValue>(
  ACCOUNT_TABS.map((tab) => tab.value),
);

const normalizeAccountTab = (value: string | null): AccountTabValue => {
  if (!value || !validAccountTabs.has(value as AccountTabValue)) {
    return "general";
  }

  return value as AccountTabValue;
};

const TIMEZONE_OPTIONS = [
  { value: "America/New_York", label: "Eastern Time (EST/EDT)" },
  { value: "America/Chicago", label: "Central Time (CST/CDT)" },
  { value: "America/Denver", label: "Mountain Time (MST/MDT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PST/PDT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKST/AKDT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HST)" },
  { value: "America/Vancouver", label: "Pacific Time - Vancouver" },
  { value: "America/Toronto", label: "Eastern Time - Toronto" },
  { value: "UTC", label: "UTC" },
] as const;

const cardSx = {
  bgcolor: "background.surface",
  borderRadius: "md",
  p: 3,
} as const;

const dangerCardSx = {
  ...cardSx,
  borderColor: "danger.outlinedBorder",
} as const;

const fieldSx = {
  "--Input-focusedThickness": "0px",
  "--Select-focusedThickness": "0px",
} as const;

const tertiaryTextSx = {
  color: "text.tertiary",
} as const;

function AccountHeaderSkeleton() {
  return (
    <Stack spacing={0.75}>
      <Skeleton variant="text" width={140} />
      <Skeleton variant="text" width={360} />
    </Stack>
  );
}

function AccountTabsSkeleton() {
  return (
    <Box
      sx={{
        display: "inline-flex",
        p: 0.5,
        gap: 0.5,
        borderRadius: "xl",
        bgcolor: "background.level1",
      }}
    >
      {[92, 98, 82, 76, 120].map((width) => (
        <Skeleton
          key={width}
          variant="rectangular"
          width={width}
          height={36}
          sx={{ borderRadius: "lg" }}
        />
      ))}
    </Box>
  );
}

function GeneralPanelSkeleton() {
  return (
    <Stack spacing={3}>
      <Sheet variant="outlined" sx={cardSx}>
        <Skeleton variant="text" width={180} sx={{ mb: 0.5 }} />
        <Skeleton variant="text" width={280} sx={{ mb: 2 }} />
        <Divider sx={{ mb: 3 }} />
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid xs={12} sm={6}>
            <Skeleton variant="text" width={60} sx={{ mb: 1 }} />
            <Skeleton variant="rectangular" height={40} />
          </Grid>
          <Grid xs={12} sm={6}>
            <Skeleton variant="text" width={100} sx={{ mb: 1 }} />
            <Skeleton variant="rectangular" height={40} />
          </Grid>
        </Grid>
        <Skeleton variant="text" width={70} sx={{ mb: 1 }} />
        <Skeleton variant="rectangular" height={40} sx={{ mb: 3 }} />
        <Divider sx={{ mb: 2 }} />
        <Stack direction="row" justifyContent="flex-end">
          <Skeleton
            variant="rectangular"
            width={120}
            height={36}
            sx={{ borderRadius: "sm" }}
          />
        </Stack>
      </Sheet>

      <Sheet variant="outlined" sx={cardSx}>
        <Skeleton variant="text" width={190} sx={{ mb: 1.5 }} />
        <Divider sx={{ my: 1.5 }} />
        <Skeleton variant="text" width={220} />
      </Sheet>
    </Stack>
  );
}

function BusinessPanelSkeleton() {
  return (
    <Sheet variant="outlined" sx={cardSx}>
      <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 0.5 }}>
        <Skeleton variant="circular" width={20} height={20} />
        <Skeleton variant="text" width={140} />
      </Stack>
      <Skeleton variant="text" width={320} sx={{ mb: 1.5 }} />
      <Divider sx={{ mb: 3 }} />
      <Skeleton variant="text" width={100} sx={{ mb: 1 }} />
      <Skeleton variant="rectangular" height={40} sx={{ mb: 0.5 }} />
      <Skeleton variant="text" width={300} sx={{ mb: 3 }} />
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid xs={12} sm={6}>
          <Skeleton variant="text" width={110} sx={{ mb: 1 }} />
          <Skeleton variant="rectangular" height={40} />
        </Grid>
        <Grid xs={12} sm={6}>
          <Skeleton variant="text" width={110} sx={{ mb: 1 }} />
          <Skeleton variant="rectangular" height={40} />
        </Grid>
      </Grid>
      <Divider sx={{ mb: 2 }} />
      <Stack direction="row" justifyContent="flex-end">
        <Skeleton
          variant="rectangular"
          width={150}
          height={36}
          sx={{ borderRadius: "sm" }}
        />
      </Stack>
    </Sheet>
  );
}

function DangerPanelSkeleton() {
  return (
    <Sheet variant="outlined" sx={dangerCardSx}>
      <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 0.5 }}>
        <Skeleton variant="circular" width={20} height={20} />
        <Skeleton variant="text" width={120} />
      </Stack>
      <Skeleton variant="text" width={250} sx={{ mb: 1.5 }} />
      <Divider sx={{ mb: 3 }} />
      <Skeleton variant="text" width={110} sx={{ mb: 1 }} />
      <Skeleton variant="text" width="100%" sx={{ mb: 0.5 }} />
      <Skeleton variant="text" width="88%" sx={{ mb: 0.5 }} />
      <Skeleton variant="text" width="92%" sx={{ mb: 0.5 }} />
      <Skeleton variant="text" width="76%" sx={{ mb: 2 }} />
      <Skeleton
        variant="rectangular"
        width={132}
        height={36}
        sx={{ borderRadius: "sm" }}
      />
    </Sheet>
  );
}

function AccountPageInitialSkeleton() {
  return (
    <ProtectedPageWrapper>
      <Box sx={{ maxWidth: 900, mx: "auto", py: 4, px: { xs: 2, sm: 3 } }}>
        <Stack spacing={3}>
          <AccountHeaderSkeleton />
          <AccountTabsSkeleton />
          <GeneralPanelSkeleton />
        </Stack>
      </Box>
    </ProtectedPageWrapper>
  );
}

const getUserDisplayName = (fullName: unknown) =>
  typeof fullName === "string" ? fullName : "";

const AccountPage = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const { tenant } = useTenant();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    subscription: deletionSubscription,
    loading: isLoadingDeletionSubscription,
  } = useSubscription();

  const [hasMounted, setHasMounted] = useState(false);
  const [profileStatus, setProfileStatus] = useState<LoadStatus>("loading");
  const [businessStatus, setBusinessStatus] = useState<LoadStatus>("idle");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingBusiness, setIsSavingBusiness] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [activeTab, setActiveTab] = useState<AccountTabValue>(() =>
    normalizeAccountTab(searchParams.get("tab")),
  );
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
    const tabParam = searchParams.get("tab");

    if (tabParam && !validAccountTabs.has(tabParam as AccountTabValue)) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set("tab", "general");
      setSearchParams(nextParams, { replace: true });
      setActiveTab("general");
      return;
    }

    const nextTab = normalizeAccountTab(tabParam);
    setActiveTab((currentTab) => (currentTab === nextTab ? currentTab : nextTab));

    if (nextTab === "business" && businessStatus === "idle") {
      void loadBusinessData();
    }
  }, [businessStatus, loadBusinessData, searchParams, setSearchParams]);

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
        (existingProfile?.compliance_settings as Record<string, unknown> | null) ??
        {};

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

  const closeModalAndReset = useCallback(() => {
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

  const handleTabChange = useCallback(
    (_event: React.SyntheticEvent | null, value: string | number | null) => {
      if (!value || !validAccountTabs.has(value as AccountTabValue)) {
        return;
      }

      const nextTab = value as AccountTabValue;
      setActiveTab(nextTab);

      const nextParams = new URLSearchParams(searchParams);
      nextParams.set("tab", nextTab);
      setSearchParams(nextParams, { replace: true });

      if (nextTab === "business" && businessStatus === "idle") {
        void loadBusinessData();
      }
    },
    [businessStatus, loadBusinessData, searchParams, setSearchParams],
  );

  if (!hasMounted || authLoading) {
    return <AccountPageInitialSkeleton />;
  }

  return (
    <ProtectedPageWrapper>
      <Box sx={{ maxWidth: 900, mx: "auto", py: 4, px: { xs: 2, sm: 3 } }}>
        <Typography level="h3" fontWeight={700} sx={{ mb: 0.5 }}>
          Account
        </Typography>
        <Typography level="body-sm" sx={{ color: "text.tertiary", mb: 3 }}>
          Manage your profile, business details, billing, and account settings.
        </Typography>

        <Tabs
          aria-label="Account settings"
          value={activeTab}
          onChange={handleTabChange}
          sx={{ bgcolor: "transparent" }}
        >
          <TabList
            disableUnderline
            sx={{
              p: 0.5,
              gap: 0.5,
              borderRadius: "xl",
              bgcolor: "background.level1",
              [`& .${tabClasses.root}[aria-selected="true"]`]: {
                boxShadow: "sm",
                bgcolor: "background.surface",
              },
            }}
          >
            {ACCOUNT_TABS.map((tab) => (
              <Tab
                key={tab.value}
                disableIndicator
                value={tab.value}
                sx={tab.danger ? { color: "danger.500" } : undefined}
              >
                {tab.label}
              </Tab>
            ))}
          </TabList>

          <TabPanel value="general" sx={{ p: 0, pt: 3 }}>
            {profileStatus !== "ready" ? (
              <GeneralPanelSkeleton />
            ) : (
              <Stack spacing={3}>
                <Sheet variant="outlined" sx={cardSx}>
                  <Typography level="title-md" fontWeight={600}>
                    Profile Information
                  </Typography>
                  <Typography level="body-sm" sx={{ color: "text.tertiary", mb: 1.5 }}>
                    Update your personal information and preferences.
                  </Typography>
                  <Divider sx={{ mb: 3 }} />

                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid xs={12} sm={6}>
                      <FormControl>
                        <FormLabel>Email</FormLabel>
                        <Input
                          value={user?.email || ""}
                          disabled
                          variant="soft"
                          sx={fieldSx}
                        />
                        <FormHelperText sx={tertiaryTextSx}>
                          Your sign-in email is managed through authentication.
                        </FormHelperText>
                      </FormControl>
                    </Grid>
                    <Grid xs={12} sm={6}>
                      <FormControl>
                        <FormLabel>Display Name</FormLabel>
                        <Input
                          value={profileData.displayName}
                          onChange={(event) =>
                            handleProfileFieldChange("displayName", event.target.value)
                          }
                          placeholder="Enter your display name"
                          sx={fieldSx}
                        />
                      </FormControl>
                    </Grid>
                  </Grid>

                  <FormControl sx={{ mb: 3 }}>
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

                  <Divider sx={{ mb: 2 }} />

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
                </Sheet>

                <Sheet variant="outlined" sx={cardSx}>
                  <Typography level="title-md" fontWeight={600}>
                    Notification Preferences
                  </Typography>
                  <Divider sx={{ my: 1.5 }} />
                  <Typography level="body-sm" sx={{ color: "text.tertiary" }}>
                    Notification settings coming soon.
                  </Typography>
                </Sheet>
              </Stack>
            )}
          </TabPanel>

          <TabPanel value="business" sx={{ p: 0, pt: 3 }}>
            {businessStatus !== "ready" ? (
              <BusinessPanelSkeleton />
            ) : (
              <Stack spacing={3}>
                <Sheet variant="outlined" sx={cardSx}>
                  <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 0.5 }}>
                    <Building2 size={20} style={{ color: "var(--joy-palette-text-secondary)" }} />
                    <Typography level="title-md" fontWeight={600}>
                      Business Profile
                    </Typography>
                  </Stack>

                  <Typography level="body-sm" sx={{ color: "text.tertiary", mb: 1.5 }}>
                    This information is used across your store and email campaigns.
                  </Typography>
                  <Divider sx={{ mb: 3 }} />

                  <FormControl sx={{ mb: 3 }}>
                    <FormLabel>Business Name</FormLabel>
                    <Input
                      value={businessData.companyName}
                      onChange={(event) =>
                        handleBusinessFieldChange("companyName", event.target.value)
                      }
                      placeholder="Enter your business name"
                      sx={fieldSx}
                    />
                    <FormHelperText sx={tertiaryTextSx}>
                      This name will appear as the sender on your email campaigns.
                    </FormHelperText>
                  </FormControl>

                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid xs={12} sm={6}>
                      <FormControl>
                        <FormLabel>Business Phone</FormLabel>
                        <Input
                          type="tel"
                          value={businessData.companyPhone}
                          onChange={(event) =>
                            handleBusinessFieldChange("companyPhone", event.target.value)
                          }
                          placeholder="(555) 123-4567"
                          sx={fieldSx}
                        />
                      </FormControl>
                    </Grid>
                    <Grid xs={12} sm={6}>
                      <FormControl>
                        <FormLabel>Business Email</FormLabel>
                        <Input
                          type="email"
                          value={businessData.companyEmail}
                          onChange={(event) =>
                            handleBusinessFieldChange("companyEmail", event.target.value)
                          }
                          placeholder="hello@yourbusiness.com"
                          sx={fieldSx}
                        />
                      </FormControl>
                    </Grid>
                  </Grid>

                  <Divider sx={{ mb: 2 }} />

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
                </Sheet>
              </Stack>
            )}
          </TabPanel>

          <TabPanel value="billing" sx={{ p: 0, pt: 3 }}>
            <BillingDashboard />
          </TabPanel>

          <TabPanel value="usage" sx={{ p: 0, pt: 3 }}>
            <UsageAnalytics />
          </TabPanel>

          <TabPanel value="danger" sx={{ p: 0, pt: 3 }}>
            {isLoadingDeletionSubscription ? (
              <DangerPanelSkeleton />
            ) : (
              <Stack spacing={3}>
                <Sheet variant="outlined" sx={dangerCardSx}>
                  <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 0.5 }}>
                    <AlertTriangle size={20} style={{ color: "var(--joy-palette-danger-500)" }} />
                    <Typography level="title-md" fontWeight={600} color="danger">
                      Danger Zone
                    </Typography>
                  </Stack>

                  <Typography level="body-sm" sx={{ color: "text.tertiary", mb: 1.5 }}>
                    Irreversible and destructive actions.
                  </Typography>
                  <Divider sx={{ mb: 3 }} />

                  <Typography level="title-sm" fontWeight={600} sx={{ mb: 1 }}>
                    Delete Account
                  </Typography>
                  <Box
                    component="ul"
                    sx={{
                      m: 0,
                      pl: 2.5,
                      mb: 2,
                      color: "text.secondary",
                      display: "grid",
                      gap: 0.75,
                    }}
                  >
                    <Typography component="li" level="body-sm" sx={{ color: "text.secondary" }}>
                      All your content and campaigns will be deleted
                    </Typography>
                    <Typography component="li" level="body-sm" sx={{ color: "text.secondary" }}>
                      Social media connections will be revoked
                    </Typography>
                    <Typography component="li" level="body-sm" sx={{ color: "text.secondary" }}>
                      Analytics data will be permanently lost
                    </Typography>
                    <Typography component="li" level="body-sm" sx={{ color: "text.secondary" }}>
                      Active subscriptions will be cancelled
                    </Typography>
                    <Typography component="li" level="body-sm" sx={{ color: "text.secondary" }}>
                      This action cannot be undone
                    </Typography>
                  </Box>

                  {hasActiveSubscription ? (
                    <Alert
                      variant="soft"
                      color="warning"
                      size="sm"
                      startDecorator={<AlertTriangle size={18} />}
                      sx={{ mb: 2 }}
                    >
                      You have an active subscription. Please cancel your subscription before deleting your account.
                    </Alert>
                  ) : null}

                  <Button
                    variant="solid"
                    color="danger"
                    size="sm"
                    startDecorator={<Trash2 size={16} />}
                    disabled={hasActiveSubscription || isDeletingAccount}
                    onClick={() => setIsDeleteModalOpen(true)}
                  >
                    Delete Account
                  </Button>
                </Sheet>
              </Stack>
            )}
          </TabPanel>
        </Tabs>

        <Modal open={isDeleteModalOpen} onClose={closeModalAndReset}>
          <ModalDialog
            variant="outlined"
            layout="center"
            sx={{
              bgcolor: "background.surface",
              maxWidth: 480,
              p: 3,
              borderRadius: "md",
            }}
          >
            <ModalClose />

            <DialogTitle>
              <Stack direction="row" alignItems="center" gap={1}>
                <AlertTriangle
                  size={20}
                  style={{ color: "var(--joy-palette-danger-500)" }}
                />
                Delete Account Confirmation
              </Stack>
            </DialogTitle>

            <DialogContent sx={{ pt: 1 }}>
              <Typography level="body-sm" sx={{ color: "text.secondary", mb: 2 }}>
                This action is permanent and cannot be undone. All your data,
                content, connections, and settings will be permanently deleted.
              </Typography>

              <Typography level="body-sm" fontWeight={600} sx={{ mb: 1 }}>
                Type DELETE to confirm:
              </Typography>

              <FormControl>
                <Input
                  placeholder="Type DELETE to confirm"
                  value={confirmText}
                  onChange={(event) => setConfirmText(event.target.value)}
                  color={confirmText === "DELETE" ? "danger" : "neutral"}
                  autoFocus
                />
              </FormControl>
            </DialogContent>

            <Divider sx={{ my: 2 }} />

            <DialogActions sx={{ pt: 0 }}>
              <Button
                variant="solid"
                color="danger"
                size="sm"
                loading={isDeletingAccount}
                disabled={confirmText !== "DELETE" || isDeletingAccount}
                onClick={handleDeleteAccount}
              >
                Permanently Delete Account
              </Button>
              <Button
                variant="plain"
                color="neutral"
                size="sm"
                onClick={closeModalAndReset}
              >
                Cancel
              </Button>
            </DialogActions>
          </ModalDialog>
        </Modal>
      </Box>
    </ProtectedPageWrapper>
  );
};

export default AccountPage;
