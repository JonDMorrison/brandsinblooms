import React, { useCallback, useEffect, useState } from "react";
import Checkbox from "@mui/joy/Checkbox";
import CircularProgress from "@mui/joy/CircularProgress";
import LinearProgress from "@mui/joy/LinearProgress";
import Box from "@mui/joy/Box";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { format } from "date-fns";
import {
  Calendar,
  DollarSign,
  Eye,
  Mail,
  MoreVertical,
  Phone,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SyncFromCRMModal } from "@/components/crm/customers/SyncFromCRMModal";
import { EnhancedSegmentImportDialog } from "@/components/crm/segments/EnhancedSegmentImportDialog";
import { JoyAlertDialog } from "@/components/joy/JoyAlertDialog";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoyChip } from "@/components/joy/JoyChip";
import {
  JoyDropdownMenu,
  JoyDropdownMenuContent,
  JoyDropdownMenuItem,
  JoyDropdownMenuTrigger,
} from "@/components/joy/JoyDropdownMenu";
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
  const { segments: allSegments } = useAllSegments();

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
  };

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

  if (isLoading) {
    return (
      <Stack spacing={3.5}>
        <Sheet
          variant="plain"
          sx={{
            p: { xs: 3, md: 4 },
            borderRadius: "24px",
            border: "1px solid",
            borderColor: "neutral.200",
            background:
              "linear-gradient(135deg, rgba(14, 165, 233, 0.08) 0%, rgba(236, 253, 245, 0.9) 48%, rgba(255, 255, 255, 1) 100%)",
          }}
        >
          <Stack
            direction={{ xs: "column", lg: "row" }}
            spacing={2}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", lg: "center" }}
          >
            <Stack spacing={1}>
              <Typography level="h1">Customers</Typography>
              <Typography level="body-md" color="neutral">
                Loading customer records, bulk actions, and CRM sync state.
              </Typography>
            </Stack>
          </Stack>
        </Sheet>
        <JoyCard>
          <JoyCardContent>
            <Stack
              direction="row"
              spacing={1.5}
              alignItems="center"
              sx={{ py: 4 }}
            >
              <CircularProgress size="sm" />
              <Typography level="body-md">Loading customers...</Typography>
            </Stack>
          </JoyCardContent>
        </JoyCard>
      </Stack>
    );
  }

  return (
    <Stack spacing={3.5}>
      <Sheet
        variant="plain"
        sx={{
          p: { xs: 3, md: 4 },
          borderRadius: "24px",
          border: "1px solid",
          borderColor: "neutral.200",
          background:
            "linear-gradient(135deg, rgba(2, 132, 199, 0.08) 0%, rgba(236, 253, 245, 0.92) 45%, rgba(255, 255, 255, 1) 100%)",
        }}
      >
        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", lg: "center" }}
        >
          <Stack spacing={1}>
            <Typography level="h1">Customers</Typography>
            <Typography level="body-md" color="neutral">
              Search, segment, and clean up tenant customer records with Joy
              table controls and bulk actions.
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <JoyChip color="primary" variant="soft">
                {totalCount.toLocaleString()} total customers
              </JoyChip>
              <JoyChip color="success" variant="soft">
                CRM sync ready
              </JoyChip>
            </Stack>
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <JoyButton
              bloomVariant="outline"
              onClick={() => setShowImportDialog(true)}
              startDecorator={<Upload />}
            >
              Upload List
            </JoyButton>
            <JoyButton
              bloomVariant="outline"
              onClick={() => setShowSyncFromCRM(true)}
              startDecorator={<RefreshCw />}
            >
              Sync From CRM
            </JoyButton>
            <JoyButton
              onClick={() => navigate("/crm/customers/new")}
              startDecorator={<Plus />}
            >
              Add Customer
            </JoyButton>
          </Stack>
        </Stack>
      </Sheet>

      <JoyCard>
        <JoyCardHeader
          title={`Customer Management (${totalCount} total)`}
          description="Use search, segmentation badges, and bulk actions to keep customer records clean and current."
          startDecorator={
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: "16px",
                display: "grid",
                placeItems: "center",
                backgroundColor: "primary.50",
                color: "primary.700",
              }}
            >
              <Users className="h-5 w-5" />
            </Box>
          }
        />
        <JoyCardContent>
          <Stack spacing={2.5}>
            <Stack
              direction={{ xs: "column", xl: "row" }}
              spacing={1.5}
              justifyContent="space-between"
              alignItems={{ xs: "stretch", xl: "center" }}
            >
              <JoySearchInput
                value={searchInput}
                onValueChange={setSearchInput}
                onClear={handleClearSearch}
                placeholder="Search by name, email, or phone..."
                sx={{ width: { xs: "100%", xl: 420 } }}
              />

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
                    bloomVariant="ghost"
                    onClick={clearSelection}
                  >
                    Clear
                  </JoyButton>
                </Sheet>
              ) : null}
            </Stack>

            {customers.length === 0 ? (
              <Stack
                spacing={2}
                alignItems="center"
                justifyContent="center"
                sx={{ py: { xs: 5, md: 7 }, textAlign: "center" }}
              >
                <Box
                  sx={{
                    width: 64,
                    height: 64,
                    borderRadius: "20px",
                    display: "grid",
                    placeItems: "center",
                    backgroundColor: "neutral.100",
                    color: "neutral.500",
                  }}
                >
                  <Users className="h-8 w-8" />
                </Box>
                <Stack spacing={0.5}>
                  <Typography level="title-md">No customers found</Typography>
                  <Typography level="body-sm" color="neutral">
                    {searchQuery
                      ? "No customers match your search criteria. Adjust the search or add a new customer."
                      : "Add your first customer or import a list to start building segments and personas."}
                  </Typography>
                </Stack>
                <JoyButton
                  onClick={() => navigate("/crm/customers/new")}
                  startDecorator={<Plus />}
                >
                  Add Customer
                </JoyButton>
              </Stack>
            ) : (
              <>
                <JoyTable stickyHeader data-testid="customers-table">
                  <JoyTableHead>
                    <JoyTableRow>
                      <JoyTableHeaderCell sx={{ width: 56 }}>
                        <Checkbox
                          checked={allVisibleSelected}
                          onChange={(event) => {
                            if (event.target.checked) {
                              selectAll(
                                customers.map((customer) => customer.id),
                              );
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
                      <JoyTableHeaderCell align="right">
                        Actions
                      </JoyTableHeaderCell>
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
                              ? "rgba(2, 132, 199, 0.06)"
                              : undefined
                          }
                          onClick={() => handleCustomerClick(customer)}
                          sx={
                            selectedIds.has(customer.id)
                              ? {
                                  "& > td": {
                                    backgroundColor: "rgba(2, 132, 199, 0.04)",
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
                                <Mail className="h-3.5 w-3.5" />
                                <Typography level="body-xs" color="neutral">
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
                                <Phone className="h-3.5 w-3.5" />
                                <Typography level="body-sm">
                                  {customer.phone}
                                </Typography>
                              </Stack>
                            ) : (
                              <Typography level="body-sm" color="neutral">
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
                            >
                              <DollarSign className="h-3.5 w-3.5" />
                              <Typography level="body-sm">
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
                                <Calendar className="h-3.5 w-3.5" />
                                <Typography level="body-sm">
                                  {format(
                                    new Date(customer.last_purchase_date),
                                    "MMM d, yyyy",
                                  )}
                                </Typography>
                              </Stack>
                            ) : (
                              <Typography level="body-sm" color="neutral">
                                No purchases
                              </Typography>
                            )}
                          </JoyTableCell>
                          <JoyTableCell>
                            <Typography level="body-sm" color="neutral">
                              {format(
                                new Date(customer.created_at),
                                "MMM d, yyyy",
                              )}
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
                                  startDecorator={
                                    <Trash2 className="h-4 w-4" />
                                  }
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
          </Stack>
        </JoyCardContent>
      </JoyCard>

      <EnhancedSegmentImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImportComplete={handleImportComplete}
      />

      <SyncFromCRMModal
        open={showSyncFromCRM}
        onOpenChange={setShowSyncFromCRM}
        onSyncComplete={invalidateCustomers}
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
  );
};
