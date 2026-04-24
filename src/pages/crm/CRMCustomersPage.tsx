import React, { useCallback, useEffect, useMemo, useState } from "react";
import Button from "@mui/joy/Button";
import ButtonGroup from "@mui/joy/ButtonGroup";
import Checkbox from "@mui/joy/Checkbox";
import CircularProgress from "@mui/joy/CircularProgress";
import IconButton from "@mui/joy/IconButton";
import LinearProgress from "@mui/joy/LinearProgress";
import Box from "@mui/joy/Box";
import MenuButton from "@mui/joy/MenuButton";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Calendar,
  ChevronDown,
  DollarSign,
  Eye,
  Mail,
  MoreVertical,
  Phone,
  Plus,
  RefreshCw,
  Tags,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  CatalogStatsStrip,
  CatalogStatsStripSkeleton,
} from "@/components/crm/catalog/CatalogStatsStrip";
import { SyncFromCRMModal } from "@/components/crm/customers/SyncFromCRMModal";
import { EnhancedSegmentImportDialog } from "@/components/crm/segments/EnhancedSegmentImportDialog";
import { JoyAlertDialog } from "@/components/joy/JoyAlertDialog";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyChip } from "@/components/joy/JoyChip";
import { JoyDataSectionCard } from "@/components/joy/JoyDataSectionCard";
import {
  JoyDropdownMenu,
  JoyDropdownMenuContent,
  JoyDropdownMenuItem,
  JoyDropdownMenuTrigger,
} from "@/components/joy/JoyDropdownMenu";
import { JoyEmptyState } from "@/components/joy/JoyEmptyState";
import { PageContainer } from "@/components/joy/PageContainer";
import { JoySearchInput } from "@/components/joy/JoySearchInput";
import {
  JoyTable,
  JoyTableBody,
  JoyTableCell,
  JoyTableHead,
  JoyTableHeaderCell,
  JoyTablePagination,
  JoyTableRow,
} from "@/components/joy/JoyTable";
import { useAllPersonas } from "@/hooks/useAllPersonas";
import { useAllSegments } from "@/hooks/useAllSegments";
import { useBulkCustomerOperations } from "@/hooks/useBulkCustomerOperations";
import { useCustomers } from "@/hooks/useCustomers";
import { useDeleteCustomer } from "@/hooks/useDeleteCustomer";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";

const CUSTOMER_CURRENCY_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export const CRMCustomersPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showSyncFromCRM, setShowSyncFromCRM] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<{
    id: string;
    name: string;
    email: string;
  } | null>(null);
  const pageSize = 15;

  const deleteCustomer = useDeleteCustomer();
  const {
    selectedIds,
    isProcessing,
    progress,
    toggleSelection,
    selectAll,
    clearSelection,
    bulkDeleteCustomers,
  } = useBulkCustomerOperations();

  const {
    data: customers = [],
    totalCount = 0,
    isLoading,
    invalidateCustomers,
  } = useCustomers({
    search: searchQuery,
    page: currentPage,
    pageSize,
  });
  const { personas } = useAllPersonas();
  const { tenant, loading: isTenantLoading } = useTenant();
  const { segments: allSegments = [], loading: isSegmentsLoading } =
    useAllSegments();

  const {
    data: customerHeaderStats,
    isLoading: isCustomerHeaderStatsLoading,
    refetch: refetchCustomerHeaderStats,
  } = useQuery({
    queryKey: ["crm-customers-header-stats", tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) {
        return {
          newThisMonth: 0,
          totalSpent: 0,
        };
      }

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const [{ data: spendRows, error: spendError }, { count, error: countError }] =
        await Promise.all([
          supabase
            .from("crm_customers")
            .select("total_spent")
            .eq("tenant_id", tenant.id),
          supabase
            .from("crm_customers")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tenant.id)
            .gte("created_at", startOfMonth.toISOString()),
        ]);

      if (spendError) {
        throw spendError;
      }

      if (countError) {
        throw countError;
      }

      const totalSpent = (spendRows ?? []).reduce(
        (sum, row) => sum + (Number(row.total_spent) || 0),
        0,
      );

      return {
        newThisMonth: count ?? 0,
        totalSpent,
      };
    },
    enabled: Boolean(tenant?.id),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const activeSegmentCount = useMemo(
    () =>
      allSegments.filter((segment) => segment.state !== "system_pending").length,
    [allSegments],
  );

  const headerStats = useMemo(
    () => [
      {
        label: "Total Customers",
        value: totalCount.toLocaleString(),
        icon: <Users size={18} />,
      },
      {
        label: "New This Month",
        value: (customerHeaderStats?.newThisMonth ?? 0).toLocaleString(),
        icon: <UserPlus size={18} />,
      },
      {
        label: "Total Spent",
        value: CUSTOMER_CURRENCY_FORMATTER.format(
          customerHeaderStats?.totalSpent ?? 0,
        ),
        icon: <DollarSign size={18} />,
      },
      {
        label: "Segments",
        value: activeSegmentCount.toLocaleString(),
        icon: <Tags size={18} />,
      },
    ],
    [activeSegmentCount, customerHeaderStats?.newThisMonth, customerHeaderStats?.totalSpent, totalCount],
  );

  const isHeaderStatsLoading =
    isLoading ||
    isTenantLoading ||
    isSegmentsLoading ||
    isCustomerHeaderStatsLoading;

  // Check if all visible customers are selected
  const allVisibleSelected =
    customers.length > 0 && customers.every((c) => selectedIds.has(c.id));

  // Get persona details for a customer using unified approach
  const getCustomerPersona = (customer: any) => {
    // First check the new junction table for persona assignments
    if (customer.customer_personas && customer.customer_personas.length > 0) {
      const assignment = customer.customer_personas[0]; // Get first persona assignment

      // Check if it's a predefined persona
      if (assignment.predefined_persona_id && personas) {
        return personas.find((p) => p.id === assignment.predefined_persona_id);
      }

      // Check if it's a custom persona
      if (assignment.persona_id && personas) {
        return personas.find((p) => p.id === assignment.persona_id);
      }
    }

    // Fallback to legacy persona_id field
    if (customer.persona_id && personas) {
      return personas.find((p) => p.id === customer.persona_id);
    }

    return null;
  };

  // Get all assigned persona names for display (in case multiple are assigned)
  const getCustomerPersonas = (customer: any) => {
    if (
      !customer.customer_personas ||
      customer.customer_personas.length === 0
    ) {
      return [];
    }

    const personaNames = [];
    for (const assignment of customer.customer_personas) {
      let persona = null;

      if (assignment.predefined_persona_id && personas) {
        persona = personas.find(
          (p) => p.id === assignment.predefined_persona_id,
        );
      } else if (assignment.persona_id && personas) {
        persona = personas.find((p) => p.id === assignment.persona_id);
      }

      if (persona) {
        personaNames.push(persona.persona_name);
      }
    }

    return personaNames;
  };

  // Get all assigned segment names for display
  const getCustomerSegments = (customer: any) => {
    if (
      !customer.customer_segments ||
      customer.customer_segments.length === 0
    ) {
      return [];
    }

    const segmentNames = [];
    for (const assignment of customer.customer_segments) {
      // Look up segment name from allSegments by matching segment_id
      const segment = allSegments.find((s) => s.id === assignment.segment_id);
      if (segment?.name) {
        segmentNames.push(segment.name);
      }
    }

    return segmentNames;
  };

  // Dynamic persona colors based on the actual personas
  const getPersonaColor = (personaName: string) => {
    const colorMap: Record<
      string,
      "success" | "primary" | "warning" | "danger" | "neutral"
    > = {
      "Plant-Killer Pam": "success",
      "Pet-Friendly Hannah": "primary",
      "Vegetable Garden Veronica": "warning",
      "Sustainable Susie": "success",
      "Patio Gardener Gail": "danger",
      "Pollinator Paula": "warning",
      "Curb Appeal Ashley": "primary",
      "DIY Dana": "neutral",
      "Wellness Whitney": "primary",
    };
    return colorMap[personaName] || "neutral";
  };

  // Dynamic segment colors for visual variety
  const getSegmentColor = (segmentName: string) => {
    const colorMap: Record<
      string,
      "success" | "primary" | "warning" | "danger" | "neutral"
    > = {
      "Loyalty Members": "primary",
      "High-Value Customers": "success",
      "New Customers": "primary",
      "Lapsed Customers": "warning",
      "Seasonal Shoppers": "primary",
      "Frequent Buyers": "success",
    };
    return colorMap[segmentName] || "neutral";
  };

  const handleImportComplete = () => {
    invalidateCustomers();
    setCurrentPage(1);
    void refetchCustomerHeaderStats();
  };

  const handleSyncComplete = useCallback(() => {
    invalidateCustomers();
    void refetchCustomerHeaderStats();
  }, [invalidateCustomers, refetchCustomerHeaderStats]);

  const handleCustomerClick = (customer: any) => {
    navigate(`/crm/customers/${customer.id}`);
  };

  // Debounced search - auto-search as user types
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== searchQuery) {
        setSearchQuery(searchInput);
        setCurrentPage(1);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleClearSearch = useCallback(() => {
    setSearchInput("");
    setSearchQuery("");
    setCurrentPage(1);
  }, []);

  return (
    <PageContainer fullWidth>
      <Stack spacing={3} sx={{ pb: 4 }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          alignItems={{ xs: "stretch", md: "flex-start" }}
          justifyContent="space-between"
          spacing={2}
        >
          <Stack spacing={0.5} sx={{ minWidth: 0 }}>
            <Typography level="h3" fontWeight="bold">
              Customers
            </Typography>
            <Typography
              level="body-sm"
              sx={{ color: "neutral.600" }}
              noWrap
            >
              Manage customer records with segments, personas, and bulk actions.
            </Typography>
            <Typography
              level="body-xs"
              sx={{ color: "neutral.500", fontWeight: 500, mt: 0.5 }}
            >
              {totalCount.toLocaleString()} customers · CRM sync ready
            </Typography>
          </Stack>

          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            justifyContent={{ xs: "flex-start", md: "flex-end" }}
            sx={{ flexShrink: 0 }}
          >
            <Tooltip title="Sync From CRM">
              <IconButton
                variant="outlined"
                color="neutral"
                size="sm"
                onClick={() => setShowSyncFromCRM(true)}
                aria-label="Sync From CRM"
              >
                <RefreshCw size={16} />
              </IconButton>
            </Tooltip>

            <JoyDropdownMenu>
              <ButtonGroup
                variant="solid"
                color="primary"
                sx={{
                  borderRadius: "lg",
                  width: { xs: "100%", sm: "auto" },
                }}
              >
                <Button
                  size="sm"
                  variant="solid"
                  color="primary"
                  startDecorator={<Plus size={16} />}
                  onClick={() => navigate("/crm/customers/new")}
                  sx={{
                    justifyContent: "center",
                    borderInlineEnd:
                      "1px solid rgba(var(--joy-palette-primary-mainChannel) / 0.34)",
                  }}
                >
                  Add Customer
                </Button>

                <MenuButton
                  size="sm"
                  variant="solid"
                  color="primary"
                  aria-label="More customer creation options"
                  sx={{
                    minWidth: 40,
                    px: 1,
                    "& .customers-header-cta__chevron": {
                      transition: "transform 0.2s ease",
                    },
                    '&[aria-expanded="true"] .customers-header-cta__chevron': {
                      transform: "rotate(180deg)",
                    },
                  }}
                >
                  <ChevronDown
                    className="customers-header-cta__chevron"
                    size={16}
                  />
                </MenuButton>
              </ButtonGroup>

              <JoyDropdownMenuContent placement="bottom-end" sx={{ minWidth: 220 }}>
                <JoyDropdownMenuItem
                  startDecorator={<Upload size={16} />}
                  onClick={() => setShowImportDialog(true)}
                >
                  Upload List
                </JoyDropdownMenuItem>
              </JoyDropdownMenuContent>
            </JoyDropdownMenu>
          </Stack>
        </Stack>

        {isHeaderStatsLoading ? (
          <CatalogStatsStripSkeleton itemCount={4} />
        ) : (
          <CatalogStatsStrip items={headerStats} />
        )}

        <Stack spacing={1.5}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                lg: "minmax(300px, 420px) minmax(0, 1fr)",
              },
              gap: 1.5,
              alignItems: "start",
            }}
          >
            <JoySearchInput
              value={searchInput}
              onValueChange={setSearchInput}
              onClear={handleClearSearch}
              placeholder="Search by name, email, or phone..."
              sx={{ width: "100%", minWidth: 0 }}
            />

            <Box
              sx={{
                minWidth: 0,
                display: "flex",
                justifyContent: { xs: "flex-start", lg: "flex-end" },
              }}
            >
              {selectedIds.size > 0 ? (
                <Sheet
                  variant="soft"
                  color="warning"
                  sx={{
                    px: 2,
                    py: 1.25,
                    borderRadius: "16px",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 1,
                    alignItems: "center",
                  }}
                >
                  <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                    {selectedIds.size} selected
                  </Typography>
                  <JoyButton
                    size="sm"
                    bloomVariant="destructive"
                    onClick={() => setBulkDeleteDialogOpen(true)}
                    startDecorator={<Trash2 />}
                  >
                    Delete Selected
                  </JoyButton>
                  <JoyButton
                    size="sm"
                    variant="plain"
                    color="neutral"
                    onClick={clearSelection}
                  >
                    Clear
                  </JoyButton>
                </Sheet>
              ) : null}
            </Box>
          </Box>
        </Stack>

        <JoyDataSectionCard bodySx={{ p: 0 }}>
        {isLoading ? (
          <Stack
            direction="row"
            spacing={1.5}
            alignItems="center"
            sx={{ px: 4, py: 4 }}
          >
            <CircularProgress size="sm" />
            <Typography level="body-md">Loading customers...</Typography>
          </Stack>
        ) : customers.length === 0 ? (
          <JoyEmptyState
            icon={<Users />}
            title="No customers found"
            description={
              searchQuery
                ? "Try adjusting your search or add a new customer record."
                : "Add your first customer or import a list to start building segments and personas."
            }
            primaryAction={{
              label: "Add Customer",
              size: "sm",
              onClick: () => navigate("/crm/customers/new"),
              startDecorator: <Plus />,
            }}
          />
        ) : (
          <>
            <JoyTable stickyHeader data-testid="customers-table">
              <JoyTableHead>
                <JoyTableRow>
                  <JoyTableHeaderCell sx={{ width: 56 }}>
                    <Checkbox
                      size="sm"
                      color="primary"
                      checked={allVisibleSelected}
                      onChange={(event) => {
                        if (event.target.checked) {
                          selectAll(customers.map((customer) => customer.id));
                        } else {
                          clearSelection();
                        }
                      }}
                    />
                  </JoyTableHeaderCell>
                  <JoyTableHeaderCell>Customer</JoyTableHeaderCell>
                  <JoyTableHeaderCell>Contact</JoyTableHeaderCell>
                  <JoyTableHeaderCell>Persona</JoyTableHeaderCell>
                  <JoyTableHeaderCell>Segments</JoyTableHeaderCell>
                  <JoyTableHeaderCell>Total Spent</JoyTableHeaderCell>
                  <JoyTableHeaderCell>Last Purchase</JoyTableHeaderCell>
                  <JoyTableHeaderCell>Added</JoyTableHeaderCell>
                  <JoyTableHeaderCell align="right">Actions</JoyTableHeaderCell>
                </JoyTableRow>
              </JoyTableHead>
              <JoyTableBody>
                {customers.map((customer) => {
                  const assignedPersonas = getCustomerPersonas(customer);
                  const assignedSegments = getCustomerSegments(customer);
                  const customerName =
                    customer.first_name || customer.last_name
                      ? `${customer.first_name || ""} ${customer.last_name || ""}`.trim()
                      : "No name";

                  return (
                    <JoyTableRow
                      key={customer.id}
                      clickable
                      hoverColor={
                        selectedIds.has(customer.id)
                          ? "rgb(var(--joy-palette-primary-mainChannel) / 0.08)"
                          : undefined
                      }
                      onClick={() => handleCustomerClick(customer)}
                      sx={
                        selectedIds.has(customer.id)
                          ? {
                              "& > td": {
                                backgroundColor:
                                  "rgb(var(--joy-palette-primary-mainChannel) / 0.05)",
                              },
                            }
                          : undefined
                      }
                    >
                      <JoyTableCell
                        onClick={(event) => event.stopPropagation()}
                      >
                        <Checkbox
                          checked={selectedIds.has(customer.id)}
                          onChange={() => toggleSelection(customer.id)}
                        />
                      </JoyTableCell>
                      <JoyTableCell>
                        <Stack spacing={0.35}>
                          <Typography level="title-sm">
                            {customerName}
                          </Typography>
                          <Stack
                            direction="row"
                            spacing={0.75}
                            alignItems="center"
                          >
                            <Mail
                              size={12}
                              strokeWidth={1.9}
                              color="var(--joy-palette-neutral-400)"
                            />
                            <Typography
                              sx={{
                                fontSize: "12px",
                                lineHeight: 1.5,
                                color: "neutral.500",
                              }}
                            >
                              {customer.email}
                            </Typography>
                          </Stack>
                        </Stack>
                      </JoyTableCell>
                      <JoyTableCell>
                        {customer.phone ? (
                          <Stack
                            direction="row"
                            spacing={0.75}
                            alignItems="center"
                          >
                            <Phone
                              size={12}
                              strokeWidth={1.9}
                              color="var(--joy-palette-neutral-400)"
                            />
                            <Typography
                              sx={{
                                fontSize: "13px",
                                lineHeight: 1.45,
                                color: "neutral.600",
                              }}
                            >
                              {customer.phone}
                            </Typography>
                          </Stack>
                        ) : (
                          <Typography
                            sx={{ fontSize: "13px", color: "neutral.500" }}
                          >
                            No phone
                          </Typography>
                        )}
                      </JoyTableCell>
                      <JoyTableCell>
                        {assignedPersonas.length > 0 ? (
                          <Stack
                            direction="row"
                            spacing={0.75}
                            useFlexGap
                            flexWrap="wrap"
                          >
                            {assignedPersonas.map((personaName, index) => (
                              <JoyChip
                                key={`${customer.id}-persona-${index}`}
                                color={getPersonaColor(personaName)}
                                variant="soft"
                                size="sm"
                              >
                                {personaName}
                              </JoyChip>
                            ))}
                          </Stack>
                        ) : (
                          <Typography level="body-sm" color="neutral">
                            No persona
                          </Typography>
                        )}
                      </JoyTableCell>
                      <JoyTableCell>
                        {assignedSegments.length > 0 ? (
                          <Stack
                            direction="row"
                            spacing={0.75}
                            useFlexGap
                            flexWrap="wrap"
                          >
                            {assignedSegments.map((segmentName, index) => (
                              <JoyChip
                                key={`${customer.id}-segment-${index}`}
                                color={getSegmentColor(segmentName)}
                                variant="soft"
                                size="sm"
                              >
                                {segmentName}
                              </JoyChip>
                            ))}
                          </Stack>
                        ) : (
                          <Typography level="body-sm" color="neutral">
                            No segments
                          </Typography>
                        )}
                      </JoyTableCell>
                      <JoyTableCell>
                        <Stack
                          direction="row"
                          spacing={0.5}
                          alignItems="center"
                          justifyContent="flex-end"
                        >
                          <DollarSign
                            size={12}
                            strokeWidth={1.9}
                            color="var(--joy-palette-neutral-400)"
                          />
                          <Typography
                            sx={{
                              fontFamily: "var(--joy-fontFamily-display)",
                              fontSize: "14px",
                              fontWeight: 500,
                              color: "neutral.900",
                            }}
                          >
                            {customer.total_spent
                              ? customer.total_spent.toFixed(2)
                              : "0.00"}
                          </Typography>
                        </Stack>
                      </JoyTableCell>
                      <JoyTableCell>
                        {customer.last_purchase_date ? (
                          <Stack
                            direction="row"
                            spacing={0.5}
                            alignItems="center"
                          >
                            <Calendar
                              size={12}
                              strokeWidth={1.9}
                              color="var(--joy-palette-neutral-400)"
                            />
                            <Typography
                              sx={{ fontSize: "13px", color: "neutral.500" }}
                            >
                              {format(
                                new Date(customer.last_purchase_date),
                                "MMM d, yyyy",
                              )}
                            </Typography>
                          </Stack>
                        ) : (
                          <Typography
                            sx={{ fontSize: "13px", color: "neutral.500" }}
                          >
                            No purchases
                          </Typography>
                        )}
                      </JoyTableCell>
                      <JoyTableCell>
                        <Typography
                          sx={{ fontSize: "13px", color: "neutral.500" }}
                        >
                          {format(new Date(customer.created_at), "MMM d, yyyy")}
                        </Typography>
                      </JoyTableCell>
                      <JoyTableCell
                        align="right"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <JoyDropdownMenu>
                          <JoyDropdownMenuTrigger
                            aria-label={`Actions for ${customerName}`}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </JoyDropdownMenuTrigger>
                          <JoyDropdownMenuContent>
                            <JoyDropdownMenuItem
                              startDecorator={<Eye className="h-4 w-4" />}
                              onClick={() =>
                                navigate(`/crm/customers/${customer.id}`)
                              }
                            >
                              View Customer
                            </JoyDropdownMenuItem>
                            <JoyDropdownMenuItem
                              destructive
                              startDecorator={<Trash2 className="h-4 w-4" />}
                              onClick={() => {
                                setCustomerToDelete({
                                  id: customer.id,
                                  name:
                                    customerName === "No name"
                                      ? "This customer"
                                      : customerName,
                                  email: customer.email,
                                });
                                setDeleteDialogOpen(true);
                              }}
                            >
                              Delete Customer
                            </JoyDropdownMenuItem>
                          </JoyDropdownMenuContent>
                        </JoyDropdownMenu>
                      </JoyTableCell>
                    </JoyTableRow>
                  );
                })}
              </JoyTableBody>
            </JoyTable>

            <JoyTablePagination
              page={currentPage}
              pageSize={pageSize}
              totalCount={totalCount}
              onPageChange={setCurrentPage}
            />
          </>
        )}
        </JoyDataSectionCard>

        <EnhancedSegmentImportDialog
          open={showImportDialog}
          onOpenChange={setShowImportDialog}
          onImportComplete={handleImportComplete}
        />

        <SyncFromCRMModal
          open={showSyncFromCRM}
          onOpenChange={setShowSyncFromCRM}
          onSyncComplete={handleSyncComplete}
        />

        <JoyAlertDialog
          open={deleteDialogOpen}
          onClose={() => {
            setDeleteDialogOpen(false);
            setCustomerToDelete(null);
          }}
          title="Delete Customer"
          description={`Are you sure you want to delete ${customerToDelete?.name ?? "this customer"} (${customerToDelete?.email ?? "no email"})? This action cannot be undone.`}
          confirmLabel={deleteCustomer.isPending ? "Deleting..." : "Delete"}
          cancelLabel="Cancel"
          onConfirm={async () => {
            if (customerToDelete) {
              await deleteCustomer.mutateAsync(customerToDelete.id);
              await refetchCustomerHeaderStats();
              setDeleteDialogOpen(false);
              setCustomerToDelete(null);
            }
          }}
          loading={deleteCustomer.isPending}
          variant="danger"
        />

        <JoyAlertDialog
          open={bulkDeleteDialogOpen}
          onClose={() => {
            if (!isProcessing) {
              setBulkDeleteDialogOpen(false);
            }
          }}
          title={`Delete ${selectedIds.size} Customers`}
          description={`Are you sure you want to delete ${selectedIds.size} customer(s)? This action cannot be undone.`}
          confirmLabel={
            isProcessing ? "Deleting..." : `Delete ${selectedIds.size} Customers`
          }
          cancelLabel="Cancel"
          onConfirm={async () => {
            await bulkDeleteCustomers(Array.from(selectedIds));
            await refetchCustomerHeaderStats();
            setBulkDeleteDialogOpen(false);
          }}
          loading={isProcessing}
          variant="danger"
          disableClose={isProcessing}
        >
          {isProcessing ? (
            <Stack spacing={1.25}>
              <LinearProgress
                value={(progress.completed / Math.max(progress.total, 1)) * 100}
              />
              <Typography level="body-sm" color="neutral">
                Deleting {progress.completed} of {progress.total}...
                {progress.failed > 0 ? ` (${progress.failed} failed)` : ""}
              </Typography>
            </Stack>
          ) : null}
        </JoyAlertDialog>
      </Stack>
    </PageContainer>
  );
};
