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
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Chip from "@mui/joy/Chip";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Table from "@mui/joy/Table";
import Typography from "@mui/joy/Typography";
import Alert from "@mui/joy/Alert";

import {
  SectionCard,
  StatCardSkeleton,
} from "@/components/integrations/shared/detailPrimitives";
import {
  DataTabEmptyState,
  DataTabPagination,
  TableSearchInput,
  TableSkeleton,
  ToolbarSelect,
  formatDateTimeValue,
  formatRelativeTimestamp,
} from "@/components/integrations/shared/dataTabPrimitives";
import { formatCount } from "@/components/integrations/shared/formatCount";
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
    return "\u2014";
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

function renderNameList(values: string[], emptyLabel = "\u2014") {
  if (values.length === 0) {
    return (
      <Typography level="body-sm" sx={{ color: "text.secondary" }}>
        {emptyLabel}
      </Typography>
    );
  }

  const visible = values.slice(0, 2);
  const overflow = values.length - visible.length;

  return (
    <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap" }}>
      {visible.map((value) => (
        <Chip key={value} size="sm" variant="soft" color="neutral">
          {value}
        </Chip>
      ))}
      {overflow > 0 ? (
        <Typography
          level="body-xs"
          sx={{ color: "text.secondary", alignSelf: "center" }}
        >
          +{overflow} more
        </Typography>
      ) : null}
    </Stack>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <Sheet variant="outlined" sx={{ borderRadius: "lg", px: 2, py: 1.5 }}>
      <Typography
        level="body-xs"
        fontWeight="lg"
        sx={{
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "text.tertiary",
        }}
      >
        {label}
      </Typography>
      <Typography level="h4" sx={{ mt: 0.75 }}>
        {value.toLocaleString()}
      </Typography>
    </Sheet>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography
        level="body-xs"
        fontWeight="lg"
        sx={{
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "text.tertiary",
        }}
      >
        {label}
      </Typography>
      <Typography level="body-sm" sx={{ mt: 0.5, color: "text.primary" }}>
        {value}
      </Typography>
    </Box>
  );
}

function SegmentMembersPreview({ segmentId }: { segmentId: string }) {
  const membersQuery = useMailchimpSegmentMembersPreview(segmentId, {
    enabled: Boolean(segmentId),
  });

  if (membersQuery.isLoading) {
    return (
      <Typography level="body-sm" sx={{ color: "text.secondary" }}>
        Loading member preview\u2026
      </Typography>
    );
  }

  if ((membersQuery.data ?? []).length === 0) {
    return (
      <Typography level="body-sm" sx={{ color: "text.secondary" }}>
        No member emails available.
      </Typography>
    );
  }

  return (
    <Stack component="ul" spacing={0.5} sx={{ m: 0, pl: 0, listStyle: "none" }}>
      {(membersQuery.data ?? []).map((email) => (
        <Sheet
          component="li"
          key={email}
          variant="soft"
          color="neutral"
          sx={{ borderRadius: "sm", px: 1.5, py: 0.75 }}
        >
          <Typography level="body-xs">{email}</Typography>
        </Sheet>
      ))}
    </Stack>
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
    <Stack spacing={2.5}>
      <SectionCard
        title="Imported Data"
        description="Browse the CRM records Mailchimp has already written into BloomSuite."
      >
        <Stack spacing={2.5}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr 1fr",
                md: "repeat(3, 1fr)",
                xl: "repeat(5, 1fr)",
              },
              gap: 1.5,
            }}
          >
            {summaryQuery.loading ? (
              <>
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
              </>
            ) : (
              <>
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
              </>
            )}
          </Box>

          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
            {SECTION_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isActive = option.value === section;

              return (
                <Button
                  key={option.value}
                  size="sm"
                  variant={isActive ? "solid" : "outlined"}
                  color={isActive ? "neutral" : "neutral"}
                  onClick={() => setSection(option.value)}
                  startDecorator={<Icon size={14} />}
                  sx={
                    isActive
                      ? {
                          bgcolor: "neutral.900",
                          color: "common.white",
                          "&:hover": { bgcolor: "neutral.800" },
                        }
                      : {}
                  }
                >
                  {option.label}
                </Button>
              );
            })}
          </Stack>
        </Stack>
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
                variant="outlined"
                color="neutral"
                onClick={handlePrimaryAction}
              >
                {primaryActionLabel}
              </Button>
            }
          />
        </SectionCard>
      ) : null}

      {summaryQuery.error ? (
        <Alert color="danger" variant="soft">
          Imported Mailchimp data could not be loaded right now.
        </Alert>
      ) : null}

      {hasImportedCustomers ? (
        <>
          {section === "customers" ? (
            <SectionCard
              title="Customers"
              description="Search Mailchimp-sourced CRM customers, then expand a row to inspect the linked CRM details."
            >
              <Sheet
                variant="outlined"
                sx={{ borderRadius: "lg", overflow: "hidden" }}
              >
                <Stack
                  direction={{ xs: "column", lg: "row" }}
                  spacing={1.5}
                  alignItems={{ lg: "center" }}
                  justifyContent="space-between"
                  sx={{
                    px: 2.5,
                    py: 2,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={1.5}
                    sx={{ flexWrap: "wrap" }}
                  >
                    <TableSearchInput
                      placeholder="Search by email, first name, or last name\u2026"
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
                  </Stack>
                  <Typography
                    level="body-xs"
                    sx={{ color: "text.secondary", whiteSpace: "nowrap" }}
                  >
                    {(
                      customerQuery.data?.pagination.totalCount ?? 0
                    ).toLocaleString()}{" "}
                    records
                  </Typography>
                </Stack>

                {customerSegmentFilter || customerTagFilter ? (
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    sx={{
                      flexWrap: "wrap",
                      px: 2.5,
                      py: 1.5,
                      borderBottom: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    {customerSegmentFilter ? (
                      <Chip size="sm" variant="soft" color="primary">
                        Segment: {customerSegmentFilter.name}
                      </Chip>
                    ) : null}
                    {customerTagFilter ? (
                      <Chip size="sm" variant="soft" color="success">
                        Tag: {customerTagFilter.name}
                      </Chip>
                    ) : null}
                    <Button
                      size="sm"
                      variant="plain"
                      color="neutral"
                      startDecorator={<FilterX size={13} />}
                      onClick={() => {
                        setCustomerSegmentFilter(null);
                        setCustomerTagFilter(null);
                        resetCustomerPage();
                      }}
                    >
                      Clear linked filter
                    </Button>
                  </Stack>
                ) : null}

                {customerQuery.isLoading ? (
                  <TableSkeleton columns={5} rows={8} />
                ) : null}

                {(customerQuery.data?.rows.length ?? 0) > 0 ? (
                  <>
                    <Box sx={{ overflowX: "auto" }}>
                      <Table sx={{ minWidth: 1060 }}>
                        <thead>
                          <tr>
                            <th>Email</th>
                            <th>First Name</th>
                            <th>Last Name</th>
                            <th>Phone</th>
                            <th>Imported At</th>
                            <th>Segments</th>
                            <th>Tags</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(customerQuery.data?.rows ?? []).map((row) => {
                            const isExpanded = expandedCustomerId === row.id;

                            return (
                              <Fragment key={row.id}>
                                <tr
                                  style={{ cursor: "pointer" }}
                                  onClick={() =>
                                    setExpandedCustomerId(
                                      isExpanded ? null : row.id,
                                    )
                                  }
                                >
                                  <td>
                                    <Stack
                                      direction="row"
                                      spacing={0.75}
                                      alignItems="center"
                                    >
                                      {isExpanded ? (
                                        <ChevronDown size={14} />
                                      ) : (
                                        <ChevronRight size={14} />
                                      )}
                                      <span>{row.email}</span>
                                    </Stack>
                                  </td>
                                  <td>{row.firstName || "\u2014"}</td>
                                  <td>{row.lastName || "\u2014"}</td>
                                  <td>{formatPhoneNumber(row.phone)}</td>
                                  <td>
                                    {formatRelativeTimestamp(row.importedAt)}
                                  </td>
                                  <td>
                                    {renderNameList(
                                      row.segments.map(
                                        (segment) => segment.name,
                                      ),
                                    )}
                                  </td>
                                  <td>
                                    {renderNameList(
                                      row.tags.map((tag) => tag.name),
                                    )}
                                  </td>
                                </tr>
                                {isExpanded ? (
                                  <tr>
                                    <td colSpan={7} style={{ padding: 0 }}>
                                      <Box
                                        sx={{
                                          display: "grid",
                                          gridTemplateColumns: {
                                            xs: "1fr",
                                            lg: "1fr 1fr",
                                          },
                                          gap: 2.5,
                                          p: 2.5,
                                          bgcolor: "background.level1",
                                        }}
                                      >
                                        <Sheet
                                          variant="outlined"
                                          sx={{ borderRadius: "lg", p: 2 }}
                                        >
                                          <Typography
                                            level="title-sm"
                                            sx={{ mb: 1.5 }}
                                          >
                                            Customer Details
                                          </Typography>
                                          <Box
                                            sx={{
                                              display: "grid",
                                              gridTemplateColumns: {
                                                xs: "1fr",
                                                sm: "1fr 1fr",
                                              },
                                              gap: 2,
                                            }}
                                          >
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
                                              value={row.sourceId ?? "\u2014"}
                                            />
                                          </Box>
                                          <Box sx={{ mt: 2 }}>
                                            <Typography
                                              level="body-xs"
                                              fontWeight="lg"
                                              sx={{
                                                textTransform: "uppercase",
                                                letterSpacing: "0.12em",
                                                color: "text.tertiary",
                                              }}
                                            >
                                              Linked Segments
                                            </Typography>
                                            <Box sx={{ mt: 1 }}>
                                              {renderNameList(
                                                row.segments.map(
                                                  (segment) => segment.name,
                                                ),
                                                "No linked segments",
                                              )}
                                            </Box>
                                          </Box>
                                          <Box sx={{ mt: 2 }}>
                                            <Typography
                                              level="body-xs"
                                              fontWeight="lg"
                                              sx={{
                                                textTransform: "uppercase",
                                                letterSpacing: "0.12em",
                                                color: "text.tertiary",
                                              }}
                                            >
                                              Linked Tags
                                            </Typography>
                                            <Box sx={{ mt: 1 }}>
                                              {renderNameList(
                                                row.tags.map((tag) => tag.name),
                                                "No linked tags",
                                              )}
                                            </Box>
                                          </Box>
                                        </Sheet>

                                        <Sheet
                                          variant="outlined"
                                          sx={{ borderRadius: "lg", p: 2 }}
                                        >
                                          <Typography
                                            level="title-sm"
                                            sx={{ mb: 1.5 }}
                                          >
                                            Compliance Snapshot
                                          </Typography>
                                          <Box
                                            sx={{
                                              display: "grid",
                                              gridTemplateColumns: {
                                                xs: "1fr",
                                                sm: "1fr 1fr",
                                              },
                                              gap: 2,
                                            }}
                                          >
                                            <DetailField
                                              label="Latest Consent"
                                              value={
                                                row.latestConsent
                                                  ? `${row.latestConsent.statusLabel} \u00b7 ${row.latestConsent.channel}`
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
                                                  : "\u2014"
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
                                                "\u2014"
                                              }
                                            />
                                          </Box>
                                          {row.allSuppressions.length > 0 ? (
                                            <Box sx={{ mt: 2 }}>
                                              <Typography
                                                level="body-xs"
                                                fontWeight="lg"
                                                sx={{
                                                  textTransform: "uppercase",
                                                  letterSpacing: "0.12em",
                                                  color: "text.tertiary",
                                                }}
                                              >
                                                Active Suppressions
                                              </Typography>
                                              <Stack
                                                direction="row"
                                                spacing={0.5}
                                                sx={{ mt: 1, flexWrap: "wrap" }}
                                              >
                                                {row.allSuppressions.map(
                                                  (suppression) => (
                                                    <Chip
                                                      key={suppression.id}
                                                      size="sm"
                                                      variant="outlined"
                                                      color="neutral"
                                                    >
                                                      {suppression.channel}:{" "}
                                                      {suppression.reason}
                                                    </Chip>
                                                  ),
                                                )}
                                              </Stack>
                                            </Box>
                                          ) : null}
                                        </Sheet>
                                      </Box>
                                    </td>
                                  </tr>
                                ) : null}
                              </Fragment>
                            );
                          })}
                        </tbody>
                      </Table>
                    </Box>

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
              </Sheet>
            </SectionCard>
          ) : null}

          {section === "segments" ? (
            <SectionCard
              title="Segments"
              description="Review the Mailchimp-backed CRM segments created by imports and jump into the linked customers."
            >
              <Sheet
                variant="outlined"
                sx={{ borderRadius: "lg", overflow: "hidden" }}
              >
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{
                    px: 2.5,
                    py: 2,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Typography level="body-sm" fontWeight="lg">
                    Mailchimp segments
                  </Typography>
                  <Typography level="body-xs" sx={{ color: "text.secondary" }}>
                    {(segmentsQuery.data?.length ?? 0).toLocaleString()} records
                  </Typography>
                </Stack>

                {segmentsQuery.isLoading ? (
                  <TableSkeleton columns={5} rows={8} />
                ) : null}

                {(segmentsQuery.data?.length ?? 0) > 0 ? (
                  <Box sx={{ overflowX: "auto" }}>
                    <Table sx={{ minWidth: 920 }}>
                      <thead>
                        <tr>
                          <th>Segment Name</th>
                          <th>Source ID</th>
                          <th>Members</th>
                          <th>Created At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(segmentsQuery.data ?? []).map((segment) => {
                          const isExpanded = expandedSegmentId === segment.id;

                          return (
                            <Fragment key={segment.id}>
                              <tr
                                style={{ cursor: "pointer" }}
                                onClick={() =>
                                  setExpandedSegmentId(
                                    isExpanded ? null : segment.id,
                                  )
                                }
                              >
                                <td>
                                  <Stack
                                    direction="row"
                                    spacing={0.75}
                                    alignItems="center"
                                  >
                                    {isExpanded ? (
                                      <ChevronDown size={14} />
                                    ) : (
                                      <ChevronRight size={14} />
                                    )}
                                    <span>{segment.name}</span>
                                  </Stack>
                                </td>
                                <td>{segment.sourceId ?? "\u2014"}</td>
                                <td>{segment.memberCount.toLocaleString()}</td>
                                <td>
                                  {formatDateTimeValue(segment.createdAt)}
                                </td>
                              </tr>
                              {isExpanded ? (
                                <tr>
                                  <td colSpan={4} style={{ padding: 0 }}>
                                    <Box
                                      sx={{
                                        display: "grid",
                                        gridTemplateColumns: {
                                          xs: "1fr",
                                          lg: "1.1fr 1fr",
                                        },
                                        gap: 2.5,
                                        p: 2.5,
                                        bgcolor: "background.level1",
                                      }}
                                    >
                                      <Sheet
                                        variant="outlined"
                                        sx={{ borderRadius: "lg", p: 2 }}
                                      >
                                        <Box
                                          sx={{
                                            display: "grid",
                                            gridTemplateColumns: "1fr 1fr",
                                            gap: 2,
                                            mb: 2,
                                          }}
                                        >
                                          <DetailField
                                            label="Parent List"
                                            value={
                                              segment.parentListName ?? "\u2014"
                                            }
                                          />
                                          <DetailField
                                            label="Member Count"
                                            value={segment.memberCount.toLocaleString()}
                                          />
                                        </Box>
                                        <Button
                                          size="sm"
                                          variant="outlined"
                                          color="neutral"
                                          onClick={() =>
                                            openCustomerSegmentFilter(
                                              segment.id,
                                              segment.name,
                                            )
                                          }
                                        >
                                          View All Customers
                                        </Button>
                                      </Sheet>
                                      <Sheet
                                        variant="outlined"
                                        sx={{ borderRadius: "lg", p: 2 }}
                                      >
                                        <Typography
                                          level="title-sm"
                                          sx={{ mb: 1.5 }}
                                        >
                                          First 10 Member Emails
                                        </Typography>
                                        <SegmentMembersPreview
                                          segmentId={segment.id}
                                        />
                                      </Sheet>
                                    </Box>
                                  </td>
                                </tr>
                              ) : null}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </Table>
                  </Box>
                ) : null}

                {!segmentsQuery.isLoading &&
                (segmentsQuery.data?.length ?? 0) === 0 ? (
                  <DataTabEmptyState
                    icon={Database}
                    title="No Mailchimp segments found"
                    description="Run a Mailchimp import that includes segments to see them here."
                  />
                ) : null}
              </Sheet>
            </SectionCard>
          ) : null}

          {section === "tags" ? (
            <SectionCard
              title="Tags"
              description="Review tags attached to Mailchimp-sourced customers and jump into the tagged customer set."
            >
              <Sheet
                variant="outlined"
                sx={{ borderRadius: "lg", overflow: "hidden" }}
              >
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{
                    px: 2.5,
                    py: 2,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Typography level="body-sm" fontWeight="lg">
                    Associated tags
                  </Typography>
                  <Typography level="body-xs" sx={{ color: "text.secondary" }}>
                    {(tagsQuery.data?.length ?? 0).toLocaleString()} records
                  </Typography>
                </Stack>

                {tagsQuery.isLoading ? (
                  <TableSkeleton columns={5} rows={8} />
                ) : null}

                {(tagsQuery.data?.length ?? 0) > 0 ? (
                  <Box sx={{ overflowX: "auto" }}>
                    <Table sx={{ minWidth: 760 }}>
                      <thead>
                        <tr>
                          <th>Tag Name</th>
                          <th>Customers</th>
                          <th>Created At</th>
                          <th style={{ textAlign: "right" }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(tagsQuery.data ?? []).map((tag) => (
                          <tr key={tag.id}>
                            <td>{tag.name}</td>
                            <td>{tag.customerCount.toLocaleString()}</td>
                            <td>{formatDateTimeValue(tag.createdAt)}</td>
                            <td style={{ textAlign: "right" }}>
                              <Button
                                size="sm"
                                variant="plain"
                                color="neutral"
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
                    </Table>
                  </Box>
                ) : null}

                {!tagsQuery.isLoading && (tagsQuery.data?.length ?? 0) === 0 ? (
                  <DataTabEmptyState
                    icon={Tags}
                    title="No Mailchimp tags found"
                    description="Tags appear here after Mailchimp imports associate them with CRM customers."
                  />
                ) : null}
              </Sheet>
            </SectionCard>
          ) : null}

          {section === "compliance" ? (
            <Stack spacing={2.5}>
              <SectionCard
                title="Consents"
                description="Current consent records for Mailchimp-sourced customers, grouped by channel and status."
              >
                <Stack spacing={2.5}>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: {
                        xs: "1fr 1fr",
                        md: "repeat(4, 1fr)",
                      },
                      gap: 1.5,
                    }}
                  >
                    {(complianceQuery.data?.consentSummaryCards ?? []).map(
                      (card) => (
                        <SummaryStat
                          key={card.key}
                          label={card.label}
                          value={card.value}
                        />
                      ),
                    )}
                  </Box>

                  <Sheet
                    variant="outlined"
                    sx={{ borderRadius: "lg", overflow: "hidden" }}
                  >
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      sx={{
                        px: 2.5,
                        py: 2,
                        borderBottom: "1px solid",
                        borderColor: "divider",
                      }}
                    >
                      <Typography level="body-sm" fontWeight="lg">
                        Consent records
                      </Typography>
                      <Typography
                        level="body-xs"
                        sx={{ color: "text.secondary" }}
                      >
                        {(
                          complianceQuery.data?.consentRows.length ?? 0
                        ).toLocaleString()}{" "}
                        records
                      </Typography>
                    </Stack>

                    {complianceQuery.isLoading ? (
                      <TableSkeleton columns={5} rows={8} />
                    ) : null}

                    {(consentPageState.rows.length ?? 0) > 0 ? (
                      <>
                        <Box sx={{ overflowX: "auto" }}>
                          <Table sx={{ minWidth: 760 }}>
                            <thead>
                              <tr>
                                <th>Email</th>
                                <th>Channel</th>
                                <th>Consent Status</th>
                                <th>Recorded At</th>
                              </tr>
                            </thead>
                            <tbody>
                              {consentPageState.rows.map((row) => (
                                <tr key={row.id}>
                                  <td>{row.email}</td>
                                  <td>{row.channel}</td>
                                  <td>
                                    <Chip
                                      size="sm"
                                      variant="soft"
                                      color="neutral"
                                    >
                                      {row.statusLabel}
                                    </Chip>
                                  </td>
                                  <td>{formatDateTimeValue(row.recordedAt)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </Table>
                        </Box>
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
                  </Sheet>
                </Stack>
              </SectionCard>

              <SectionCard
                title="Suppressions"
                description="Active suppression rows matched to Mailchimp-sourced customers by customer id or normalized email."
              >
                <Stack spacing={2.5}>
                  <Box sx={{ maxWidth: 200 }}>
                    <SummaryStat
                      label="Active Suppressions"
                      value={complianceQuery.data?.activeSuppressions ?? 0}
                    />
                  </Box>

                  <Sheet
                    variant="outlined"
                    sx={{ borderRadius: "lg", overflow: "hidden" }}
                  >
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      sx={{
                        px: 2.5,
                        py: 2,
                        borderBottom: "1px solid",
                        borderColor: "divider",
                      }}
                    >
                      <Typography level="body-sm" fontWeight="lg">
                        Suppression records
                      </Typography>
                      <Typography
                        level="body-xs"
                        sx={{ color: "text.secondary" }}
                      >
                        {(
                          complianceQuery.data?.suppressionRows.length ?? 0
                        ).toLocaleString()}{" "}
                        records
                      </Typography>
                    </Stack>

                    {complianceQuery.isLoading ? (
                      <TableSkeleton columns={5} rows={8} />
                    ) : null}

                    {(suppressionPageState.rows.length ?? 0) > 0 ? (
                      <>
                        <Box sx={{ overflowX: "auto" }}>
                          <Table sx={{ minWidth: 860 }}>
                            <thead>
                              <tr>
                                <th>Email / Phone</th>
                                <th>Channel</th>
                                <th>Reason</th>
                                <th>Suppressed At</th>
                                <th>Active</th>
                              </tr>
                            </thead>
                            <tbody>
                              {suppressionPageState.rows.map((row) => (
                                <tr key={row.id}>
                                  <td>{row.email ?? row.phone ?? "\u2014"}</td>
                                  <td>{row.channel}</td>
                                  <td>{row.reason}</td>
                                  <td>
                                    {formatDateTimeValue(row.suppressedAt)}
                                  </td>
                                  <td>
                                    <Chip
                                      size="sm"
                                      variant="soft"
                                      color={row.active ? "danger" : "neutral"}
                                    >
                                      {row.active ? "Active" : "Lifted"}
                                    </Chip>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </Table>
                        </Box>
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
                  </Sheet>
                </Stack>
              </SectionCard>
            </Stack>
          ) : null}
        </>
      ) : null}
    </Stack>
  );
}
