import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Users, Plus, Sparkles } from "lucide-react";
import { SegmentSelectorModal } from "./SegmentSelectorModal";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SegmentOnboardingStepProps {
  onComplete: (selectedSegments: any[]) => void;
  onSkip?: () => void;
}

const SUGGESTED_SEGMENTS = [
  {
    id: "loyalty-members",
    name: "Loyalty Members",
    description: "Customers in your loyalty program",
    suggested: true
  },
  {
    id: "new-customers", 
    name: "New Customers",
    description: "First purchase in last 30 days",
    suggested: true
  },
  {
    id: "email-engagers",
    name: "Email Engagers", 
    description: "Clicked on recent campaigns",
    suggested: true
  },
  {
    id: "big-spenders",
    name: "Big Spenders",
    description: "Average cart value > $200",
    suggested: true
  }
];

export const SegmentOnboardingStep = ({ onComplete, onSkip }: SegmentOnboardingStepProps) => {
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSegmentToggle = (segmentId: string) => {
    setSelectedSegments(prev => 
      prev.includes(segmentId)
        ? prev.filter(id => id !== segmentId)
        : [...prev, segmentId]
    );
  };

  const handleModalSegmentsSelected = (segments: any[]) => {
    const segmentIds = segments.map(s => s.id);
    setSelectedSegments(prev => [...new Set([...prev, ...segmentIds])]);
  };

  const savePreferences = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("user_segment_preferences")
        .upsert({
          user_id: "temp", // Will be set by RLS
          tenant_id: "temp", // Will be set by RLS  
          preferred_segments: selectedSegments
        });

      if (error) throw error;

      toast({
        title: "Preferences Saved",
        description: "Your segment preferences have been saved"
      });

      onComplete(selectedSegments);
    } catch (error) {
      console.error("Error saving preferences:", error);
      toast({
        title: "Error",
        description: "Failed to save preferences",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto w-12 h-12 bg-brand-teal/10 rounded-lg flex items-center justify-center mb-4">
          <Users className="h-6 w-6 text-brand-teal" />
        </div>
        <CardTitle className="text-2xl">Who are your customers?</CardTitle>
        <p className="text-muted-foreground">
          Select the groups you'd like to target with your campaigns. This helps us suggest relevant content and strategies.
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Quick Select Segments */}
        <div>
          <h3 className="font-semibold mb-3">Popular Customer Segments</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {SUGGESTED_SEGMENTS.map((segment) => (
              <div
                key={segment.id}
                className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                onClick={() => handleSegmentToggle(segment.id)}
              >
                <Checkbox
                  id={segment.id}
                  checked={selectedSegments.includes(segment.id)}
                  onCheckedChange={() => handleSegmentToggle(segment.id)}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Label htmlFor={segment.id} className="text-sm font-medium cursor-pointer">
                      {segment.name}
                    </Label>
                    {segment.suggested && (
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 text-xs">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Popular
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-600">
                    {segment.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Custom Segment Option */}
        <div className="pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => setShowModal(true)}
            className="w-full border-dashed border-2 hover:border-brand-teal hover:bg-brand-teal/5"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Your Own Segment
          </Button>
        </div>

        {/* Selected Summary */}
        {selectedSegments.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium mb-2">Selected Segments ({selectedSegments.length})</h4>
            <div className="flex flex-wrap gap-2">
              {selectedSegments.map((segmentId) => {
                const segment = SUGGESTED_SEGMENTS.find(s => s.id === segmentId);
                return segment ? (
                  <Badge key={segmentId} variant="secondary">
                    {segment.name}
                  </Badge>
                ) : null;
              })}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button 
            onClick={savePreferences}
            disabled={selectedSegments.length === 0 || saving}
            className="flex-1 bg-brand-teal hover:bg-brand-teal/90"
          >
            {saving ? "Saving..." : `Continue with ${selectedSegments.length} segment${selectedSegments.length !== 1 ? 's' : ''}`}
          </Button>
          {onSkip && (
            <Button variant="outline" onClick={onSkip}>
              Skip for now
            </Button>
          )}
        </div>
      </CardContent>

      <SegmentSelectorModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSegmentsSelected={handleModalSegmentsSelected}
        selectedSegmentIds={selectedSegments}
        title="Choose Target Segments"
        description="Select from our predefined segments or create your own custom segments"
      />
    </Card>
  );
};