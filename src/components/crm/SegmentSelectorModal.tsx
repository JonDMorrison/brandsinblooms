import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { X, Plus, Users, Sparkles, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CustomSegmentBuilder } from "./CustomSegmentBuilder";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
    conditions: { loyalty_program: true }
  },
  {
    id: "new-customers",
    name: "New Customers",
    description: "First purchase in last 30 days",
    suggested: true,
    conditions: { first_purchase_days: 30 }
  },
  {
    id: "at-risk-customers",
    name: "At-Risk Customers",
    description: "No purchase in 6+ months",
    conditions: { last_purchase_days: 180 }
  },
  {
    id: "email-engagers",
    name: "Email Engagers",
    description: "Clicked on last 3 campaigns",
    suggested: true,
    conditions: { email_engagement: "high" }
  },
  {
    id: "frequent-buyers",
    name: "Frequent Buyers",
    description: "3+ purchases in last 60 days",
    conditions: { purchase_frequency: { count: 3, days: 60 } }
  },
  {
    id: "houseplant-shoppers",
    name: "Houseplant Shoppers",
    description: "Bought houseplants recently",
    conditions: { product_categories: ["houseplants"] }
  },
  {
    id: "vegetable-gardeners",
    name: "Vegetable Gardeners",
    description: "Bought edibles or seeds",
    conditions: { product_categories: ["vegetables", "seeds", "edibles"] }
  },
  {
    id: "holiday-decorators",
    name: "Holiday Decorators",
    description: "Bought holiday-themed items",
    conditions: { product_categories: ["holiday", "decorations"] }
  },
  {
    id: "workshop-attendees",
    name: "Workshop Attendees",
    description: "Registered for a class/workshop",
    conditions: { workshop_attendance: true }
  },
  {
    id: "big-spenders",
    name: "Big Spenders",
    description: "Average cart value > $200",
    suggested: true,
    conditions: { avg_cart_value: { operator: ">", value: 200 } }
  }
];

export const SegmentSelectorModal = ({
  open,
  onClose,
  onSegmentsSelected,
  selectedSegmentIds = [],
  title = "Select Target Segments",
  description = "Choose customer segments for your campaign targeting"
}: SegmentSelectorModalProps) => {
  const [selectedPredefined, setSelectedPredefined] = useState<string[]>(selectedSegmentIds);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customSegments, setCustomSegments] = useState<any[]>([]);
  const [existingSegments, setExistingSegments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchExistingSegments();
    }
  }, [open]);

  const fetchExistingSegments = async () => {
    try {
      const { data, error } = await supabase
        .from("crm_segments")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setExistingSegments(data || []);
    } catch (error) {
      console.error("Error fetching segments:", error);
    }
  };

  const handlePredefinedToggle = (segmentId: string) => {
    setSelectedPredefined(prev => 
      prev.includes(segmentId) 
        ? prev.filter(id => id !== segmentId)
        : [...prev, segmentId]
    );
  };

  const createCustomSegment = async (segmentData: { name: string; filters: any[] }) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("custom_segments")
        .insert({
          name: segmentData.name,
          filters: segmentData.filters,
          tenant_id: "temp", // Will be set by RLS
          user_id: "temp" // Will be set by RLS
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Success", 
        description: "Custom segment created successfully"
      });

      // Add to existing segments and select it
      setCustomSegments(prev => [data, ...prev]);
      setSelectedPredefined(prev => [...prev, data.id]);
      setShowCustomForm(false);
    } catch (error) {
      console.error("Error creating segment:", error);
      toast({
        title: "Error",
        description: "Failed to create custom segment",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    const selectedSegments = [
      ...predefinedSegments.filter(seg => selectedPredefined.includes(seg.id)),
      ...existingSegments.filter(seg => selectedPredefined.includes(seg.id))
    ];
    
    onSegmentsSelected(selectedSegments);
    onClose();
  };

  const handleClose = () => {
    setShowCustomForm(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-brand-teal" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Predefined Segments */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Predefined Segments</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {predefinedSegments.map((segment) => (
                <TooltipProvider key={segment.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                        <Checkbox
                          id={segment.id}
                          checked={selectedPredefined.includes(segment.id)}
                          onCheckedChange={() => handlePredefinedToggle(segment.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Label 
                              htmlFor={segment.id} 
                              className="text-sm font-medium cursor-pointer"
                            >
                              {segment.name}
                            </Label>
                            {segment.suggested && (
                              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 text-xs">
                                <Sparkles className="h-3 w-3 mr-1" />
                                Suggested
                              </Badge>
                            )}
                            <Info className="h-4 w-4 text-gray-400" />
                          </div>
                          <p className="text-xs text-gray-600 mt-1 truncate">
                            {segment.description}
                          </p>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">{segment.description}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          </div>

          {/* Existing Custom Segments */}
          {existingSegments.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Your Custom Segments</h3>
              <div className="space-y-2">
                {existingSegments.map((segment) => (
                  <div key={segment.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                    <Checkbox
                      id={segment.id}
                      checked={selectedPredefined.includes(segment.id)}
                      onCheckedChange={() => handlePredefinedToggle(segment.id)}
                    />
                    <div className="flex-1">
                      <Label htmlFor={segment.id} className="text-sm font-medium cursor-pointer">
                        {segment.name}
                      </Label>
                      {segment.description && (
                        <p className="text-xs text-gray-600 mt-1">{segment.description}</p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {segment.customer_count || 0} customers
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Custom Segment Creation */}
          <div>
            {!showCustomForm ? (
              <Button
                variant="outline"
                onClick={() => setShowCustomForm(true)}
                className="w-full border-dashed border-2 hover:border-brand-teal hover:bg-brand-teal/5"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Custom Segment
              </Button>
            ) : (
              <div className="border rounded-lg p-4 bg-gray-50">
                <CustomSegmentBuilder
                  onSave={createCustomSegment}
                  onCancel={() => setShowCustomForm(false)}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-4 border-t">
          <p className="text-sm text-gray-600">
            {selectedPredefined.length} segment{selectedPredefined.length !== 1 ? 's' : ''} selected
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirm}
              disabled={selectedPredefined.length === 0}
              className="bg-brand-teal hover:bg-brand-teal/90"
            >
              Confirm Selection
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
