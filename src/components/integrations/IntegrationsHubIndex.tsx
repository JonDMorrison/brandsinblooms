import { useMemo, useState } from "react";
import {
  Link as RouterLink,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import IconButton from "@mui/joy/IconButton";
import Input from "@mui/joy/Input";
import LinearProgress from "@mui/joy/LinearProgress";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { ChevronLeft, Download, MailPlus, Search, X } from "lucide-react";
import { FeaturedCard } from "@/components/integrations/FeaturedCard";
import { IntegrationCard } from "@/components/integrations/IntegrationCard";
import { IntegrationSection } from "@/components/integrations/IntegrationSection";
import { IntegrationsSkeletonLoader } from "@/components/integrations/IntegrationsSkeletonLoader";
import {
  INTEGRATION_CATEGORIES,
  INTEGRATION_STATUS_ORDER,
  type IntegrationCategory,
  type IntegrationDefinition,
  type IntegrationTabValue,
} from "@/components/integrations/integrationsHubConfig";
import { PageContainer } from "@/components/joy/PageContainer";
import { useIntegrationsHubData } from "@/hooks/useIntegrationsHubData";

const REQUEST_INTEGRATION_MAILTO =
  "mailto:support@bloomsuite.app?subject=Request%20an%20Integration&body=Hi%20BloomSuite%20team%2C%0A%0AI'd%20like%20to%20request%20support%20for%20the%20following%20integration%3A%0A";

const FILTER_OPTIONS: Array<{
  value: IntegrationTabValue;
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "pos-systems", label: "POS" },
  { value: "marketing-import", label: "Marketing" },
  { value: "social", label: "Social" },
  { value: "analytics", label: "Analytics" },
  { value: "infrastructure", label: "Infrastructure" },
  { value: "automation", label: "Automation" },
];

const CATEGORY_COPY: Record<
  IntegrationCategory,
  { title: string; description: string }
> = {
  "pos-systems": {
    title: "Point of sale",
    description:
      "Commerce connections for orders, customers, and in-store revenue flows.",
  },
  "marketing-import": {
    title: "Marketing",
    description:
      "Audience and campaign connectors for CRM, email, and customer growth programs.",
  },
  social: {
    title: "Social",
    description:
      "Publishing and profile integrations for the channels your team manages every week.",
  },
  analytics: {
    title: "Analytics",
    description:
      "Measurement, website, and reporting integrations for traffic and attribution visibility.",
  },
  infrastructure: {
    title: "Infrastructure",
    description:
      "Operational services that keep forms, domains, and delivery flows working reliably.",
  },
  automation: {
    title: "Automation",
    description:
      "Workflow, orchestration, and handoff integrations for operational follow-through.",
  },
};

const CATEGORY_QUERY_ALIASES: Record<string, IntegrationCategory> = {
  pos: "pos-systems",
  "pos-systems": "pos-systems",
  crm: "marketing-import",
  marketing: "marketing-import",
  "marketing-import": "marketing-import",
  social: "social",
  website: "analytics",
  analytics: "analytics",
  automation: "automation",
  automations: "automation",
  infrastructure: "infrastructure",
};

const FEATURED_INTEGRATION_SLUGS = new Set(["email-infrastructure", "shopify"]);

type IntegrationsHubIndexProps = {
  forcedCategory?: IntegrationCategory;
  title?: string;
  description?: string;
};

function exportIntegrationStatuses(items: IntegrationDefinition[]) {
  const rows = [
    ["Name", "Category", "Status", "Detail Path"],
    ...items.map((item) => [
      item.name,
      item.categoryLabel,
      item.status,
      `/integrations/${item.slug}`,
    ]),
  ];

  const csv = rows
    .map((row) =>
      row.map((value) => `"${String(value).split('"').join('""')}"`).join(","),
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "integrations-status.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function resolveCategoryFromQuery(
  value: string | null,
): IntegrationCategory | null {
  if (!value) {
    return null;
  }

  return CATEGORY_QUERY_ALIASES[value.trim().toLowerCase()] ?? null;
}

function filterItems(
  items: IntegrationDefinition[],
  activeTab: IntegrationTabValue,
  searchQuery: string,
) {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  return items.filter((item) => {
    if (activeTab !== "all" && item.category !== activeTab) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return item.name.toLowerCase().includes(normalizedQuery);
  });
}

function sortItems(
  items: IntegrationDefinition[],
  sourceItems: IntegrationDefinition[],
) {
  const sourceOrder = new Map(
    sourceItems.map((item, index) => [item.slug, index]),
  );

  return [...items].sort((left, right) => {
    const statusDifference =
      INTEGRATION_STATUS_ORDER.indexOf(left.status) -
      INTEGRATION_STATUS_ORDER.indexOf(right.status);

    if (statusDifference !== 0) {
      return statusDifference;
    }

    return (
      (sourceOrder.get(left.slug) ?? 0) - (sourceOrder.get(right.slug) ?? 0)
    );
  });
}

function getEmptyStateCopy(
  activeTab: IntegrationTabValue,
  searchQuery: string,
) {
  if (searchQuery.trim()) {
    return {
      title: "No providers match that search",
      description:
        "Try a different provider name or clear the current search to browse the full catalog again.",
    };
  }

  if (activeTab === "all") {
    return {
      title: "No integrations available",
      description:
        "This workspace does not have any integration definitions to display right now.",
    };
  }

  return {
    title: "No providers in this category",
    description:
      "Switch to another category or return to the full hub to explore other connection types.",
  };
}

function getCategorySection(category: IntegrationCategory) {
  const config = CATEGORY_COPY[category];

  return {
    title: config.title,
    description: config.description,
  };
}

export function IntegrationsHubIndex({
  forcedCategory,
  title,
  description,
}: IntegrationsHubIndexProps = {}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const { items, canUseActions, isLoading, isRefreshing, statusUnavailable } =
    useIntegrationsHubData();

  const queryCategory = forcedCategory
    ? null
    : resolveCategoryFromQuery(searchParams.get("category"));
  const activeTab: IntegrationTabValue =
    forcedCategory ?? queryCategory ?? "all";
  const filteredItems = useMemo(
    () => filterItems(items, activeTab, searchQuery),
    [activeTab, items, searchQuery],
  );
  const sortedItems = useMemo(
    () => sortItems(filteredItems, items),
    [filteredItems, items],
  );
  const groupedItems = useMemo(
    () =>
      INTEGRATION_CATEGORIES.reduce<
        Record<IntegrationCategory, IntegrationDefinition[]>
      >(
        (groups, category) => {
          groups[category.value] = sortedItems.filter(
            (item) => item.category === category.value,
          );
          return groups;
        },
        {
          "pos-systems": [],
          social: [],
          analytics: [],
          "marketing-import": [],
          automation: [],
          infrastructure: [],
        },
      ),
    [sortedItems],
  );

  const currentCategoryCopy =
    activeTab === "all" ? null : CATEGORY_COPY[activeTab];
  const pageTitle = title ?? currentCategoryCopy?.title ?? "Integrations";
  const pageDescription =
    description ??
    currentCategoryCopy?.description ??
    "Connect BloomSuite to commerce, marketing, analytics, automation, and infrastructure tools without leaving the dashboard.";
  const emptyState = getEmptyStateCopy(activeTab, searchQuery);

  const handleCardActivate = (item: IntegrationDefinition) => {
    navigate(`/integrations/${item.slug}`);
  };

  const handleFilterChange = (nextValue: IntegrationTabValue) => {
    if (forcedCategory) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);

    if (nextValue === "all") {
      nextParams.delete("category");
    } else {
      nextParams.set("category", nextValue);
    }

    setSearchParams(nextParams, { replace: true });
  };

  const cardStatusProps = (item: IntegrationDefinition) => {
    if (!statusUnavailable || item.status === "coming-soon") {
      return {};
    }

    return {
      statusTone: "error" as const,
      statusLabel: "Status unavailable",
      activityLabel: "Connection data unavailable",
    };
  };

  if (isLoading) {
    return (
      <IntegrationsSkeletonLoader
        canUseActions={canUseActions}
        showFilters={!forcedCategory}
      />
    );
  }

  return (
    <PageContainer
      fullWidth
      sx={{ px: { xs: 2, md: 3 }, py: { xs: 2.5, md: 3.5 } }}
    >
      <Stack spacing={3}>
        <Sheet
          color="neutral"
          variant="soft"
          sx={{
            borderRadius: "xl",
            border: "1px solid",
            borderColor: "neutral.200",
            p: { xs: 2.5, md: 3 },
            bgcolor: "background.level1",
          }}
        >
          <Stack spacing={1.25}>
            {activeTab !== "all" ? (
              <Button
                color="neutral"
                component={RouterLink}
                size="sm"
                startDecorator={<ChevronLeft size={16} />}
                sx={{ alignSelf: "flex-start" }}
                to="/integrations"
                variant="plain"
              >
                All integrations
              </Button>
            ) : null}

            <Stack
              direction={{ xs: "column", lg: "row" }}
              spacing={2}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", lg: "center" }}
            >
              <Stack spacing={0.75} sx={{ maxWidth: 820 }}>
                <Typography
                  level="body-sm"
                  sx={{ color: "text.tertiary", fontWeight: 600 }}
                >
                  {activeTab === "all"
                    ? "Integration catalog"
                    : "Category landing"}
                </Typography>
                <Typography level="h2">{pageTitle}</Typography>
                <Typography
                  level="body-sm"
                  sx={{ color: "text.secondary", maxWidth: 720 }}
                >
                  {pageDescription}
                </Typography>
              </Stack>

              {canUseActions ? (
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  alignItems={{ xs: "stretch", sm: "center" }}
                >
                  <Button
                    color="neutral"
                    size="sm"
                    startDecorator={<Download size={16} />}
                    variant="outlined"
                    onClick={() => exportIntegrationStatuses(sortedItems)}
                  >
                    Export status
                  </Button>
                  <Button
                    color="neutral"
                    component="a"
                    href={REQUEST_INTEGRATION_MAILTO}
                    size="sm"
                    startDecorator={<MailPlus size={16} />}
                    variant="solid"
                  >
                    Request integration
                  </Button>
                </Stack>
              ) : null}
            </Stack>
          </Stack>
        </Sheet>

        {isRefreshing ? (
          <LinearProgress color="neutral" size="sm" variant="soft" />
        ) : null}

        <Stack spacing={1.5}>
          <Stack
            direction={{ xs: "column", xl: "row" }}
            spacing={1.5}
            alignItems={{ xs: "stretch", xl: "center" }}
          >
            <Input
              aria-label="Search integrations"
              color="neutral"
              endDecorator={
                searchQuery ? (
                  <IconButton
                    aria-label="Clear search"
                    color="neutral"
                    size="sm"
                    variant="plain"
                    onClick={() => setSearchQuery("")}
                  >
                    <X size={16} />
                  </IconButton>
                ) : null
              }
              placeholder="Search by provider name"
              startDecorator={<Search size={16} />}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              sx={{ flex: 1, minWidth: { xs: "100%", xl: 320 } }}
            />

            {!forcedCategory ? (
              <Box
                role="tablist"
                aria-label="Integration categories"
                sx={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 1,
                  alignItems: "center",
                }}
              >
                {FILTER_OPTIONS.map((option) => {
                  const selected = activeTab === option.value;

                  return (
                    <Button
                      key={option.value}
                      aria-pressed={selected}
                      color="neutral"
                      size="sm"
                      variant={selected ? "solid" : "outlined"}
                      onClick={() => handleFilterChange(option.value)}
                    >
                      {option.label}
                    </Button>
                  );
                })}
              </Box>
            ) : null}
          </Stack>
        </Stack>

        {sortedItems.length === 0 ? (
          <Sheet
            color="neutral"
            variant="outlined"
            sx={{
              borderRadius: "xl",
              borderStyle: "dashed",
              p: { xs: 3, md: 4 },
              textAlign: "center",
            }}
          >
            <Stack spacing={1} alignItems="center">
              <Box
                sx={{
                  display: "grid",
                  placeItems: "center",
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  bgcolor: "neutral.softBg",
                  color: "text.secondary",
                }}
              >
                <Search size={18} />
              </Box>
              <Typography level="title-lg">{emptyState.title}</Typography>
              <Typography
                level="body-sm"
                sx={{ color: "text.secondary", maxWidth: 520 }}
              >
                {emptyState.description}
              </Typography>
              {searchQuery ? (
                <Button
                  color="neutral"
                  size="sm"
                  variant="plain"
                  onClick={() => setSearchQuery("")}
                >
                  Clear search
                </Button>
              ) : null}
            </Stack>
          </Sheet>
        ) : activeTab === "all" ? (
          <Stack spacing={3}>
            {INTEGRATION_CATEGORIES.map((category) => {
              const sectionItems = groupedItems[category.value];

              if (sectionItems.length === 0) {
                return null;
              }

              const section = getCategorySection(category.value);

              return (
                <IntegrationSection
                  key={category.value}
                  title={section.title}
                  description={section.description}
                  icon={section.icon}
                >
                  {sectionItems.map((item) =>
                    FEATURED_INTEGRATION_SLUGS.has(item.slug) ||
                    item.isManagedInfrastructure ? (
                      <FeaturedCard
                        key={item.slug}
                        item={item}
                        onActivate={handleCardActivate}
                        {...cardStatusProps(item)}
                      />
                    ) : (
                      <IntegrationCard
                        key={item.slug}
                        item={item}
                        onActivate={handleCardActivate}
                        {...cardStatusProps(item)}
                      />
                    ),
                  )}
                </IntegrationSection>
              );
            })}
          </Stack>
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                md: "repeat(2, minmax(0, 1fr))",
                xl: "repeat(3, minmax(0, 1fr))",
              },
              gap: 2,
            }}
          >
            {sortedItems.map((item) =>
              FEATURED_INTEGRATION_SLUGS.has(item.slug) ||
              item.isManagedInfrastructure ? (
                <FeaturedCard
                  key={item.slug}
                  item={item}
                  onActivate={handleCardActivate}
                  {...cardStatusProps(item)}
                />
              ) : (
                <IntegrationCard
                  key={item.slug}
                  item={item}
                  onActivate={handleCardActivate}
                  {...cardStatusProps(item)}
                />
              ),
            )}
          </Box>
        )}
      </Stack>
    </PageContainer>
  );
}
