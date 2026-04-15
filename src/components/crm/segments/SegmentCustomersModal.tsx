import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-legacy/dialog";
import { Button } from "@/components/ui-legacy/button";
import { Input } from "@/components/ui-legacy/input";
import { Badge } from "@/components/ui-legacy/badge";
import { Card, CardContent } from "@/components/ui-legacy/card";
import { Avatar, AvatarFallback } from "@/components/ui-legacy/avatar";
import { ScrollArea } from "@/components/ui-legacy/scroll-area";
import {
  Search,
  Mail,
  Phone,
  Calendar,
  Users,
  X,
  UserPlus,
  Loader2,
  SlidersHorizontal,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { useCustomers } from "@/hooks/useCustomers";
import { useCustomerSegments } from "@/hooks/useCustomerSegments";
import { format } from "date-fns";

interface SegmentCustomer {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  persona: string | null;
  persona_id: string | null;
  created_at: string;
  total_spent: number | null;
  last_purchase_date: string | null;
  tags: string[] | null;
  order_history: Json | null;
}

interface SegmentCustomersModalProps {
  open: boolean;
  onClose: () => void;
  segmentId: string;
  segmentName: string;
  onAssignmentChange?: () => void;
}

export const SegmentCustomersModal: React.FC<SegmentCustomersModalProps> = ({
  open,
  onClose,
  segmentId,
  segmentName,
  onAssignmentChange,
}) => {
  const [customers, setCustomers] = useState<SegmentCustomer[]>([]);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [assigningCustomer, setAssigningCustomer] = useState<string | null>(
    null,
  );
  const [unassigningCustomer, setUnassigningCustomer] = useState<string | null>(
    null,
  );
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { data: allCustomers, isLoading: customersLoading } = useCustomers();

  // Fetch customers in this segment
  const fetchSegmentCustomers = async () => {
    if (!user || !segmentId || !tenant) return [];

    try {
      let customersData: SegmentCustomer[] = [];

      // For predefined segments, we need to calculate based on criteria AND check customer_segments table
      if (
        [
          "loyalty-members",
          "high-value",
          "new-customers",
          "lapsed-customers",
          "seasonal-shoppers",
          "frequent-buyers",
        ].includes(segmentId)
      ) {
        // Get all customers and filter based on segment criteria
        const { data: allCustomers, error } = await supabase
          .from("crm_customers")
          .select(
            "id, email, first_name, last_name, phone, persona, persona_id, created_at, total_spent, last_purchase_date, tags, order_history",
          )
          .eq("tenant_id", tenant.id);

        if (error) throw error;

        // Apply segment-specific filtering
        let criteriaBasedCustomers: SegmentCustomer[] = [];
        switch (segmentId) {
          case "loyalty-members":
            criteriaBasedCustomers =
              allCustomers?.filter(
                (customer) =>
                  customer.tags && customer.tags.includes("loyalty"),
              ) || [];
            break;
          case "high-value":
            criteriaBasedCustomers =
              allCustomers?.filter(
                (customer) => (customer.total_spent || 0) >= 500,
              ) || [];
            break;
          case "new-customers":
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            criteriaBasedCustomers =
              allCustomers?.filter(
                (customer) => new Date(customer.created_at) >= thirtyDaysAgo,
              ) || [];
            break;
          case "lapsed-customers":
            const ninetyDaysAgo = new Date();
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
            criteriaBasedCustomers =
              allCustomers?.filter(
                (customer) =>
                  customer.last_purchase_date &&
                  new Date(customer.last_purchase_date) <= ninetyDaysAgo,
              ) || [];
            break;
          case "frequent-buyers":
            criteriaBasedCustomers =
              allCustomers?.filter(
                (customer) =>
                  customer.order_history &&
                  Array.isArray(customer.order_history) &&
                  (customer.order_history as any[]).length >= 3,
              ) || [];
            break;
          case "seasonal-shoppers":
            criteriaBasedCustomers =
              allCustomers?.filter(
                (customer) =>
                  customer.tags &&
                  (customer.tags.includes("seasonal") ||
                    customer.tags.includes("holiday")),
              ) || [];
            break;
        }
        // ALSO get manually assigned customers from customer_segments table
        // First, find the segment ID in the database
        const predefinedSegmentNames = {
          "loyalty-members": "Loyalty Members",
          "high-value": "High-Value Customers",
          "new-customers": "New Customers",
          "lapsed-customers": "Lapsed Customers",
          "seasonal-shoppers": "Seasonal Shoppers",
          "frequent-buyers": "Frequent Buyers",
        };

        const segmentName =
          predefinedSegmentNames[
            segmentId as keyof typeof predefinedSegmentNames
          ];
        let manuallyAssignedCustomers: SegmentCustomer[] = [];

        if (segmentName) {
          const { data: existingSegment } = await supabase
            .from("crm_segments")
            .select("id")
            .eq("name", segmentName)
            .eq("tenant_id", tenant.id)
            .single();

          if (existingSegment) {
            const { data: segmentCustomers, error: segmentError } =
              await supabase
                .from("customer_segments")
                .select(
                  `
                customer_id,
                crm_customers (
                  id,
                  email,
                  first_name,
                  last_name,
                  phone,
                  persona,
                  persona_id,
                  created_at,
                  total_spent,
                  last_purchase_date,
                  tags,
                  order_history
                )
              `,
                )
                .eq("segment_id", existingSegment.id);

            if (!segmentError && segmentCustomers) {
              manuallyAssignedCustomers =
                segmentCustomers
                  ?.map((sc) => sc.crm_customers)
                  .filter(Boolean) || [];
            }
          }
        }

        // Combine both lists and remove duplicates
        const allCustomerIds = new Set();
        customersData = [];

        // Add criteria-based customers
        criteriaBasedCustomers.forEach((customer) => {
          if (!allCustomerIds.has(customer.id)) {
            allCustomerIds.add(customer.id);
            customersData.push(customer);
          }
        });

        // Add manually assigned customers
        manuallyAssignedCustomers.forEach((customer) => {
          if (!allCustomerIds.has(customer.id)) {
            allCustomerIds.add(customer.id);
            customersData.push(customer);
          }
        });
      } else {
        // For custom segments, get customers from customer_segments table
        const { data: segmentCustomers, error } = await supabase
          .from("customer_segments")
          .select(
            `
            customer_id,
            crm_customers (
              id,
              email,
              first_name,
              last_name,
              phone,
              persona,
              persona_id,
              created_at,
              total_spent,
              last_purchase_date,
              tags,
              order_history
            )
          `,
          )
          .eq("segment_id", segmentId);

        if (error) throw error;

        customersData =
          segmentCustomers?.map((sc) => sc.crm_customers).filter(Boolean) || [];
      }

      return customersData;
    } catch (error) {
      console.error("Error fetching segment customers:", error);
      return [];
    }
  };

  // Get customers assigned to this segment
  const getFilteredSegmentCustomers = () => {
    if (!customers) return [];

    const filtered = customers.filter((customer) => {
      if (!searchTerm) return true;

      return (
        customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        `${customer.first_name || ""} ${customer.last_name || ""}`
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        (customer.phone && customer.phone.includes(searchTerm))
      );
    });

    return filtered;
  };

  // Get customers not assigned to this segment
  const getFilteredUnassignedCustomers = () => {
    if (!allCustomers) return [];

    const assignedCustomerIds = new Set(customers.map((c) => c.id));
    const unassigned = allCustomers.filter(
      (customer) => !assignedCustomerIds.has(customer.id),
    );

    if (!searchTerm) return unassigned;

    return unassigned.filter(
      (customer) =>
        customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        `${customer.first_name || ""} ${customer.last_name || ""}`
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        (customer.phone && customer.phone.includes(searchTerm)),
    );
  };

  // Handle assigning customer to segment
  const handleAssignCustomer = async (customerId: string) => {
    if (assigningCustomer) return;
    setAssigningCustomer(customerId);

    try {
      // Check if this is a predefined segment (non-UUID)
      const isUUID =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          segmentId,
        );

      if (!isUUID) {
        // For predefined segments, we need to create the segment first
        const predefinedSegments = [
          {
            id: "loyalty-members",
            name: "Loyalty Members",
            description:
              "Customers enrolled in your loyalty program with active engagement",
          },
          {
            id: "high-value",
            name: "High-Value Customers",
            description: "Top spending customers who drive significant revenue",
          },
          {
            id: "new-customers",
            name: "New Customers",
            description:
              "Recent customers who made their first purchase within 30 days",
          },
          {
            id: "lapsed-customers",
            name: "Lapsed Customers",
            description:
              "Previously active customers who haven't purchased in 90+ days",
          },
          {
            id: "seasonal-shoppers",
            name: "Seasonal Shoppers",
            description:
              "Customers who typically purchase during specific seasons or holidays",
          },
          {
            id: "frequent-buyers",
            name: "Frequent Buyers",
            description: "Customers with 3+ purchases in the last 6 months",
          },
        ];

        const predefinedSegment = predefinedSegments.find(
          (s) => s.id === segmentId,
        );
        if (!predefinedSegment) {
          throw new Error(`Unknown predefined segment: ${segmentId}`);
        }

        // Check if segment already exists
        let actualSegmentId = segmentId;
        const { data: existingSegment } = await supabase
          .from("crm_segments")
          .select("id")
          .eq("name", predefinedSegment.name)
          .eq("tenant_id", tenant.id)
          .single();

        if (!existingSegment) {
          // Create the segment
          const { data: newSegment, error: createError } = await supabase
            .from("crm_segments")
            .insert({
              name: predefinedSegment.name,
              description: predefinedSegment.description,
              tenant_id: tenant.id,
              user_id: user.id,
              conditions: {},
              customer_count: 0,
            })
            .select("id")
            .single();

          if (createError) {
            console.error("❌ Error creating segment:", createError);
            throw createError;
          }

          actualSegmentId = newSegment.id;
        } else {
          actualSegmentId = existingSegment.id;
        }

        // Check if customer is already assigned to avoid duplicate key error
        const { data: existingAssignment } = await supabase
          .from("customer_segments")
          .select("id")
          .eq("customer_id", customerId)
          .eq("segment_id", actualSegmentId)
          .single();

        if (existingAssignment) {
        } else {
          // Now assign customer to the segment
          const { error: assignError } = await supabase
            .from("customer_segments")
            .insert({
              customer_id: customerId,
              segment_id: actualSegmentId,
            });

          if (assignError) {
            console.error(
              "❌ Error assigning customer to segment:",
              assignError,
            );
            throw assignError;
          }
        }
      } else {
        // For UUID segments (custom segments), check for existing assignment first
        const { data: existingAssignment } = await supabase
          .from("customer_segments")
          .select("id")
          .eq("customer_id", customerId)
          .eq("segment_id", segmentId)
          .single();

        if (existingAssignment) {
        } else {
          const { error } = await supabase.from("customer_segments").insert({
            customer_id: customerId,
            segment_id: segmentId,
          });

          if (error) {
            console.error("❌ Error assigning customer to segment:", error);
            throw error;
          }
        }
      }
      // Refresh the customer lists
      const segmentCustomersData = await fetchSegmentCustomers();
      setCustomers(segmentCustomersData);

      // Notify parent component about the change
      if (onAssignmentChange) {
        onAssignmentChange();
      }
    } catch (error) {
      console.error("❌ Error assigning customer to segment:", error);
    } finally {
      setAssigningCustomer(null);
    }
  };

  // Handle removing customer from segment
  const handleUnassignCustomer = async (customerId: string) => {
    if (unassigningCustomer) return;
    setUnassigningCustomer(customerId);

    try {
      // For removing, we need to find the actual segment ID if it's predefined
      let actualSegmentId = segmentId;

      const isUUID =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          segmentId,
        );
      if (!isUUID) {
        // Find the actual segment ID from the database
        const predefinedSegments = [
          { id: "loyalty-members", name: "Loyalty Members" },
          { id: "high-value", name: "High-Value Customers" },
          { id: "new-customers", name: "New Customers" },
          { id: "lapsed-customers", name: "Lapsed Customers" },
          { id: "seasonal-shoppers", name: "Seasonal Shoppers" },
          { id: "frequent-buyers", name: "Frequent Buyers" },
        ];

        const predefinedSegment = predefinedSegments.find(
          (s) => s.id === segmentId,
        );
        if (predefinedSegment) {
          const { data: existingSegment } = await supabase
            .from("crm_segments")
            .select("id")
            .eq("name", predefinedSegment.name)
            .eq("tenant_id", tenant.id)
            .single();

          if (existingSegment) {
            actualSegmentId = existingSegment.id;
          }
        }
      }

      const { error } = await supabase
        .from("customer_segments")
        .delete()
        .eq("customer_id", customerId)
        .eq("segment_id", actualSegmentId);

      if (error) {
        console.error("❌ Error removing customer from segment:", error);
        throw error;
      }
      // Refresh the customer lists
      const segmentCustomersData = await fetchSegmentCustomers();
      setCustomers(segmentCustomersData);

      // Notify parent component about the change
      if (onAssignmentChange) {
        onAssignmentChange();
      }
    } catch (error) {
      console.error("❌ Error removing customer from segment:", error);
    } finally {
      setUnassigningCustomer(null);
    }
  };

  useEffect(() => {
    if (open && segmentId && tenant) {
      setLoading(true);
      fetchSegmentCustomers().then((data) => {
        setCustomers(data);
        setLoading(false);
      });
    }
  }, [open, segmentId, user, tenant]);

  const getCustomerInitials = (customer: SegmentCustomer | any) => {
    const first = customer.first_name?.[0] || "";
    const last = customer.last_name?.[0] || "";
    return first + last || customer.email[0].toUpperCase();
  };

  const getCustomerName = (customer: SegmentCustomer | any) => {
    const name =
      `${customer.first_name || ""} ${customer.last_name || ""}`.trim();
    return name || customer.email;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* X Close Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute top-4 right-4 h-6 w-6 rounded-full z-50"
        >
          <X className="h-4 w-4" />
        </Button>

        <DialogHeader>
          <DialogTitle className="flex items-center justify-between pr-8">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <span>Manage Customers in "{segmentName}"</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  navigate("/crm/segments/beta");
                }}
                className="gap-1.5"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Advanced Rules
              </Button>
              <Badge variant="secondary">
                {getFilteredSegmentCustomers().length} assigned
              </Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col overflow-hidden space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Customer Management */}
          {loading || customersLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-hidden min-h-0">
              {/* Assigned Customers */}
              <div className="flex flex-col min-h-0">
                <h5 className="font-medium text-sm mb-2 flex items-center gap-1">
                  Customers in Segment
                  <Badge variant="secondary" className="text-xs">
                    {getFilteredSegmentCustomers().length}
                  </Badge>
                </h5>
                <ScrollArea className="flex-1 border rounded-md p-2 h-[400px]">
                  <div className="space-y-2">
                    {getFilteredSegmentCustomers().map((customer) => (
                      <Card key={customer.id} className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                {getCustomerInitials(customer)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm">
                                {getCustomerName(customer)}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {customer.email}
                              </p>
                              {customer.phone && (
                                <p className="text-xs text-muted-foreground">
                                  {customer.phone}
                                </p>
                              )}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleUnassignCustomer(customer.id)}
                            disabled={unassigningCustomer === customer.id}
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            title="Remove from segment"
                          >
                            {unassigningCustomer === customer.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <X className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </Card>
                    ))}
                    {getFilteredSegmentCustomers().length === 0 && (
                      <div className="text-center py-8">
                        <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-sm text-muted-foreground">
                          {searchTerm
                            ? "No customers found"
                            : "No customers in this segment"}
                        </p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>

              {/* Available Customers */}
              <div className="flex flex-col min-h-0">
                <h5 className="font-medium text-sm mb-2 flex items-center gap-1">
                  Available to Add
                  <Badge variant="outline" className="text-xs">
                    {getFilteredUnassignedCustomers().length}
                  </Badge>
                </h5>
                <ScrollArea className="flex-1 border rounded-md p-2 h-[400px]">
                  <div className="space-y-2">
                    {getFilteredUnassignedCustomers().map((customer) => (
                      <Card key={customer.id} className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                {getCustomerInitials(customer)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm">
                                {getCustomerName(customer)}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {customer.email}
                              </p>
                              {customer.phone && (
                                <p className="text-xs text-muted-foreground">
                                  {customer.phone}
                                </p>
                              )}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleAssignCustomer(customer.id)}
                            disabled={assigningCustomer === customer.id}
                            className="h-7 w-7 p-0"
                            title="Add to segment"
                          >
                            {assigningCustomer === customer.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <UserPlus className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </Card>
                    ))}
                    {getFilteredUnassignedCustomers().length === 0 && (
                      <div className="text-center py-8">
                        <UserPlus className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-sm text-muted-foreground">
                          {searchTerm
                            ? "No available customers found"
                            : "All customers are assigned"}
                        </p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
