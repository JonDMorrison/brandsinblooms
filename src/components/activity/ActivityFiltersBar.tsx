import React from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Divider from "@mui/joy/Divider";
import IconButton from "@mui/joy/IconButton";
import Input from "@mui/joy/Input";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronDown, Filter, RotateCcw, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { formatActivityLabel } from "@/components/activity/activityPresentation";
import { SegmentPicker } from "@/components/crm/segments/SegmentPicker";
import { JoyAutocomplete } from "@/components/joy/JoyAutocomplete";
import { JoyChip } from "@/components/joy/JoyChip";
import { JoySearchInput } from "@/components/joy/JoySearchInput";
import { useAllPersonas } from "@/hooks/useAllPersonas";
import { useAsyncAutocomplete } from "@/hooks/useAsyncAutocomplete";
import { useSegments } from "@/hooks/useSegments";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { parseCsvParam, parseDateParam, toCsvParam } from "@/lib/activityUtils";

const STATUS_OPTIONS = ["success", "failed", "pending", "warning"] as const;
const ACTOR_OPTIONS = ["user", "automation", "integration", "system"] as const;
const SOURCE_OPTIONS = ["ui", "automation", "webhook", "sync"] as const;

const QUICK_ACTIVITY_FILTERS = [
  { label: "All", value: null },
  { label: "Customer", value: "customer.*" },
  { label: "Campaign", value: "campaign.*" },
  { label: "Automation", value: "automation.*" },
  { label: "Integration", value: "integration.*" },
] as const;

const FILTER_PARAM_KEYS = [
  "customer",
  "q",
  "status",
  "actor",
  "source",
  "type",
  "start",
  "end",
  "segment",
  "persona",
] as const;

type CustomerOption = {
  id: string;
  label: string;
  subtitle: string;
};

type PersonaOption = {
  id: string;
  label: string;
  subtitle?: string;
};

function updateParam(
  params: URLSearchParams,
  key: string,
  value: string | null,
) {
  if (value === null || value === "") params.delete(key);
  else params.set(key, value);
}

function toCustomerOption(row: Record<string, unknown>): CustomerOption {
  const firstName = String(row.first_name ?? "").trim();
  const lastName = String(row.last_name ?? "").trim();
  const email = String(row.email ?? "").trim();
  const label = `${firstName} ${lastName}`.trim() || email || "Customer";

  return {
    id: String(row.id),
    label,
    subtitle: email,
  };
}

function toDateInputValue(value?: Date | null) {
  if (!value) {
    return "";
  }

  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function startOfDayIso(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function endOfDayIso(dateValue: string) {
  const date = new Date(`${dateValue}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatDateLabel(value?: Date | null) {
  if (!value) {
    return "";
  }

  return value.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function FilterPill({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <JoyChip
      size="sm"
      variant="soft"
      color="neutral"
      endDecorator={
        <IconButton
          size="sm"
          variant="plain"
          color="neutral"
          onClick={onRemove}
          onMouseDown={(event) => event.preventDefault()}
          sx={{
            width: 20,
            height: 20,
            minWidth: 20,
            minHeight: 20,
            borderRadius: "999px",
          }}
        >
          <X size={12} />
        </IconButton>
      }
      sx={{ pr: 0.25 }}
    >
      {label}
    </JoyChip>
  );
}

export interface ActivityFiltersBarProps {
  className?: string;
}

export function ActivityFiltersBar({}: ActivityFiltersBarProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { tenant } = useTenant();

  const customerId = searchParams.get("customer");
  const search = searchParams.get("q") ?? "";
  const status = parseCsvParam(searchParams.get("status"));
  const actor = parseCsvParam(searchParams.get("actor"));
  const source = parseCsvParam(searchParams.get("source"));
  const type = parseCsvParam(searchParams.get("type"));
  const segmentIds = parseCsvParam(searchParams.get("segment"));
  const personaIds = parseCsvParam(searchParams.get("persona"));
  const start = parseDateParam(searchParams.get("start"));
  const end = parseDateParam(searchParams.get("end"));
  const group = searchParams.get("group") ?? "campaign";
  const { allSegments } = useSegments();
  const { personas: allPersonas, loading: personasLoading } = useAllPersonas();

  const [advancedOpen, setAdvancedOpen] = React.useState(
    Boolean(
      customerId ||
      status.length ||
      actor.length ||
      source.length ||
      type.length ||
      segmentIds.length ||
      personaIds.length ||
      start ||
      end,
    ),
  );
  const [customerQuery, setCustomerQuery] = React.useState("");
  const [activityTypeQuery, setActivityTypeQuery] = React.useState("");

  React.useEffect(() => {
    if (
      customerId ||
      status.length ||
      actor.length ||
      source.length ||
      type.length ||
      segmentIds.length ||
      personaIds.length ||
      start ||
      end
    ) {
      setAdvancedOpen(true);
    }
  }, [
    actor.length,
    customerId,
    end,
    personaIds.length,
    segmentIds.length,
    source.length,
    start,
    status.length,
    type.length,
  ]);

  const personaOptions = React.useMemo<PersonaOption[]>(
    () =>
      [...allPersonas]
        .map((persona) => ({
          id: persona.id,
          label: persona.persona_name,
          subtitle: persona.persona_description ?? undefined,
        }))
        .sort((left, right) => left.label.localeCompare(right.label)),
    [allPersonas],
  );

  const setParams = (updater: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams);
    updater(next);
    setSearchParams(next, { replace: true });
  };

  const setCsvParam = (key: string, values: string[]) => {
    setParams((params) => {
      updateParam(params, key, toCsvParam(values));
    });
  };

  const removeCsv = (key: string, value: string) => {
    setParams((params) => {
      const existing = parseCsvParam(params.get(key));
      updateParam(
        params,
        key,
        toCsvParam(existing.filter((item) => item !== value)),
      );
    });
  };

  const { data: selectedCustomer } = useQuery({
    queryKey: ["activity-filter-customer", customerId],
    enabled: Boolean(customerId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_customers")
        .select("id, first_name, last_name, email")
        .eq("id", customerId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data ? toCustomerOption(data as Record<string, unknown>) : null;
    },
  });

  const customerInitialOptions = React.useMemo(
    () => (selectedCustomer ? [selectedCustomer] : []),
    [selectedCustomer],
  );

  const loadCustomerOptions = React.useCallback(
    async (query: string) => {
      if (!tenant?.id) {
        return [];
      }

      const term = query.trim();
      let request = supabase
        .from("crm_customers")
        .select("id, first_name, last_name, email")
        .eq("tenant_id", tenant.id)
        .order("updated_at", { ascending: false })
        .limit(12);

      if (term) {
        request = request.or(
          `first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%`,
        );
      }

      const { data, error } = await request;

      if (error) {
        throw error;
      }

      return (data ?? []).map((row) =>
        toCustomerOption(row as Record<string, unknown>),
      );
    },
    [tenant?.id],
  );

  const customerLookup = useAsyncAutocomplete<CustomerOption>({
    query: customerQuery,
    enabled: Boolean(tenant?.id && advancedOpen),
    debounceMs: 250,
    minQueryLength: 0,
    initialOptions: customerInitialOptions,
    loadOptions: loadCustomerOptions,
  });

  const activityTypeInitialOptions = React.useMemo(() => type, [type]);

  const loadActivityTypeOptions = React.useCallback(
    async (query: string) => {
      if (!tenant?.id) {
        return activityTypeInitialOptions;
      }

      const { data, error } = await supabase
        .from("crm_activity_events")
        .select("activity_type")
        .eq("tenant_id", tenant.id)
        .order("timestamp", { ascending: false })
        .limit(query.trim() ? 120 : 50);

      if (error) {
        throw error;
      }

      const normalizedQuery = query.trim().toLowerCase();
      const unique = new Set<string>(activityTypeInitialOptions);

      for (const row of data ?? []) {
        const value = String(
          (row as Record<string, unknown>).activity_type ?? "",
        ).trim();

        if (!value) {
          continue;
        }

        if (normalizedQuery && !value.toLowerCase().includes(normalizedQuery)) {
          continue;
        }

        unique.add(value);
      }

      return Array.from(unique).sort((left, right) =>
        left.localeCompare(right),
      );
    },
    [activityTypeInitialOptions, tenant?.id],
  );

  const activityTypeLookup = useAsyncAutocomplete<string>({
    query: activityTypeQuery,
    enabled: Boolean(tenant?.id && advancedOpen),
    debounceMs: 250,
    minQueryLength: 0,
    initialOptions: activityTypeInitialOptions,
    loadOptions: loadActivityTypeOptions,
  });

  const customerOptions = React.useMemo(() => {
    const next = new Map<string, CustomerOption>();

    if (selectedCustomer) {
      next.set(selectedCustomer.id, selectedCustomer);
    }

    for (const option of customerLookup.options) {
      next.set(option.id, option);
    }

    return Array.from(next.values());
  }, [customerLookup.options, selectedCustomer]);

  const selectedCustomerOption =
    customerOptions.find((option) => option.id === customerId) ??
    selectedCustomer ??
    null;

  const selectedActivityTypes = React.useMemo(
    () =>
      Array.from(new Set([...type, ...activityTypeLookup.options])).sort(
        (left, right) => left.localeCompare(right),
      ),
    [activityTypeLookup.options, type],
  );

  const quickFilterValue =
    type.length === 1 &&
    QUICK_ACTIVITY_FILTERS.some((filter) => filter.value === type[0])
      ? type[0]
      : null;

  const segmentLabelMap = React.useMemo(
    () => new Map(allSegments.map((segment) => [segment.id, segment.name])),
    [allSegments],
  );

  const personaLabelMap = React.useMemo(
    () => new Map(personaOptions.map((persona) => [persona.id, persona.label])),
    [personaOptions],
  );

  const selectedPersonaOptions = React.useMemo(
    () => personaOptions.filter((persona) => personaIds.includes(persona.id)),
    [personaIds, personaOptions],
  );

  const activeCount =
    (customerId ? 1 : 0) +
    (search ? 1 : 0) +
    status.length +
    actor.length +
    source.length +
    type.length +
    segmentIds.length +
    personaIds.length +
    (start ? 1 : 0) +
    (end ? 1 : 0);

  const clearAllFilters = () => {
    const next = new URLSearchParams(searchParams);
    for (const key of FILTER_PARAM_KEYS) {
      next.delete(key);
    }
    setSearchParams(next, { replace: true });
  };

  const setQuickFilter = (value: string | null) => {
    setParams((params) => {
      updateParam(params, "type", value ? toCsvParam([value]) : null);
    });
  };

  const activePills: Array<{
    key: string;
    label: string;
    onRemove: () => void;
  }> = [];

  if (search) {
    activePills.push({
      key: "search",
      label: `Search: ${search}`,
      onRemove: () => setParams((params) => updateParam(params, "q", null)),
    });
  }

  if (selectedCustomerOption) {
    activePills.push({
      key: "customer",
      label: `Customer: ${selectedCustomerOption.label}`,
      onRemove: () =>
        setParams((params) => updateParam(params, "customer", null)),
    });
  }

  for (const value of status) {
    activePills.push({
      key: `status:${value}`,
      label: `Status: ${formatActivityLabel(value)}`,
      onRemove: () => removeCsv("status", value),
    });
  }

  for (const value of actor) {
    activePills.push({
      key: `actor:${value}`,
      label: `Actor: ${formatActivityLabel(value)}`,
      onRemove: () => removeCsv("actor", value),
    });
  }

  for (const value of source) {
    activePills.push({
      key: `source:${value}`,
      label: `Source: ${formatActivityLabel(value)}`,
      onRemove: () => removeCsv("source", value),
    });
  }

  for (const value of type) {
    activePills.push({
      key: `type:${value}`,
      label: `Type: ${value}`,
      onRemove: () => removeCsv("type", value),
    });
  }

  for (const value of segmentIds) {
    activePills.push({
      key: `segment:${value}`,
      label: `Segment: ${segmentLabelMap.get(value) ?? value}`,
      onRemove: () => removeCsv("segment", value),
    });
  }

  for (const value of personaIds) {
    activePills.push({
      key: `persona:${value}`,
      label: `Persona: ${personaLabelMap.get(value) ?? value}`,
      onRemove: () => removeCsv("persona", value),
    });
  }

  if (start) {
    activePills.push({
      key: "start",
      label: `From: ${formatDateLabel(start)}`,
      onRemove: () => setParams((params) => updateParam(params, "start", null)),
    });
  }

  if (end) {
    activePills.push({
      key: "end",
      label: `To: ${formatDateLabel(end)}`,
      onRemove: () => setParams((params) => updateParam(params, "end", null)),
    });
  }

  return (
    <Stack
      spacing={2}
      sx={{
        position: "sticky",
        top: 16,
        zIndex: 20,
        py: { xs: 1.5, md: 1.75 },
        borderBottom: "1px solid",
        borderColor: "neutral.200",
        backgroundColor: "rgba(255, 255, 255, 0.94)",
        backdropFilter: "blur(18px)",
      }}
    >
      <Stack
        direction={{ xs: "column", lg: "row" }}
        spacing={1.5}
        alignItems={{ xs: "stretch", lg: "center" }}
        justifyContent="space-between"
      >
        <Stack
          direction="row"
          spacing={1.25}
          alignItems="center"
          useFlexGap
          flexWrap="wrap"
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <Filter size={16} />
            <Typography level="title-sm">Filters</Typography>
            {activeCount ? (
              <JoyChip size="sm" variant="soft" color="primary">
                {activeCount}
              </JoyChip>
            ) : null}
          </Stack>

          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.5,
              p: 0.5,
              borderRadius: "999px",
              border: "1px solid",
              borderColor: "neutral.200",
              backgroundColor: "background.surface",
            }}
          >
            <Button
              size="sm"
              variant={group === "campaign" ? "solid" : "plain"}
              color={group === "campaign" ? "primary" : "neutral"}
              sx={{ borderRadius: "999px" }}
              onClick={() =>
                setParams((params) => updateParam(params, "group", "campaign"))
              }
            >
              Group by campaign
            </Button>
            <Button
              size="sm"
              variant={group === "none" ? "solid" : "plain"}
              color={group === "none" ? "primary" : "neutral"}
              sx={{ borderRadius: "999px" }}
              onClick={() =>
                setParams((params) => updateParam(params, "group", "none"))
              }
            >
              Ungrouped
            </Button>
          </Box>
        </Stack>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          alignItems={{ sm: "center" }}
        >
          <Box sx={{ minWidth: { xs: "100%", sm: 320 }, flex: 1 }}>
            <JoySearchInput
              value={search}
              placeholder="Search activity by title, type, or customer"
              onDebouncedChange={(value) => {
                setParams((params) => updateParam(params, "q", value || null));
              }}
              onClear={() =>
                setParams((params) => updateParam(params, "q", null))
              }
            />
          </Box>
          <Button
            size="sm"
            variant={advancedOpen ? "solid" : "soft"}
            color={advancedOpen ? "primary" : "neutral"}
            startDecorator={<Filter size={14} />}
            endDecorator={<ChevronDown size={14} />}
            onClick={() => setAdvancedOpen((current) => !current)}
            sx={{ borderRadius: "999px", whiteSpace: "nowrap" }}
          >
            More filters
          </Button>
          {activeCount ? (
            <Button
              size="sm"
              variant="plain"
              color="neutral"
              startDecorator={<RotateCcw size={14} />}
              onClick={clearAllFilters}
              sx={{ borderRadius: "999px", whiteSpace: "nowrap" }}
            >
              Clear all
            </Button>
          ) : null}
        </Stack>
      </Stack>

      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        {QUICK_ACTIVITY_FILTERS.map((filter) => {
          const isActive =
            filter.value === null
              ? type.length === 0
              : quickFilterValue === filter.value;

          return (
            <Button
              key={filter.label}
              size="sm"
              variant={isActive ? "solid" : "soft"}
              color={isActive ? "primary" : "neutral"}
              onClick={() => setQuickFilter(filter.value)}
              sx={{ borderRadius: "999px" }}
            >
              {filter.label}
            </Button>
          );
        })}
      </Stack>

      <Box
        sx={{
          display: "grid",
          gridTemplateRows: advancedOpen ? "1fr" : "0fr",
          transition: "grid-template-rows 180ms ease",
        }}
      >
        <Box sx={{ overflow: "hidden" }}>
          {advancedOpen ? (
            <Stack spacing={2}>
              <Divider />
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    md: "repeat(2, minmax(0, 1fr))",
                    xl: "repeat(3, minmax(0, 1fr))",
                  },
                  gap: 1.5,
                }}
              >
                <JoyAutocomplete<CustomerOption, false, false, false>
                  label="Customer"
                  placeholder="Any customer"
                  options={customerOptions}
                  value={selectedCustomerOption}
                  loading={customerLookup.loading}
                  onInputChange={(_, value) => setCustomerQuery(value)}
                  onValueChange={(value) => {
                    setParams((params) =>
                      updateParam(params, "customer", value?.id ?? null),
                    );
                  }}
                  getOptionLabel={(option) => option.label}
                  isOptionEqualToValue={(option, value) =>
                    option.id === value.id
                  }
                  renderOption={(props, option) => (
                    <Box component="li" {...props}>
                      <Stack spacing={0.25}>
                        <Typography level="body-sm">{option.label}</Typography>
                        {option.subtitle ? (
                          <Typography level="body-xs" color="neutral">
                            {option.subtitle}
                          </Typography>
                        ) : null}
                      </Stack>
                    </Box>
                  )}
                />

                <JoyAutocomplete<string, true, false, false>
                  multiple
                  disableCloseOnSelect
                  label="Status"
                  placeholder="All statuses"
                  options={[...STATUS_OPTIONS]}
                  value={status}
                  onValueChange={(value) =>
                    setCsvParam(
                      "status",
                      Array.isArray(value) ? [...value] : [],
                    )
                  }
                />

                <JoyAutocomplete<string, true, false, false>
                  multiple
                  disableCloseOnSelect
                  label="Actor"
                  placeholder="All actors"
                  options={[...ACTOR_OPTIONS]}
                  value={actor}
                  onValueChange={(value) =>
                    setCsvParam("actor", Array.isArray(value) ? [...value] : [])
                  }
                />

                <JoyAutocomplete<string, true, false, false>
                  multiple
                  disableCloseOnSelect
                  label="Source"
                  placeholder="All sources"
                  options={[...SOURCE_OPTIONS]}
                  value={source}
                  onValueChange={(value) =>
                    setCsvParam(
                      "source",
                      Array.isArray(value) ? [...value] : [],
                    )
                  }
                />

                <JoyAutocomplete<string, true, false, true>
                  multiple
                  freeSolo
                  filterSelectedOptions
                  label="Activity type"
                  placeholder="Any activity type"
                  options={selectedActivityTypes}
                  value={type}
                  loading={activityTypeLookup.loading}
                  inputValue={activityTypeQuery}
                  onInputChange={(_, value) => setActivityTypeQuery(value)}
                  onValueChange={(value) => {
                    const nextValues = Array.from(
                      new Set(
                        (Array.isArray(value) ? value : [])
                          .map((item) => String(item).trim())
                          .filter(Boolean),
                      ),
                    );
                    setCsvParam("type", nextValues);
                  }}
                />

                <SegmentPicker
                  helperText="Filter the activity feed down to one or more segments."
                  label="Segment"
                  onChange={(nextValue) => setCsvParam("segment", nextValue)}
                  statuses={["active", "draft", "paused", "archived"]}
                  value={segmentIds}
                />

                <JoyAutocomplete<PersonaOption, true, false, false>
                  multiple
                  disableCloseOnSelect
                  label="Persona"
                  placeholder="Any persona"
                  options={personaOptions}
                  value={selectedPersonaOptions}
                  loading={personasLoading}
                  onValueChange={(value) =>
                    setCsvParam(
                      "persona",
                      Array.isArray(value) ? value.map((item) => item.id) : [],
                    )
                  }
                  getOptionLabel={(option) => option.label}
                  isOptionEqualToValue={(option, value) =>
                    option.id === value.id
                  }
                  renderOption={(props, option) => (
                    <Box component="li" {...props}>
                      <Stack spacing={0.25}>
                        <Typography level="body-sm">{option.label}</Typography>
                        {option.subtitle ? (
                          <Typography level="body-xs" color="neutral">
                            {option.subtitle}
                          </Typography>
                        ) : null}
                      </Stack>
                    </Box>
                  )}
                />

                <Stack spacing={0.75}>
                  <Typography level="body-xs" color="neutral">
                    Date range
                  </Typography>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <Input
                      type="date"
                      value={toDateInputValue(start)}
                      startDecorator={<CalendarDays size={16} />}
                      onChange={(event) => {
                        const nextValue = startOfDayIso(event.target.value);
                        setParams((params) =>
                          updateParam(params, "start", nextValue),
                        );
                      }}
                    />
                    <Input
                      type="date"
                      value={toDateInputValue(end)}
                      startDecorator={<CalendarDays size={16} />}
                      onChange={(event) => {
                        const nextValue = endOfDayIso(event.target.value);
                        setParams((params) =>
                          updateParam(params, "end", nextValue),
                        );
                      }}
                    />
                  </Stack>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    <Button
                      size="sm"
                      variant="soft"
                      color="neutral"
                      onClick={() => {
                        const now = new Date();
                        const today = now.toISOString().slice(0, 10);
                        setParams((params) => {
                          updateParam(params, "start", startOfDayIso(today));
                          updateParam(params, "end", endOfDayIso(today));
                        });
                      }}
                    >
                      Today
                    </Button>
                    <Button
                      size="sm"
                      variant="soft"
                      color="neutral"
                      onClick={() => {
                        const endDate = new Date();
                        const startDate = new Date();
                        startDate.setDate(endDate.getDate() - 6);
                        setParams((params) => {
                          updateParam(
                            params,
                            "start",
                            startOfDayIso(toDateInputValue(startDate)),
                          );
                          updateParam(
                            params,
                            "end",
                            endOfDayIso(toDateInputValue(endDate)),
                          );
                        });
                      }}
                    >
                      Last 7 days
                    </Button>
                    <Button
                      size="sm"
                      variant="soft"
                      color="neutral"
                      onClick={() => {
                        const endDate = new Date();
                        const startDate = new Date();
                        startDate.setDate(endDate.getDate() - 29);
                        setParams((params) => {
                          updateParam(
                            params,
                            "start",
                            startOfDayIso(toDateInputValue(startDate)),
                          );
                          updateParam(
                            params,
                            "end",
                            endOfDayIso(toDateInputValue(endDate)),
                          );
                        });
                      }}
                    >
                      Last 30 days
                    </Button>
                    {start || end ? (
                      <Button
                        size="sm"
                        variant="plain"
                        color="neutral"
                        onClick={() => {
                          setParams((params) => {
                            updateParam(params, "start", null);
                            updateParam(params, "end", null);
                          });
                        }}
                      >
                        Clear dates
                      </Button>
                    ) : null}
                  </Stack>
                </Stack>
              </Box>
            </Stack>
          ) : null}
        </Box>
      </Box>

      {activePills.length ? (
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          {activePills.map((pill) => (
            <FilterPill
              key={pill.key}
              label={pill.label}
              onRemove={pill.onRemove}
            />
          ))}
        </Stack>
      ) : null}
    </Stack>
  );
}
