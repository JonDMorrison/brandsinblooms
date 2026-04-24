import * as React from "react";
import Box from "@mui/joy/Box";
import Divider from "@mui/joy/Divider";
import Skeleton from "@mui/joy/Skeleton";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Copy,
  Mail,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useNavigate, useParams } from "react-router-dom";
import { getPersonaEmoji, type PersonaRecord } from "@/config/systemPersonas";
import {
  CustomPersonaModal,
  type PersonaFormInitialValue,
} from "@/components/crm/personas/CustomPersonaModal";
import { JoyAlertDialog } from "@/components/joy/JoyAlertDialog";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoyChip } from "@/components/joy/JoyChip";
import { JoyDrawer } from "@/components/joy/JoyDrawer";
import { JoyPageHeaderBand } from "@/components/joy/JoyPageHeaderBand";
import { PageContainer } from "@/components/joy/PageContainer";
import { JoySearchInput } from "@/components/joy/JoySearchInput";
import {
  JoyTable,
  JoyTableBody,
  JoyTableCell,
  JoyTableHead,
  JoyTableHeaderCell,
  JoyTableRow,
} from "@/components/joy/JoyTable";
import {
  JoyTabs,
  JoyTabsContent,
  JoyTabsList,
  JoyTabsTrigger,
} from "@/components/joy/JoyTabs";
import { useAllPersonas } from "@/hooks/useAllPersonas";
import { useCRMCustomers } from "@/hooks/useCRMCustomers";
import { usePersonaCustomerCounts } from "@/hooks/usePersonaCustomerCounts";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { getCustomerDisplayName } from "@/lib/personaUtils";

type EditorState = {
  mode: "edit" | "duplicate";
  title: string;
  submitLabel: string;
  initialValue: PersonaFormInitialValue;
} | null;

const CHART_COLORS = [
  "var(--joy-palette-neutral-500)",
  "var(--joy-palette-neutral-400)",
  "var(--joy-palette-neutral-300)",
  "var(--joy-palette-neutral-200)",
  "var(--joy-palette-neutral-300)",
  "var(--joy-palette-neutral-400)",
];

const PERSONA_DETAIL_TAB_SX = {
  px: 0,
  py: 1.5,
  minHeight: 44,
  borderRadius: 0,
  borderBottom: "2px solid transparent",
  backgroundColor: "transparent",
  color: "neutral.600",
  fontWeight: 500,
  justifyContent: "flex-start",
  "&::after": {
    display: "none",
  },
  "&:hover": {
    backgroundColor: "transparent",
    color: "neutral.800",
  },
  "&.Mui-selected": {
    backgroundColor: "transparent",
    color: "primary.600",
    borderBottomColor: "primary.500",
    boxShadow: "none",
  },
} as const;

const CAMPAIGN_SELECT_FIELDS = [
  "id",
  "name",
  "status",
  "total_sent",
  "open_rate",
  "click_rate",
  "metrics",
  "metadata",
  "created_at",
].join(", ");

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function toInitialValue(persona: PersonaRecord): PersonaFormInitialValue {
  return {
    name: persona.persona_name,
    description: persona.persona_description,
    metadata: persona.metadata,
  };
}

function buildTrendSeries(
  totalCustomers: Array<{ created_at?: string | null }>,
) {
  const countsByMonth = new Map<string, number>();

  totalCustomers.forEach((customer) => {
    if (!customer.created_at) {
      return;
    }

    const date = new Date(customer.created_at);
    if (Number.isNaN(date.getTime())) {
      return;
    }

    const label = `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}`;
    countsByMonth.set(label, (countsByMonth.get(label) ?? 0) + 1);
  });

  let runningTotal = 0;
  return Array.from(countsByMonth.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([label, count]) => {
      runningTotal += count;
      return { label, customers: runningTotal };
    });
}

function extractCampaignRevenue(campaign: any) {
  return (
    Number(
      campaign?.metrics?.revenue ?? campaign?.metrics?.revenue_generated,
    ) ||
    Number(
      campaign?.metadata?.revenue ?? campaign?.metadata?.revenue_generated,
    ) ||
    0
  );
}

function sortCampaignsByCreatedAt(
  left: { created_at?: string | null },
  right: { created_at?: string | null },
) {
  return (
    new Date(right.created_at ?? 0).getTime() -
    new Date(left.created_at ?? 0).getTime()
  );
}

function PersonaDetailSkeleton() {
  return (
    <PageContainer>
      <Stack spacing={3} sx={{ pb: 4 }}>
        <Stack spacing={1.25}>
          <Skeleton variant="text" width={120} height={14} animation="wave" />
          <Skeleton variant="text" width={240} height={34} animation="wave" />
          <Skeleton variant="text" width={360} height={18} animation="wave" />
        </Stack>

        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: {
              xs: "1fr",
              md: "repeat(3, minmax(0, 1fr))",
            },
          }}
        >
          {Array.from({ length: 3 }).map((_, index) => (
            <JoyCard key={index}>
              <JoyCardContent sx={{ pt: 3, gap: 1.25 }}>
                <Skeleton
                  variant="text"
                  width={96}
                  height={12}
                  animation="wave"
                />
                <Skeleton
                  variant="text"
                  width={64}
                  height={28}
                  animation="wave"
                />
                <Skeleton
                  variant="text"
                  width="75%"
                  height={14}
                  animation="wave"
                />
              </JoyCardContent>
            </JoyCard>
          ))}
        </Box>

        <Stack
          direction="row"
          spacing={2}
          sx={{ borderBottom: "1px solid", borderColor: "neutral.200" }}
        >
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton
              key={index}
              variant="text"
              width={110}
              height={20}
              animation="wave"
            />
          ))}
        </Stack>

        <Box
          sx={{
            display: "grid",
            gap: 3,
            gridTemplateColumns: {
              xs: "1fr",
              xl: "minmax(0, 1.2fr) minmax(320px, 0.8fr)",
            },
          }}
        >
          <JoyCard>
            <JoyCardContent sx={{ pt: 3, gap: 2 }}>
              <Skeleton
                variant="text"
                width={180}
                height={20}
                animation="wave"
              />
              <Skeleton
                variant="rectangular"
                height={280}
                animation="wave"
                sx={{ borderRadius: "lg" }}
              />
            </JoyCardContent>
          </JoyCard>

          <Stack spacing={3}>
            <JoyCard>
              <JoyCardContent sx={{ pt: 3, gap: 1.5 }}>
                <Skeleton
                  variant="text"
                  width={140}
                  height={20}
                  animation="wave"
                />
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton
                    key={index}
                    variant="rectangular"
                    height={44}
                    animation="wave"
                    sx={{ borderRadius: "md" }}
                  />
                ))}
              </JoyCardContent>
            </JoyCard>

            <JoyCard>
              <JoyCardContent sx={{ pt: 3, gap: 1.5 }}>
                <Skeleton
                  variant="text"
                  width={132}
                  height={20}
                  animation="wave"
                />
                <Skeleton
                  variant="rectangular"
                  height={188}
                  animation="wave"
                  sx={{ borderRadius: "lg" }}
                />
              </JoyCardContent>
            </JoyCard>
          </Stack>
        </Box>
      </Stack>
    </PageContainer>
  );
}

export default function PersonaDetailPage() {
  const navigate = useNavigate();
  const { personaId } = useParams<{ personaId: string }>();
  const { tenant } = useTenant();
  const { personas, createPersona, updatePersona, deletePersona, loading } =
    useAllPersonas();
  const {
    statsByPersona,
    summary,
    loading: metricsLoading,
  } = usePersonaCustomerCounts();
  const {
    customers,
    loading: customersLoading,
    assignPersonaToCustomer,
    removeSpecificPersonaFromCustomer,
    getCustomersByPersona,
  } = useCRMCustomers();

  const [customerSearch, setCustomerSearch] = React.useState("");
  const [customerPickerSearch, setCustomerPickerSearch] = React.useState("");
  const [assignDrawerOpen, setAssignDrawerOpen] = React.useState(false);
  const [busyCustomerId, setBusyCustomerId] = React.useState<string | null>(
    null,
  );
  const [editorState, setEditorState] = React.useState<EditorState>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const persona = React.useMemo(
    () => personas.find((item) => item.id === personaId) ?? null,
    [personaId, personas],
  );

  const personaStats = persona ? statsByPersona[persona.id] : undefined;
  const assignedCustomers = React.useMemo(
    () => (persona ? getCustomersByPersona(persona.id) : []),
    [getCustomersByPersona, persona],
  );

  const filteredAssignedCustomers = React.useMemo(() => {
    const query = customerSearch.trim().toLowerCase();
    if (!query) {
      return assignedCustomers;
    }

    return assignedCustomers.filter((customer) => {
      const haystack = [customer.email, customer.first_name, customer.last_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [assignedCustomers, customerSearch]);

  const availableCustomers = React.useMemo(() => {
    if (!persona) {
      return [];
    }

    const query = customerPickerSearch.trim().toLowerCase();

    return customers.filter((customer) => {
      if (customer.assigned_persona_ids.includes(persona.id)) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [customer.email, customer.first_name, customer.last_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [customerPickerSearch, customers, persona]);

  const campaignsQuery = useQuery({
    queryKey: [
      "persona-campaigns",
      tenant?.id,
      personaId,
      persona?.is_custom ?? false,
    ],
    enabled: Boolean(tenant?.id && personaId && persona),
    queryFn: async () => {
      if (!tenant?.id || !personaId || !persona) {
        return [] as any[];
      }

      const { data: fieldCampaigns, error: fieldCampaignError } = await supabase
        .from("crm_campaigns")
        .select(CAMPAIGN_SELECT_FIELDS)
        .eq("tenant_id", tenant.id)
        .contains("persona_ids", [personaId])
        .order("created_at", { ascending: false })
        .limit(10);

      if (fieldCampaignError) {
        throw fieldCampaignError;
      }

      if (!persona.is_custom) {
        return fieldCampaigns ?? [];
      }

      const { data: campaignPersonaRows, error: campaignPersonaError } =
        await supabase
          .from("campaign_personas")
          .select("campaign_id")
          .eq("persona_id", persona.id);

      if (campaignPersonaError) {
        throw campaignPersonaError;
      }

      const seenCampaignIds = new Set(
        (fieldCampaigns ?? []).map((campaign) => campaign.id),
      );
      const missingCampaignIds = Array.from(
        new Set(
          (campaignPersonaRows ?? [])
            .map((row) => String(row.campaign_id ?? "").trim())
            .filter(Boolean)
            .filter((campaignId) => !seenCampaignIds.has(campaignId)),
        ),
      );

      if (missingCampaignIds.length === 0) {
        return fieldCampaigns ?? [];
      }

      const { data: joinCampaigns, error: joinCampaignError } = await supabase
        .from("crm_campaigns")
        .select(CAMPAIGN_SELECT_FIELDS)
        .eq("tenant_id", tenant.id)
        .in("id", missingCampaignIds);

      if (joinCampaignError) {
        throw joinCampaignError;
      }

      return [...(fieldCampaigns ?? []), ...(joinCampaigns ?? [])]
        .sort(sortCampaignsByCreatedAt)
        .slice(0, 10);
    },
  });

  const trendSeries = React.useMemo(
    () => buildTrendSeries(assignedCustomers),
    [assignedCustomers],
  );

  const engagementBreakdown = React.useMemo(() => {
    const high = assignedCustomers.filter((customer) =>
      personaStats?.customerIds.includes(customer.id) ? true : true,
    );

    return [
      {
        label: "High",
        value: high.filter(
          (customer) => (customer.email_engagement_score ?? 0) >= 70,
        ).length,
      },
      {
        label: "Medium",
        value: high.filter((customer) => {
          const score = customer.email_engagement_score ?? 0;
          return score >= 40 && score < 70;
        }).length,
      },
      {
        label: "Low",
        value: high.filter(
          (customer) => (customer.email_engagement_score ?? 0) < 40,
        ).length,
      },
    ];
  }, [assignedCustomers, personaStats?.customerIds]);

  const revenueShare = React.useMemo(() => {
    const personaRevenue = personaStats?.totalValue ?? 0;
    const remainder = Math.max(summary.totalCustomerValue - personaRevenue, 0);

    return [
      { label: persona?.persona_name ?? "Persona", value: personaRevenue },
      { label: "Rest of audience", value: remainder },
    ];
  }, [
    persona?.persona_name,
    personaStats?.totalValue,
    summary.totalCustomerValue,
  ]);

  const recommendations = React.useMemo(() => {
    if (!persona) {
      return [] as string[];
    }

    const nextSteps: string[] = [];

    if ((personaStats?.customerCount ?? 0) === 0) {
      nextSteps.push(
        "Start by assigning a few customers so this persona can build analytics and campaign history.",
      );
    }

    if ((personaStats?.averageEngagement ?? 0) < 45) {
      nextSteps.push(
        "Lead with education-first content before moving into product-heavy offers.",
      );
    }

    if ((personaStats?.averageValue ?? 0) > 120) {
      nextSteps.push(
        "This audience is a good fit for premium seasonal bundles and concierge-style recommendations.",
      );
    }

    if (personaStats?.topChannel) {
      nextSteps.push(
        `Lean into ${personaStats.topChannel} because that is currently the strongest channel signal for this persona.`,
      );
    }

    return nextSteps.slice(0, 3);
  }, [persona, personaStats]);

  const emoji = persona ? getPersonaEmoji(persona) : "🎯";

  const handleEditorSave = React.useCallback(
    async (payload: {
      name: string;
      description?: string | null;
      metadata?: PersonaRecord["metadata"];
    }) => {
      if (!persona) {
        return null;
      }

      const result =
        editorState?.mode === "duplicate"
          ? await createPersona(payload)
          : await updatePersona({ id: persona.id, ...payload });

      if (result) {
        setEditorState(null);

        if (editorState?.mode === "duplicate") {
          navigate(`/crm/personas/${encodeURIComponent(result.id)}`);
        }
      }

      return result;
    },
    [createPersona, editorState?.mode, navigate, persona, updatePersona],
  );

  if ((loading || metricsLoading || customersLoading) && !persona) {
    return <PersonaDetailSkeleton />;
  }

  if (!persona) {
    return (
      <PageContainer>
        <Sheet
          variant="plain"
          sx={{
            borderRadius: "var(--joy-radius-2xl)",
            border: "1px solid",
            borderColor: "neutral.200",
            backgroundColor: "background.surface",
            px: 4,
            py: 6,
            textAlign: "center",
          }}
        >
          <Stack spacing={1.5} alignItems="center">
            <Typography level="title-lg">Persona not found</Typography>
            <Typography level="body-sm" color="neutral">
              This persona no longer exists or is not available in the current
              tenant.
            </Typography>
            <JoyButton
              variant="plain"
              color="primary"
              startDecorator={<ArrowLeft size={16} />}
              onClick={() => navigate("/crm/personas")}
            >
              Back to personas
            </JoyButton>
          </Stack>
        </Sheet>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Stack spacing={3} sx={{ pb: 4 }}>
        <JoyPageHeaderBand
          title={persona.persona_name}
          description={persona.persona_description}
          metadata={
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <JoyChip size="sm" variant="outlined" color="neutral">
                {persona.is_custom ? "Custom persona" : "System persona"}
              </JoyChip>
              <Typography level="body-xs" color="neutral">
                {personaStats?.customerCount ?? 0} customers
              </Typography>
              {personaStats?.topChannel ? (
                <Typography level="body-xs" color="neutral">
                  {personaStats.topChannel}
                </Typography>
              ) : null}
            </Stack>
          }
          actions={
            <>
              <JoyButton
                variant="plain"
                color="neutral"
                onClick={() => navigate("/crm/personas")}
                startDecorator={<ArrowLeft size={16} />}
              >
                Back
              </JoyButton>
              <JoyButton
                onClick={() =>
                  navigate(
                    `/crm/campaigns/new?persona=${encodeURIComponent(persona.id)}`,
                  )
                }
                startDecorator={<Mail size={16} />}
              >
                Create campaign
              </JoyButton>
            </>
          }
          sx={{
            px: 0,
            py: 0,
            borderRadius: 0,
            background: "transparent",
          }}
        />

        <Sheet
          variant="plain"
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              md: "repeat(3, minmax(0, 1fr))",
            },
            gap: 2,
          }}
        >
          <JoyCard>
            <JoyCardHeader title="Assigned customers" />
            <JoyCardContent>
              <Typography level="h2">
                {personaStats?.customerCount ?? 0}
              </Typography>
            </JoyCardContent>
          </JoyCard>
          <JoyCard>
            <JoyCardHeader title="Average engagement" />
            <JoyCardContent>
              <Typography level="h2">
                {personaStats?.averageEngagement ?? 0}%
              </Typography>
            </JoyCardContent>
          </JoyCard>
          <JoyCard>
            <JoyCardHeader title="Average customer value" />
            <JoyCardContent>
              <Typography level="h2">
                {currency.format(personaStats?.averageValue ?? 0)}
              </Typography>
            </JoyCardContent>
          </JoyCard>
        </Sheet>

        <JoyTabs defaultValue={0}>
          <JoyTabsList
            disableUnderline
            sx={{
              p: 0,
              gap: 2,
              border: "none",
              borderBottom: "1px solid",
              borderColor: "neutral.200",
              backgroundColor: "transparent",
              boxShadow: "none",
              borderRadius: 0,
            }}
          >
            <JoyTabsTrigger value={0} sx={PERSONA_DETAIL_TAB_SX}>
              Overview
            </JoyTabsTrigger>
            <JoyTabsTrigger value={1} sx={PERSONA_DETAIL_TAB_SX}>
              Customers
            </JoyTabsTrigger>
            <JoyTabsTrigger value={2} sx={PERSONA_DETAIL_TAB_SX}>
              Analytics
            </JoyTabsTrigger>
            <JoyTabsTrigger value={3} sx={PERSONA_DETAIL_TAB_SX}>
              Settings
            </JoyTabsTrigger>
          </JoyTabsList>

          <JoyTabsContent value={0}>
            <Stack spacing={2.5}>
              <JoyCard>
                <JoyCardHeader
                  title="Persona snapshot"
                  description="Key CRM signals and positioning details for this audience."
                  startDecorator={
                    <Sheet
                      variant="soft"
                      color="neutral"
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: "999px",
                        display: "grid",
                        placeItems: "center",
                        fontSize: "1.5rem",
                      }}
                    >
                      {emoji}
                    </Sheet>
                  }
                />
                <JoyCardContent sx={{ display: "grid", gap: 2 }}>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    {persona.metadata?.demographics?.ageRange ? (
                      <JoyChip size="sm" variant="outlined" color="neutral">
                        {persona.metadata.demographics.ageRange}
                      </JoyChip>
                    ) : null}
                    {persona.metadata?.demographics?.incomeRange ? (
                      <JoyChip size="sm" variant="outlined" color="neutral">
                        {persona.metadata.demographics.incomeRange}
                      </JoyChip>
                    ) : null}
                    {persona.metadata?.demographics?.locationType ? (
                      <JoyChip size="sm" variant="outlined" color="neutral">
                        {persona.metadata.demographics.locationType}
                      </JoyChip>
                    ) : null}
                    {persona.metadata?.behavior?.preferredChannel ? (
                      <JoyChip size="sm" variant="outlined" color="neutral">
                        {persona.metadata.behavior.preferredChannel}
                      </JoyChip>
                    ) : null}
                    {persona.metadata?.communication?.preferredTone ? (
                      <JoyChip size="sm" variant="outlined" color="neutral">
                        {persona.metadata.communication.preferredTone}
                      </JoyChip>
                    ) : null}
                  </Stack>

                  {persona.metadata?.communication?.interests?.length ? (
                    <Stack spacing={0.75}>
                      <Typography level="body-sm" fontWeight="lg">
                        Topics of interest
                      </Typography>
                      <Stack
                        direction="row"
                        spacing={1}
                        useFlexGap
                        flexWrap="wrap"
                      >
                        {persona.metadata.communication.interests.map(
                          (interest) => (
                            <JoyChip
                              key={interest}
                              size="sm"
                              variant="outlined"
                              color="neutral"
                            >
                              {interest}
                            </JoyChip>
                          ),
                        )}
                      </Stack>
                    </Stack>
                  ) : null}

                  {persona.metadata?.communication?.avoidTopics?.length ? (
                    <Stack spacing={0.75}>
                      <Typography level="body-sm" fontWeight="lg">
                        Topics to avoid
                      </Typography>
                      <Stack
                        direction="row"
                        spacing={1}
                        useFlexGap
                        flexWrap="wrap"
                      >
                        {persona.metadata.communication.avoidTopics.map(
                          (topic) => (
                            <JoyChip
                              key={topic}
                              size="sm"
                              variant="outlined"
                              color="neutral"
                            >
                              {topic}
                            </JoyChip>
                          ),
                        )}
                      </Stack>
                    </Stack>
                  ) : null}
                </JoyCardContent>
              </JoyCard>

              <Sheet
                variant="plain"
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    md: "repeat(3, minmax(0, 1fr))",
                  },
                  gap: 2,
                }}
              >
                {recommendations.map((recommendation) => (
                  <JoyCard key={recommendation}>
                    <JoyCardContent>
                      <Typography level="body-sm">{recommendation}</Typography>
                    </JoyCardContent>
                  </JoyCard>
                ))}
              </Sheet>
            </Stack>
          </JoyTabsContent>

          <JoyTabsContent value={1}>
            <Stack spacing={2}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={1}
                justifyContent="space-between"
                alignItems={{ md: "center" }}
              >
                <Box sx={{ minWidth: { xs: "100%", md: 320 } }}>
                  <JoySearchInput
                    value={customerSearch}
                    placeholder="Search assigned customers"
                    onDebouncedChange={setCustomerSearch}
                    onClear={() => setCustomerSearch("")}
                  />
                </Box>
                <JoyButton
                  variant="plain"
                  color="primary"
                  startDecorator={<Plus size={16} />}
                  onClick={() => setAssignDrawerOpen(true)}
                >
                  Add customers
                </JoyButton>
              </Stack>

              <JoyCard>
                <JoyCardHeader
                  title="Assigned customers"
                  description="Add or remove customers without leaving the persona detail view."
                />
                <JoyCardContent sx={{ pt: 2 }}>
                  {filteredAssignedCustomers.length === 0 ? (
                    <Sheet
                      variant="plain"
                      sx={{
                        borderRadius: "var(--joy-radius-xl)",
                        border: "1px solid",
                        borderColor: "neutral.200",
                        backgroundColor: "background.surface",
                        px: 3,
                        py: 4,
                        textAlign: "center",
                      }}
                    >
                      <Typography level="body-sm" color="neutral">
                        No customers are currently assigned to this persona.
                      </Typography>
                    </Sheet>
                  ) : (
                    <JoyTable>
                      <JoyTableHead>
                        <JoyTableRow>
                          <JoyTableHeaderCell>Customer</JoyTableHeaderCell>
                          <JoyTableHeaderCell>Email</JoyTableHeaderCell>
                          <JoyTableHeaderCell>Last purchase</JoyTableHeaderCell>
                          <JoyTableHeaderCell align="right">
                            Actions
                          </JoyTableHeaderCell>
                        </JoyTableRow>
                      </JoyTableHead>
                      <JoyTableBody>
                        {filteredAssignedCustomers.map((customer) => (
                          <JoyTableRow key={customer.id}>
                            <JoyTableCell>
                              {getCustomerDisplayName(customer)}
                            </JoyTableCell>
                            <JoyTableCell>{customer.email}</JoyTableCell>
                            <JoyTableCell>
                              {customer.last_purchase_date
                                ? new Date(
                                    customer.last_purchase_date,
                                  ).toLocaleDateString()
                                : "No purchase yet"}
                            </JoyTableCell>
                            <JoyTableCell align="right">
                              <JoyButton
                                variant="plain"
                                color="danger"
                                loading={busyCustomerId === customer.id}
                                onClick={async () => {
                                  setBusyCustomerId(customer.id);
                                  await removeSpecificPersonaFromCustomer(
                                    customer.id,
                                    persona.id,
                                  );
                                  setBusyCustomerId(null);
                                }}
                              >
                                Remove
                              </JoyButton>
                            </JoyTableCell>
                          </JoyTableRow>
                        ))}
                      </JoyTableBody>
                    </JoyTable>
                  )}
                </JoyCardContent>
              </JoyCard>
            </Stack>
          </JoyTabsContent>

          <JoyTabsContent value={2}>
            <Stack spacing={2.5}>
              <Sheet
                variant="plain"
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    xl: "repeat(2, minmax(0, 1fr))",
                  },
                  gap: 2,
                }}
              >
                <JoyCard>
                  <JoyCardHeader
                    title="Customer growth"
                    description="Cumulative customer growth based on customer creation dates."
                  />
                  <JoyCardContent sx={{ height: 280, pt: 2 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendSeries}>
                        <CartesianGrid
                          stroke="var(--joy-palette-neutral-200)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="label"
                          tick={{
                            fill: "var(--joy-palette-neutral-500)",
                            fontSize: 12,
                          }}
                        />
                        <YAxis
                          tick={{
                            fill: "var(--joy-palette-neutral-500)",
                            fontSize: 12,
                          }}
                        />
                        <Tooltip />
                        <Area
                          type="monotone"
                          dataKey="customers"
                          stroke="var(--joy-palette-primary-500)"
                          fill="rgba(var(--joy-palette-primary-mainChannel) / 0.08)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </JoyCardContent>
                </JoyCard>

                <JoyCard>
                  <JoyCardHeader
                    title="Engagement mix"
                    description="A quick look at the quality of the audience assigned to this persona."
                  />
                  <JoyCardContent sx={{ height: 280, pt: 2 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={engagementBreakdown}>
                        <CartesianGrid
                          stroke="var(--joy-palette-neutral-200)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="label"
                          tick={{
                            fill: "var(--joy-palette-neutral-500)",
                            fontSize: 12,
                          }}
                        />
                        <YAxis
                          tick={{
                            fill: "var(--joy-palette-neutral-500)",
                            fontSize: 12,
                          }}
                        />
                        <Tooltip />
                        <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                          {engagementBreakdown.map((entry, index) => (
                            <Cell
                              key={entry.label}
                              fill={CHART_COLORS[index]}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </JoyCardContent>
                </JoyCard>
              </Sheet>

              <Sheet
                variant="plain"
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    xl: "minmax(0, 360px) minmax(0, 1fr)",
                  },
                  gap: 2,
                }}
              >
                <JoyCard>
                  <JoyCardHeader
                    title="Revenue contribution"
                    description="Current persona value against the rest of the customer base."
                  />
                  <JoyCardContent sx={{ height: 280, pt: 2 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={revenueShare}
                          dataKey="value"
                          nameKey="label"
                          innerRadius={56}
                          outerRadius={88}
                          paddingAngle={4}
                        >
                          {revenueShare.map((entry, index) => (
                            <Cell
                              key={entry.label}
                              fill={
                                index === 0
                                  ? "var(--joy-palette-primary-500)"
                                  : "var(--joy-palette-neutral-200)"
                              }
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => currency.format(value)}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </JoyCardContent>
                </JoyCard>

                <JoyCard>
                  <JoyCardHeader
                    title="Campaign performance"
                    description="Campaigns currently targeting this persona."
                  />
                  <JoyCardContent sx={{ pt: 2 }}>
                    {campaignsQuery.data?.length ? (
                      <JoyTable>
                        <JoyTableHead>
                          <JoyTableRow>
                            <JoyTableHeaderCell>Campaign</JoyTableHeaderCell>
                            <JoyTableHeaderCell>Status</JoyTableHeaderCell>
                            <JoyTableHeaderCell>Sent</JoyTableHeaderCell>
                            <JoyTableHeaderCell>Open rate</JoyTableHeaderCell>
                            <JoyTableHeaderCell>Revenue</JoyTableHeaderCell>
                          </JoyTableRow>
                        </JoyTableHead>
                        <JoyTableBody>
                          {campaignsQuery.data.map((campaign) => (
                            <JoyTableRow key={campaign.id}>
                              <JoyTableCell>{campaign.name}</JoyTableCell>
                              <JoyTableCell>
                                {campaign.status ?? "draft"}
                              </JoyTableCell>
                              <JoyTableCell>
                                {campaign.total_sent ?? 0}
                              </JoyTableCell>
                              <JoyTableCell>
                                {campaign.open_rate
                                  ? `${Math.round(campaign.open_rate)}%`
                                  : "-"}
                              </JoyTableCell>
                              <JoyTableCell>
                                {currency.format(
                                  extractCampaignRevenue(campaign),
                                )}
                              </JoyTableCell>
                            </JoyTableRow>
                          ))}
                        </JoyTableBody>
                      </JoyTable>
                    ) : (
                      <Sheet
                        variant="plain"
                        sx={{
                          borderRadius: "var(--joy-radius-xl)",
                          border: "1px solid",
                          borderColor: "neutral.200",
                          backgroundColor: "background.surface",
                          px: 3,
                          py: 4,
                          textAlign: "center",
                        }}
                      >
                        <Typography level="body-sm" color="neutral">
                          No campaigns are currently targeting this persona.
                        </Typography>
                      </Sheet>
                    )}
                  </JoyCardContent>
                </JoyCard>
              </Sheet>
            </Stack>
          </JoyTabsContent>

          <JoyTabsContent value={3}>
            <Stack spacing={2}>
              {persona.is_custom ? (
                <JoyCard>
                  <JoyCardHeader
                    title="Custom persona settings"
                    description="Keep the persona definition accurate as the audience evolves."
                  />
                  <JoyCardContent
                    sx={{ display: "flex", flexDirection: "column", gap: 2 }}
                  >
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <JoyButton
                        variant="plain"
                        color="neutral"
                        startDecorator={<Pencil size={16} />}
                        onClick={() =>
                          setEditorState({
                            mode: "edit",
                            title: `Edit ${persona.persona_name}`,
                            submitLabel: "Update persona",
                            initialValue: toInitialValue(persona),
                          })
                        }
                      >
                        Edit persona
                      </JoyButton>
                      <JoyButton
                        variant="plain"
                        color="neutral"
                        startDecorator={<Copy size={16} />}
                        onClick={() =>
                          setEditorState({
                            mode: "duplicate",
                            title: `Duplicate ${persona.persona_name}`,
                            submitLabel: "Create duplicate",
                            initialValue: {
                              ...toInitialValue(persona),
                              name: `${persona.persona_name} Copy`,
                            },
                          })
                        }
                      >
                        Duplicate
                      </JoyButton>
                      <JoyButton
                        variant="plain"
                        color="danger"
                        startDecorator={<Trash2 size={16} />}
                        onClick={() => setDeleteOpen(true)}
                      >
                        Delete persona
                      </JoyButton>
                    </Stack>
                    <Typography level="body-sm" color="neutral">
                      Deleting this persona removes it from the catalog and
                      clears its explicit customer assignments. Historic
                      campaigns remain visible in reporting.
                    </Typography>
                  </JoyCardContent>
                </JoyCard>
              ) : (
                <JoyCard>
                  <JoyCardHeader
                    title="System persona"
                    description="System personas are curated defaults. Use them as-is or create a custom copy if you need a tenant-specific variation."
                  />
                  <JoyCardContent>
                    <JoyButton
                      variant="plain"
                      color="primary"
                      startDecorator={<Copy size={16} />}
                      onClick={() =>
                        setEditorState({
                          mode: "duplicate",
                          title: `Create a custom version of ${persona.persona_name}`,
                          submitLabel: "Create custom persona",
                          initialValue: {
                            ...toInitialValue(persona),
                            name: `${persona.persona_name} Copy`,
                          },
                        })
                      }
                    >
                      Create custom copy
                    </JoyButton>
                  </JoyCardContent>
                </JoyCard>
              )}
            </Stack>
          </JoyTabsContent>
        </JoyTabs>

        <JoyDrawer
          open={assignDrawerOpen}
          onClose={() => setAssignDrawerOpen(false)}
          title={`Assign customers to ${persona.persona_name}`}
          description="Search your customer base and add people to this persona without leaving the detail page."
          size="md"
        >
          <Stack spacing={2}>
            <JoySearchInput
              value={customerPickerSearch}
              placeholder="Search available customers"
              onDebouncedChange={setCustomerPickerSearch}
              onClear={() => setCustomerPickerSearch("")}
            />
            <Divider />
            <Stack spacing={1.25}>
              {availableCustomers.slice(0, 20).map((customer) => (
                <Sheet
                  key={customer.id}
                  variant="plain"
                  sx={{
                    borderRadius: "var(--joy-radius-xl)",
                    border: "1px solid",
                    borderColor: "neutral.200",
                    backgroundColor: "background.surface",
                    px: 2,
                    py: 1.5,
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={1.5}
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                      <Typography level="body-sm" fontWeight="lg">
                        {getCustomerDisplayName(customer)}
                      </Typography>
                      <Typography level="body-xs" color="neutral">
                        {customer.email}
                      </Typography>
                    </Stack>
                    <JoyButton
                      size="sm"
                      variant="plain"
                      color="primary"
                      loading={busyCustomerId === customer.id}
                      onClick={async () => {
                        setBusyCustomerId(customer.id);
                        const success = await assignPersonaToCustomer(
                          customer.id,
                          persona.id,
                        );
                        setBusyCustomerId(null);
                        if (success) {
                          setAssignDrawerOpen(false);
                        }
                      }}
                    >
                      Assign
                    </JoyButton>
                  </Stack>
                </Sheet>
              ))}
              {availableCustomers.length === 0 ? (
                <Sheet
                  variant="plain"
                  sx={{
                    borderRadius: "var(--joy-radius-xl)",
                    border: "1px solid",
                    borderColor: "neutral.200",
                    backgroundColor: "background.surface",
                    px: 3,
                    py: 4,
                    textAlign: "center",
                  }}
                >
                  <Typography level="body-sm" color="neutral">
                    Every visible customer is already assigned to this persona.
                  </Typography>
                </Sheet>
              ) : null}
            </Stack>
          </Stack>
        </JoyDrawer>

        <CustomPersonaModal
          open={Boolean(editorState)}
          onSave={handleEditorSave}
          onCancel={() => setEditorState(null)}
          title={editorState?.title}
          submitLabel={editorState?.submitLabel}
          initialValue={editorState?.initialValue}
        />

        <JoyAlertDialog
          open={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          onConfirm={async () => {
            const success = await deletePersona(persona.id);
            if (success) {
              navigate("/crm/personas");
            }
          }}
          title={`Delete ${persona.persona_name}?`}
          description="This removes the custom persona and its explicit customer assignments."
          confirmLabel="Delete persona"
          variant="danger"
        />
      </Stack>
    </PageContainer>
  );
}
