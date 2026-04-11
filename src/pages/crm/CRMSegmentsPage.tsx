import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Target,
  Plus,
  Search,
  RefreshCw,
  Upload,
  SlidersHorizontal,
  Eye,
  EyeOff,
  ChevronDown,
} from "lucide-react";
import { useCRMSegments } from "@/hooks/useCRMSegments";
import { useSegmentCounts } from "@/hooks/useSegmentCounts";
import { useSystemSegmentVisibility } from "@/hooks/useSystemSegmentVisibility";
import { SegmentCard } from "@/components/crm/segments/SegmentCard";
import { CustomSegmentModal } from "@/components/crm/segments/CustomSegmentModal";
import { SegmentOverviewCard } from "@/components/crm/segments/SegmentOverviewCard";
import { SegmentCustomersModal } from "@/components/crm/segments/SegmentCustomersModal";
import { EnhancedSegmentImportDialog } from "@/components/crm/segments/EnhancedSegmentImportDialog";
import { SegmentSMSDialog } from "@/components/sms/SegmentSMSDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNavigate } from "react-router-dom";
import {
  CustomDropdown,
  CustomDropdownItem,
} from "@/components/ui/custom-dropdown";
import { DomainHealthBanner } from "@/components/crm/email/DomainHealthBanner";

// Predefined segments data (without hardcoded counts)
const predefinedSegments = [
  {
    id: "perks-members",
    name: "Perks Members",
    description: "Customers enrolled in your Perks loyalty program",
    icon: "crown" as const,
  },
  {
    id: "loyalty-members",
    name: "Loyalty Members",
    description:
      "Customers enrolled in your loyalty program with active engagement",
    icon: "crown" as const,
  },
  {
    id: "high-value",
    name: "High-Value Customers",
    description: "Top spending customers who drive significant revenue",
    icon: "trending" as const,
  },
  {
    id: "new-customers",
    name: "New Customers",
    description:
      "Recent customers who made their first purchase within 30 days",
    icon: "users" as const,
  },
  {
    id: "lapsed-customers",
    name: "Lapsed Customers",
    description:
      "Previously active customers who haven't purchased in 90+ days",
    icon: "mail" as const,
  },
  {
    id: "seasonal-shoppers",
    name: "Seasonal Shoppers",
    description:
      "Customers who typically purchase during specific seasons or holidays",
    icon: "gift" as const,
  },
  {
    id: "frequent-buyers",
    name: "Frequent Buyers",
    description: "Customers with 3+ purchases in the last 6 months",
    icon: "shopping" as const,
  },
];

export const CRMSegmentsPage: React.FC = () => {
  const {
    segments,
    loading,
    searchTerm,
    setSearchTerm,
    fetchSegments,
    createSegment,
    deleteSegment,
    bulkImportSegments,
  } = useCRMSegments();
  const { counts, loading: countsLoading, refreshCounts } = useSegmentCounts();
  const { hideSegment, showSegment, isHidden, hiddenCount } =
    useSystemSegmentVisibility();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCustomBuilder, setShowCustomBuilder] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [highlightedSegment, setHighlightedSegment] = useState<string | null>(
    null,
  );
  const [selectedSegment, setSelectedSegment] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [smsSegment, setSmsSegment] = useState<{
    id: string;
    name: string;
    count: number;
    isSystem: boolean;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<"visible" | "hidden">("visible");
  const [createDropdownOpen, setCreateDropdownOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const segmentRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const handleCreateSegment = () => {
    setShowCustomBuilder(true);
  };

  const handleSaveCustomSegment = async (segmentData: any) => {
    try {
      await createSegment(segmentData);
      setShowCustomBuilder(false);
      // Refresh both segments and counts
      await fetchSegments();
      refreshCounts();
    } catch (error) {
      // Error is already handled in createSegment with toast
      console.error("Failed to save segment:", error);
    }
  };

  const handleSegmentUpdate = async () => {
    // Refresh both segments and counts when segment customers are modified
    await fetchSegments();
    refreshCounts();
  };

  const handleImportComplete = async () => {
    setShowImportModal(false);
    await fetchSegments();
    refreshCounts();
  };

  const handleCreateCampaign = (segmentId: string) => {
    navigate(`/crm/campaigns/new?segment=${segmentId}`);
  };

  const handleSendSMS = (
    segmentId: string,
    segmentName: string,
    count: number,
    isSystem: boolean,
  ) => {
    setSmsSegment({ id: segmentId, name: segmentName, count, isSystem });
  };

  const handleViewSegmentDetails = (segmentId: string) => {
    // Find segment name
    const segment = predefinedSegments.find((s) => s.id === segmentId);
    if (segment) {
      setSelectedSegment({ id: segmentId, name: segment.name });
      return;
    }

    // If not found in predefined, try highlighting (for navigation effect)
    // Update URL with highlight parameter
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set("highlight", segmentId);
    setSearchParams(newSearchParams);

    // Set highlighted segment
    setHighlightedSegment(segmentId);

    // Scroll to segment
    const segmentElement = segmentRefs.current[segmentId];
    if (segmentElement) {
      segmentElement.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }

    // Clear highlight after 3 seconds
    setTimeout(() => {
      setHighlightedSegment(null);
      const params = new URLSearchParams(searchParams);
      params.delete("highlight");
      setSearchParams(params);
    }, 3000);
  };

  // Handle URL highlight parameter on page load
  useEffect(() => {
    const highlightParam = searchParams.get("highlight");
    if (highlightParam) {
      setHighlightedSegment(highlightParam);

      // Scroll to segment after a brief delay to ensure rendering
      setTimeout(() => {
        const segmentElement = segmentRefs.current[highlightParam];
        if (segmentElement) {
          segmentElement.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }
      }, 100);

      // Clear highlight after 3 seconds
      setTimeout(() => {
        setHighlightedSegment(null);
        const params = new URLSearchParams(searchParams);
        params.delete("highlight");
        setSearchParams(params);
      }, 3000);
    }
  }, [searchParams, setSearchParams]);

  // Filter predefined segments based on search term and visibility
  const filteredPredefinedSegments = predefinedSegments.filter(
    (segment) =>
      segment.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      segment.description.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Split into visible and hidden segments
  const visibleSystemSegments = filteredPredefinedSegments.filter(
    (s) => !isHidden(s.id),
  );
  const hiddenSystemSegments = filteredPredefinedSegments.filter((s) =>
    isHidden(s.id),
  );

  return (
    <div
      className={`${isMobile ? "mobile-section" : "p-6"} mobile-space-normal mobile-container`}
    >
      <DomainHealthBanner />
      {/* Header */}
      <div
        className={`${isMobile ? "mobile-space-tight" : "flex justify-between items-center"} mb-6`}
      >
        <div className="flex items-center gap-3 mb-4 md:mb-0">
          <h1
            className={`${isMobile ? "mobile-text-hero" : "text-3xl"} font-bold`}
          >
            Customer Segments
          </h1>
        </div>
        <div className={`flex ${isMobile ? "flex-col gap-2" : "gap-2"}`}>
          <Button
            variant="outline"
            onClick={fetchSegments}
            disabled={loading}
            className={`${isMobile ? "mobile-btn-secondary mobile-touch-feedback w-full" : ""} mobile-focus-ring`}
            size={isMobile ? "default" : "sm"}
          >
            <RefreshCw
              className={`${isMobile ? "mobile-icon-sm" : "h-4 w-4"} mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Refresh Data
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowImportModal(true)}
            className={`${isMobile ? "mobile-btn-secondary mobile-touch-feedback w-full" : ""} mobile-focus-ring`}
            size={isMobile ? "default" : "sm"}
          >
            <Upload
              className={`${isMobile ? "mobile-icon-sm" : "h-4 w-4"} mr-2`}
            />
            Import CSV
          </Button>
          <CustomDropdown
            open={createDropdownOpen}
            onOpenChange={setCreateDropdownOpen}
            align="end"
            trigger={(props) => (
              <Button
                {...props}
                ref={props.ref as React.RefCallback<HTMLButtonElement>}
                className={`${isMobile ? "mobile-btn-primary mobile-touch-feedback w-full" : ""} mobile-focus-ring gap-1`}
                size={isMobile ? "default" : "sm"}
              >
                <Plus
                  className={`${isMobile ? "mobile-icon-sm" : "h-4 w-4"}`}
                />
                Create Segment
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            )}
          >
            <CustomDropdownItem
              onSelect={() => {
                setCreateDropdownOpen(false);
                handleCreateSegment();
              }}
            >
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                <div>
                  <div className="font-medium">Create Segment</div>
                  <div className="text-xs text-muted-foreground">
                    Simple segment with filters
                  </div>
                </div>
              </div>
            </CustomDropdownItem>
            <CustomDropdownItem
              onSelect={() => {
                setCreateDropdownOpen(false);
                navigate("/crm/segments/beta");
              }}
            >
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                <div>
                  <div className="font-medium">Advanced Segment</div>
                  <div className="text-xs text-muted-foreground">
                    Rule-based with analytics
                  </div>
                </div>
              </div>
            </CustomDropdownItem>
          </CustomDropdown>
        </div>
      </div>

      <div className={isMobile ? "mobile-space-normal" : "space-y-6"}>
        {/* Search */}
        <Card className="mobile-card-elevated">
          <CardContent className={isMobile ? "p-4" : "pt-6"}>
            <div className="relative">
              <Search
                className={`absolute left-3 top-3 ${isMobile ? "mobile-icon-sm" : "h-4 w-4"} text-muted-foreground`}
              />
              <Input
                placeholder="Search all segments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`pl-10 ${isMobile ? "mobile-touch-target" : ""} mobile-focus-ring`}
              />
            </div>
          </CardContent>
        </Card>

        {/* System Segments with Tabs */}
        <Card className="mobile-card-elevated">
          <CardHeader className={isMobile ? "p-4 pb-2" : ""}>
            <CardTitle
              className={`flex items-center gap-2 ${isMobile ? "mobile-text-heading" : ""}`}
            >
              <Target
                className={`${isMobile ? "mobile-icon-md" : "h-5 w-5"}`}
              />
              System Segments
            </CardTitle>
          </CardHeader>
          <CardContent className={isMobile ? "p-4 pt-2" : ""}>
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as "visible" | "hidden")}
              className="w-full"
            >
              <TabsList className="mb-4">
                <TabsTrigger value="visible" className="gap-2">
                  <Eye className="h-4 w-4" />
                  Visible
                  {visibleSystemSegments.length > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {visibleSystemSegments.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="hidden" className="gap-2">
                  <EyeOff className="h-4 w-4" />
                  Hidden
                  {hiddenCount > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {hiddenCount}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="visible">
                {visibleSystemSegments.length > 0 ? (
                  <div
                    className={`${isMobile ? "grid grid-cols-1 gap-4" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"}`}
                  >
                    {visibleSystemSegments.map((segment) => (
                      <div
                        key={segment.id}
                        ref={(el) => (segmentRefs.current[segment.id] = el)}
                        className={`transition-all duration-500 ${
                          highlightedSegment === segment.id
                            ? "ring-4 ring-primary ring-offset-4 bg-primary/20 shadow-2xl scale-105 rounded-lg"
                            : ""
                        }`}
                      >
                        <SegmentOverviewCard
                          name={segment.name}
                          description={segment.description}
                          estimatedCount={
                            counts[segment.id as keyof typeof counts] || 0
                          }
                          isLoadingCount={countsLoading}
                          icon={segment.icon}
                          isSystem={true}
                          isHidden={false}
                          onCreateCampaign={() =>
                            handleCreateCampaign(segment.id)
                          }
                          onViewDetails={() =>
                            handleViewSegmentDetails(segment.id)
                          }
                          onHide={() => hideSegment(segment.id)}
                          onSendSMS={() =>
                            handleSendSMS(
                              segment.id,
                              segment.name,
                              counts[segment.id as keyof typeof counts] || 0,
                              true,
                            )
                          }
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <EyeOff className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">
                      All system segments are hidden
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      Switch to the "Hidden" tab to make them visible again.
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="hidden">
                {hiddenSystemSegments.length > 0 ? (
                  <div
                    className={`${isMobile ? "grid grid-cols-1 gap-4" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"}`}
                  >
                    {hiddenSystemSegments.map((segment) => (
                      <div
                        key={segment.id}
                        ref={(el) => (segmentRefs.current[segment.id] = el)}
                        className="opacity-70"
                      >
                        <SegmentOverviewCard
                          name={segment.name}
                          description={segment.description}
                          estimatedCount={
                            counts[segment.id as keyof typeof counts] || 0
                          }
                          isLoadingCount={countsLoading}
                          icon={segment.icon}
                          isSystem={true}
                          isHidden={true}
                          onCreateCampaign={() =>
                            handleCreateCampaign(segment.id)
                          }
                          onViewDetails={() =>
                            handleViewSegmentDetails(segment.id)
                          }
                          onShow={() => showSegment(segment.id)}
                          onSendSMS={() =>
                            handleSendSMS(
                              segment.id,
                              segment.name,
                              counts[segment.id as keyof typeof counts] || 0,
                              true,
                            )
                          }
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Eye className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">
                      No hidden segments
                    </h3>
                    <p className="text-muted-foreground">
                      Hide segments you don't need by clicking the hide icon on
                      any segment card.
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Custom Segments */}
        <Card className="mobile-card-elevated">
          <CardHeader className={isMobile ? "p-4 pb-2" : ""}>
            <CardTitle
              className={`flex items-center gap-2 ${isMobile ? "mobile-text-heading" : ""}`}
            >
              <Target
                className={`${isMobile ? "mobile-icon-md" : "h-5 w-5"}`}
              />
              Custom Segments
            </CardTitle>
          </CardHeader>
          <CardContent className={isMobile ? "p-4 pt-2" : ""}>
            {loading || countsLoading ? (
              <div className="text-center py-8">
                <div
                  className={`animate-spin rounded-full ${isMobile ? "mobile-icon-lg" : "h-8 w-8"} border-b-2 border-primary mx-auto`}
                ></div>
                <p
                  className={`${isMobile ? "mobile-text-body" : "text-muted-foreground"} mt-2`}
                >
                  Loading custom segments...
                </p>
              </div>
            ) : segments.length === 0 ? (
              <div className="text-center py-8">
                <Target
                  className={`${isMobile ? "mobile-icon-xl" : "h-12 w-12"} text-muted-foreground mx-auto mb-4`}
                />
                <h3
                  className={`${isMobile ? "mobile-text-subheading" : "text-lg"} font-semibold mb-2`}
                >
                  No custom segments found
                </h3>
                <p
                  className={`${isMobile ? "mobile-text-body" : "text-muted-foreground"} mb-4 mobile-text-balance`}
                >
                  {searchTerm
                    ? "No custom segments match your search."
                    : "Create your first custom segment to start targeting specific customer groups."}
                </p>
                {!searchTerm && (
                  <Button
                    onClick={handleCreateSegment}
                    className={`${isMobile ? "mobile-btn-cta mobile-touch-feedback" : ""} mobile-focus-ring`}
                  >
                    <Plus
                      className={`${isMobile ? "mobile-icon-sm" : "h-4 w-4"} mr-2`}
                    />
                    Create Your First Custom Segment
                  </Button>
                )}
              </div>
            ) : (
              <div
                className={`${isMobile ? "grid grid-cols-1 gap-4" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"}`}
              >
                {segments.map((segment) => (
                  <SegmentCard
                    key={segment.id}
                    segment={segment}
                    onSegmentUpdate={handleSegmentUpdate}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <CustomSegmentModal
        open={showCustomBuilder}
        onSave={handleSaveCustomSegment}
        onCancel={() => setShowCustomBuilder(false)}
      />

      <EnhancedSegmentImportDialog
        open={showImportModal}
        onOpenChange={setShowImportModal}
        onImportComplete={handleImportComplete}
      />

      {/* Segment Customers Modal */}
      {selectedSegment && (
        <SegmentCustomersModal
          open={!!selectedSegment}
          onClose={() => setSelectedSegment(null)}
          segmentId={selectedSegment.id}
          segmentName={selectedSegment.name}
          onAssignmentChange={refreshCounts}
        />
      )}

      {/* SMS Dialog for System Segments */}
      {smsSegment && (
        <SegmentSMSDialog
          open={!!smsSegment}
          onOpenChange={(open) => !open && setSmsSegment(null)}
          segmentId={smsSegment.id}
          segmentName={smsSegment.name}
          customerCount={smsSegment.count}
          isSystemSegment={smsSegment.isSystem}
        />
      )}
    </div>
  );
};
