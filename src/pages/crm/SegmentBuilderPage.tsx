import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Box from "@mui/joy/Box";
import Checkbox from "@mui/joy/Checkbox";
import Chip from "@mui/joy/Chip";
import IconButton from "@mui/joy/IconButton";
import LinearProgress from "@mui/joy/LinearProgress";
import List from "@mui/joy/List";
import ListItem from "@mui/joy/ListItem";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import {
  ChevronRight,
  DollarSign,
  Eye,
  PieChart,
  Save,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  CatalogStatsStrip,
  CatalogStatsStripSkeleton,
} from "@/components/crm/catalog/CatalogStatsStrip";
import { SegmentDeleteDialog } from "@/components/crm/segments/SegmentDeleteDialog";
import { NaturalLanguageRulePreview } from "@/components/crm/segments/rule-builder/NaturalLanguageRulePreview";
import { SegmentLivePreview } from "@/components/crm/segments/rule-builder/SegmentLivePreview";
import { SegmentRuleBuilder } from "@/components/crm/segments/rule-builder/SegmentRuleBuilder";
import { StaticSegmentMemberManager } from "@/components/crm/segments/rule-builder/StaticSegmentMemberManager";
import { SegmentTemplateGallery } from "@/components/crm/segments/rule-builder/SegmentTemplateGallery";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoyInput } from "@/components/joy/JoyInput";
import { PageContainer } from "@/components/joy/PageContainer";
import { JoySelect } from "@/components/joy/JoySelect";
import { JoyTextarea } from "@/components/joy/JoyTextarea";
import { useBeforeUnload } from "@/hooks/useBeforeUnload";
import { useCreateSegment } from "@/hooks/useCreateSegment";
import { useDeleteSegment } from "@/hooks/useDeleteSegment";
import { useEvaluateSegments } from "@/hooks/useSegmentEvaluation";
import { useSegment } from "@/hooks/useSegment";
import { useSegmentMembers } from "@/hooks/useSegmentMembers";
import { useSegmentPreview } from "@/hooks/useSegmentPreview";
import {
  useSegments,
  type SegmentKind,
  type SegmentStatus,
} from "@/hooks/useSegments";
import { useTenant } from "@/hooks/useTenant";
import { useUpdateSegment } from "@/hooks/useUpdateSegment";
import { supabase } from "@/integrations/supabase/client";
import {
  BASE_SEGMENT_FIELDS,
  createEmptyGroup,
  hasIncompleteRules,
  SEGMENT_TEMPLATES,
  type SegmentField,
  type SegmentRuleGroup,
} from "@/lib/segmentFields";

const SEGMENT_CURRENCY_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatSegmentStatusLabel(status: SegmentStatus) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDeltaCurrency(value: number) {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}${SEGMENT_CURRENCY_FORMATTER.format(Math.abs(value))}`;
}

function serializeSegmentState({
  name,
  description,
  type,
  status,
  rules,
  includeAllCustomers,
  memberIds,
}: {
  name: string;
  description: string;
  type: SegmentKind;
  status: SegmentStatus;
  rules: SegmentRuleGroup;
  includeAllCustomers: boolean;
  memberIds: string[];
}) {
  return JSON.stringify({
    name: name.trim(),
    description: description.trim(),
    type,
    status,
    rules,
    includeAllCustomers,
    memberIds: [...memberIds].sort(),
  });
}

function SegmentBuilderSkeleton() {
  return (
    <PageContainer
      fullWidth
      sx={{ px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}
    >
      <Stack spacing={3}>
        <Stack spacing={1.25}>
          <Stack direction="row" justifyContent="space-between" spacing={2}>
            <Stack spacing={1}>
              <Skeleton
                variant="text"
                width={120}
                height={14}
                animation="wave"
              />
              <Skeleton
                variant="text"
                width={260}
                height={32}
                animation="wave"
              />
              <Skeleton
                variant="text"
                width={420}
                height={18}
                animation="wave"
              />
            </Stack>
            <Stack direction="row" spacing={1}>
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton
                  key={index}
                  variant="rectangular"
                  width={112}
                  height={36}
                  animation="wave"
                  sx={{ borderRadius: "lg" }}
                />
              ))}
            </Stack>
          </Stack>

          <Stack direction="row" spacing={1}>
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton
                key={index}
                variant="rectangular"
                width={92}
                height={24}
                animation="wave"
                sx={{ borderRadius: "999px" }}
              />
            ))}
          </Stack>
        </Stack>

        <Box
          sx={{
            display: "grid",
            gap: 3,
            gridTemplateColumns: {
              xs: "1fr",
              xl: "minmax(0, 1.5fr) minmax(360px, 0.9fr)",
            },
            alignItems: "start",
          }}
        >
          <Stack spacing={3}>
            <JoyCard>
              <JoyCardContent sx={{ pt: 3, gap: 2 }}>
                <Skeleton
                  variant="text"
                  width={130}
                  height={20}
                  animation="wave"
                />
                <Skeleton
                  variant="rectangular"
                  height={42}
                  animation="wave"
                  sx={{ borderRadius: "lg" }}
                />
                <Skeleton
                  variant="rectangular"
                  height={88}
                  animation="wave"
                  sx={{ borderRadius: "lg" }}
                />
                <Box
                  sx={{
                    display: "grid",
                    gap: 1.5,
                    gridTemplateColumns: {
                      xs: "1fr",
                      md: "repeat(3, minmax(0, 1fr))",
                    },
                  }}
                >
                  {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton
                      key={index}
                      variant="rectangular"
                      height={42}
                      animation="wave"
                      sx={{ borderRadius: "lg" }}
                    />
                  ))}
                </Box>
              </JoyCardContent>
            </JoyCard>

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
                  height={320}
                  animation="wave"
                  sx={{ borderRadius: "lg" }}
                />
              </JoyCardContent>
            </JoyCard>
          </Stack>

          <Stack spacing={3}>
            <JoyCard>
              <JoyCardContent sx={{ pt: 3, gap: 1.5 }}>
                <Skeleton
                  variant="text"
                  width={160}
                  height={20}
                  animation="wave"
                />
                <Skeleton
                  variant="rectangular"
                  height={160}
                  animation="wave"
                  sx={{ borderRadius: "lg" }}
                />
              </JoyCardContent>
            </JoyCard>

            <JoyCard>
              <JoyCardContent sx={{ pt: 3, gap: 1.5 }}>
                <Skeleton
                  variant="text"
                  width={150}
                  height={20}
                  animation="wave"
                />
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton
                    key={index}
                    variant="rectangular"
                    height={40}
                    animation="wave"
                    sx={{ borderRadius: "md" }}
                  />
                ))}
              </JoyCardContent>
            </JoyCard>
          </Stack>
        </Box>
      </Stack>
    </PageContainer>
  );
}

export default function SegmentBuilderPage() {
  const { segmentId } = useParams<{ segmentId: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(segmentId);
  const {
    tenant,
    loading: tenantLoading,
    error: tenantError,
    requiresTenantSelection,
  } = useTenant();
  const tenantId = tenant?.id ?? null;
  const segmentQuery = useSegment(segmentId);
  const segmentMembersQuery = useSegmentMembers(segmentId);
  const { allSegments } = useSegments();
  const createSegment = useCreateSegment();
  const updateSegment = useUpdateSegment();
  const deleteSegment = useDeleteSegment();
  const evaluateSegments = useEvaluateSegments();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<SegmentKind>("dynamic");
  const [status, setStatus] = useState<SegmentStatus>("active");
  const [rules, setRules] = useState<SegmentRuleGroup>(createEmptyGroup());
  const [includeAllCustomers, setIncludeAllCustomers] = useState(false);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [initialSnapshot, setInitialSnapshot] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const personasQuery = useQuery({
    queryKey: ["segment-builder-personas", tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      if (!tenantId) {
        return [] as Array<{ id: string; label: string }>;
      }

      const { data, error } = await supabase
        .from("personas")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .order("name");

      if (error) {
        throw error;
      }

      return (data ?? []).map((persona) => ({
        id: persona.id,
        label: persona.name,
      }));
    },
  });

  const tagsQuery = useQuery({
    queryKey: ["segment-builder-tags", tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      if (!tenantId) {
        return [] as string[];
      }

      const { data, error } = await supabase
        .from("crm_customers")
        .select("tags, product_tags")
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .limit(500);

      if (error) {
        throw error;
      }

      const tagSet = new Set<string>();
      for (const customer of data ?? []) {
        for (const tag of [
          ...(customer.tags ?? []),
          ...(customer.product_tags ?? []),
        ]) {
          if (typeof tag === "string" && tag.trim()) {
            tagSet.add(tag.trim());
          }
        }
      }

      return Array.from(tagSet).sort((left, right) =>
        left.localeCompare(right),
      );
    },
  });

  useEffect(() => {
    if (initialized) {
      return;
    }

    if (!isEditing) {
      const baseGroup = createEmptyGroup();
      setRules(baseGroup);
      setInitialSnapshot(
        serializeSegmentState({
          name: "",
          description: "",
          type: "dynamic",
          status: "active",
          rules: baseGroup,
          includeAllCustomers: false,
          memberIds: [],
        }),
      );
      setInitialized(true);
      return;
    }

    if (segmentQuery.isLoading || !segmentQuery.data) {
      return;
    }

    if (segmentQuery.data.type === "static" && segmentMembersQuery.isLoading) {
      return;
    }

    const nextMemberIds =
      segmentQuery.data.type === "static"
        ? segmentMembersQuery.allMembers.map((member) => member.customerId)
        : [];

    setName(segmentQuery.data.name);
    setDescription(segmentQuery.data.description ?? "");
    setType(segmentQuery.data.type);
    setStatus(segmentQuery.data.status);
    setRules(segmentQuery.data.rules);
    setIncludeAllCustomers(segmentQuery.data.includeAllCustomers);
    setMemberIds(nextMemberIds);
    setInitialSnapshot(
      serializeSegmentState({
        name: segmentQuery.data.name,
        description: segmentQuery.data.description ?? "",
        type: segmentQuery.data.type,
        status: segmentQuery.data.status,
        rules: segmentQuery.data.rules,
        includeAllCustomers: segmentQuery.data.includeAllCustomers,
        memberIds: nextMemberIds,
      }),
    );
    setInitialized(true);
  }, [
    initialized,
    isEditing,
    segmentMembersQuery.allMembers,
    segmentMembersQuery.isLoading,
    segmentQuery.data,
    segmentQuery.isLoading,
  ]);

  const previewQuery = useSegmentPreview({
    enabled: initialized || !isEditing,
    group: rules,
    includeAllCustomers,
    segmentId: segmentId ?? null,
    segmentType: type,
    staticMemberIds: memberIds,
  });

  const fields = useMemo<SegmentField[]>(() => {
    const registry = new Map(
      BASE_SEGMENT_FIELDS.map((field) => [field.id, field]),
    );
    for (const field of previewQuery.customFields ?? []) {
      registry.set(field.id, field);
    }
    return Array.from(registry.values());
  }, [previewQuery.customFields]);

  const currentSnapshot = useMemo(
    () =>
      serializeSegmentState({
        name,
        description,
        type,
        status,
        rules,
        includeAllCustomers,
        memberIds,
      }),
    [description, includeAllCustomers, memberIds, name, rules, status, type],
  );
  const isDirty = initialized && currentSnapshot !== initialSnapshot;
  const hasValidRules =
    includeAllCustomers || !hasIncompleteRules(rules, fields);
  const contextBlocker = tenantLoading
    ? "Organization context is still loading."
    : requiresTenantSelection
      ? "Select a tenant in Master Admin before saving this segment."
      : !tenantId
        ? tenantError || "Organization context is unavailable."
        : null;
  const canSave =
    !contextBlocker &&
    name.trim().length > 0 &&
    (type === "static" ? memberIds.length > 0 : hasValidRules);
  const isInitialLoading =
    isEditing &&
    (segmentQuery.isLoading ||
      (segmentQuery.data?.type === "static" &&
        segmentMembersQuery.isLoading &&
        !initialized));

  const pageTitle = isEditing
    ? `Edit ${segmentQuery.data?.name ?? "segment"}`
    : "New segment";
  const memberCount = previewQuery.preview.count;
  const metadataLabel = `${type === "dynamic" ? (includeAllCustomers ? "Dynamic · All customers" : "Dynamic") : "Static"} · ${formatSegmentStatusLabel(status)} · ${memberCount.toLocaleString()} members`;
  const headerStats = useMemo(
    () => [
      {
        label: "Matched Customers",
        value: previewQuery.preview.count.toLocaleString(),
        icon: <Users size={18} />,
        iconColor: "neutral" as const,
      },
      {
        label: "Audience Share",
        value: `${previewQuery.preview.percentage}%`,
        icon: <PieChart size={18} />,
        iconColor: "neutral" as const,
      },
      {
        label: "Average LTV",
        value: SEGMENT_CURRENCY_FORMATTER.format(
          previewQuery.preview.averageLifetimeValue,
        ),
        icon: <DollarSign size={18} />,
        iconColor: "neutral" as const,
      },
      {
        label: "LTV Delta",
        value: formatDeltaCurrency(
          previewQuery.preview.averageLifetimeValueDelta,
        ),
        icon:
          previewQuery.preview.averageLifetimeValueDelta >= 0 ? (
            <TrendingUp size={18} />
          ) : (
            <TrendingDown size={18} />
          ),
        iconColor: "neutral" as const,
      },
    ],
    [
      previewQuery.preview.averageLifetimeValue,
      previewQuery.preview.averageLifetimeValueDelta,
      previewQuery.preview.count,
      previewQuery.preview.percentage,
    ],
  );

  useBeforeUnload({ when: isDirty });

  const segmentOptions = allSegments
    .filter((segment) => segment.id !== segmentId)
    .map((segment) => ({ id: segment.id, label: segment.name }));

  if (isInitialLoading) {
    return <SegmentBuilderSkeleton />;
  }

  const handleSave = async () => {
    if (contextBlocker) {
      toast.error(contextBlocker);
      return;
    }

    try {
      const savedId = isEditing
        ? await updateSegment.mutateAsync({
            description,
            includeAllCustomers,
            memberIds,
            name,
            rules,
            segmentId: segmentId!,
            status,
            type,
          })
        : (
            await createSegment.mutateAsync({
              description,
              includeAllCustomers,
              memberIds,
              name,
              rules,
              status,
              type,
            })
          ).id;

      if (
        type === "dynamic" &&
        tenantId &&
        status !== "draft" &&
        status !== "archived"
      ) {
        try {
          await evaluateSegments.mutateAsync({ tenantId, segmentId: savedId });
        } catch (evaluationError) {
          toast.warning(
            evaluationError instanceof Error
              ? evaluationError.message
              : "Segment saved, but preview recomputation failed",
          );
        }
      }

      setInitialSnapshot(currentSnapshot);
      toast.success(isEditing ? "Segment updated" : "Segment created");

      if (!isEditing) {
        navigate(`/crm/segments/${savedId}`, { replace: true });
      }
    } catch (saveError) {
      toast.error(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save segment",
      );
    }
  };

  const handleDelete = async () => {
    if (!segmentId) {
      return;
    }

    try {
      await deleteSegment.mutateAsync(segmentId);
      toast.success("Segment archived");
      navigate("/crm/segments", { replace: true });
    } catch (deleteError) {
      toast.error(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to archive segment",
      );
    }
  };

  if (isEditing && !segmentQuery.isLoading && !segmentQuery.data) {
    return (
      <PageContainer sx={{ px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}>
        <JoyCard>
          <JoyCardHeader
            description="The segment may have been archived or deleted."
            title="Segment not found"
          />
          <JoyCardContent sx={{ pt: 3 }}>
            <JoyButton onClick={() => navigate("/crm/segments")}>
              Back to segments
            </JoyButton>
          </JoyCardContent>
        </JoyCard>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      fullWidth
      sx={{ px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}
    >
      <Stack spacing={3}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          alignItems={{ xs: "stretch", md: "flex-start" }}
          justifyContent="space-between"
          spacing={2}
        >
          <Stack spacing={0.75} sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <Typography
                component={RouterLink}
                to="/crm/segments"
                level="body-xs"
                sx={{
                  color: "neutral.500",
                  textDecoration: "none",
                  fontWeight: 500,
                  "&:hover": {
                    color: "neutral.700",
                  },
                }}
              >
                Segments
              </Typography>
              <ChevronRight size={12} color="var(--joy-palette-neutral-400)" />
              <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                {pageTitle}
              </Typography>
            </Stack>

            <Typography level="h3" fontWeight="bold">
              {pageTitle}
            </Typography>
            <Typography
              level="body-sm"
              sx={{
                color: "neutral.600",
                whiteSpace: { xs: "normal", md: "nowrap" },
              }}
            >
              Define rules and membership for this audience segment.
            </Typography>
            <Typography
              level="body-xs"
              sx={{ color: "neutral.500", fontWeight: 500, mt: 0.5 }}
            >
              {metadataLabel}
            </Typography>
          </Stack>

          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            justifyContent={{ xs: "flex-start", md: "flex-end" }}
            sx={{ flexShrink: 0 }}
          >
            {segmentId ? (
              <Tooltip title="View members">
                <IconButton
                  variant="outlined"
                  color="neutral"
                  size="sm"
                  onClick={() => navigate(`/crm/segments/${segmentId}/members`)}
                  aria-label="View members"
                >
                  <Eye size={16} />
                </IconButton>
              </Tooltip>
            ) : null}
            <JoyButton
              variant="solid"
              color="primary"
              disabled={!canSave}
              loading={createSegment.isPending || updateSegment.isPending}
              onClick={() => void handleSave()}
              startDecorator={<Save size={16} />}
            >
              {isEditing ? "Save segment" : "Create segment"}
            </JoyButton>
          </Stack>
        </Stack>

        {previewQuery.isLoading ? (
          <CatalogStatsStripSkeleton itemCount={4} />
        ) : (
          <CatalogStatsStrip items={headerStats} />
        )}

        {(segmentQuery.isLoading ||
          createSegment.isPending ||
          updateSegment.isPending) && <LinearProgress size="sm" />}

        {contextBlocker ? (
          <JoyCard>
            <JoyCardHeader
              description={contextBlocker}
              title="Tenant context required"
            />
          </JoyCard>
        ) : null}

        <Box
          sx={{
            display: "grid",
            gap: 3,
            gridTemplateColumns: {
              xs: "1fr",
              xl: "minmax(0, 1.5fr) minmax(360px, 0.9fr)",
            },
            alignItems: "start",
          }}
        >
          <Stack spacing={3}>
            <JoyCard>
              <JoyCardHeader
                description="Name, describe, and control how this audience behaves operationally."
                title="Definition"
              />
              <JoyCardContent
                sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 3 }}
              >
                <JoyInput
                  label="Segment name"
                  onValueChange={setName}
                  placeholder="VIP repeat buyers"
                  value={name}
                />
                <JoyTextarea
                  label="Description"
                  minRows={3}
                  onValueChange={setDescription}
                  placeholder="Why this audience exists and how the team should use it."
                  sx={{
                    minHeight: 104,
                    "& .MuiTextarea-textarea": {
                      minHeight: 104,
                    },
                  }}
                  value={description}
                />
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
                  <JoySelect
                    label="Type"
                    onValueChange={(nextValue) =>
                      setType((nextValue || "dynamic") as SegmentKind)
                    }
                    options={[
                      { value: "dynamic", label: "Dynamic" },
                      { value: "static", label: "Static" },
                    ]}
                    value={type}
                  />
                  <JoySelect
                    label="Status"
                    onValueChange={(nextValue) =>
                      setStatus((nextValue || "active") as SegmentStatus)
                    }
                    options={[
                      { value: "draft", label: "Draft" },
                      { value: "active", label: "Active" },
                      { value: "paused", label: "Paused" },
                      { value: "archived", label: "Archived" },
                    ]}
                    value={status}
                  />
                  <JoyInput
                    disabled
                    label="Live count"
                    value={
                      type === "static"
                        ? memberIds.length.toLocaleString()
                        : previewQuery.preview.count.toLocaleString()
                    }
                  />
                </Box>
              </JoyCardContent>
            </JoyCard>

            {type === "dynamic" ? (
              <JoyCard>
                <JoyCardHeader
                  description="Choose between a living all-customer audience or your custom rule set."
                  title="Rules"
                />
                <JoyCardContent
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    pt: 3,
                  }}
                >
                  <Box
                    sx={{
                      border: "1px solid",
                      borderColor: includeAllCustomers
                        ? "primary.outlinedBorder"
                        : "neutral.outlinedBorder",
                      borderRadius: "lg",
                      p: 2,
                      transition:
                        "border-color 0.2s ease, box-shadow 0.2s ease",
                      boxShadow: includeAllCustomers ? "sm" : "none",
                    }}
                  >
                    <Stack
                      direction="row"
                      spacing={1.5}
                      alignItems="flex-start"
                    >
                      <Checkbox
                        checked={includeAllCustomers}
                        onChange={(event) =>
                          setIncludeAllCustomers(event.target.checked)
                        }
                        slotProps={{
                          input: {
                            "aria-label":
                              "Include all customers in this segment",
                          },
                        }}
                      />
                      <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                        <Typography level="title-sm">
                          Include All Customers
                        </Typography>
                        <Typography
                          level="body-sm"
                          sx={{ color: "neutral.600" }}
                        >
                          Every customer in your store is included in this
                          segment. New customers are added automatically.
                        </Typography>
                        {includeAllCustomers ? (
                          <Typography
                            level="body-xs"
                            sx={{ color: "neutral.500" }}
                          >
                            Custom rules are paused while All Customers is
                            active.
                          </Typography>
                        ) : null}
                      </Stack>
                    </Stack>
                  </Box>

                  <Typography
                    level="body-xs"
                    sx={{
                      color: "neutral.500",
                      textAlign: "center",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    or
                  </Typography>

                  <Box
                    aria-disabled={includeAllCustomers}
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                      opacity: includeAllCustomers ? 0.45 : 1,
                      pointerEvents: includeAllCustomers ? "none" : "auto",
                      transition: "opacity 0.2s ease",
                    }}
                  >
                    <Stack spacing={0.5}>
                      <Typography level="title-sm">Custom Rules</Typography>
                      <Typography level="body-sm" sx={{ color: "neutral.600" }}>
                        Build targeted logic with fields, operators, and grouped
                        conditions.
                      </Typography>
                    </Stack>

                    <SegmentTemplateGallery
                      fields={fields}
                      onApplyTemplate={(template) => {
                        setType("dynamic");
                        setRules(template.group);
                      }}
                      templates={SEGMENT_TEMPLATES}
                    />
                    <SegmentRuleBuilder
                      currentSegmentId={segmentId}
                      dependencySource={allSegments.map((segment) => ({
                        id: segment.id,
                        conditions: segment.rules,
                      }))}
                      fields={fields}
                      onChange={setRules}
                      personaOptions={personasQuery.data ?? []}
                      segmentOptions={segmentOptions}
                      tagOptions={tagsQuery.data ?? []}
                      value={rules}
                    />
                  </Box>
                </JoyCardContent>
              </JoyCard>
            ) : (
              <StaticSegmentMemberManager
                onChange={setMemberIds}
                value={memberIds}
              />
            )}

            {isEditing && segmentQuery.data?.usage.length ? (
              <JoyCard>
                <JoyCardHeader
                  description="Campaigns currently pointing at this segment."
                  title="Active usage"
                />
                <JoyCardContent sx={{ pt: 3 }}>
                  <List sx={{ gap: 1, "--List-padding": "0px" }}>
                    {segmentQuery.data.usage.map((usage) => (
                      <ListItem
                        key={`${usage.kind}-${usage.id}`}
                        sx={{ px: 0, py: 0.5 }}
                      >
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          sx={{ width: "100%" }}
                        >
                          <Box>
                            <Typography level="body-sm">
                              {usage.name}
                            </Typography>
                            <Typography level="body-xs" color="neutral">
                              {usage.kind}
                            </Typography>
                          </Box>
                          <Chip size="sm" variant="outlined">
                            {usage.status || "draft"}
                          </Chip>
                        </Stack>
                      </ListItem>
                    ))}
                  </List>
                </JoyCardContent>
              </JoyCard>
            ) : null}

            {isEditing ? (
              <JoyCard>
                <JoyCardHeader
                  description="Archive the segment to remove it from active routing while preserving historic references."
                  title="Danger zone"
                />
                <JoyCardContent sx={{ pt: 3 }}>
                  <JoyButton
                    bloomVariant="ghost"
                    color="danger"
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    Archive segment
                  </JoyButton>
                </JoyCardContent>
              </JoyCard>
            ) : null}
          </Stack>

          <Stack spacing={3}>
            <NaturalLanguageRulePreview fields={fields} group={rules} />
            <SegmentLivePreview
              loading={previewQuery.isFetching}
              preview={previewQuery.preview}
            />

            {!canSave ? (
              <JoyCard>
                <JoyCardHeader
                  description="Complete the remaining requirements to enable saving."
                  title="Ready-to-save checks"
                />
                <JoyCardContent sx={{ pt: 3 }}>
                  <Stack spacing={1.25}>
                    <Typography
                      level="body-sm"
                      color={name.trim() ? "success" : "neutral"}
                      sx={{ fontWeight: 500 }}
                    >
                      {name.trim() ? "Name added" : "Add a segment name"}
                    </Typography>
                    <Typography
                      level="body-sm"
                      color={
                        type === "static"
                          ? memberIds.length
                            ? "success"
                            : "neutral"
                          : hasValidRules
                            ? "success"
                            : "neutral"
                      }
                      sx={{ fontWeight: 500 }}
                    >
                      {type === "static"
                        ? memberIds.length
                          ? "At least one static member selected"
                          : "Select at least one static member"
                        : hasValidRules
                          ? "Rules are complete"
                          : "Complete all rule fields"}
                    </Typography>
                    <Typography
                      level="body-sm"
                      color={contextBlocker ? "neutral" : "success"}
                      sx={{ fontWeight: 500 }}
                    >
                      {contextBlocker || "Organization context is ready"}
                    </Typography>
                  </Stack>
                </JoyCardContent>
              </JoyCard>
            ) : null}
          </Stack>
        </Box>
      </Stack>

      <SegmentDeleteDialog
        loading={deleteSegment.isPending}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={() => void handleDelete()}
        open={showDeleteDialog}
        segment={segmentQuery.data ?? null}
      />
    </PageContainer>
  );
}
