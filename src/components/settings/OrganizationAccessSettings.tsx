import { useCallback, useEffect, useMemo, useState } from "react";
import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Checkbox from "@mui/joy/Checkbox";
import Chip from "@mui/joy/Chip";
import Divider from "@mui/joy/Divider";
import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import Input from "@mui/joy/Input";
import Option from "@mui/joy/Option";
import Select from "@mui/joy/Select";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Building2, MapPin, Plus, Save, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import {
  CRM_ROLES,
  CRM_ROLE_DESCRIPTIONS,
  CRM_ROLE_LABELS,
  isLocationScopedCrmRole,
  normalizeCrmRole,
  type CrmRole,
} from "@/lib/auth/crmAccess";

type AccessLocation = {
  id: string;
  name: string;
  code: string | null;
  timezone: string;
  is_active: boolean;
};

type AccessMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  location_ids: string[];
};

type AccessOverview = {
  tenant_id: string;
  current_user_id: string;
  current_role: string;
  can_manage: boolean;
  locations: AccessLocation[];
  members: AccessMember[];
};

type MemberDraft = { role: CrmRole; locationIds: string[] };

type RpcResult = Promise<{
  data: unknown;
  error: { message: string } | null;
}>;

const accessRpc = (name: string, args: Record<string, unknown>): RpcResult =>
  (supabase.rpc as unknown as (rpcName: string, rpcArgs: Record<string, unknown>) => RpcResult)(
    name,
    args,
  );

const timezones = [
  "America/St_Johns",
  "America/Halifax",
  "America/Toronto",
  "America/Winnipeg",
  "America/Regina",
  "America/Edmonton",
  "America/Vancouver",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
];

export const OrganizationAccessSettings = () => {
  const { tenant, loading: tenantLoading } = useTenant();
  const [overview, setOverview] = useState<AccessOverview | null>(null);
  const [drafts, setDrafts] = useState<Record<string, MemberDraft>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [locationName, setLocationName] = useState("");
  const [locationCode, setLocationCode] = useState("");
  const [locationTimezone, setLocationTimezone] = useState("America/Toronto");

  const loadOverview = useCallback(async () => {
    if (!tenant?.id) {
      setOverview(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const { data, error: rpcError } = await accessRpc(
      "get_tenant_access_overview",
      { p_tenant_id: tenant.id },
    );

    if (rpcError) {
      setError(rpcError.message);
      setLoading(false);
      return;
    }

    const next = data as AccessOverview;
    const activeLocationIds = new Set(
      next.locations
        .filter((location) => location.is_active)
        .map((location) => location.id),
    );
    setOverview(next);
    setDrafts(
      Object.fromEntries(
        next.members.map((member) => [
          member.id,
          {
            role: normalizeCrmRole(member.role),
            locationIds: (member.location_ids ?? []).filter((locationId) =>
              activeLocationIds.has(locationId),
            ),
          },
        ]),
      ),
    );
    setLoading(false);
  }, [tenant?.id]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const activeLocations = useMemo(
    () => overview?.locations.filter((location) => location.is_active) ?? [],
    [overview?.locations],
  );

  const saveLocation = async (
    location?: AccessLocation,
    activeOverride?: boolean,
  ) => {
    const key = location?.id ?? "new-location";
    setSavingKey(key);
    const { error: rpcError } = await accessRpc("save_tenant_location", {
      p_location_id: location?.id ?? null,
      p_name: location?.name ?? locationName,
      p_code: location?.code ?? locationCode,
      p_timezone: location?.timezone ?? locationTimezone,
      p_is_active: activeOverride ?? location?.is_active ?? true,
    });
    setSavingKey(null);

    if (rpcError) {
      toast.error(rpcError.message);
      return;
    }

    if (!location) {
      setLocationName("");
      setLocationCode("");
    }
    toast.success(location ? "Location updated" : "Location added");
    await loadOverview();
  };

  const saveMember = async (member: AccessMember) => {
    const draft = drafts[member.id];
    if (!draft) return;
    if (isLocationScopedCrmRole(draft.role) && draft.locationIds.length === 0) {
      toast.error("Choose at least one active location for this role");
      return;
    }

    setSavingKey(member.id);
    const { error: rpcError } = await accessRpc("set_tenant_user_crm_access", {
      p_user_id: member.id,
      p_role: draft.role,
      p_location_ids: isLocationScopedCrmRole(draft.role)
        ? draft.locationIds
        : [],
    });
    setSavingKey(null);

    if (rpcError) {
      toast.error(rpcError.message);
      return;
    }

    toast.success(`Access updated for ${member.name}`);
    await loadOverview();
  };

  if (tenantLoading || loading) {
    return (
      <Stack spacing={2}>
        <Skeleton variant="text" width={260} />
        <Skeleton variant="rectangular" height={180} sx={{ borderRadius: "lg" }} />
        <Skeleton variant="rectangular" height={220} sx={{ borderRadius: "lg" }} />
      </Stack>
    );
  }

  if (error) {
    return <Alert color="danger">Unable to load organization access: {error}</Alert>;
  }

  if (!overview) {
    return <Alert color="warning">Choose an organization before managing access.</Alert>;
  }

  return (
    <Stack spacing={3}>
      <Stack spacing={0.75}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Building2 size={18} />
          <Typography level="title-lg">Locations &amp; Team</Typography>
        </Stack>
        <Typography level="body-sm" sx={{ color: "text.secondary", maxWidth: 760 }}>
          Keep one customer database across every store while controlling who can
          see company-wide or location-specific information.
        </Typography>
      </Stack>

      <Sheet variant="outlined" sx={{ p: 2.5, borderRadius: "lg" }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} alignItems="center">
            <MapPin size={17} />
            <Typography level="title-md">Store locations</Typography>
            <Chip size="sm" variant="soft">{overview.locations.length}</Chip>
          </Stack>

          {overview.can_manage ? (
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.25}>
              <FormControl sx={{ flex: 2 }}>
                <FormLabel>Location name</FormLabel>
                <Input
                  value={locationName}
                  onChange={(event) => setLocationName(event.target.value)}
                  placeholder="Downtown Garden Centre"
                />
              </FormControl>
              <FormControl sx={{ flex: 1 }}>
                <FormLabel>Store code</FormLabel>
                <Input
                  value={locationCode}
                  onChange={(event) => setLocationCode(event.target.value)}
                  placeholder="downtown"
                />
              </FormControl>
              <FormControl sx={{ flex: 1.5 }}>
                <FormLabel>Timezone</FormLabel>
                <Select
                  value={locationTimezone}
                  onChange={(_, value) => value && setLocationTimezone(value)}
                >
                  {timezones.map((timezone) => (
                    <Option key={timezone} value={timezone}>{timezone}</Option>
                  ))}
                </Select>
              </FormControl>
              <Button
                startDecorator={<Plus size={16} />}
                loading={savingKey === "new-location"}
                disabled={!locationName.trim()}
                onClick={() => void saveLocation()}
                sx={{ alignSelf: { md: "flex-end" } }}
              >
                Add location
              </Button>
            </Stack>
          ) : null}

          <Divider />
          <Stack spacing={1}>
            {overview.locations.length === 0 ? (
              <Typography level="body-sm" sx={{ color: "text.secondary" }}>
                No store locations have been configured yet.
              </Typography>
            ) : overview.locations.map((location) => (
              <Stack
                key={location.id}
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
                alignItems={{ sm: "center" }}
                justifyContent="space-between"
                sx={{ p: 1.5, borderRadius: "md", bgcolor: "background.level1" }}
              >
                <Box>
                  <Typography level="title-sm">{location.name}</Typography>
                  <Typography level="body-xs" sx={{ color: "text.secondary" }}>
                    {location.code || "No store code"} · {location.timezone}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip color={location.is_active ? "success" : "neutral"} size="sm">
                    {location.is_active ? "Active" : "Inactive"}
                  </Chip>
                  {overview.can_manage ? (
                    <Button
                      size="sm"
                      variant="outlined"
                      color={location.is_active ? "danger" : "success"}
                      loading={savingKey === location.id}
                      onClick={() => void saveLocation(location, !location.is_active)}
                    >
                      {location.is_active ? "Deactivate" : "Reactivate"}
                    </Button>
                  ) : null}
                </Stack>
              </Stack>
            ))}
          </Stack>
        </Stack>
      </Sheet>

      <Sheet variant="outlined" sx={{ p: 2.5, borderRadius: "lg" }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Users size={17} />
            <Typography level="title-md">Team access</Typography>
            <Chip size="sm" variant="soft">{overview.members.length}</Chip>
          </Stack>

          {!overview.can_manage ? (
            <Alert color="neutral" startDecorator={<ShieldCheck size={18} />}>
              Your role is {overview.current_role.replaceAll("_", " ")}. An owner
              or admin manages role and store assignments.
            </Alert>
          ) : null}

          <Stack spacing={1.5}>
            {overview.members.map((member) => {
              const draft = drafts[member.id] ?? {
                role: normalizeCrmRole(member.role),
                locationIds: member.location_ids ?? [],
              };
              const scoped = isLocationScopedCrmRole(draft.role);
              const isCurrentUser = member.id === overview.current_user_id;

              return (
                <Sheet key={member.id} variant="soft" sx={{ p: 2, borderRadius: "md" }}>
                  <Stack spacing={1.5}>
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={1.5}
                      justifyContent="space-between"
                    >
                      <Box sx={{ minWidth: 220 }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography level="title-sm">{member.name}</Typography>
                          {isCurrentUser ? <Chip size="sm">You</Chip> : null}
                        </Stack>
                        <Typography level="body-xs" sx={{ color: "text.secondary" }}>
                          {member.email}
                        </Typography>
                      </Box>
                      {overview.can_manage ? (
                        <FormControl sx={{ minWidth: 210 }}>
                          <FormLabel>Role</FormLabel>
                          <Select
                            value={draft.role}
                            disabled={isCurrentUser}
                            onChange={(_, value) => {
                              if (!value) return;
                              setDrafts((current) => ({
                                ...current,
                                [member.id]: {
                                  role: value,
                                  locationIds: isLocationScopedCrmRole(value)
                                    ? draft.locationIds
                                    : [],
                                },
                              }));
                            }}
                          >
                            {CRM_ROLES.map((role) => (
                              <Option key={role} value={role}>{CRM_ROLE_LABELS[role]}</Option>
                            ))}
                          </Select>
                        </FormControl>
                      ) : (
                        <Chip>{CRM_ROLE_LABELS[draft.role]}</Chip>
                      )}
                    </Stack>

                    <Typography level="body-xs" sx={{ color: "text.secondary" }}>
                      {CRM_ROLE_DESCRIPTIONS[draft.role]}
                    </Typography>

                    {scoped ? (
                      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                        {activeLocations.map((location) => (
                          <Checkbox
                            key={location.id}
                            label={location.name}
                            disabled={!overview.can_manage || isCurrentUser}
                            checked={draft.locationIds.includes(location.id)}
                            onChange={(event) => {
                              const checked = event.target.checked;
                              setDrafts((current) => ({
                                ...current,
                                [member.id]: {
                                  ...draft,
                                  locationIds: checked
                                    ? [...new Set([...draft.locationIds, location.id])]
                                    : draft.locationIds.filter((id) => id !== location.id),
                                },
                              }));
                            }}
                          />
                        ))}
                      </Stack>
                    ) : null}

                    {overview.can_manage && !isCurrentUser ? (
                      <Button
                        size="sm"
                        variant="solid"
                        startDecorator={<Save size={15} />}
                        loading={savingKey === member.id}
                        disabled={scoped && draft.locationIds.length === 0}
                        onClick={() => void saveMember(member)}
                        sx={{ alignSelf: "flex-end" }}
                      >
                        Save access
                      </Button>
                    ) : isCurrentUser ? (
                      <Typography level="body-xs" sx={{ color: "text.secondary" }}>
                        Another owner or admin must change your access.
                      </Typography>
                    ) : null}
                  </Stack>
                </Sheet>
              );
            })}
          </Stack>
        </Stack>
      </Sheet>
    </Stack>
  );
};
