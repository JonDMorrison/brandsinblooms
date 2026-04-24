import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Box from "@mui/joy/Box";
import Chip from "@mui/joy/Chip";
import Divider from "@mui/joy/Divider";
import IconButton from "@mui/joy/IconButton";
import List from "@mui/joy/List";
import ListItem from "@mui/joy/ListItem";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Trash2 } from "lucide-react";
import { JoyAutocomplete } from "@/components/joy/JoyAutocomplete";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";

interface CustomerOption {
  id: string;
  label: string;
  email: string;
  phone: string | null;
}

export interface StaticSegmentMemberManagerProps {
  value: string[];
  onChange: (memberIds: string[]) => void;
}

export function StaticSegmentMemberManager({
  value,
  onChange,
}: StaticSegmentMemberManagerProps) {
  const { tenant } = useTenant();
  const tenantId = tenant?.id ?? null;

  const customerQuery = useQuery({
    queryKey: ["segment-static-customer-options", tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      if (!tenantId) {
        return [] as CustomerOption[];
      }

      const { data, error } = await supabase
        .from("crm_customers")
        .select("id, first_name, last_name, email, phone")
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .order("first_name")
        .limit(500);

      if (error) {
        throw error;
      }

      return (data ?? []).map((customer) => ({
        id: customer.id,
        label:
          `${String(customer.first_name ?? "").trim()} ${String(customer.last_name ?? "").trim()}`.trim() ||
          customer.email,
        email: customer.email,
        phone: customer.phone,
      }));
    },
    staleTime: 60_000,
  });

  const selectedCustomers = useMemo(() => {
    const registry = new Map(
      (customerQuery.data ?? []).map((customer) => [customer.id, customer]),
    );
    return value
      .map((memberId) => registry.get(memberId))
      .filter(Boolean) as CustomerOption[];
  }, [customerQuery.data, value]);

  return (
    <JoyCard>
      <JoyCardHeader
        description="Static segments use manual membership lists instead of rule evaluation."
        title="Members"
      />
      <JoyCardContent
        sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 3 }}
      >
        <JoyAutocomplete<CustomerOption, true, false, false>
          getOptionLabel={(option) => option.label}
          helperText="Search current tenant customers and add them to this segment."
          isOptionEqualToValue={(option, current) => option.id === current.id}
          loading={customerQuery.isLoading}
          multiple
          onValueChange={(nextValue) =>
            onChange((nextValue ?? []).map((customer) => customer.id))
          }
          options={customerQuery.data ?? []}
          placeholder="Add customers"
          renderOption={(props, option) => (
            <li {...props} key={option.id}>
              <Stack spacing={0.25}>
                <Typography level="body-sm">{option.label}</Typography>
                <Typography level="body-xs" color="neutral">
                  {option.email}
                </Typography>
              </Stack>
            </li>
          )}
          value={selectedCustomers}
        />

        <Divider />

        <Stack direction="row" justifyContent="space-between" spacing={1}>
          <Typography level="title-sm">Selected customers</Typography>
          <Chip color="primary" size="sm" variant="soft">
            {value.length}
          </Chip>
        </Stack>

        <List
          sx={{
            gap: 1,
            "--List-padding": "0px",
            maxHeight: 280,
            overflowY: "auto",
          }}
        >
          {selectedCustomers.length ? (
            selectedCustomers.map((customer) => (
              <ListItem key={customer.id} sx={{ px: 0, py: 0.5 }}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  spacing={2}
                  sx={{ width: "100%" }}
                >
                  <Box>
                    <Typography level="body-sm">{customer.label}</Typography>
                    <Typography level="body-xs" color="neutral">
                      {customer.email}
                    </Typography>
                  </Box>
                  <IconButton
                    color="danger"
                    onClick={() =>
                      onChange(
                        value.filter((memberId) => memberId !== customer.id),
                      )
                    }
                    size="sm"
                    variant="plain"
                  >
                    <Trash2 size={16} />
                  </IconButton>
                </Stack>
              </ListItem>
            ))
          ) : (
            <ListItem sx={{ px: 0 }}>
              <Typography level="body-sm" color="neutral">
                No customers added yet.
              </Typography>
            </ListItem>
          )}
        </List>
      </JoyCardContent>
    </JoyCard>
  );
}
