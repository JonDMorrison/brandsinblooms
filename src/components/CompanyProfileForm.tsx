import Avatar from "@mui/joy/Avatar";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import ButtonGroup from "@mui/joy/ButtonGroup";
import Chip from "@mui/joy/Chip";
import Divider from "@mui/joy/Divider";
import Modal from "@mui/joy/Modal";
import ModalDialog from "@mui/joy/ModalDialog";
import Sheet from "@mui/joy/Sheet";
import Snackbar from "@mui/joy/Snackbar";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Building2, MapPin, Phone, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { JoyEmptyState } from "@/components/joy/JoyEmptyState";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

import { CompanyProfileFormFields } from "./company-profile/CompanyProfileFormFields";
import { CompanyProfileLoadingState } from "./company-profile/CompanyProfileLoadingState";
import {
  EMPTY_COMPANY_PROFILE_FORM_DATA,
  parseArrayField,
  type CompanyProfileFormData,
} from "./company-profile/CompanyProfileFormFields";

interface CompanyProfileFormProps {
  profile: any;
  isEditing: boolean;
  isLoading?: boolean;
  onToggleEdit: () => void;
  onProfileUpdate: (profile: any) => void;
}

type FeedbackState = {
  color: "danger" | "success";
  message: string;
};

const buildFormDataFromProfile = (profile: any): CompanyProfileFormData => ({
  ...EMPTY_COMPANY_PROFILE_FORM_DATA,
  company_name: profile?.company_name || "",
  company_phone: profile?.company_phone || "",
  company_overview: profile?.company_overview || "",
  mission_statement: profile?.mission_statement || "",
  brand_voice: profile?.brand_voice || "",
  tone_of_writing: profile?.tone_of_writing || "",
  target_audience: profile?.target_audience || "",
  ideal_customer: profile?.ideal_customer || "",
  unique_selling_points: profile?.unique_selling_points || "",
  company_values: profile?.company_values || "",
  seasonal_focus: profile?.seasonal_focus || "",
  specializations: profile?.specializations || "",
  location_info: profile?.location_info || "",
});

const serializeFormData = (value: CompanyProfileFormData) => JSON.stringify(value);

export const CompanyProfileForm = ({
  profile,
  isEditing,
  isLoading = false,
  onToggleEdit,
  onProfileUpdate,
}: CompanyProfileFormProps) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState<CompanyProfileFormData>(() =>
    buildFormDataFromProfile(profile),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isAutoPopulating, setIsAutoPopulating] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false);
  const [showStickyActionBar, setShowStickyActionBar] = useState(false);
  const headerActionGroupRef = useRef<HTMLDivElement | null>(null);
  const initialFormData = useMemo(
    () => buildFormDataFromProfile(profile),
    [profile],
  );
  const isDirty = useMemo(
    () => serializeFormData(formData) !== serializeFormData(initialFormData),
    [formData, initialFormData],
  );

  useEffect(() => {
    if (!isEditing) {
      setFormData(initialFormData);
    }
  }, [initialFormData, isEditing]);

  // Separate effect for auto-populate logic that only runs once when no profile exists
  useEffect(() => {
    const shouldAutoPopulate = async () => {
      if (isLoading || !user || profile !== null) return;

      // Check if we've already attempted auto-populate for this user
      const autoPopulateKey = `garden-center-autopopulated-${user.id}`;
      const hasAlreadyTriedAutoPopulate = localStorage.getItem(autoPopulateKey);

      if (hasAlreadyTriedAutoPopulate) {
        // Auto-populate already attempted for this user
        return;
      }

      await handleAutoPopulate();
      // Mark that we've attempted auto-populate for this user
      localStorage.setItem(autoPopulateKey, "true");
    };

    shouldAutoPopulate();
  }, [isLoading, user, profile]);

  const handleAutoPopulate = async () => {
    if (!user) return;

    setIsAutoPopulating(true);

    try {
      // Get onboarding data from localStorage - only use real user data
      let onboardingData = localStorage.getItem(
        `garden-center-onboarding-${user.id}`,
      );
      let parsedOnboardingData;

      if (!onboardingData) {
        // No onboarding data exists - leave fields blank for new users
        // No onboarding data found - leaving fields blank for new user
        setIsAutoPopulating(false);
        return;
      }

      parsedOnboardingData = JSON.parse(onboardingData);

      // Only proceed if we have meaningful onboarding data (not just sample data)
      if (
        parsedOnboardingData.aboutBusiness &&
        parsedOnboardingData.aboutBusiness.trim()
      ) {
        // Auto-populating company profile from onboarding data

        const { data, error } = await supabase.functions.invoke(
          "generate-company-profile",
          {
            body: {
              aboutBusiness: parsedOnboardingData.aboutBusiness,
              toneSamples: parsedOnboardingData.toneSamples,
              annualEvents: parsedOnboardingData.annualEvents,
            },
          },
        );

        if (error) {
          // Error generating profile
        } else if (data.profileData) {
          setFormData((current) => buildFormDataFromProfile({
            ...current,
            ...data.profileData,
          }));
        }
      } else {
        // No meaningful onboarding data found - skipping auto-populate
      }
    } catch (error) {
      // Error in handleAutoPopulate
    } finally {
      setIsAutoPopulating(false);
    }
  };

  const handleInputChange = (field: keyof CompanyProfileFormData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  useEffect(() => {
    if (!isEditing) {
      setShowStickyActionBar(false);
      return;
    }

    const actionGroupNode = headerActionGroupRef.current;

    if (!actionGroupNode || typeof IntersectionObserver === "undefined") {
      setShowStickyActionBar(false);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowStickyActionBar(!entry.isIntersecting);
      },
      {
        threshold: 0.95,
      },
    );

    observer.observe(actionGroupNode);

    return () => {
      observer.disconnect();
    };
  }, [isEditing]);

  const handleStartEdit = () => {
    setFormData(initialFormData);
    onToggleEdit();
  };

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      // Only send columns that exist in company_profiles (exclude mission_statement)
      const payload = {
        user_id: user.id,
        company_name: formData.company_name || null,
        company_phone: formData.company_phone || null,
        company_overview: formData.company_overview || null,
        brand_voice: formData.brand_voice || null,
        tone_of_writing: formData.tone_of_writing || null,
        target_audience: formData.target_audience || null,
        ideal_customer: formData.ideal_customer || null,
        unique_selling_points: formData.unique_selling_points || null,
        company_values: formData.company_values || null,
        seasonal_focus: formData.seasonal_focus || null,
        specializations: formData.specializations || null,
        location_info: formData.location_info || null,
      };

      let result;
      if (profile?.id) {
        // Update existing profile
        result = await supabase
          .from("company_profiles")
          .update(payload)
          .eq("id", profile.id)
          .select()
          .maybeSingle();
      } else {
        // Create new profile
        result = await supabase
          .from("company_profiles")
          .insert(payload)
          .select()
          .maybeSingle();
      }

      if (result.error) {
        console.error("Error saving profile:", result.error);
        setFeedback({
          color: "danger",
          message: "Failed to save. Please try again.",
        });
        return;
      }

      // If company name was updated, sync a friendly blurb in onboarding localStorage
      if (formData.company_name) {
        const onboardingKey = `garden-center-onboarding-${user.id}`;
        const existingData = localStorage.getItem(onboardingKey);
        if (existingData) {
          try {
            const parsedData = JSON.parse(existingData);
            parsedData.aboutBusiness = `${formData.company_name} has been serving the community with quality gardening products and expert advice.`;
            localStorage.setItem(onboardingKey, JSON.stringify(parsedData));
          } catch (error) {}
        }
      }

      const nextProfile = result.data;

      setFeedback({
        color: "success",
        message: "Company profile updated.",
      });

      setFormData(buildFormDataFromProfile(nextProfile));
      onProfileUpdate(nextProfile);
    } catch (error) {
      console.error("Unexpected error in handleSave:", error);
      setFeedback({
        color: "danger",
        message: "Failed to save. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscardChanges = () => {
    setFormData(initialFormData);
    setIsDiscardDialogOpen(false);
    onToggleEdit();
  };

  const handleCancel = () => {
    if (isSaving) {
      return;
    }

    if (isDirty) {
      setIsDiscardDialogOpen(true);
      return;
    }

    setFormData(initialFormData);
    onToggleEdit();
  };

  const displayFields = useMemo(
    () => ({
      companyName: formData.company_name.trim(),
      phone: formData.company_phone.trim(),
      overview: formData.company_overview.trim(),
      mission: formData.mission_statement.trim(),
      brandVoice: formData.brand_voice.trim(),
      tone: formData.tone_of_writing.trim(),
      audience: formData.target_audience.trim(),
      idealCustomer: formData.ideal_customer.trim(),
      seasonalFocus: formData.seasonal_focus.trim(),
      specializations: formData.specializations.trim(),
      locationInfo: formData.location_info.trim(),
      uniqueSellingPoints: parseArrayField(formData.unique_selling_points),
      companyValues: parseArrayField(formData.company_values),
    }),
    [formData],
  );

  const readOnlyGroups = [
    {
      title: 'Brand & Audience',
      items: [
        { label: 'Brand Voice', value: displayFields.brandVoice },
        { label: 'Tone of Writing', value: displayFields.tone },
        { label: 'Target Audience', value: displayFields.audience },
        { label: 'Ideal Customer Profile', value: displayFields.idealCustomer },
      ].filter((item) => item.value),
    },
    {
      title: 'Operational Context',
      items: [
        { label: 'Seasonal Focus', value: displayFields.seasonalFocus },
        { label: 'Specializations', value: displayFields.specializations },
        { label: 'Mission Statement', value: displayFields.mission },
      ].filter((item) => item.value),
    },
  ].filter((group) => group.items.length > 0);

  const hasVisibleContent = Boolean(
    displayFields.companyName ||
      displayFields.phone ||
      displayFields.overview ||
      displayFields.mission ||
      displayFields.brandVoice ||
      displayFields.tone ||
      displayFields.audience ||
      displayFields.idealCustomer ||
      displayFields.seasonalFocus ||
      displayFields.specializations ||
      displayFields.locationInfo ||
      displayFields.uniqueSellingPoints.length ||
      displayFields.companyValues.length,
  );

  if (isLoading) {
    return <CompanyProfileLoadingState />;
  }

  if (!profile && !isEditing) {
    return (
      <Sheet
        variant="outlined"
        sx={{
          p: { xs: 4, md: 6 },
          borderRadius: 'xl',
          bgcolor: 'background.surface',
          minHeight: 360,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <JoyEmptyState
          icon={<Building2 />}
          title="Set up your company profile"
          description="Add your business story, audience cues, and local context so the platform can tailor voice, recommendations, and seasonal guidance."
          primaryAction={{
            label: 'Set Up Profile',
            onClick: handleStartEdit,
            variant: 'solid',
          }}
        />
      </Sheet>
    );
  }

  if (isAutoPopulating && isEditing) {
    return (
      <CompanyProfileLoadingState label="Drafting a starter profile from your onboarding details." />
    );
  }

  return (
    <Sheet
      variant="outlined"
      sx={{
        p: { xs: 3, md: 4 },
        borderRadius: 'xl',
        bgcolor: 'background.surface',
        overflow: 'visible',
      }}
    >
      <Stack spacing={3}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          spacing={2}
        >
          <Stack spacing={0.5}>
            <Typography level="title-lg">Company Information</Typography>
            <Typography level="body-sm" sx={{ color: 'neutral.500' }}>
              Shape how your business is represented across content, campaigns, and recommendations.
            </Typography>
          </Stack>

          {isEditing ? (
            <Box ref={headerActionGroupRef} sx={{ flexShrink: 0 }}>
              <EditActionButtons
                isSaving={isSaving}
                onCancel={handleCancel}
                onSave={handleSave}
              />
            </Box>
          ) : (
            <Button color="neutral" onClick={handleStartEdit} variant="plain">
              Edit
            </Button>
          )}
        </Stack>

        {isEditing ? (
          <>
            <CompanyProfileFormFields
              formData={formData}
              onInputChange={handleInputChange}
            />

            {showStickyActionBar ? (
              <Box
                sx={{
                  position: 'sticky',
                  bottom: 0,
                  mx: { xs: -3, md: -4 },
                  px: { xs: 3, md: 4 },
                  py: 2,
                  bgcolor: 'background.surface',
                  borderTop: '1px solid',
                  borderColor: 'neutral.200',
                  boxShadow: '0 -10px 30px rgba(15 23 42 / 0.08)',
                  zIndex: (theme) => (theme.vars.zIndex.modal ?? theme.zIndex.modal) - 1,
                }}
              >
                <Stack direction="row" justifyContent="flex-end">
                  <EditActionButtons
                    isSaving={isSaving}
                    onCancel={handleCancel}
                    onSave={handleSave}
                  />
                </Stack>
              </Box>
            ) : null}
          </>
        ) : !hasVisibleContent ? (
          <Sheet variant="soft" sx={{ borderRadius: 'xl', p: { xs: 3, md: 4 } }}>
            <JoyEmptyState
              icon={<Sparkles />}
              title="No company details yet"
              description="Add your brand voice, audience context, and seasonal notes so future content is tailored to your business."
              primaryAction={{
                label: 'Edit company info',
                onClick: handleStartEdit,
                variant: 'solid',
              }}
            />
          </Sheet>
        ) : (
          <Stack spacing={3}>
            <Sheet variant="soft" sx={{ p: { xs: 2.5, md: 3 }, borderRadius: 'xl' }}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2.5} alignItems={{ md: 'center' }}>
                <Avatar
                  color="neutral"
                  variant="soft"
                  sx={{
                    width: 72,
                    height: 72,
                    borderRadius: 'xl',
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {getCompanyInitials(displayFields.companyName)}
                </Avatar>

                <Stack spacing={1.25} sx={{ minWidth: 0, flex: 1 }}>
                  <Typography level="h2">
                    {displayFields.companyName || 'Company Profile'}
                  </Typography>

                  {displayFields.overview ? (
                    <Typography
                      level="body-lg"
                      sx={{ color: 'neutral.700', maxWidth: '72ch', whiteSpace: 'pre-line' }}
                    >
                      {displayFields.overview}
                    </Typography>
                  ) : null}

                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    useFlexGap
                    flexWrap="wrap"
                  >
                    {displayFields.phone ? (
                      <Chip color="neutral" startDecorator={<Phone className="h-4 w-4" />} variant="soft">
                        {displayFields.phone}
                      </Chip>
                    ) : null}
                    {displayFields.locationInfo ? (
                      <Chip
                        color="neutral"
                        startDecorator={<MapPin className="h-4 w-4" />}
                        sx={{
                          maxWidth: '100%',
                          '& .MuiChip-label': {
                            display: 'block',
                            whiteSpace: 'normal',
                          },
                        }}
                        variant="soft"
                      >
                        {displayFields.locationInfo}
                      </Chip>
                    ) : null}
                  </Stack>
                </Stack>
              </Stack>
            </Sheet>

            {readOnlyGroups.map((group) => (
              <Stack key={group.title} spacing={1.5}>
                <Typography level="title-sm">{group.title}</Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                    gap: 1.5,
                  }}
                >
                  {group.items.map((item) => (
                    <ReadOnlyFieldCard key={item.label} label={item.label} value={item.value} />
                  ))}
                </Box>
              </Stack>
            ))}

            {displayFields.uniqueSellingPoints.length ? (
              <ReadOnlyChipSection
                items={displayFields.uniqueSellingPoints}
                title="Unique Selling Points"
              />
            ) : null}

            {displayFields.companyValues.length ? (
              <ReadOnlyChipSection
                items={displayFields.companyValues}
                title="Company Values"
              />
            ) : null}
          </Stack>
        )}
      </Stack>

      <Modal open={isDiscardDialogOpen} onClose={() => setIsDiscardDialogOpen(false)}>
        <ModalDialog
          sx={{
            borderRadius: 'xl',
            p: 3,
            maxWidth: 420,
            width: 'calc(100vw - 2rem)',
            bgcolor: 'background.surface',
          }}
        >
          <Stack spacing={1.5}>
            <Typography level="title-md">Discard changes?</Typography>
            <Typography level="body-sm" textColor="text.tertiary">
              You have unsaved changes that will be lost.
            </Typography>
            <Stack direction="row" justifyContent="flex-end" spacing={1}>
              <Button color="neutral" onClick={() => setIsDiscardDialogOpen(false)} variant="plain">
                Keep Editing
              </Button>
              <Button color="danger" onClick={handleDiscardChanges} variant="solid">
                Discard
              </Button>
            </Stack>
          </Stack>
        </ModalDialog>
      </Modal>

      <Snackbar
        anchorOrigin={{ horizontal: 'center', vertical: 'bottom' }}
        autoHideDuration={3000}
        color={feedback?.color ?? 'neutral'}
        onClose={() => setFeedback(null)}
        open={Boolean(feedback)}
        variant="soft"
      >
        {feedback?.message}
      </Snackbar>
    </Sheet>
  );
};

function EditActionButtons({
  isSaving,
  onCancel,
  onSave,
}: {
  isSaving: boolean;
  onCancel: () => void;
  onSave: () => Promise<void>;
}) {
  return (
    <ButtonGroup
      sx={{
        '--ButtonGroup-radius': '40px',
        gap: 1,
      }}
    >
      <Button color="neutral" disabled={isSaving} onClick={onCancel} variant="plain">
        Cancel
      </Button>
      <Button
        color="primary"
        loading={isSaving}
        loadingPosition="start"
        onClick={() => {
          void onSave();
        }}
        variant="solid"
      >
        {isSaving ? 'Saving...' : 'Save'}
      </Button>
    </ButtonGroup>
  );
}

function getCompanyInitials(companyName: string) {
  if (!companyName) {
    return <Building2 className="h-8 w-8" />;
  }

  const initials = companyName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return initials || <Building2 className="h-8 w-8" />;
}

function ReadOnlyFieldCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <Sheet variant="soft" sx={{ p: 2.25, borderRadius: 'lg' }}>
      <Stack spacing={0.75}>
        <Typography
          level="body-xs"
          sx={{
            color: 'neutral.500',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </Typography>
        <Typography level="body-sm" sx={{ color: 'neutral.800', whiteSpace: 'pre-line' }}>
          {value}
        </Typography>
      </Stack>
    </Sheet>
  );
}

function ReadOnlyChipSection({
  items,
  title,
}: {
  items: string[];
  title: string;
}) {
  return (
    <Stack spacing={1.5}>
      <Typography level="title-sm">{title}</Typography>
      <Sheet variant="soft" sx={{ p: 2.25, borderRadius: 'lg' }}>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          {items.map((item) => (
            <Chip
              key={`${title}-${item}`}
              color="neutral"
              sx={{
                '& .MuiChip-label': {
                  whiteSpace: 'normal',
                },
                height: 'auto',
                py: 0.5,
              }}
              variant="soft"
            >
              {item}
            </Chip>
          ))}
        </Stack>
      </Sheet>
      <Divider />
    </Stack>
  );
}
