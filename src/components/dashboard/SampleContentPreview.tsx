
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Instagram, Facebook, Mail } from "lucide-react";

interface SampleContentPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  content: {
    theme: string;
    description: string;
    contentPieces: Array<{
      type: string;
      content: string;
      hashtags: string;
    }>;
  };
  onCreateRealCampaign: () => void;
}

export const SampleContentPreview = ({ 
  isOpen, 
  onClose, 
  content, 
  onCreateRealCampaign 
}: SampleContentPreviewProps) => {
  
  const getIcon = (type: string) => {
    if (type.includes("Instagram")) return Instagram;
    if (type.includes("Facebook")) return Facebook;
    if (type.includes("Email")) return Mail;
    return Mail;
  };

  const handleCreateCampaign = () => {
    onClose();
    onCreateRealCampaign();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Sample Campaign Preview</span>
            <Badge variant="outline">Demo Content</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Campaign Overview */}
          <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="p-4">
              <h3 className="text-lg font-semibold mb-2">{content.theme}</h3>
              <p className="text-gray-700 text-sm">{content.description}</p>
            </CardContent>
          </Card>

          {/* Content Pieces */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {content.contentPieces.map((piece, index) => {
              const IconComponent = getIcon(piece.type);
              return (
                <Card key={index} className="border-l-4 border-l-primary">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <IconComponent className="w-4 h-4 text-primary" />
                      <span className="font-medium text-sm">{piece.type}</span>
                      <Badge variant="secondary" className="text-xs">Ready to use</Badge>
                    </div>
                    <p className="text-sm text-gray-700 mb-3 leading-relaxed">
                      {piece.content}
                    </p>
                    <div className="text-xs text-primary font-medium">
                      {piece.hashtags}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Call to Action */}
          <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200">
            <CardContent className="p-6 text-center">
              <h3 className="text-lg font-semibold mb-2 text-green-800">
                This is what you'll get for every campaign!
              </h3>
              <p className="text-green-700 mb-4 text-sm">
                Each campaign generates 5+ personalized content pieces tailored to your garden center, 
                including social media posts, emails, newsletters, and video scripts.
              </p>
              <Button 
                onClick={handleCreateCampaign}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2"
              >
                Create My First Campaign
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};
