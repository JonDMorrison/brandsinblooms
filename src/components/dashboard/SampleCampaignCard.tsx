
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Eye, ArrowRight } from "lucide-react";
import { useState } from "react";
import { SampleContentPreview } from "./SampleContentPreview";

interface SampleCampaignCardProps {
  onCreateRealCampaign: () => void;
}

export const SampleCampaignCard = ({ onCreateRealCampaign }: SampleCampaignCardProps) => {
  const [showPreview, setShowPreview] = useState(false);

  const sampleContent = {
    theme: "Spring Plant Sale Extravaganza",
    description: "Promote your seasonal plant collection with fresh, engaging content that drives sales and builds community.",
    contentPieces: [
      {
        type: "Instagram Post",
        content: "Spring has sprung and our greenhouse is bursting with fresh possibilities! 🌱 From vibrant annuals to hardy perennials, we've got everything you need to transform your outdoor space into a blooming paradise. Visit us this weekend and let our plant experts help you choose the perfect additions to your garden story.",
        hashtags: "#SpringPlants #GardenLife #LocalGardening"
      },
      {
        type: "Facebook Post", 
        content: "The wait is over – our Spring Plant Sale is here! This weekend only, enjoy 20% off all flowering plants and get expert advice on creating stunning garden displays. Whether you're a seasoned gardener or just starting your green journey, our team is here to help you succeed. What will you plant this spring?",
        hashtags: "#SpringSale #CommunityGarden #GardenCenter"
      },
      {
        type: "Email Newsletter",
        content: "Dear Gardening Friends, Spring's arrival means it's time to bring your garden dreams to life! Our fresh plant inventory has arrived, featuring beautiful selections perfect for your spring planting. Join us this weekend for our Spring Plant Sale and discover how the right plants can transform any space into your personal oasis.",
        hashtags: "#Newsletter #SpringGardening #PlantSale"
      }
    ]
  };

  return (
    <>
      <Card className="border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-full">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">See What You'll Get</CardTitle>
                <p className="text-sm text-gray-600">Sample campaign with generated content</p>
              </div>
            </div>
            <Badge variant="outline" className="bg-white/80">
              Preview
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-gray-100 backdrop-blur p-4 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-2">{sampleContent.theme}</h3>
            <p className="text-sm text-gray-700 mb-3">{sampleContent.description}</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              {sampleContent.contentPieces.map((piece, index) => (
                <div key={index} className="bg-gray-50 p-3 rounded border border-gray-200 text-center">
                  <span className="text-xs font-medium text-primary">{piece.type}</span>
                  <p className="text-xs text-gray-600 mt-1 line-clamp-2">{piece.content}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowPreview(true)}
              className="flex-1"
            >
              <Eye className="w-4 h-4 mr-2" />
              Preview Content
            </Button>
            <Button
              onClick={onCreateRealCampaign}
              className="flex-1 bg-primary hover:bg-primary-600 text-white"
            >
              Create My Campaign
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <SampleContentPreview
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        content={sampleContent}
        onCreateRealCampaign={onCreateRealCampaign}
      />
    </>
  );
};
