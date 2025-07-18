
import { useState } from "react";
import { SegmentSelectorModal } from "../SegmentSelectorModal";
import { SegmentSelectorButton } from "../SegmentSelectorButton";
import { useSegmentSelector } from "@/hooks/useSegmentSelector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const SegmentSelectorExample = () => {
  const {
    isOpen,
    selectedSegments,
    selectedSegmentIds,
    openModal,
    closeModal,
    handleSegmentsSelected,
    clearSegments
  } = useSegmentSelector({
    onSegmentsSelected: (segments) => {
      console.log("Selected segments:", segments);
    }
  });

  const removeSegment = (segmentId: string) => {
    const updatedSegments = selectedSegments.filter(s => s.id !== segmentId);
    handleSegmentsSelected(updatedSegments);
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Campaign Targeting</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            Target Audience
          </label>
          <SegmentSelectorButton
            selectedSegments={selectedSegments}
            onOpenModal={openModal}
            onRemoveSegment={removeSegment}
            placeholder="Choose your target segments"
          />
        </div>

        {selectedSegments.length > 0 && (
          <div className="text-sm text-gray-600">
            <p>
              Targeting {selectedSegments.length} segment{selectedSegments.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}

        <SegmentSelectorModal
          open={isOpen}
          onClose={closeModal}
          onSegmentsSelected={handleSegmentsSelected}
          selectedSegmentIds={selectedSegmentIds}
          title="Select Target Segments"
          description="Choose customer segments for your campaign targeting"
        />
      </CardContent>
    </Card>
  );
};
