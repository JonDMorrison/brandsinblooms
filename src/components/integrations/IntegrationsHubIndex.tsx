import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BarChart3,
  BookOpen,
  Clover,
  Download,
  ExternalLink,
  Facebook,
  Globe,
  Hash,
  Hexagon,
  Instagram,
  Mail,
  MailPlus,
  Plus,
  Search,
  Settings,
  Share2,
  ShoppingBag,
  Square as SquareIcon,
  X,
  Webhook,
  Zap,
} from "lucide-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ActionDropdown,
  type ActionDropdownSection,
} from "@/components/ui/action-dropdown";
import { cn } from "@/lib/utils";
import { useIntegrationsHubData } from "@/hooks/useIntegrationsHubData";
import {
  filterIntegrations,
  getTabCounts,
  INTEGRATION_CATEGORIES,
  type IntegrationDefinition,
  INTEGRATION_STATUS_ORDER,
  type IntegrationStatus,
  type IntegrationTabValue,
} from "@/components/integrations/integrationsHubConfig";
import { IntegrationsSkeletonLoader } from "@/components/integrations/IntegrationsSkeletonLoader";

const REQUEST_INTEGRATION_MAILTO =
  "mailto:support@bloomsuite.app?subject=Request%20an%20Integration&body=Hi%20BloomSuite%20team%2C%0A%0AI'd%20like%20to%20request%20support%20for%20the%20following%20integration%3A%0A";

function getStatusLabel(status: IntegrationStatus) {
  if (status === "coming-soon") {
    return "Upcoming";
  }

  return status === "connected" ? "Connected" : "Available";
}

function exportIntegrationStatuses(items: IntegrationDefinition[]) {
  const rows = [
    ["Name", "Category", "Status", "Meta", "Detail Path"],
    ...items.map((item) => [
      item.name,
      item.categoryLabel,
      getStatusLabel(item.status),
      item.metaLabel ?? "",
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

const PROVIDER_DOMAIN_CONFIG: Record<
  string,
  { label: string; href: string } | null
> = {
  square: { label: "squareup.com", href: "https://squareup.com" },
  clover: { label: "clover.com", href: "https://clover.com" },
  lightspeed: {
    label: "lightspeedhq.com",
    href: "https://www.lightspeedhq.com",
  },
  meta: { label: "meta.com", href: "https://meta.com" },
  "google-analytics-4": {
    label: "analytics.google.com",
    href: "https://analytics.google.com",
  },
  mailchimp: { label: "mailchimp.com", href: "https://mailchimp.com" },
  klaviyo: { label: "klaviyo.com", href: "https://www.klaviyo.com" },
  "constant-contact": {
    label: "constantcontact.com",
    href: "https://www.constantcontact.com",
  },
  shopify: { label: "shopify.com", href: "https://shopify.com" },
  hubspot: { label: "hubspot.com", href: "https://www.hubspot.com" },
  zapier: { label: "zapier.com", href: "https://zapier.com" },
  slack: { label: "slack.com", href: "https://slack.com" },
  "custom-webhooks": null,
};

const PROVIDER_ICON_CONFIG: Record<
  string,
  {
    icon: IntegrationDefinition["icon"];
    iconClassName: string;
    tileClassName?: string;
  }
> = {
  square: {
    icon: SquareIcon,
    iconClassName: "h-6 w-6 text-black",
  },
  clover: {
    icon: Clover,
    iconClassName: "h-6 w-6 text-[#00A859]",
  },
  lightspeed: {
    icon: Zap,
    iconClassName: "h-6 w-6 text-[#FF6B35]",
  },
  meta: {
    icon: Share2,
    iconClassName: "h-6 w-6 text-[#0082FB]",
  },
  "google-analytics-4": {
    icon: BarChart3,
    iconClassName: "h-6 w-6 text-[#E37400]",
  },
  mailchimp: {
    icon: Mail,
    iconClassName: "h-6 w-6 text-[#FFE01B]",
    tileClassName: "bg-black",
  },
  klaviyo: {
    icon: Mail,
    iconClassName: "h-6 w-6 text-[#1B1B1B]",
  },
  "constant-contact": {
    icon: Mail,
    iconClassName: "h-6 w-6 text-[#005594]",
  },
  "email-infrastructure": {
    icon: Globe,
    iconClassName: "h-6 w-6 text-[#6B7280]",
  },
  shopify: {
    icon: ShoppingBag,
    iconClassName: "h-6 w-6 text-[#96BF48]",
  },
  hubspot: {
    icon: Hexagon,
    iconClassName: "h-6 w-6 text-[#FF7A59]",
  },
  zapier: {
    icon: Zap,
    iconClassName: "h-6 w-6 text-[#FF4A00]",
  },
  slack: {
    icon: Hash,
    iconClassName: "h-6 w-6 text-[#4A154B]",
  },
  "custom-webhooks": {
    icon: Webhook,
    iconClassName: "h-6 w-6 text-[#6B7280]",
  },
};

function getProviderLink(item: IntegrationDefinition) {
  if (item.slug === "email-infrastructure") {
    const domain = item.metaLabel?.trim();

    if (!domain) {
      return null;
    }

    return {
      label: domain,
      href: `https://${domain}`,
    };
  }

  return PROVIDER_DOMAIN_CONFIG[item.slug] ?? null;
}

function getCardIconConfig(item: IntegrationDefinition) {
  const config = PROVIDER_ICON_CONFIG[item.slug];

  if (config) {
    return config;
  }

  return {
    icon: item.icon,
    iconClassName: "h-6 w-6 text-slate-700",
  };
}

function getFooterActionLabel(item: IntegrationDefinition) {
  if (item.slug === "email-infrastructure") {
    return "Manage settings";
  }

  return item.status === "connected" ? "Manage" : "Connect";
}

function getStatusSortOrder(status: IntegrationStatus) {
  return INTEGRATION_STATUS_ORDER.indexOf(status);
}

function IntegrationCard({
  item,
  onPrimaryAction,
}: {
  item: IntegrationDefinition;
  onPrimaryAction: (item: IntegrationDefinition) => void;
}) {
  const { icon: Icon, iconClassName, tileClassName } = getCardIconConfig(item);
  const isConnected = item.status === "connected";
  const isComingSoon = item.status === "coming-soon";
  const isInfrastructure = item.slug === "email-infrastructure";
  const providerLink = getProviderLink(item);
  const actionLabel = getFooterActionLabel(item);

  return (
    <article
      className={cn(
        "flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-5 transition-[border-color,box-shadow,opacity] duration-150 ease-out",
        isComingSoon ? "cursor-default opacity-60" : "hover:shadow-sm",
        !isComingSoon &&
          (isConnected ? "hover:border-emerald-200" : "hover:border-gray-300"),
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-4">
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-white",
            tileClassName,
          )}
        >
          <Icon className={iconClassName} />
        </div>
        {providerLink ? (
          <a
            href={providerLink.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-slate-900"
            onClick={(event) => event.stopPropagation()}
          >
            <span>{providerLink.label}</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col">
        <h3 className="mb-1 text-[15px] font-semibold leading-5 text-foreground">
          {item.name}
        </h3>
        <p className="mb-4 line-clamp-2 text-[13px] leading-[1.5] text-muted-foreground">
          {item.description}
        </p>

        {item.children && item.children.length > 0 ? (
          <div className="mb-3 flex flex-col gap-1">
            <div className="space-y-1">
              {item.children.map((child) => (
                <div
                  key={child.name}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {child.name === "Facebook" ? (
                      <Facebook className="h-3.5 w-3.5 text-[#1877F2]" />
                    ) : null}
                    {child.name === "Instagram" ? (
                      <Instagram className="h-3.5 w-3.5 text-[#E4405F]" />
                    ) : null}
                    {child.name}
                  </span>
                  <span
                    className={cn(
                      "text-xs",
                      child.status === "connected"
                        ? "font-medium text-emerald-600"
                        : "text-muted-foreground",
                    )}
                  >
                    {child.status === "connected"
                      ? "Connected"
                      : "Not connected"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
        <div className="min-h-9 flex items-center gap-1">
          <Button
            asChild
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 rounded-lg px-2 text-sm font-medium text-muted-foreground hover:bg-gray-50 hover:text-slate-900"
          >
            <Link to={`/integrations/${item.slug}/documentation`}>
              <BookOpen className="h-3.5 w-3.5" />
              <span>Documentation</span>
            </Link>
          </Button>

          {isComingSoon ? (
            <span className="select-text text-xs text-muted-foreground">
              Upcoming
            </span>
          ) : null}
        </div>

        <div className="ml-auto flex items-center gap-3">
          {!isComingSoon ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label={isInfrastructure ? actionLabel : undefined}
              className={cn(
                "h-8 text-sm font-medium",
                isInfrastructure || isConnected
                  ? cn(
                      "rounded-lg text-muted-foreground hover:bg-gray-50 hover:text-slate-900",
                      isInfrastructure ? "w-8 px-0" : "px-2",
                    )
                  : "rounded-md border border-gray-300 bg-white px-2 text-slate-900 shadow-sm hover:border-gray-300 hover:bg-brand-teal hover:text-white",
              )}
              onClick={() => onPrimaryAction(item)}
            >
              {isInfrastructure || isConnected ? (
                <>
                  <Settings className="h-3.5 w-3.5" />
                  {isInfrastructure ? null : <span>{actionLabel}</span>}
                </>
              ) : (
                <>
                  <span>Add</span>
                  <Plus className="h-3.5 w-3.5" />
                </>
              )}
            </Button>
          ) : null}

          {isConnected && !isInfrastructure ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  aria-label={`${item.name} sync management`}
                  className="inline-flex items-center"
                >
                  <Switch
                    checked
                    disabled
                    aria-label={`${item.name} sync toggle`}
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Sync management coming soon</p>
              </TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function IntegrationsHubIndex() {
  const navigate = useNavigate();
  const { items, canUseActions, isLoading } = useIntegrationsHubData();
  const [activeTab, setActiveTab] = useState<IntegrationTabValue>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredItems = useMemo(
    () => filterIntegrations(items, activeTab, searchQuery),
    [activeTab, items, searchQuery],
  );
  const tabCounts = useMemo(
    () => getTabCounts(items, searchQuery),
    [items, searchQuery],
  );
  const sortedItems = useMemo(
    () =>
      filteredItems
        .map((item, index) => ({ item, index }))
        .sort((left, right) => {
          const statusDifference =
            getStatusSortOrder(left.item.status) -
            getStatusSortOrder(right.item.status);

          if (statusDifference !== 0) {
            return statusDifference;
          }

          return left.index - right.index;
        })
        .map(({ item }) => item),
    [filteredItems],
  );

  const headerActionSections: ActionDropdownSection[] = useMemo(
    () => [
      {
        label: "Export",
        items: [
          {
            label: "Export Integration Status",
            description:
              "Download the current filtered integration view as CSV.",
            icon: Download,
            onSelect: () => exportIntegrationStatuses(filteredItems),
          },
        ],
      },
      {
        label: "Requests",
        items: [
          {
            label: "Request an Integration",
            description:
              "Email the BloomSuite team with a new integration request.",
            icon: MailPlus,
            onSelect: () => {
              window.location.href = REQUEST_INTEGRATION_MAILTO;
            },
          },
        ],
      },
    ],
    [filteredItems],
  );

  const handlePrimaryAction = (item: IntegrationDefinition) => {
    navigate(`/integrations/${item.slug}`);
  };

  const noSearchResults =
    searchQuery.trim().length > 0 && filteredItems.length === 0;
  const noCategoryResults =
    searchQuery.trim().length === 0 && filteredItems.length === 0;

  if (isLoading) {
    return <IntegrationsSkeletonLoader canUseActions={canUseActions} />;
  }

  return (
    <div className="container mx-auto space-y-7 p-6">
      <section className="space-y-5 rounded-[1.75rem] border border-border/70 bg-gradient-to-br from-white via-white to-brand-teal/5 p-5 shadow-sm shadow-brand-navy/5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-4">
            <Breadcrumb>
              <BreadcrumbList className="flex-wrap gap-2 rounded-full border border-border/70 bg-white/90 px-4 py-2 text-sm shadow-sm shadow-brand-navy/5 backdrop-blur-sm">
                <BreadcrumbItem>
                  <BreadcrumbLink
                    asChild
                    className="font-medium text-muted-foreground transition-colors hover:text-brand-navy"
                  >
                    <Link to="/dashboard">Dashboard</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="text-muted-foreground/50" />
                <BreadcrumbItem>
                  <BreadcrumbPage className="font-semibold text-brand-navy">
                    Integrations
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-slate-950">
                Integrations
              </h1>
              <p className="text-sm text-muted-foreground">
                Connect your tools to power BloomSuite&apos;s marketing and
                operations.
              </p>
            </div>
          </div>

          {canUseActions ? (
            <ActionDropdown
              label="Actions"
              variant="outline"
              align="end"
              triggerClassName="self-start border-border/80 bg-white/95 shadow-sm"
              sections={headerActionSections}
            />
          ) : null}
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div
            className="flex flex-wrap gap-2 border-b border-border/70 pb-2"
            role="tablist"
            aria-label="Integration categories"
          >
            {[
              { value: "all" as const, label: "All" },
              ...INTEGRATION_CATEGORIES.map((category) => ({
                value: category.value,
                label: category.label,
              })),
            ].map((tab) => {
              const isActive = activeTab === tab.value;

              return (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={cn(
                    "inline-flex items-center gap-1 border-b-2 px-2 py-2 text-sm transition-colors",
                    isActive
                      ? "border-brand-teal text-slate-950"
                      : "border-transparent text-muted-foreground hover:text-slate-900",
                  )}
                  onClick={() => setActiveTab(tab.value)}
                >
                  <span>{tab.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {tabCounts[tab.value]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="relative min-w-0 flex-1 lg:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="h-10 rounded-xl border-border bg-white pl-10 pr-10 shadow-sm focus-visible:ring-brand-teal"
              placeholder="Search integrations by name, description, or category..."
              aria-label="Search integrations"
            />
            {searchQuery ? (
              <button
                type="button"
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-slate-900"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="space-y-6">
        {noSearchResults ? (
          <div className="rounded-2xl border border-dashed border-border/80 bg-slate-50/60 px-6 py-14 text-center shadow-sm">
            <span className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-border/70 bg-white text-muted-foreground shadow-sm">
              <Search className="h-6 w-6" />
            </span>
            <h2 className="text-lg font-semibold text-brand-navy">
              No integrations match your search
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Try a different term or clear the current search.
            </p>
            <button
              type="button"
              className="mt-4 text-sm font-medium text-brand-teal underline-offset-4 hover:underline"
              onClick={() => setSearchQuery("")}
            >
              Clear search
            </button>
          </div>
        ) : noCategoryResults ? (
          <div className="rounded-2xl border border-dashed border-border/80 bg-slate-50/60 px-6 py-10 text-center shadow-sm">
            <p className="text-sm text-muted-foreground">
              No integrations in this category yet.
            </p>
          </div>
        ) : (
          <div className="grid animate-fade-in gap-4 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
            {sortedItems.map((item) => (
              <IntegrationCard
                key={item.slug}
                item={item}
                onPrimaryAction={handlePrimaryAction}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
