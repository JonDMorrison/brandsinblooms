import * as React from "react";
import Box from "@mui/joy/Box";
import Divider from "@mui/joy/Divider";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import {
  createEmptyPersonaMetadata,
  getPersonaAccentStyles,
  normalizePersonaMetadata,
  PERSONA_ACCENT_OPTIONS,
  PERSONA_AGE_RANGE_OPTIONS,
  PERSONA_CHANNEL_OPTIONS,
  PERSONA_DISCOUNT_SENSITIVITY_OPTIONS,
  PERSONA_FAMILY_STATUS_OPTIONS,
  PERSONA_FREQUENCY_OPTIONS,
  PERSONA_ICON_OPTIONS,
  PERSONA_INCOME_RANGE_OPTIONS,
  PERSONA_LOCATION_OPTIONS,
  PERSONA_ORDER_VALUE_OPTIONS,
  PERSONA_TONE_OPTIONS,
  type PersonaAccent,
  type PersonaMetadata,
} from "@/config/systemPersonas";
import { JoyAutocomplete } from "@/components/joy/JoyAutocomplete";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  JoyDialog,
  JoyDialogActions,
  JoyDialogContent,
} from "@/components/joy/JoyDialog";
import { JoyDrawer } from "@/components/joy/JoyDrawer";
import { JoyFormSection } from "@/components/joy/JoyFormSection";
import { JoyInput } from "@/components/joy/JoyInput";
import { JoySelect } from "@/components/joy/JoySelect";
import { JoyTextarea } from "@/components/joy/JoyTextarea";
import { useIsMobile } from "@/hooks/use-mobile";

const personaSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name is required.")
    .max(80, "Use 80 characters or fewer."),
  description: z
    .string()
    .max(320, "Use 320 characters or fewer.")
    .optional()
    .default(""),
  icon: z.string().optional().default(""),
  color: z.enum([
    "primary",
    "info",
    "success",
    "warning",
    "danger",
    "brandNavy",
  ]),
  ageRange: z.string().optional().default(""),
  incomeRange: z.string().optional().default(""),
  locationType: z.string().optional().default(""),
  familyStatus: z.array(z.string()).default([]),
  preferredChannel: z.string().optional().default(""),
  shoppingFrequency: z.string().optional().default(""),
  averageOrderValue: z.string().optional().default(""),
  discountSensitivity: z.string().optional().default(""),
  preferredTone: z.string().optional().default(""),
  interests: z.array(z.string()).default([]),
  avoidTopics: z.array(z.string()).default([]),
});

type PersonaFormValues = z.infer<typeof personaSchema>;

export interface PersonaFormInitialValue {
  name: string;
  description?: string | null;
  metadata?: PersonaMetadata | null;
}

interface CustomPersonaModalProps {
  open: boolean;
  onSave: (personaData: {
    name: string;
    description?: string | null;
    metadata?: PersonaMetadata | null;
  }) => Promise<unknown>;
  onCancel: () => void;
  title?: string;
  description?: string;
  submitLabel?: string;
  initialValue?: PersonaFormInitialValue | null;
}

const INTEREST_SUGGESTIONS = [
  "Seasonal planting",
  "Indoor plants",
  "Native plants",
  "Container design",
  "Soil health",
  "Garden workshops",
  "Pest prevention",
  "Landscape upgrades",
  "Low-maintenance care",
  "Pollinator support",
];

function toFormValues(
  initialValue?: PersonaFormInitialValue | null,
): PersonaFormValues {
  const metadata =
    normalizePersonaMetadata(initialValue?.metadata) ??
    createEmptyPersonaMetadata();

  return {
    name: initialValue?.name ?? "",
    description: initialValue?.description ?? "",
    icon: metadata.icon ?? "",
    color: (metadata.color ?? "primary") as PersonaAccent,
    ageRange: metadata.demographics?.ageRange ?? "",
    incomeRange: metadata.demographics?.incomeRange ?? "",
    locationType: metadata.demographics?.locationType ?? "",
    familyStatus: metadata.demographics?.familyStatus ?? [],
    preferredChannel: metadata.behavior?.preferredChannel ?? "",
    shoppingFrequency: metadata.behavior?.shoppingFrequency ?? "",
    averageOrderValue: metadata.behavior?.averageOrderValue ?? "",
    discountSensitivity: metadata.behavior?.discountSensitivity ?? "",
    preferredTone: metadata.communication?.preferredTone ?? "",
    interests: metadata.communication?.interests ?? [],
    avoidTopics: metadata.communication?.avoidTopics ?? [],
  };
}

function toMutationPayload(values: PersonaFormValues) {
  return {
    name: values.name.trim(),
    description: values.description.trim() || null,
    metadata: {
      icon: values.icon || null,
      color: values.color,
      demographics: {
        ageRange: values.ageRange || null,
        incomeRange: values.incomeRange || null,
        locationType: values.locationType || null,
        familyStatus: values.familyStatus,
      },
      behavior: {
        preferredChannel: values.preferredChannel || null,
        shoppingFrequency: values.shoppingFrequency || null,
        averageOrderValue: values.averageOrderValue || null,
        discountSensitivity: values.discountSensitivity || null,
      },
      communication: {
        preferredTone: values.preferredTone || null,
        interests: values.interests,
        avoidTopics: values.avoidTopics,
      },
    } satisfies PersonaMetadata,
  };
}

function PersonaFormBody({
  control,
  register,
  watch,
  isSubmitting,
}: {
  control: ReturnType<typeof useForm<PersonaFormValues>>["control"];
  register: ReturnType<typeof useForm<PersonaFormValues>>["register"];
  watch: ReturnType<typeof useForm<PersonaFormValues>>["watch"];
  isSubmitting: boolean;
}) {
  const selectedAccent = watch("color");
  const accentStyles = getPersonaAccentStyles(selectedAccent);

  return (
    <Stack spacing={2.5}>
      <JoyFormSection
        title="Identity"
        description="Give the persona a clear name, visual accent, and short positioning statement."
      >
        <JoyInput
          label="Persona name"
          placeholder="Succulent Sam, Event Planner Elle, Budget Gardener Ben"
          disabled={isSubmitting}
          {...register("name")}
        />
        <JoyTextarea
          label="Description"
          placeholder="Summarize who this persona is, what they care about, and what keeps them buying."
          minRows={4}
          disabled={isSubmitting}
          {...register("description")}
        />

        <Stack spacing={1}>
          <Typography level="body-sm" fontWeight="lg">
            Emoji icon
          </Typography>
          <Controller
            name="icon"
            control={control}
            render={({ field }) => (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(44px, 1fr))",
                  gap: 1,
                }}
              >
                {PERSONA_ICON_OPTIONS.map((icon) => {
                  const isActive = field.value === icon;
                  return (
                    <JoyButton
                      key={icon}
                      variant={isActive ? "soft" : "plain"}
                      color="neutral"
                      onClick={() => field.onChange(icon)}
                      sx={{
                        minHeight: 44,
                        fontSize: "1.2rem",
                        borderRadius: "var(--joy-radius-lg)",
                        border: "1px solid",
                        borderColor: isActive ? "neutral.300" : "transparent",
                        backgroundColor: isActive
                          ? "neutral.100"
                          : "transparent",
                        "&:hover": {
                          backgroundColor: "neutral.100",
                        },
                      }}
                    >
                      {icon}
                    </JoyButton>
                  );
                })}
              </Box>
            )}
          />
        </Stack>

        <Stack spacing={1}>
          <Typography level="body-sm" fontWeight="lg">
            Accent color
          </Typography>
          <Controller
            name="color"
            control={control}
            render={({ field }) => (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "repeat(2, 1fr)",
                    sm: "repeat(3, 1fr)",
                  },
                  gap: 1,
                }}
              >
                {PERSONA_ACCENT_OPTIONS.map((option) => {
                  const styles = getPersonaAccentStyles(option.value);
                  const isActive = field.value === option.value;
                  return (
                    <Sheet
                      key={option.value}
                      variant="outlined"
                      onClick={() => field.onChange(option.value)}
                      sx={{
                        borderRadius: "var(--joy-radius-lg)",
                        borderColor: isActive ? "neutral.400" : "neutral.200",
                        backgroundColor: "background.surface",
                        cursor: "pointer",
                        px: 1.5,
                        py: 1.25,
                        transition:
                          "border-color 160ms ease, background-color 160ms ease",
                        "&:hover": {
                          borderColor: "neutral.300",
                        },
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box
                          sx={{
                            width: 14,
                            height: 14,
                            borderRadius: "999px",
                            backgroundColor: styles.strongBg,
                          }}
                        />
                        <Typography level="body-sm">{option.label}</Typography>
                      </Stack>
                    </Sheet>
                  );
                })}
              </Box>
            )}
          />
        </Stack>
      </JoyFormSection>

      <JoyFormSection
        title="Demographics"
        description="Optional context that helps the team describe the audience more precisely."
      >
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
          <Controller
            name="ageRange"
            control={control}
            render={({ field }) => (
              <JoySelect
                label="Age range"
                value={field.value}
                onValueChange={field.onChange}
                options={PERSONA_AGE_RANGE_OPTIONS.map((value) => ({
                  value,
                  label: value,
                }))}
              />
            )}
          />
          <Controller
            name="incomeRange"
            control={control}
            render={({ field }) => (
              <JoySelect
                label="Income range"
                value={field.value}
                onValueChange={field.onChange}
                options={PERSONA_INCOME_RANGE_OPTIONS.map((value) => ({
                  value,
                  label: value,
                }))}
              />
            )}
          />
          <Controller
            name="locationType"
            control={control}
            render={({ field }) => (
              <JoySelect
                label="Location type"
                value={field.value}
                onValueChange={field.onChange}
                options={PERSONA_LOCATION_OPTIONS.map((value) => ({
                  value,
                  label: value,
                }))}
              />
            )}
          />
        </Stack>

        <Controller
          name="familyStatus"
          control={control}
          render={({ field }) => (
            <JoyAutocomplete<string, true, false, false>
              multiple
              disableCloseOnSelect
              label="Family status"
              placeholder="Select family traits"
              options={PERSONA_FAMILY_STATUS_OPTIONS}
              value={field.value}
              onValueChange={(value) =>
                field.onChange(Array.isArray(value) ? value : [])
              }
            />
          )}
        />
      </JoyFormSection>

      <JoyFormSection
        title="Behavior and messaging"
        description="These fields help campaigns, segmentation, and copy stay aligned with the persona."
      >
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
          <Controller
            name="preferredChannel"
            control={control}
            render={({ field }) => (
              <JoySelect
                label="Preferred channel"
                value={field.value}
                onValueChange={field.onChange}
                options={PERSONA_CHANNEL_OPTIONS.map((value) => ({
                  value,
                  label: value,
                }))}
              />
            )}
          />
          <Controller
            name="shoppingFrequency"
            control={control}
            render={({ field }) => (
              <JoySelect
                label="Shopping frequency"
                value={field.value}
                onValueChange={field.onChange}
                options={PERSONA_FREQUENCY_OPTIONS.map((value) => ({
                  value,
                  label: value,
                }))}
              />
            )}
          />
        </Stack>

        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
          <Controller
            name="averageOrderValue"
            control={control}
            render={({ field }) => (
              <JoySelect
                label="Average order value"
                value={field.value}
                onValueChange={field.onChange}
                options={PERSONA_ORDER_VALUE_OPTIONS.map((value) => ({
                  value,
                  label: value,
                }))}
              />
            )}
          />
          <Controller
            name="discountSensitivity"
            control={control}
            render={({ field }) => (
              <JoySelect
                label="Discount sensitivity"
                value={field.value}
                onValueChange={field.onChange}
                options={PERSONA_DISCOUNT_SENSITIVITY_OPTIONS.map((value) => ({
                  value,
                  label: value,
                }))}
              />
            )}
          />
        </Stack>

        <Controller
          name="preferredTone"
          control={control}
          render={({ field }) => (
            <JoySelect
              label="Preferred tone"
              value={field.value}
              onValueChange={field.onChange}
              options={PERSONA_TONE_OPTIONS.map((value) => ({
                value,
                label: value,
              }))}
            />
          )}
        />

        <Controller
          name="interests"
          control={control}
          render={({ field }) => (
            <JoyAutocomplete<string, true, false, true>
              multiple
              freeSolo
              filterSelectedOptions
              label="Topics of interest"
              placeholder="Add interests"
              options={INTEREST_SUGGESTIONS}
              value={field.value}
              onValueChange={(value) =>
                field.onChange(
                  Array.from(
                    new Set(
                      (Array.isArray(value) ? value : [])
                        .map((item) => String(item).trim())
                        .filter(Boolean),
                    ),
                  ),
                )
              }
            />
          )}
        />

        <Controller
          name="avoidTopics"
          control={control}
          render={({ field }) => (
            <JoyAutocomplete<string, true, false, true>
              multiple
              freeSolo
              filterSelectedOptions
              label="Topics to avoid"
              placeholder="Add sensitive topics"
              options={INTEREST_SUGGESTIONS}
              value={field.value}
              onValueChange={(value) =>
                field.onChange(
                  Array.from(
                    new Set(
                      (Array.isArray(value) ? value : [])
                        .map((item) => String(item).trim())
                        .filter(Boolean),
                    ),
                  ),
                )
              }
            />
          )}
        />
      </JoyFormSection>

      <Sheet
        variant="outlined"
        sx={{
          borderRadius: "var(--joy-radius-xl)",
          border: "1px solid",
          borderColor: "neutral.200",
          backgroundColor: "background.surface",
          p: 2,
        }}
      >
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: "var(--joy-radius-xl)",
              display: "grid",
              placeItems: "center",
              backgroundColor: "neutral.100",
              color: "neutral.700",
              fontSize: "1.6rem",
            }}
          >
            {watch("icon") || "🎯"}
          </Box>
          <Stack spacing={0.25} sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: "999px",
                  backgroundColor: accentStyles.strongBg,
                }}
              />
              <Typography level="body-xs" color="neutral">
                Accent preview
              </Typography>
            </Stack>
            <Typography level="title-md">
              {watch("name") || "Persona preview"}
            </Typography>
            <Typography level="body-sm" color="neutral">
              {watch("description") ||
                "The preview updates as you define the persona profile."}
            </Typography>
          </Stack>
        </Stack>
      </Sheet>
    </Stack>
  );
}

export const CustomPersonaModal: React.FC<CustomPersonaModalProps> = ({
  open,
  onSave,
  onCancel,
  title = "Create custom persona",
  description = "Add the signals your team actually uses so personas can travel cleanly across CRM, campaigns, and analytics.",
  submitLabel = "Save persona",
  initialValue,
}) => {
  const isMobile = useIsMobile();
  const [isSaving, setIsSaving] = React.useState(false);
  const { control, handleSubmit, register, reset, watch } =
    useForm<PersonaFormValues>({
      resolver: zodResolver(personaSchema),
      defaultValues: toFormValues(initialValue),
    });

  React.useEffect(() => {
    if (open) {
      reset(toFormValues(initialValue));
    }
  }, [initialValue, open, reset]);

  const handleClose = React.useCallback(() => {
    reset(toFormValues(initialValue));
    onCancel();
  }, [initialValue, onCancel, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setIsSaving(true);
    const result = await onSave(toMutationPayload(values));
    setIsSaving(false);

    if (result) {
      reset(toFormValues(null));
    }
  });

  const body = (
    <Stack spacing={2}>
      <PersonaFormBody
        control={control}
        register={register}
        watch={watch}
        isSubmitting={isSaving}
      />
      <Divider />
      <Stack
        direction={{ xs: "column-reverse", sm: "row" }}
        spacing={1}
        justifyContent="flex-end"
      >
        <JoyButton
          bloomVariant="outline"
          color="neutral"
          onClick={handleClose}
          disabled={isSaving}
        >
          Cancel
        </JoyButton>
        <JoyButton onClick={() => void onSubmit()} loading={isSaving}>
          {submitLabel}
        </JoyButton>
      </Stack>
    </Stack>
  );

  if (isMobile) {
    return (
      <JoyDrawer
        open={open}
        onClose={handleClose}
        title={title}
        description={description}
        size="lg"
      >
        {body}
      </JoyDrawer>
    );
  }

  return (
    <JoyDialog
      open={open}
      onClose={handleClose}
      title={title}
      description={description}
      size="xl"
    >
      <JoyDialogContent>{body}</JoyDialogContent>
      <JoyDialogActions sx={{ display: "none" }} />
    </JoyDialog>
  );
};
