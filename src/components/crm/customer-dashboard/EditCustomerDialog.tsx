import * as React from "react";
import Stack from "@mui/joy/Stack";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  JoyDialog,
  JoyDialogActions,
  JoyDialogContent,
} from "@/components/joy/JoyDialog";
import { JoyInput } from "@/components/joy/JoyInput";
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
    });
  }, [
    initialData.email,
    initialData.first_name,
    initialData.last_name,
    initialData.phone,
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
      description="Update customer contact information. Consent is managed separately with a documented audit trail."
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
