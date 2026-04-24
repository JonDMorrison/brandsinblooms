import { useAdmin } from "@/contexts/AdminContext";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoySelect } from "@/components/joy/JoySelect";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { Building2, Shield } from "lucide-react";

export const TenantSwitcher = () => {
  const { isMasterAdmin, activeTenantId, setActiveTenantId, availableTenants } =
    useAdmin();

  if (!isMasterAdmin) {
    return null;
  }

  const activeTenant = availableTenants.find((t) => t.id === activeTenantId);

  const tenantOptions = [
    { value: "", label: "Select a tenant to manage" },
    ...availableTenants.map((tenant) => ({
      value: tenant.id,
      label: tenant.company_name || tenant.name,
    })),
  ];

  return (
    <JoyCard
      sx={{ mb: 2, borderColor: "warning.200", backgroundColor: "warning.50" }}
    >
      <JoyCardHeader
        title="Master Admin Mode"
        description="Select a tenant to manage their account"
        startDecorator={<Shield className="h-5 w-5 text-warning" />}
      />
      <JoyCardContent>
        <Stack spacing={2}>
          <JoySelect
            value={activeTenantId || ""}
            onValueChange={(value) => setActiveTenantId(value || null)}
            options={tenantOptions}
          />

          {activeTenantId && (
            <Sheet
              variant="soft"
              color="neutral"
              sx={{ p: 1.5, borderRadius: "var(--joy-radius-md)" }}
            >
              <Typography level="body-sm" fontWeight="md" sx={{ mb: 0.5 }}>
                Currently Managing:
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Building2 className="h-4 w-4" />
                <Typography level="body-sm" color="neutral">
                  {activeTenant?.company_name || activeTenant?.name}
                </Typography>
              </Stack>
              <Typography level="body-xs" color="neutral" sx={{ mt: 0.5 }}>
                Tenant ID: {activeTenantId}
              </Typography>
            </Sheet>
          )}

          {activeTenantId && (
            <JoyButton
              bloomVariant="outline"
              fullWidth
              size="sm"
              onClick={() => setActiveTenantId(null)}
            >
              Exit Tenant Management
            </JoyButton>
          )}
        </Stack>
      </JoyCardContent>
    </JoyCard>
  );
};
