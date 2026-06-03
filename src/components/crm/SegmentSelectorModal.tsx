import { useState, useEffect } from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Card from "@mui/joy/Card";
import Checkbox from "@mui/joy/Checkbox";
import Chip from "@mui/joy/Chip";
import CircularProgress from "@mui/joy/CircularProgress";
import Divider from "@mui/joy/Divider";
import Input from "@mui/joy/Input";
import Modal from "@mui/joy/Modal";
import ModalClose from "@mui/joy/ModalClose";
import ModalDialog from "@mui/joy/ModalDialog";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import {
  Check,
  Info,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { CustomSegmentBuilder } from "./CustomSegmentBuilder";

interface SegmentSelectorModalProps {
  open: boolean;
  onClose: () => void;
  onSegmentsSelected: (segments: any[]) => void;
  selectedSegmentIds?: string[];
  title?: string;
  description?: string;
}

interface PredefinedSegment {
  id: string;
  name: string;
  description: string;
  suggested?: boolean;
  conditions: any;
}

const predefinedSegments: PredefinedSegment[] = [
  {
    id: "loyalty-members",
    name: "Loyalty Members",
    description: "Customers in the loyalty program",
    suggested: true,
    conditions: { loyalty_program: true },
  },
  {
    id: "new-customers",
    name: "New Customers",
    description: "First purchase in last 30 days",
    suggested: true,
    conditions: { first_purchase_days: 30 },
  },
  {
    id: "at-risk-customers",
    name: "At-Risk Customers",
    description: "No purchase in 6+ months",
    conditions: { last_purchase_days: 180 },
  },
  {
    id: "email-engagers",
    name: "Email Engagers",
    description: "Clicked on last 3 campaigns",
    suggested: true,
    conditions: { email_engagement: "high" },
  },
  {
    id: "frequent-buyers",
    name: "Frequent Buyers",
    description: "3+ purchases in last 60 days",
    conditions: { purchase_frequency: { count: 3, days: 60 } },
  },
  {
    id: "houseplant-shoppers",
    name: "Houseplant Shoppers",
    description: "Bought houseplants recently",
    conditions: { product_categories: ["houseplants"] },
  },
  {
    id: "vegetable-gardeners",
    name: "Vegetable Gardeners",
    description: "Bought edibles or seeds",
    conditions: { product_categories: ["vegetables", "seeds", "edibles"] },
  },
  {
    id: "holiday-decorators",
    name: "Holiday Decorators",
    description: "Bought holiday-themed items",
    conditions: { product_categories: ["holiday", "decorations"] },
  },
  {
    id: "workshop-attendees",
    name: "Workshop Attendees",
    description: "Registered for a class/workshop",
    conditions: { workshop_attendance: true },
  },
  {
    id: "big-spenders",
    name: "Big Spenders",
    description: "Average cart value > $200",
    suggested: true,
    conditions: { avg_cart_value: { operator: ">", value: 200 } },
  },
];

const sectionHeadingSx = {
  color: "neutral.500",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
} as const;

const selectableCardSx = (isSelected: boolean) => ({
  cursor: "pointer",
  transition: "all 0.15s ease",
  borderColor: isSelected ? "primary.500" : "neutral.outlinedBorder",
  bgcolor: isSelected ? "primary.softBg" : "background.surface",
  boxShadow: isSelected ? "sm" : "none",
  "&:hover": {
    borderColor: isSelected ? "primary.500" : "primary.300",
    bgcolor: "primary.softBg",
  },
});

const matchesQuery = (value: string | null | undefined, query: string) =>
  !query || (value ?? "").toLowerCase().includes(query);

// Custom segments arrive from two sources — the crm_segments table (existing)
// and the custom_segments table (where the builder writes). Merge them by id so
// a freshly created segment is never shown twice or dropped on save.
const dedupeSegmentsById = (segments: any[]) => {
  const seen = new Set<string>();
  return segments.filter((segment) => {
    const id = segment?.id;
    if (!id || seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
};

export const SegmentSelectorModal = ({
  open,
  onClose,
  onSegmentsSelected,
  selectedSegmentIds = [],
  title = "Select Target Segments",
  description = "Choose customer segments for your campaign targeting",
}: SegmentSelectorModalProps) => {
  const [selectedPredefined, setSelectedPredefined] =
    useState<string[]>(selectedSegmentIds);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customDraft, setCustomDraft] = useState<{
    name: string;
    filters: any[];
  }>({ name: "", filters: [] });
  const [customSegments, setCustomSegments] = useState<any[]>([]);
  const [existingSegments, setExistingSegments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSegments, setLoadingSegments] = useState(false);
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const { tenant } = useTenant();
  const { user } = useAuth();

  useEffect(() => {
    if (open) {
      fetchSegments();
      // Re-sync selection to the incoming prop each time the modal opens, so a
      // reopened modal reflects the parent's current selection rather than the
      // state captured at first mount. Intentionally keyed on `open` only so
      // in-modal toggles aren't reset by unrelated parent re-renders.
      setSelectedPredefined(selectedSegmentIds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Fetch both segment sources on open: crm_segments (existing saved segments)
  // and custom_segments (where the builder persists new segments). The latter
  // was previously written but never read back, so created segments vanished on
  // reopen — fetching it here makes them persist.
  const fetchSegments = async () => {
    setLoadingSegments(true);
    try {
      const [crmResult, customResult] = await Promise.all([
        supabase
          .from("crm_segments")
          .select("*")
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
        supabase
          .from("custom_segments")
          .select("*")
          .eq("is_active", true)
          .order("created_at", { ascending: false }),
      ]);

      if (crmResult.error) throw crmResult.error;
      if (customResult.error) throw customResult.error;

      setExistingSegments(crmResult.data || []);
      setCustomSegments(customResult.data || []);
    } catch (error) {
      console.error("Error fetching segments:", error);
    } finally {
      setLoadingSegments(false);
    }
  };

  const handlePredefinedToggle = (segmentId: string) => {
    setSelectedPredefined((prev) =>
      prev.includes(segmentId)
        ? prev.filter((id) => id !== segmentId)
        : [...prev, segmentId],
    );
  };

  const createCustomSegment = async (segmentData: {
    name: string;
    filters: any[];
  }) => {
    // custom_segments.tenant_id / user_id are UUID NOT NULL with no default and
    // no insert trigger — RLS authorizes rows but does not populate them. The
    // real ids must be supplied or the insert fails the uuid type-cast.
    const tenantId = tenant?.id;
    const userId = user?.id;

    if (!tenantId || !userId) {
      toast({
        title: "Error",
        description:
          "Unable to determine your account. Please refresh and try again.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("custom_segments")
        .insert({
          name: segmentData.name,
          filters: segmentData.filters,
          tenant_id: tenantId,
          user_id: userId,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Success",
        description: "Custom segment created successfully",
      });

      // Add to existing segments and select it
      setCustomSegments((prev) => [data, ...prev]);
      setSelectedPredefined((prev) => [...prev, data.id]);
      setShowCustomForm(false);
      setCustomDraft({ name: "", filters: [] });
    } catch (error) {
      console.error("Error creating segment:", error);
      toast({
        title: "Error",
        description: "Failed to create custom segment",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    // Build the payload from every source the user could have selected from —
    // including custom_segments, which is the table the builder writes to.
    // Without it, a freshly created+selected segment would be silently dropped.
    const combinedSegments = dedupeSegmentsById([
      ...predefinedSegments,
      ...existingSegments,
      ...customSegments,
    ]);
    const selectedSegments = combinedSegments.filter((segment) =>
      selectedPredefined.includes(segment.id),
    );

    onSegmentsSelected(selectedSegments);
    onClose();
  };

  const closeCustomForm = () => {
    setShowCustomForm(false);
    setCustomDraft({ name: "", filters: [] });
  };

  const handleClose = () => {
    closeCustomForm();
    setSearch("");
    onClose();
  };

  const query = search.trim().toLowerCase();
  const filteredPredefined = predefinedSegments.filter((segment) =>
    matchesQuery(segment.name, query),
  );
  const customSegmentList = dedupeSegmentsById([
    ...existingSegments,
    ...customSegments,
  ]);
  const filteredCustom = customSegmentList.filter((segment) =>
    matchesQuery(segment.name, query),
  );
  const selectedCount = selectedPredefined.length;

  return (
    <Modal open={open} onClose={handleClose}>
      <ModalDialog
        aria-labelledby="segment-selector-title"
        layout="center"
        variant="outlined"
        sx={{
          width: { xs: "95vw", sm: 600, md: 700 },
          maxHeight: "85vh",
          borderRadius: "xl",
          p: 0,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <ModalClose sx={{ zIndex: 20 }} />

        {/* A. HEADER */}
        <Box
          sx={{
            bgcolor: "background.surface",
            borderBottom: "1px solid",
            borderColor: "divider",
            px: 3,
            pt: 2.5,
            pb: 2,
          }}
        >
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
            <Box sx={{ color: "primary.500", display: "inline-flex", mt: 0.25 }}>
              <Users aria-hidden="true" size={22} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0, pr: 4 }}>
              <Stack
                direction="row"
                spacing={0.75}
                sx={{ alignItems: "center" }}
              >
                <Typography id="segment-selector-title" level="title-lg">
                  {title}
                </Typography>
                <Tooltip
                  arrow
                  title="Segments are real groups of customers with shared traits, used for targeting."
                >
                  <Box
                    aria-hidden="true"
                    sx={{
                      color: "neutral.400",
                      cursor: "help",
                      display: "inline-flex",
                    }}
                  >
                    <Info size={16} />
                  </Box>
                </Tooltip>
              </Stack>
              <Typography color="neutral" level="body-sm">
                {description}
              </Typography>
            </Box>
          </Stack>
          <Input
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search segments..."
            size="sm"
            slotProps={{ input: { "aria-label": "Search segments" } }}
            startDecorator={<Search aria-hidden="true" size={16} />}
            sx={{ mt: 1.5 }}
            value={search}
            variant="outlined"
          />
        </Box>

        {/* B. BODY */}
        <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 3, py: 2 }}>
          <Typography level="title-sm" sx={{ ...sectionHeadingSx, mb: 1.5 }}>
            Predefined Segments
          </Typography>
          {filteredPredefined.length > 0 ? (
            <Box
              sx={{
                display: "grid",
                gap: 1.5,
                gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
              }}
            >
              {filteredPredefined.map((segment) => {
                const isSelected = selectedPredefined.includes(segment.id);
                return (
                  <Card
                    key={segment.id}
                    aria-pressed={isSelected}
                    onClick={() => handlePredefinedToggle(segment.id)}
                    role="button"
                    size="sm"
                    variant="outlined"
                    sx={selectableCardSx(isSelected)}
                  >
                    <Stack
                      direction="row"
                      spacing={1.5}
                      sx={{ alignItems: "flex-start" }}
                    >
                      <Checkbox
                        checked={isSelected}
                        readOnly
                        slotProps={{ input: { tabIndex: -1 } }}
                        sx={{ pointerEvents: "none", mt: 0.25 }}
                      />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack
                          direction="row"
                          spacing={1}
                          sx={{
                            alignItems: "flex-start",
                            justifyContent: "space-between",
                          }}
                        >
                          <Typography level="title-sm">
                            {segment.name}
                          </Typography>
                          {segment.suggested && (
                            <Chip
                              color="primary"
                              size="sm"
                              startDecorator={<Sparkles size={12} />}
                              variant="soft"
                            >
                              Suggested
                            </Chip>
                          )}
                        </Stack>
                        <Typography color="neutral" level="body-xs" noWrap>
                          {segment.description}
                        </Typography>
                      </Box>
                    </Stack>
                  </Card>
                );
              })}
            </Box>
          ) : (
            <Typography
              color="neutral"
              level="body-sm"
              sx={{ fontStyle: "italic" }}
            >
              No segments match "{search}".
            </Typography>
          )}

          <Divider sx={{ my: 2 }} />

          <Typography level="title-sm" sx={{ ...sectionHeadingSx, mb: 1.5 }}>
            Your Custom Segments
          </Typography>
          {loadingSegments ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
              <CircularProgress size="sm" />
            </Box>
          ) : filteredCustom.length > 0 ? (
            <Stack spacing={1.5}>
              {filteredCustom.map((segment) => {
                const isSelected = selectedPredefined.includes(segment.id);
                return (
                  <Card
                    key={segment.id}
                    aria-pressed={isSelected}
                    onClick={() => handlePredefinedToggle(segment.id)}
                    role="button"
                    size="sm"
                    variant="outlined"
                    sx={selectableCardSx(isSelected)}
                  >
                    <Stack
                      direction="row"
                      spacing={1.5}
                      sx={{ alignItems: "center" }}
                    >
                      <Checkbox
                        checked={isSelected}
                        readOnly
                        slotProps={{ input: { tabIndex: -1 } }}
                        sx={{ pointerEvents: "none" }}
                      />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography level="title-sm">{segment.name}</Typography>
                        {segment.description && (
                          <Typography color="neutral" level="body-xs" noWrap>
                            {segment.description}
                          </Typography>
                        )}
                      </Box>
                      <Chip
                        color="neutral"
                        size="sm"
                        startDecorator={<Users size={12} />}
                        variant="soft"
                      >
                        {segment.customer_count || 0} customers
                      </Chip>
                    </Stack>
                  </Card>
                );
              })}
            </Stack>
          ) : (
            <Typography
              color="neutral"
              level="body-sm"
              sx={{ fontStyle: "italic" }}
            >
              {customSegmentList.length === 0
                ? "No custom segments yet."
                : `No custom segments match "${search}".`}
            </Typography>
          )}

          <Box sx={{ mt: 2 }}>
            {!showCustomForm ? (
              <Button
                color="neutral"
                fullWidth
                onClick={() => setShowCustomForm(true)}
                startDecorator={<Plus aria-hidden="true" size={16} />}
                sx={{ borderStyle: "dashed" }}
                variant="outlined"
              >
                Create Custom Segment
              </Button>
            ) : (
              <Sheet
                variant="outlined"
                sx={{ borderRadius: "md", overflow: "hidden" }}
              >
                <Stack
                  direction="row"
                  spacing={1.25}
                  sx={{
                    alignItems: "center",
                    bgcolor: "background.level1",
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    px: 2,
                    py: 1.5,
                  }}
                >
                  <Box sx={{ color: "primary.500", display: "inline-flex" }}>
                    <SlidersHorizontal aria-hidden="true" size={18} />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography level="title-sm">
                      Create Custom Segment
                    </Typography>
                    <Typography color="neutral" level="body-xs">
                      Name it and add filters to define who's included.
                    </Typography>
                  </Box>
                </Stack>
                <Box sx={{ p: 2 }}>
                  <CustomSegmentBuilder
                    onCancel={closeCustomForm}
                    onChange={setCustomDraft}
                    onSave={createCustomSegment}
                  />
                </Box>
                <Box
                  sx={{
                    bgcolor: "background.level1",
                    borderTop: "1px solid",
                    borderColor: "divider",
                    display: "flex",
                    gap: 1,
                    justifyContent: "flex-end",
                    px: 2,
                    py: 1.5,
                  }}
                >
                  <Button
                    color="neutral"
                    disabled={loading}
                    onClick={closeCustomForm}
                    variant="plain"
                  >
                    Cancel
                  </Button>
                  <Button
                    color="primary"
                    disabled={!customDraft.name.trim()}
                    loading={loading}
                    onClick={() => void createCustomSegment(customDraft)}
                    startDecorator={<Plus aria-hidden="true" size={16} />}
                    variant="solid"
                  >
                    Save Segment
                  </Button>
                </Box>
              </Sheet>
            )}
          </Box>
        </Box>

        {/* C. FOOTER */}
        <Box
          sx={{
            alignItems: "center",
            bgcolor: "background.surface",
            borderTop: "1px solid",
            borderColor: "divider",
            display: "flex",
            gap: 2,
            px: 3,
            py: 2,
          }}
        >
          <Typography
            color={selectedCount > 0 ? "primary" : "neutral"}
            level="body-sm"
            startDecorator={
              selectedCount > 0 ? <Check aria-hidden="true" size={16} /> : null
            }
          >
            {selectedCount > 0
              ? `${selectedCount} segment${selectedCount === 1 ? "" : "s"} selected`
              : "No segments selected"}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ ml: "auto" }}>
            <Button color="neutral" onClick={handleClose} variant="plain">
              Cancel
            </Button>
            <Button
              color="primary"
              disabled={selectedCount === 0}
              onClick={handleConfirm}
              variant="solid"
            >
              Save Selection
            </Button>
          </Stack>
        </Box>
      </ModalDialog>
    </Modal>
  );
};
