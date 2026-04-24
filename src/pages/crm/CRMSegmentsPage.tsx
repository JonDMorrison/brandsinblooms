import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import Box from "@mui/joy/Box";
import Divider from "@mui/joy/Divider";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  Layers3,
  Plus,
  RefreshCw,
  Search,
  Shapes,
  Users,
  Zap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { SYSTEM_SEGMENTS } from "@/config/segmentDefinitions";
import { getSegmentDisplayDescription } from "@/config/systemSegments";
import { CatalogGridSkeleton } from "@/components/crm/catalog/CatalogCardSkeleton";
import {
  CatalogStatsStrip,
  CatalogStatsStripSkeleton,
} from "@/components/crm/catalog/CatalogStatsStrip";
import { SegmentCatalogCard } from "@/components/crm/segments/SegmentCatalogCard";
import { SegmentDeleteDialog } from "@/components/crm/segments/SegmentDeleteDialog";
import {
  SegmentsFilterBar,
  type SegmentSortOption,
  type SegmentViewFilter,
} from "@/components/crm/segments/SegmentsFilterBar";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyCard, JoyCardContent } from "@/components/joy/JoyCard";
import { JoyPageHeaderBand } from "@/components/joy/JoyPageHeaderBand";
import { PageContainer } from "@/components/joy/PageContainer";
import { JoyTooltip } from "@/components/joy/JoyTooltip";
import { useAuth } from "@/hooks/useAuth";
import { useCreateSegment } from "@/hooks/useCreateSegment";
import { useDeleteSegment } from "@/hooks/useDeleteSegment";
import { useEvaluateSegments } from "@/hooks/useSegmentEvaluation";
import { type SegmentListItem, useSegments } from "@/hooks/useSegments";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { BASE_SEGMENT_FIELDS } from "@/lib/segmentFields";
import { segmentRuleToNaturalLanguage } from "@/lib/segmentRuleToNaturalLanguage";
import {
  downloadTextFile,
  sanitizeFileNamePart,
  toCsvValue,
} from "@/lib/crm/campaignRecipientOperations";

const SEGMENT_GRID_COLUMNS = {
  xs: "1fr",
  md: "repeat(2, minmax(0, 1fr))",
  xl: "repeat(3, minmax(0, 1fr))",
} as const;

const normalizeSegmentName = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, " ");

const SYSTEM_SEGMENT_NAMES = new Set(
  SYSTEM_SEGMENTS.map((segment) => normalizeSegmentName(segment.name)),
);

function SegmentSectionHeading({ label }: { label: string }) {
  return (
    <Stack spacing={0.5}>
      <Typography
        level="body-xs"
        sx={{
          color: "neutral.500",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </Typography>
      <Divider sx={{ borderColor: "neutral.200" }} />
    </Stack>
  );
}

function CreateSegmentCard({ onClick }: { onClick: () => void }) {
  return (
    <JoyCard
      interactive
      onClick={onClick}
      sx={{
        minHeight: 280,
        display: "grid",
        placeItems: "center",
        borderStyle: "dashed",
        borderColor: "neutral.200",
        backgroundColor: "background.surface",
        boxShadow: "none",
        textAlign: "center",
        transition: "border-color 160ms ease, box-shadow 160ms ease",
        "&:hover": {
          borderColor: "neutral.400",
          boxShadow: "none",
          backgroundColor: "background.surface",
        },
        "&:hover .create-segment-icon": {
          color: "neutral.500",
        },
      }}
    >
      <JoyCardContent
        sx={{
          pt: 4,
          display: "flex",
          flexDirection: "column",
          gap: 1,
          alignItems: "center",
        }}
      >
        <Plus
          size={24}
          className="create-segment-icon"
          style={{ color: "var(--joy-palette-neutral-300)" }}
        />
        <Typography
          level="body-sm"
          sx={{ color: "neutral.700", fontWeight: 500 }}
        >
          Create segment
        </Typography>
      </JoyCardContent>
    </JoyCard>
  );
}

function buildCustomerName(customer: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}) {
  const name = [customer.first_name, customer.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  return name || customer.email || "Unknown customer";
}

function getNextDuplicateSegmentName(
  name: string,
  segments: SegmentListItem[],
) {
  const existingNames = new Set(
    segments.map((segment) => segment.name.trim().toLowerCase()),
  );
  const baseName = `${name} Copy`;

  if (!existingNames.has(baseName.toLowerCase())) {
    return baseName;
  }

  let index = 2;
  while (existingNames.has(`${baseName} ${index}`.toLowerCase())) {
    index += 1;
  }

  return `${baseName} ${index}`;
}

export function CRMSegmentsPage() {
  const navigate = useNavigate();
  const { tenant, loading: tenantLoading } = useTenant();
  const { user, loading: authLoading } = useAuth();
  const tenantId = tenant?.id ?? null;
  const userId = user?.id ?? null;
  const [query, setQuery] = React.useState("");
  const [view, setView] = React.useState<SegmentViewFilter>("all");
  const [sort, setSort] = React.useState<SegmentSortOption>("members-desc");
  const [segmentPendingDelete, setSegmentPendingDelete] =
    React.useState<SegmentListItem | null>(null);
  const { allSegments, stats, isLoading, isFetching, error, refetch } =
    useSegments();
  const createSegment = useCreateSegment();
  const deleteSegment = useDeleteSegment();
  const evaluateSegments = useEvaluateSegments();
  const [isHydratingSystemSegments, setIsHydratingSystemSegments] =
    React.useState(false);
  const hydrationAttemptRef = React.useRef<string | null>(null);

  const totalCustomersQuery = useQuery({
    queryKey: ["segments-total-customers", tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      if (!tenantId) {
        return 0;
      }

      const { count, error: countError } = await supabase
        .from("crm_customers")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .is("deleted_at", null);

      if (countError) {
        throw countError;
      }

      return count ?? 0;
    },
    staleTime: 60_000,
  });

  const summaries = React.useMemo(() => {
    return Object.fromEntries(
      allSegments.map((segment) => [
        segment.id,
        segmentRuleToNaturalLanguage(segment.rules, BASE_SEGMENT_FIELDS),
      ]),
    );
  }, [allSegments]);

  const missingSystemDefinitions = React.useMemo(() => {
    const existingNames = new Set(
      allSegments.map((segment) => normalizeSegmentName(segment.name)),
    );

    return SYSTEM_SEGMENTS.filter(
      (segment) => !existingNames.has(normalizeSegmentName(segment.name)),
    );
  }, [allSegments]);

  React.useEffect(() => {
    if (
      !tenantId ||
      !userId ||
      isLoading ||
      missingSystemDefinitions.length === 0
    ) {
      return;
    }

    const attemptKey = `${tenantId}:${missingSystemDefinitions
      .map((segment) => segment.id)
      .join(",")}`;

    if (
      hydrationAttemptRef.current === attemptKey ||
      isHydratingSystemSegments
    ) {
      return;
    }

    hydrationAttemptRef.current = attemptKey;
    let cancelled = false;

    const hydrateSystemSegments = async () => {
      setIsHydratingSystemSegments(true);

      try {
        const { error: insertError } = await supabase
          .from("crm_segments")
          .insert(
            missingSystemDefinitions.map((segment) => ({
              tenant_id: tenantId,
              user_id: userId,
              name: segment.name,
              description: segment.description,
              auto_update: true,
              conditions: segment.conditions,
              status: "active",
              is_system_segment: true,
              customer_count: 0,
            })),
          );

        if (insertError) {
          throw insertError;
        }

        await evaluateSegments.mutateAsync({ tenantId });

        if (!cancelled) {
          await Promise.all([refetch(), totalCustomersQuery.refetch()]);
        }
      } catch (hydrationError) {
        if (!cancelled) {
          toast.error(
            hydrationError instanceof Error
              ? hydrationError.message
              : "Failed to restore built-in system segments",
          );
        }
      } finally {
        if (!cancelled) {
          setIsHydratingSystemSegments(false);
        }
      }
    };

    void hydrateSystemSegments();

    return () => {
      cancelled = true;
    };
  }, [
    evaluateSegments,
    isHydratingSystemSegments,
    isLoading,
    missingSystemDefinitions,
    refetch,
    tenantId,
    totalCustomersQuery,
    userId,
  ]);

  const systemSegments = React.useMemo(() => {
    const segmentsByName = new Map(
      allSegments.map((segment) => [
        normalizeSegmentName(segment.name),
        segment,
      ]),
    );

    return SYSTEM_SEGMENTS.map((definition) =>
      segmentsByName.get(normalizeSegmentName(definition.name)),
    ).filter(Boolean) as SegmentListItem[];
  }, [allSegments]);

  const customSegments = React.useMemo(
    () =>
      allSegments.filter(
        (segment) =>
          !SYSTEM_SEGMENT_NAMES.has(normalizeSegmentName(segment.name)),
      ),
    [allSegments],
  );

  const matchesQuery = React.useCallback(
    (segment: SegmentListItem) => {
      const normalizedQuery = query.trim().toLowerCase();

      if (!normalizedQuery) {
        return true;
      }

      const haystack = [
        segment.name,
        segment.description,
        summaries[segment.id],
        getSegmentDisplayDescription({
          isSystemSegment: segment.isSystemSegment,
          name: segment.name,
          description: segment.description,
          fallback: summaries[segment.id],
        }),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    },
    [query, summaries],
  );

  const visibleSystemSegments = React.useMemo(
    () => systemSegments.filter((segment) => matchesQuery(segment)),
    [matchesQuery, systemSegments],
  );

  const visibleCustomSegments = React.useMemo(() => {
    return customSegments
      .filter((segment) => matchesQuery(segment))
      .sort((left, right) => {
        switch (sort) {
          case "name-asc":
            return left.name.localeCompare(right.name);
          case "newest":
            return (
              new Date(right.updatedAt ?? right.createdAt ?? 0).getTime() -
              new Date(left.updatedAt ?? left.createdAt ?? 0).getTime()
            );
          case "members-desc":
          default:
            return right.memberCount - left.memberCount;
        }
      });
  }, [customSegments, matchesQuery, sort]);

  const clearFilters = React.useCallback(() => {
    setQuery("");
    setView("all");
    setSort("members-desc");
  }, []);

  const openCreateSegment = React.useCallback(() => {
    navigate("/crm/segments/new");
  }, [navigate]);

  const handleRefresh = React.useCallback(() => {
    void Promise.all([refetch(), totalCustomersQuery.refetch()]);
  }, [refetch, totalCustomersQuery]);

  const handleDuplicateSegment = React.useCallback(
    async (segment: SegmentListItem) => {
      try {
        let memberIds: string[] | undefined;

        if (segment.type === "static") {
          const { data, error: membershipError } = await supabase
            .from("customer_segments")
            .select("customer_id")
            .eq("segment_id", segment.id);

          if (membershipError) {
            throw membershipError;
          }

          memberIds = (data ?? []).map((membership) => membership.customer_id);
        }

        const created = await createSegment.mutateAsync({
          name: getNextDuplicateSegmentName(segment.name, allSegments),
          description: segment.description,
          type: segment.type,
          status: segment.status,
          rules: segment.rules,
          memberIds,
        });

        toast.success("Segment duplicated");
        navigate(`/crm/segments/${created.id}`);
      } catch (duplicateError) {
        toast.error(
          duplicateError instanceof Error
            ? duplicateError.message
            : "Failed to duplicate segment",
        );
      }
    },
    [allSegments, createSegment, navigate],
  );

  const handleExportMembers = React.useCallback(
    async (segment: SegmentListItem) => {
      try {
        const { data, error: exportError } = await supabase
          .from("customer_segments")
          .select(
            `
              assigned_at,
              crm_customers!inner(first_name, last_name, email, phone, tenant_id)
            `,
          )
          .eq("segment_id", segment.id)
          .eq("crm_customers.tenant_id", tenantId);

        if (exportError) {
          throw exportError;
        }

        const headers = ["Customer Name", "Email", "Phone", "Added At"];
        const rows = (data ?? []).map((record) => {
          const customer = record.crm_customers as {
            first_name?: string | null;
            last_name?: string | null;
            email?: string | null;
            phone?: string | null;
          };

          return [
            buildCustomerName(customer),
            customer.email ?? "",
            customer.phone ?? "",
            record.assigned_at ?? "",
          ];
        });

        const csv = [
          headers.map(toCsvValue).join(","),
          ...rows.map((row) => row.map(toCsvValue).join(",")),
        ].join("\n");

        downloadTextFile(
          csv,
          `${sanitizeFileNamePart(segment.name)}-members.csv`,
          "text/csv;charset=utf-8",
        );
        toast.success("Member CSV exported");
      } catch (exportMembersError) {
        toast.error(
          exportMembersError instanceof Error
            ? exportMembersError.message
            : "Failed to export members",
        );
      }
    },
    [tenantId],
  );

  const handleDelete = async () => {
    if (!segmentPendingDelete) {
      return;
    }

    try {
      await deleteSegment.mutateAsync(segmentPendingDelete.id);
      toast.success("Segment archived");
      setSegmentPendingDelete(null);
    } catch (deleteError) {
      toast.error(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to archive segment",
      );
    }
  };

  const totalCustomers = totalCustomersQuery.data ?? 0;
  const segmentedCustomers = stats.totalSegmentedCustomers;
  const filteredCount =
    view === "system"
      ? visibleSystemSegments.length
      : view === "custom"
        ? visibleCustomSegments.length
        : visibleSystemSegments.length + visibleCustomSegments.length;
  const hasLoadedSegments = allSegments.length > 0;
  const isInitialCatalogLoading =
    authLoading ||
    tenantLoading ||
    (!hasLoadedSegments && (isLoading || totalCustomersQuery.isLoading));
  const isRefreshingCatalog =
    isFetching || totalCustomersQuery.isFetching || isHydratingSystemSegments;
  const showSearchEmptyState = filteredCount === 0 && query.trim().length > 0;
  const loadError = error ?? totalCustomersQuery.error;
  const segmentStats = [
    {
      label: "Total segments",
      value: allSegments.length.toLocaleString(),
      icon: <Shapes size={18} />,
      iconColor: "primary" as const,
    },
    {
      label: "Dynamic segments",
      value: allSegments
        .filter((segment) => segment.type === "dynamic")
        .length.toLocaleString(),
      icon: <Zap size={18} />,
      iconColor: "warning" as const,
    },
    {
      label: "Static segments",
      value: allSegments
        .filter((segment) => segment.type === "static")
        .length.toLocaleString(),
      icon: <Layers3 size={18} />,
      iconColor: "neutral" as const,
    },
    {
      label: "Customers reached",
      value: segmentedCustomers.toLocaleString(),
      icon: <Users size={18} />,
      iconColor: "success" as const,
    },
  ];

  return (
    <PageContainer>
      <Stack spacing={3} sx={{ pb: 4 }}>
        <JoyPageHeaderBand
          title="Segments"
          description="System and custom segments for targeting, campaign planning, and audience management."
          actions={
            <>
              <JoyTooltip title="Refresh segments">
                <IconButton
                  variant="plain"
                  color="neutral"
                  size="sm"
                  onClick={handleRefresh}
                >
                  <RefreshCw
                    size={16}
                    className={isRefreshingCatalog ? "animate-spin" : undefined}
                  />
                </IconButton>
              </JoyTooltip>
              <JoyButton
                size="sm"
                onClick={openCreateSegment}
                startDecorator={<Plus size={16} />}
              >
                Create segment
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

        {isInitialCatalogLoading ? (
          <CatalogStatsStripSkeleton />
        ) : (
          <CatalogStatsStrip items={segmentStats} />
        )}

        <SegmentsFilterBar
          query={query}
          onQueryChange={setQuery}
          view={view}
          onViewChange={setView}
          sort={sort}
          onSortChange={setSort}
          resultCount={filteredCount}
          totalCount={allSegments.length}
          loading={isInitialCatalogLoading}
          hasActiveFilters={
            query.trim().length > 0 || view !== "all" || sort !== "members-desc"
          }
          onClearFilters={clearFilters}
        />

        {loadError ? (
          <JoyCard>
            <JoyCardContent sx={{ pt: 4, display: "grid", gap: 1.25 }}>
              <Typography level="title-md">Unable to load segments</Typography>
              <Typography level="body-sm" color="neutral">
                {loadError instanceof Error
                  ? loadError.message
                  : "Unknown error"}
              </Typography>
              <Stack direction="row">
                <JoyButton
                  variant="plain"
                  color="primary"
                  onClick={handleRefresh}
                >
                  Retry
                </JoyButton>
              </Stack>
            </JoyCardContent>
          </JoyCard>
        ) : null}

        {isInitialCatalogLoading ? (
          <Stack spacing={4}>
            <CatalogGridSkeleton
              columns={SEGMENT_GRID_COLUMNS}
              headingWidth={138}
            />
            <CatalogGridSkeleton
              columns={SEGMENT_GRID_COLUMNS}
              headingWidth={138}
            />
          </Stack>
        ) : showSearchEmptyState ? (
          <Stack
            spacing={1.25}
            alignItems="center"
            sx={{ py: { xs: 6, md: 8 } }}
          >
            <Search
              size={32}
              style={{ color: "var(--joy-palette-neutral-300)" }}
            />
            <Typography level="body-sm" color="neutral">
              No segments match your search
            </Typography>
            <JoyButton
              variant="plain"
              color="primary"
              size="sm"
              sx={{ minHeight: "auto", px: 0 }}
              onClick={clearFilters}
            >
              Clear search
            </JoyButton>
          </Stack>
        ) : (
          <Stack spacing={4}>
            {view !== "custom" && visibleSystemSegments.length > 0 ? (
              <Stack spacing={1.5}>
                <SegmentSectionHeading label="System Segments" />
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: SEGMENT_GRID_COLUMNS,
                    gap: 2,
                  }}
                >
                  {visibleSystemSegments.map((segment) => (
                    <SegmentCatalogCard
                      key={segment.id}
                      item={{
                        id: segment.id,
                        name: segment.name,
                        description: getSegmentDisplayDescription({
                          isSystemSegment: true,
                          name: segment.name,
                          description: segment.description,
                          fallback: summaries[segment.id],
                        }),
                        isSystemSegment: true,
                        memberCount: segment.memberCount,
                        averageValue: 0,
                        totalValue: 0,
                      }}
                      detailHref={`/crm/segments/${segment.id}`}
                      membersHref={`/crm/segments/${segment.id}/members`}
                      campaignHref={`/crm/campaigns/new?segment=${encodeURIComponent(segment.id)}`}
                      onView={() => navigate(`/crm/segments/${segment.id}`)}
                      onViewMembers={() =>
                        navigate(`/crm/segments/${segment.id}/members`)
                      }
                      onCreateCampaign={() =>
                        navigate(
                          `/crm/campaigns/new?segment=${encodeURIComponent(segment.id)}`,
                        )
                      }
                      onExportMembers={() => void handleExportMembers(segment)}
                    />
                  ))}
                </Box>
              </Stack>
            ) : null}

            {view !== "system" ? (
              <Stack spacing={1.5}>
                <SegmentSectionHeading label="Custom Segments" />
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: SEGMENT_GRID_COLUMNS,
                    gap: 2,
                  }}
                >
                  <CreateSegmentCard onClick={openCreateSegment} />
                  {visibleCustomSegments.map((segment) => (
                    <SegmentCatalogCard
                      key={segment.id}
                      item={{
                        id: segment.id,
                        name: segment.name,
                        description: getSegmentDisplayDescription({
                          isSystemSegment: false,
                          name: segment.name,
                          description: segment.description,
                          fallback: summaries[segment.id],
                        }),
                        isSystemSegment: false,
                        memberCount: segment.memberCount,
                        averageValue: 0,
                        totalValue: 0,
                      }}
                      detailHref={`/crm/segments/${segment.id}`}
                      membersHref={`/crm/segments/${segment.id}/members`}
                      campaignHref={`/crm/campaigns/new?segment=${encodeURIComponent(segment.id)}`}
                      onView={() => navigate(`/crm/segments/${segment.id}`)}
                      onViewMembers={() =>
                        navigate(`/crm/segments/${segment.id}/members`)
                      }
                      onCreateCampaign={() =>
                        navigate(
                          `/crm/campaigns/new?segment=${encodeURIComponent(segment.id)}`,
                        )
                      }
                      onExportMembers={() => void handleExportMembers(segment)}
                      onEdit={() => navigate(`/crm/segments/${segment.id}`)}
                      onDuplicate={() => void handleDuplicateSegment(segment)}
                      onArchive={() => setSegmentPendingDelete(segment)}
                    />
                  ))}
                </Box>

                {visibleCustomSegments.length === 0 &&
                query.trim().length === 0 ? (
                  <Sheet
                    variant="outlined"
                    sx={{
                      borderStyle: "dashed",
                      borderColor: "neutral.200",
                      borderRadius: "lg",
                      px: 3,
                      py: 3.5,
                      textAlign: "center",
                    }}
                  >
                    <Stack spacing={1.25} alignItems="center">
                      <Typography level="title-sm">
                        No custom segments yet
                      </Typography>
                      <Typography level="body-sm" color="neutral">
                        Create a custom segment for audiences that go beyond the
                        built-in system groupings.
                      </Typography>
                      <JoyButton
                        variant="plain"
                        color="primary"
                        size="sm"
                        sx={{ minHeight: "auto", px: 0 }}
                        onClick={openCreateSegment}
                      >
                        Create your first custom segment
                      </JoyButton>
                    </Stack>
                  </Sheet>
                ) : null}
              </Stack>
            ) : null}
          </Stack>
        )}
      </Stack>

      <SegmentDeleteDialog
        loading={deleteSegment.isPending}
        onClose={() => setSegmentPendingDelete(null)}
        onConfirm={() => void handleDelete()}
        open={Boolean(segmentPendingDelete)}
        segment={segmentPendingDelete}
      />
    </PageContainer>
  );
}

export default CRMSegmentsPage;
