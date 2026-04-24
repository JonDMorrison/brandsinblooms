import * as React from "react";
import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  JoyDialog,
  JoyDialogActions,
  JoyDialogContent,
} from "@/components/joy/JoyDialog";
import { JoyInput } from "@/components/joy/JoyInput";
import { JoySwitch } from "@/components/joy/JoySwitch";
import { useUpdateCustomer } from "@/hooks/useUpdateCustomer";
import type { CustomerData } from "@/hooks/useCustomerDashboard";

const editCustomerSchema = z.object({
  first_name: z
    .string()
    .trim()
    .max(100, "First name must be less than 100 characters")
    .optional(),
  last_name: z
    .string()
    .trim()
    .max(100, "Last name must be less than 100 characters")
    .optional(),
  email: z
    .string()
    .trim()
    .email("Invalid email address")
    .max(255, "Email must be less than 255 characters"),
  phone: z
    .string()
    .trim()
    .max(20, "Phone must be less than 20 characters")
    .optional(),
  email_opt_in: z.boolean().optional(),
  sms_opt_in: z.boolean().optional(),
});

type EditCustomerFormData = z.infer<typeof editCustomerSchema>;

interface EditCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  initialData: {
    first_name?: string | null;
    last_name?: string | null;
    email: string;
    phone?: string | null;
    email_opt_in?: boolean | null;
    sms_opt_in?: boolean | null;
  };
  onSuccess?: (updatedCustomer: Partial<CustomerData>) => void;
}

export function EditCustomerDialog({
  open,
  onOpenChange,
  customerId,
  initialData,
  onSuccess,
}: EditCustomerDialogProps) {
  const updateCustomer = useUpdateCustomer();

  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<EditCustomerFormData>({
    resolver: zodResolver(editCustomerSchema),
    defaultValues: {
      first_name: initialData.first_name || "",
      last_name: initialData.last_name || "",
      email: initialData.email,
      phone: initialData.phone || "",
      email_opt_in: initialData.email_opt_in ?? false,
      sms_opt_in: initialData.sms_opt_in ?? false,
    },
    mode: "onChange",
  });

  React.useEffect(() => {
    if (!open) return;

    reset({
      first_name: initialData.first_name || "",
      last_name: initialData.last_name || "",
      email: initialData.email,
      phone: initialData.phone || "",
      email_opt_in: initialData.email_opt_in ?? false,
      sms_opt_in: initialData.sms_opt_in ?? false,
    });
  }, [
    initialData.email,
    initialData.email_opt_in,
    initialData.first_name,
    initialData.last_name,
    initialData.phone,
    initialData.sms_opt_in,
    open,
    reset,
  ]);

  const onSubmit = async (data: EditCustomerFormData) => {
    const result = await updateCustomer.mutateAsync({
      customerId,
      data: {
        first_name: data.first_name || null,
        last_name: data.last_name || null,
        email: data.email,
        phone: data.phone || null,
        email_opt_in: data.email_opt_in ?? false,
        sms_opt_in: data.sms_opt_in ?? false,
      },
    });

    onSuccess?.(result as Partial<CustomerData>);
    onOpenChange(false);
  };

  return (
    <JoyDialog
      open={open}
      onClose={() => onOpenChange(false)}
      title="Edit Customer"
      description="Update customer information and communication preferences."
      size="md"
    >
      <JoyDialogContent>
        <form id="edit-customer-form" onSubmit={handleSubmit(onSubmit)}>
          <Stack spacing={2.5}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <JoyInput
                label="First Name"
                placeholder="First name"
                error={Boolean(errors.first_name)}
                errorMessage={errors.first_name?.message}
                {...register("first_name")}
              />
              <JoyInput
                label="Last Name"
                placeholder="Last name"
                error={Boolean(errors.last_name)}
                errorMessage={errors.last_name?.message}
                {...register("last_name")}
              />
            </Stack>

            <JoyInput
              label="Email"
              type="email"
              placeholder="customer@example.com"
              error={Boolean(errors.email)}
              errorMessage={errors.email?.message}
              {...register("email")}
            />

            <JoyInput
              label="Phone"
              type="tel"
              placeholder="+1 (555) 123-4567"
              error={Boolean(errors.phone)}
              errorMessage={errors.phone?.message}
              {...register("phone")}
            />

            <Stack spacing={1.5}>
              <Typography level="title-sm">
                Communication Preferences
              </Typography>

              <Controller
                name="email_opt_in"
                control={control}
                render={({ field }) => (
                  <FormControl
                    orientation="horizontal"
                    sx={{
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Stack spacing={0.25}>
                      <FormLabel>Email Marketing</FormLabel>
                      <Typography level="body-xs" color="neutral">
                        Allow marketing campaigns and newsletters by email.
                      </Typography>
                    </Stack>
                    <JoySwitch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                )}
              />

              <Controller
                name="sms_opt_in"
                control={control}
                render={({ field }) => (
                  <FormControl
                    orientation="horizontal"
                    sx={{
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Stack spacing={0.25}>
                      <FormLabel>SMS Marketing</FormLabel>
                      <Typography level="body-xs" color="neutral">
                        Allow SMS reminders, campaigns, and outreach.
                      </Typography>
                    </Stack>
                    <JoySwitch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                )}
              />
            </Stack>
          </Stack>
        </form>
      </JoyDialogContent>
      <JoyDialogActions>
        <JoyButton
          bloomVariant="ghost"
          color="neutral"
          disabled={updateCustomer.isPending}
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </JoyButton>
        <JoyButton
          type="submit"
          form="edit-customer-form"
          disabled={!isDirty}
          loading={updateCustomer.isPending}
        >
          Save
        </JoyButton>
      </JoyDialogActions>
    </JoyDialog>
  );
}

export default EditCustomerDialog;
