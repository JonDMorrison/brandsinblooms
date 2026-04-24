import * as React from "react";
import CircularProgress from "@mui/joy/CircularProgress";
import Divider from "@mui/joy/Divider";
import IconButton from "@mui/joy/IconButton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Check, Pencil, X } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoyInput } from "@/components/joy/JoyInput";
import { JoySwitch } from "@/components/joy/JoySwitch";
import { useUpdateCustomer } from "@/hooks/useUpdateCustomer";
import { useToast } from "@/hooks/use-toast";
import type { CustomerData } from "@/hooks/useCustomerDashboard";

type EditableField = "first_name" | "last_name" | "email" | "phone";

interface CustomerContactCardProps {
  customerId: string;
  customer: Pick<
    CustomerData,
    | "first_name"
    | "last_name"
    | "email"
    | "phone"
    | "email_opt_in"
    | "sms_opt_in"
  >;
  onCustomerPatched: (patch: Partial<CustomerData>) => void;
  onOpenBatchEdit?: () => void;
}

const textFieldLabels: Array<{
  field: EditableField;
  label: string;
  type?: React.ComponentProps<typeof JoyInput>["type"];
  placeholder: string;
}> = [
  { field: "first_name", label: "First Name", placeholder: "First name" },
  { field: "last_name", label: "Last Name", placeholder: "Last name" },
  {
    field: "email",
    label: "Email",
    placeholder: "email@example.com",
    type: "email",
  },
  {
    field: "phone",
    label: "Phone",
    placeholder: "+1 (555) 123-4567",
    type: "tel",
  },
];

const getDisplayValue = (
  value: string | null | undefined,
  fallback = "Data not available",
) => {
  const trimmed = String(value ?? "").trim();
  return trimmed || fallback;
};

export function CustomerContactCard({
  customerId,
  customer,
  onCustomerPatched,
  onOpenBatchEdit,
}: CustomerContactCardProps) {
  const updateCustomer = useUpdateCustomer();
  const { toast } = useToast();
  const [editingField, setEditingField] = React.useState<EditableField | null>(
    null,
  );
  const [draftValues, setDraftValues] = React.useState<
    Record<EditableField, string>
  >({
    first_name: customer.first_name ?? "",
    last_name: customer.last_name ?? "",
    email: customer.email,
    phone: customer.phone ?? "",
  });
  const [savingField, setSavingField] = React.useState<string | null>(null);

  React.useEffect(() => {
    setDraftValues({
      first_name: customer.first_name ?? "",
      last_name: customer.last_name ?? "",
      email: customer.email,
      phone: customer.phone ?? "",
    });
  }, [customer.email, customer.first_name, customer.last_name, customer.phone]);

  const resetFieldDraft = React.useCallback(
    (field: EditableField) => {
      setDraftValues((current) => ({
        ...current,
        [field]: String(customer[field] ?? ""),
      }));
    },
    [customer],
  );

  const handleFieldSave = async (field: EditableField) => {
    const rawValue = draftValues[field]?.trim() ?? "";

    if (field === "email" && !/^\S+@\S+\.\S+$/.test(rawValue)) {
      toast({
        title: "Invalid email",
        description: "Enter a valid email address before saving.",
        variant: "destructive",
      });
      return;
    }

    setSavingField(field);
    try {
      const nextValue = rawValue === "" && field !== "email" ? null : rawValue;
      await updateCustomer.mutateAsync({
        customerId,
        data: {
          [field]: nextValue,
        },
      });

      onCustomerPatched({ [field]: nextValue } as Partial<CustomerData>);
      setEditingField(null);
    } finally {
      setSavingField(null);
    }
  };

  const handleToggle = async (
    field: "email_opt_in" | "sms_opt_in",
    value: boolean,
  ) => {
    setSavingField(field);
    try {
      await updateCustomer.mutateAsync({
        customerId,
        data: { [field]: value },
      });

      onCustomerPatched({ [field]: value } as Partial<CustomerData>);
    } finally {
      setSavingField(null);
    }
  };

  return (
    <JoyCard variant="outlined">
      <JoyCardHeader
        title="Contact information"
        description="Edit core profile fields inline without leaving the customer record."
        actions={
          onOpenBatchEdit ? (
            <JoyButton
              color="neutral"
              variant="plain"
              size="sm"
              startDecorator={<Pencil size={14} />}
              onClick={onOpenBatchEdit}
            >
              Batch edit
            </JoyButton>
          ) : null
        }
      />
      <JoyCardContent>
        <Stack spacing={0}>
          {textFieldLabels.map((item, index) => {
            const isEditing = editingField === item.field;
            const isSaving = savingField === item.field;

            return (
              <React.Fragment key={item.field}>
                {index > 0 ? <Divider /> : null}
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.5}
                  justifyContent="space-between"
                  alignItems={{ xs: "flex-start", sm: "center" }}
                  sx={{ py: 1.5, gap: 1.5 }}
                >
                  <Typography
                    level="body-sm"
                    color="neutral"
                    sx={{ minWidth: 120 }}
                  >
                    {item.label}
                  </Typography>

                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    sx={{ flex: 1, width: "100%", minWidth: 0 }}
                  >
                    {isEditing ? (
                      <JoyInput
                        autoFocus
                        value={draftValues[item.field]}
                        type={item.type}
                        placeholder={item.placeholder}
                        onChange={(event) => {
                          setDraftValues((current) => ({
                            ...current,
                            [item.field]: event.target.value,
                          }));
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void handleFieldSave(item.field);
                          }

                          if (event.key === "Escape") {
                            resetFieldDraft(item.field);
                            setEditingField(null);
                          }
                        }}
                        sx={{ flex: 1 }}
                      />
                    ) : (
                      <Typography level="body-sm" sx={{ flex: 1, minWidth: 0 }}>
                        {getDisplayValue(customer[item.field])}
                      </Typography>
                    )}

                    {isEditing ? (
                      <Stack direction="row" spacing={0.5}>
                        <IconButton
                          size="sm"
                          variant="soft"
                          color="success"
                          disabled={isSaving}
                          onClick={() => {
                            void handleFieldSave(item.field);
                          }}
                        >
                          {isSaving ? (
                            <CircularProgress size="sm" />
                          ) : (
                            <Check size={14} />
                          )}
                        </IconButton>
                        <IconButton
                          size="sm"
                          variant="plain"
                          color="neutral"
                          disabled={isSaving}
                          onClick={() => {
                            resetFieldDraft(item.field);
                            setEditingField(null);
                          }}
                        >
                          <X size={14} />
                        </IconButton>
                      </Stack>
                    ) : (
                      <IconButton
                        size="sm"
                        variant="plain"
                        color="neutral"
                        onClick={() => setEditingField(item.field)}
                      >
                        <Pencil size={14} />
                      </IconButton>
                    )}
                  </Stack>
                </Stack>
              </React.Fragment>
            );
          })}

          <Divider />

          <Stack spacing={1.5} sx={{ py: 1.5 }}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              spacing={2}
            >
              <Stack spacing={0.25}>
                <Typography level="body-sm">Email Opt-in</Typography>
                <Typography level="body-xs" color="neutral">
                  Controls whether this customer can receive marketing email.
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                {savingField === "email_opt_in" ? (
                  <CircularProgress size="sm" />
                ) : null}
                <JoySwitch
                  checked={customer.email_opt_in ?? false}
                  disabled={savingField === "email_opt_in"}
                  onCheckedChange={(checked) => {
                    void handleToggle("email_opt_in", checked);
                  }}
                />
              </Stack>
            </Stack>

            <Divider />

            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              spacing={2}
            >
              <Stack spacing={0.25}>
                <Typography level="body-sm">SMS Opt-in</Typography>
                <Typography level="body-xs" color="neutral">
                  Controls whether this customer can receive SMS outreach.
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                {savingField === "sms_opt_in" ? (
                  <CircularProgress size="sm" />
                ) : null}
                <JoySwitch
                  checked={customer.sms_opt_in ?? false}
                  disabled={savingField === "sms_opt_in"}
                  onCheckedChange={(checked) => {
                    void handleToggle("sms_opt_in", checked);
                  }}
                />
              </Stack>
            </Stack>
          </Stack>
        </Stack>
      </JoyCardContent>
    </JoyCard>
  );
}
