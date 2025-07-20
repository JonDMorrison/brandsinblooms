
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SegmentSelectorButton } from "../SegmentSelectorButton";
import { SegmentChip } from "../SegmentChip";
import { useSegmentSelector } from "@/hooks/useSegmentSelector";
import { SegmentSelector } from "../campaigns/SegmentSelector";

export const CampaignSegmentExample = () => {
  const [campaignName, setCampaignName] = useState("");
  const [campaignContent, setCampaignContent] = useState("");
  
  const {
    isOpen,
    selectedSegments,
    selectedSegmentIds,
    openModal,
    closeModal,
    handleSegmentsSelected,
    clearSegments,
    hasSegments
  } = useSegmentSelector({
    onSegmentsSelected: (segments) => {
      console.log("Selected segments for campaign:", segments);
    }
  });

  const handleCreateCampaign = () => {
    const campaignData = {
      name: campaignName,
      content: campaignContent,
      targetSegments: selectedSegmentIds
    };
    
    console.log("Creating campaign with data:", campaignData);
    // Here you would typically save to database
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Create New Campaign</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label htmlFor="campaign-name">Campaign Name</Label>
          <Input
            id="campaign-name"
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            placeholder="e.g., Spring Garden Sale"
          />
        </div>

        <div>
          <Label htmlFor="campaign-content">Campaign Content</Label>
          <Textarea
            id="campaign-content"
            value={campaignContent}
            onChange={(e) => setCampaignContent(e.target.value)}
            placeholder="Write your campaign message..."
            rows={4}
          />
        </div>

        <div>
          <Label className="block mb-3">Target Segments</Label>
          <div className="space-y-3">
            <SegmentSelectorButton 
              selectedSegments={selectedSegments}
              onOpenModal={openModal}
            />
            
            {hasSegments && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Selected Segments:</span>
                  <Button variant="ghost" size="sm" onClick={clearSegments}>
                    Clear All
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedSegments.map((segment) => (
                    <SegmentChip
                      key={segment.id}
                      segment={segment}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="pt-4 border-t">
          <Button 
            onClick={handleCreateCampaign}
            disabled={!campaignName || !hasSegments}
            className="w-full"
          >
            Create Campaign
          </Button>
        </div>

        <SegmentSelector
          isOpen={isOpen}
          onClose={closeModal}
          onSegmentsSelected={handleSegmentsSelected}
          selectedSegments={selectedSegments}
        />
      </CardContent>
    </Card>
  );
};
