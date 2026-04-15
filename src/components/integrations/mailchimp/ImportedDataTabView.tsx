import { Fragment, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Database,
  FilterX,
  ShieldCheck,
  Tags,
  Users,
} from "lucide-react";

import { SectionCard } from "@/components/integrations/shared/detailPrimitives";
import {
  DataTabEmptyState,
  DataTabPagination,
  TableSearchInput,
  ToolbarSelect,
  formatCount,
  formatDateTimeValue,
  formatRelativeTimestamp,
} from "@/components/integrations/shared/dataTabPrimitives";
import { Badge } from "@/components/ui-legacy/badge";
import { Button } from "@/components/ui-legacy/button";
import { cn } from "@/lib/utils";
import {
  type MailchimpImportedSection,
  useMailchimpCompliancePage,
  useMailchimpImportedCompliance,
  useMailchimpImportedCustomers,
  useMailchimpImportedDataSummary,
  useMailchimpImportedSegments,
  useMailchimpImportedTags,
  useMailchimpSegmentMembersPreview,
} from "@/hooks/useMailchimpImportedData";

const SECTION_OPTIONS: Array<{
  value: MailchimpImportedSection;
  label: string;
  icon: typeof Users;
}> = [
  { value: "customers", label: "Customers", icon: Users },
  { value: "segments", label: "Segments", icon: Database },
  { value: "tags", label: "Tags", icon: Tags },
  { value: "compliance", label: "Consents & Suppressions", icon: ShieldCheck },
];

const HAS_FILTER_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Has value", value: "yes" },
] as const;

function formatPhoneNumber(phone?: string | null) {
  if (!phone) {
    return "—";
  }

  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  return phone;
}

function renderNameList(values: string[], emptyLabel = "—") {
  if (values.length === 0) {
    return <span className="text-sm text-muted-foreground">{emptyLabel}</span>;
  }

  const visible = values.slice(0, 2);
  const overflow = values.length - visible.length;

  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((value) => (
        <Badge
          key={value}
          variant="secondary"
          className="bg-slate-100 text-slate-700"
        >
          {value}
        </Badge>
      ))}
      {overflow > 0 ? (
        <span className="text-xs text-muted-foreground">+{overflow} more</span>
      ) : null}
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-white/85 px-4 py-4 shadow-sm shadow-brand-navy/5">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-950">
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm text-slate-900">{value}</div>
    </div>
  );
}

function SegmentMembersPreview({ segmentId }: { segmentId: string }) {
  const membersQuery = useMailchimpSegmentMembersPreview(segmentId, {
    enabled: Boolean(segmentId),
  });

  if (membersQuery.isLoading) {
    return (
      <p className="text-sm text-muted-foreground">Loading member preview…</p>
    );
  }

  if ((membersQuery.data ?? []).length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No member emails available.
      </p>
    );
  }

  return (
    <ul className="space-y-2 text-sm text-slate-900">
      {(membersQuery.data ?? []).map((email) => (
        <li key={email} className="rounded-lg bg-slate-50 px-3 py-2">
          {email}
        </li>
      ))}
    </ul>
  );
}

export function ImportedDataTabView({
  isConnected,
  onOpenConnectDialog,
  onOpenImportDialog,
}: {
  isConnected: boolean;
  onOpenConnectDialog: () => void;
  onOpenImportDialog: () => void;
}) {
  const [section, setSection] = useState<MailchimpImportedSection>("customers");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerPage, setCustomerPage] = useState(1);
  const [segmentPresence, setSegmentPresence] = useState<"all" | "yes">("all");
  const [tagPresence, setTagPresence] = useState<"all" | "yes">("all");
  const [customerSegmentFilter, setCustomerSegmentFilter] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [customerTagFilter, setCustomerTagFilter] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(
    null,
  );
  const [expandedSegmentId, setExpandedSegmentId] = useState<string | null>(
    null,
  );
  const [consentPage, setConsentPage] = useState(1);
  const [suppressionPage, setSuppressionPage] = useState(1);
  const primaryActionLabel = isConnected ? "Start Import" : "Connect Mailchimp";
  const handlePrimaryAction = isConnected
    ? onOpenImportDialog
    : onOpenConnectDialog;

  const summaryQuery = useMailchimpImportedDataSummary();
  const customerQuery = useMailchimpImportedCustomers({
    page: customerPage,
    search: customerSearch,
    hasSegments: segmentPresence === "yes",
    hasTags: tagPresence === "yes",
    segmentId: customerSegmentFilter?.id ?? null,
    tagId: customerTagFilter?.id ?? null,
  });
  const segmentsQuery = useMailchimpImportedSegments({ enabled: true });
  const tagsQuery = useMailchimpImportedTags({ enabled: true });
  const complianceQuery = useMailchimpImportedCompliance({ enabled: true });
  const consentPageState = useMailchimpCompliancePage(
    complianceQuery.data?.consentRows ?? [],
    consentPage,
  );
  const suppressionPageState = useMailchimpCompliancePage(
    complianceQuery.data?.suppressionRows ?? [],
    suppressionPage,
  );

  const hasImportedCustomers = (summaryQuery.data.totalCustomers ?? 0) > 0;

  const resetCustomerPage = () => {
    setCustomerPage(1);
    setExpandedCustomerId(null);
  };

  const openCustomerSegmentFilter = (
    segmentId: string,
    segmentName: string,
  ) => {
    setSection("customers");
    setCustomerSegmentFilter({ id: segmentId, name: segmentName });
    setCustomerTagFilter(null);
    resetCustomerPage();
  };

  const openCustomerTagFilter = (tagId: string, tagName: string) => {
    setSection("customers");
    setCustomerTagFilter({ id: tagId, name: tagName });
    setCustomerSegmentFilter(null);
    resetCustomerPage();
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="Imported Data"
        description="Browse the CRM records Mailchimp has already written into BloomSuite."
      >
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <SummaryStat
              label="Mailchimp Customers"
              value={summaryQuery.data.totalCustomers}
            />
            <SummaryStat
              label="Mailchimp Segments"
              value={summaryQuery.data.totalSegments}
            />
            <SummaryStat
              label="Associated Tags"
              value={summaryQuery.data.totalTags}
            />
            <SummaryStat
              label="Active Consent Records"
              value={summaryQuery.data.activeConsentRecords}
            />
            <SummaryStat
              label="Active Suppressions"
              value={summaryQuery.data.activeSuppressions}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {SECTION_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isActive = option.value === section;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSection(option.value)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-border bg-white text-slate-700 hover:bg-slate-50",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </SectionCard>

      {!hasImportedCustomers && !summaryQuery.loading ? (
        <SectionCard
          title="Imported Data"
          description="Mailchimp data appears here after the first successful import."
        >
          <DataTabEmptyState
            icon={Database}
            title="No imported data yet"
            description="No imported data yet. Connect Mailchimp and run your first import to see your data here."
            action={
              <Button
                type="button"
                variant="outline"
                onClick={handlePrimaryAction}
              >
                {primaryActionLabel}
              </Button>
            }
          />
        </SectionCard>
      ) : null}

      {summaryQuery.error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          Imported Mailchimp data could not be loaded right now.
        </div>
      ) : null}

      {hasImportedCustomers ? (
        <>
          {section === "customers" ? (
            <SectionCard
              title="Customers"
              description="Search Mailchimp-sourced CRM customers, then expand a row to inspect the linked CRM details."
            >
              <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-wrap items-center gap-3">
                    <TableSearchInput
                      placeholder="Search by email, first name, or last name…"
                      value={customerSearch}
                      onChange={(value) => {
                        setCustomerSearch(value);
                        resetCustomerPage();
                      }}
                    />
                    <ToolbarSelect
                      ariaLabel="Filter customers by segment presence"
                      value={segmentPresence}
                      onChange={(value) => {
                        setSegmentPresence(value);
                        resetCustomerPage();
                      }}
                      options={
                        HAS_FILTER_OPTIONS as Array<{
                          label: string;
                          value: "all" | "yes";
                        }>
                      }
                    />
                    <ToolbarSelect
                      ariaLabel="Filter customers by tag presence"
                      value={tagPresence}
                      onChange={(value) => {
                        setTagPresence(value);
                        resetCustomerPage();
                      }}
                      options={
                        HAS_FILTER_OPTIONS as Array<{
                          label: string;
                          value: "all" | "yes";
                        }>
                      }
                    />
                  </div>
                  <div className="text-xs tabular-nums text-muted-foreground">
                    {(
                      customerQuery.data?.pagination.totalCount ?? 0
                    ).toLocaleString()}{" "}
                    records
                  </div>
                </div>

                {customerSegmentFilter || customerTagFilter ? (
                  <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-5 py-3">
                    {customerSegmentFilter ? (
                      <Badge
                        variant="secondary"
                        className="gap-2 bg-sky-50 text-sky-700"
                      >
                        Segment: {customerSegmentFilter.name}
                      </Badge>
                    ) : null}
                    {customerTagFilter ? (
                      <Badge
                        variant="secondary"
                        className="gap-2 bg-emerald-50 text-emerald-700"
                      >
                        Tag: {customerTagFilter.name}
                      </Badge>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => {
                        setCustomerSegmentFilter(null);
                        setCustomerTagFilter(null);
                        resetCustomerPage();
                      }}
                    >
                      <FilterX className="mr-1.5 h-3.5 w-3.5" />
                      Clear linked filter
                    </Button>
                  </div>
                ) : null}

                {customerQuery.isLoading ? (
                  <div className="px-5 py-10 text-sm text-muted-foreground">
                    Loading imported customers…
                  </div>
                ) : null}

                {(customerQuery.data?.rows.length ?? 0) > 0 ? (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1060px] border-collapse">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Email
                            </th>
                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              First Name
                            </th>
                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Last Name
                            </th>
                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Phone
                            </th>
                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Imported At
                            </th>
                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Segments
                            </th>
                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Tags
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {(customerQuery.data?.rows ?? []).map((row) => {
                            const isExpanded = expandedCustomerId === row.id;

                            return (
                              <Fragment key={row.id}>
                                <tr
                                  className="cursor-pointer border-b border-gray-50 transition-colors hover:bg-gray-50"
                                  onClick={() =>
                                    setExpandedCustomerId(
                                      isExpanded ? null : row.id,
                                    )
                                  }
                                >
                                  <td className="px-5 py-3 text-sm text-slate-900">
                                    <div className="flex items-center gap-2">
                                      {isExpanded ? (
                                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                      )}
                                      <span>{row.email}</span>
                                    </div>
                                  </td>
                                  <td className="px-5 py-3 text-sm text-slate-900">
                                    {row.firstName || "—"}
                                  </td>
                                  <td className="px-5 py-3 text-sm text-slate-900">
                                    {row.lastName || "—"}
                                  </td>
                                  <td className="px-5 py-3 text-sm text-slate-900">
                                    {formatPhoneNumber(row.phone)}
                                  </td>
                                  <td className="px-5 py-3 text-sm text-muted-foreground">
                                    {formatRelativeTimestamp(row.importedAt)}
                                  </td>
                                  <td className="px-5 py-3 text-sm text-slate-900">
                                    {renderNameList(
                                      row.segments.map(
                                        (segment) => segment.name,
                                      ),
                                    )}
                                  </td>
                                  <td className="px-5 py-3 text-sm text-slate-900">
                                    {renderNameList(
                                      row.tags.map((tag) => tag.name),
                                    )}
                                  </td>
                                </tr>
                                {isExpanded ? (
                                  <tr className="border-b border-gray-100 bg-slate-50/70">
                                    <td colSpan={7} className="px-5 py-5">
                                      <div className="grid gap-5 lg:grid-cols-2">
                                        <div className="space-y-4 rounded-2xl border border-border/70 bg-white p-4">
                                          <h4 className="text-sm font-semibold text-slate-950">
                                            Customer Details
                                          </h4>
                                          <div className="grid gap-4 sm:grid-cols-2">
                                            <DetailField
                                              label="Email"
                                              value={row.email}
                                            />
                                            <DetailField
                                              label="Phone"
                                              value={formatPhoneNumber(
                                                row.phone,
                                              )}
                                            />
                                            <DetailField
                                              label="Imported At"
                                              value={formatDateTimeValue(
                                                row.importedAt,
                                              )}
                                            />
                                            <DetailField
                                              label="Mailchimp Source ID"
                                              value={row.sourceId ?? "—"}
                                            />
                                          </div>
                                          <div>
                                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                              Linked Segments
                                            </div>
                                            <div className="mt-2">
                                              {renderNameList(
                                                row.segments.map(
                                                  (segment) => segment.name,
                                                ),
                                                "No linked segments",
                                              )}
                                            </div>
                                          </div>
                                          <div>
                                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                              Linked Tags
                                            </div>
                                            <div className="mt-2">
                                              {renderNameList(
                                                row.tags.map((tag) => tag.name),
                                                "No linked tags",
                                              )}
                                            </div>
                                          </div>
                                        </div>

                                        <div className="space-y-4 rounded-2xl border border-border/70 bg-white p-4">
                                          <h4 className="text-sm font-semibold text-slate-950">
                                            Compliance Snapshot
                                          </h4>
                                          <div className="grid gap-4 sm:grid-cols-2">
                                            <DetailField
                                              label="Latest Consent"
                                              value={
                                                row.latestConsent
                                                  ? `${row.latestConsent.statusLabel} · ${row.latestConsent.channel}`
                                                  : "No consent record"
                                              }
                                            />
                                            <DetailField
                                              label="Consent Recorded"
                                              value={
                                                row.latestConsent
                                                  ? formatDateTimeValue(
                                                      row.latestConsent
                                                        .recordedAt,
                                                    )
                                                  : "—"
                                              }
                                            />
                                            <DetailField
                                              label="Suppression Status"
                                              value={
                                                row.activeSuppression
                                                  ? "Active suppression"
                                                  : "Clear"
                                              }
                                            />
                                            <DetailField
                                              label="Suppression Reason"
                                              value={
                                                row.activeSuppression?.reason ??
                                                "—"
                                              }
                                            />
                                          </div>
                                          {row.allSuppressions.length > 0 ? (
                                            <div>
                                              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                                Active Suppressions
                                              </div>
                                              <div className="mt-2 flex flex-wrap gap-2">
                                                {row.allSuppressions.map(
                                                  (suppression) => (
                                                    <Badge
                                                      key={suppression.id}
                                                      variant="outline"
                                                    >
                                                      {suppression.channel}:{" "}
                                                      {suppression.reason}
                                                    </Badge>
                                                  ),
                                                )}
                                              </div>
                                            </div>
                                          ) : null}
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                ) : null}
                              </Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <DataTabPagination
                      pagination={
                        customerQuery.data?.pagination ?? {
                          page: 1,
                          pageSize: 25,
                          totalCount: 0,
                          totalPages: 1,
                        }
                      }
                      onPageChange={(page) => {
                        setCustomerPage(page);
                        setExpandedCustomerId(null);
                      }}
                    />
                  </>
                ) : null}

                {!customerQuery.isLoading &&
                (customerQuery.data?.rows.length ?? 0) === 0 ? (
                  <DataTabEmptyState
                    icon={Users}
                    title="No customers match this view"
                    description="Adjust the search or customer filters to see a different slice of imported Mailchimp data."
                  />
                ) : null}
              </div>
            </SectionCard>
          ) : null}

          {section === "segments" ? (
            <SectionCard
              title="Segments"
              description="Review the Mailchimp-backed CRM segments created by imports and jump into the linked customers."
            >
              <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                  <span className="text-sm font-medium text-slate-950">
                    Mailchimp segments
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {(segmentsQuery.data?.length ?? 0).toLocaleString()} records
                  </span>
                </div>

                {segmentsQuery.isLoading ? (
                  <div className="px-5 py-10 text-sm text-muted-foreground">
                    Loading imported segments…
                  </div>
                ) : null}

                {(segmentsQuery.data?.length ?? 0) > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[920px] border-collapse">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Segment Name
                          </th>
                          <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Source ID
                          </th>
                          <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Members
                          </th>
                          <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Created At
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(segmentsQuery.data ?? []).map((segment) => {
                          const isExpanded = expandedSegmentId === segment.id;

                          return (
                            <Fragment key={segment.id}>
                              <tr
                                className="cursor-pointer border-b border-gray-50 transition-colors hover:bg-gray-50"
                                onClick={() =>
                                  setExpandedSegmentId(
                                    isExpanded ? null : segment.id,
                                  )
                                }
                              >
                                <td className="px-5 py-3 text-sm text-slate-900">
                                  <div className="flex items-center gap-2">
                                    {isExpanded ? (
                                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                    )}
                                    <span>{segment.name}</span>
                                  </div>
                                </td>
                                <td className="px-5 py-3 text-sm text-slate-900">
                                  {segment.sourceId ?? "—"}
                                </td>
                                <td className="px-5 py-3 text-sm text-slate-900">
                                  {segment.memberCount.toLocaleString()}
                                </td>
                                <td className="px-5 py-3 text-sm text-muted-foreground">
                                  {formatDateTimeValue(segment.createdAt)}
                                </td>
                              </tr>
                              {isExpanded ? (
                                <tr className="border-b border-gray-100 bg-slate-50/70">
                                  <td colSpan={4} className="px-5 py-5">
                                    <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
                                      <div className="space-y-4 rounded-2xl border border-border/70 bg-white p-4">
                                        <div className="grid gap-4 sm:grid-cols-2">
                                          <DetailField
                                            label="Parent List"
                                            value={
                                              segment.parentListName ?? "—"
                                            }
                                          />
                                          <DetailField
                                            label="Member Count"
                                            value={segment.memberCount.toLocaleString()}
                                          />
                                        </div>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={() =>
                                            openCustomerSegmentFilter(
                                              segment.id,
                                              segment.name,
                                            )
                                          }
                                        >
                                          View All Customers
                                        </Button>
                                      </div>
                                      <div className="rounded-2xl border border-border/70 bg-white p-4">
                                        <div className="mb-3 text-sm font-semibold text-slate-950">
                                          First 10 Member Emails
                                        </div>
                                        <SegmentMembersPreview
                                          segmentId={segment.id}
                                        />
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              ) : null}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {!segmentsQuery.isLoading &&
                (segmentsQuery.data?.length ?? 0) === 0 ? (
                  <DataTabEmptyState
                    icon={Database}
                    title="No Mailchimp segments found"
                    description="Run a Mailchimp import that includes segments to see them here."
                  />
                ) : null}
              </div>
            </SectionCard>
          ) : null}

          {section === "tags" ? (
            <SectionCard
              title="Tags"
              description="Review tags attached to Mailchimp-sourced customers and jump into the tagged customer set."
            >
              <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                  <span className="text-sm font-medium text-slate-950">
                    Associated tags
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {(tagsQuery.data?.length ?? 0).toLocaleString()} records
                  </span>
                </div>

                {tagsQuery.isLoading ? (
                  <div className="px-5 py-10 text-sm text-muted-foreground">
                    Loading imported tags…
                  </div>
                ) : null}

                {(tagsQuery.data?.length ?? 0) > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] border-collapse">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Tag Name
                          </th>
                          <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Customers
                          </th>
                          <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Created At
                          </th>
                          <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(tagsQuery.data ?? []).map((tag) => (
                          <tr key={tag.id} className="border-b border-gray-50">
                            <td className="px-5 py-3 text-sm text-slate-900">
                              {tag.name}
                            </td>
                            <td className="px-5 py-3 text-sm text-slate-900">
                              {tag.customerCount.toLocaleString()}
                            </td>
                            <td className="px-5 py-3 text-sm text-muted-foreground">
                              {formatDateTimeValue(tag.createdAt)}
                            </td>
                            <td className="px-5 py-3 text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  openCustomerTagFilter(tag.id, tag.name)
                                }
                              >
                                View All
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {!tagsQuery.isLoading && (tagsQuery.data?.length ?? 0) === 0 ? (
                  <DataTabEmptyState
                    icon={Tags}
                    title="No Mailchimp tags found"
                    description="Tags appear here after Mailchimp imports associate them with CRM customers."
                  />
                ) : null}
              </div>
            </SectionCard>
          ) : null}

          {section === "compliance" ? (
            <div className="space-y-6">
              <SectionCard
                title="Consents"
                description="Current consent records for Mailchimp-sourced customers, grouped by channel and status."
              >
                <div className="space-y-5">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {(complianceQuery.data?.consentSummaryCards ?? []).map(
                      (card) => (
                        <SummaryStat
                          key={card.key}
                          label={card.label}
                          value={card.value}
                        />
                      ),
                    )}
                  </div>

                  <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                      <span className="text-sm font-medium text-slate-950">
                        Consent records
                      </span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {(
                          complianceQuery.data?.consentRows.length ?? 0
                        ).toLocaleString()}{" "}
                        records
                      </span>
                    </div>

                    {complianceQuery.isLoading ? (
                      <div className="px-5 py-10 text-sm text-muted-foreground">
                        Loading consent records…
                      </div>
                    ) : null}

                    {(consentPageState.rows.length ?? 0) > 0 ? (
                      <>
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[760px] border-collapse">
                            <thead>
                              <tr className="border-b border-gray-100">
                                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  Email
                                </th>
                                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  Channel
                                </th>
                                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  Consent Status
                                </th>
                                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  Recorded At
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {consentPageState.rows.map((row) => (
                                <tr
                                  key={row.id}
                                  className="border-b border-gray-50"
                                >
                                  <td className="px-5 py-3 text-sm text-slate-900">
                                    {row.email}
                                  </td>
                                  <td className="px-5 py-3 text-sm text-slate-900">
                                    {row.channel}
                                  </td>
                                  <td className="px-5 py-3 text-sm text-slate-900">
                                    <Badge
                                      variant="secondary"
                                      className="bg-slate-100 text-slate-700"
                                    >
                                      {row.statusLabel}
                                    </Badge>
                                  </td>
                                  <td className="px-5 py-3 text-sm text-muted-foreground">
                                    {formatDateTimeValue(row.recordedAt)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <DataTabPagination
                          pagination={consentPageState.pagination}
                          onPageChange={setConsentPage}
                        />
                      </>
                    ) : null}

                    {!complianceQuery.isLoading &&
                    consentPageState.rows.length === 0 ? (
                      <DataTabEmptyState
                        icon={ShieldCheck}
                        title="No consent records found"
                        description="Mailchimp consent records will appear here after they are written to CRM."
                      />
                    ) : null}
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title="Suppressions"
                description="Active suppression rows matched to Mailchimp-sourced customers by customer id or normalized email."
              >
                <div className="space-y-5">
                  <div className="grid gap-3 md:max-w-sm">
                    <SummaryStat
                      label="Active Suppressions"
                      value={complianceQuery.data?.activeSuppressions ?? 0}
                    />
                  </div>

                  <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                      <span className="text-sm font-medium text-slate-950">
                        Suppression records
                      </span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {(
                          complianceQuery.data?.suppressionRows.length ?? 0
                        ).toLocaleString()}{" "}
                        records
                      </span>
                    </div>

                    {complianceQuery.isLoading ? (
                      <div className="px-5 py-10 text-sm text-muted-foreground">
                        Loading suppression records…
                      </div>
                    ) : null}

                    {(suppressionPageState.rows.length ?? 0) > 0 ? (
                      <>
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[860px] border-collapse">
                            <thead>
                              <tr className="border-b border-gray-100">
                                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  Email / Phone
                                </th>
                                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  Channel
                                </th>
                                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  Reason
                                </th>
                                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  Suppressed At
                                </th>
                                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  Active
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {suppressionPageState.rows.map((row) => (
                                <tr
                                  key={row.id}
                                  className="border-b border-gray-50"
                                >
                                  <td className="px-5 py-3 text-sm text-slate-900">
                                    {row.email ?? row.phone ?? "—"}
                                  </td>
                                  <td className="px-5 py-3 text-sm text-slate-900">
                                    {row.channel}
                                  </td>
                                  <td className="px-5 py-3 text-sm text-slate-900">
                                    {row.reason}
                                  </td>
                                  <td className="px-5 py-3 text-sm text-muted-foreground">
                                    {formatDateTimeValue(row.suppressedAt)}
                                  </td>
                                  <td className="px-5 py-3 text-sm text-slate-900">
                                    <Badge
                                      variant="secondary"
                                      className="bg-rose-50 text-rose-700"
                                    >
                                      {row.active ? "Active" : "Lifted"}
                                    </Badge>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <DataTabPagination
                          pagination={suppressionPageState.pagination}
                          onPageChange={setSuppressionPage}
                        />
                      </>
                    ) : null}

                    {!complianceQuery.isLoading &&
                    suppressionPageState.rows.length === 0 ? (
                      <DataTabEmptyState
                        icon={ShieldCheck}
                        title="No suppression records found"
                        description="Active suppressions tied to Mailchimp contacts will appear here."
                      />
                    ) : null}
                  </div>
                </div>
              </SectionCard>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
