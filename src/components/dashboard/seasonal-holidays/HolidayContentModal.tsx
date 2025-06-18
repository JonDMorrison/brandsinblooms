
import * as React from "react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PremiumButton } from "@/components/ui/premium-button";
import { Button } from "@/components/ui/button";
import { HeadlineLarge, BodyMedium, CaptionMedium } from "@/components/ui/typography";
import { Sparkles, Copy, Edit3, Check, Calendar, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Holiday {
  id: string;
  holiday_name: string;
  category: string;
  holiday_date: string;
  description: string;
  garden_relevance: string;
}

interface HolidayContentModalProps {
  holiday: Holiday | null;
  isOpen: boolean;
  onClose: () => void;
  onGenerateContent: (holidayId: string) => Promise<any>;
}

export const HolidayContentModal = ({
  holiday,
  isOpen,
  onClose,
  onGenerateContent
}: HolidayContentModalProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<any>(null);
  const [editingContent, setEditingContent] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);

  const handleGenerateContent = async () => {
    if (!holiday) return;

    setIsGenerating(true);
    try {
      const result = await onGenerateContent(holiday.id);
      setGeneratedContent(result);
      toast.success(`🎉 Generated content for ${holiday.holiday_name}!`);
    } catch (error) {
      console.error('Failed to generate content:', error);
      toast.error(`Failed to generate content for ${holiday.holiday_name}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyContent = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success("Content copied to clipboard!");
  };

  const handleEditContent = (content: string) => {
    setEditingContent(content);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    // Here you would typically save the edited content
    setIsEditing(false);
    toast.success("Content updated!");
  };

  const handleApproveContent = () => {
    // Here you would typically mark the content as approved
    toast.success("Content approved and ready to publish!");
    onClose();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  if (!holiday) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-green-600" />
            <span>{holiday.holiday_name}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Holiday Information */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <CaptionMedium className="font-medium text-gray-600 mb-1">
                  Date
                </CaptionMedium>
                <BodyMedium className="text-gray-800">
                  {formatDate(holiday.holiday_date)}
                </BodyMedium>
              </div>
              <div>
                <CaptionMedium className="font-medium text-gray-600 mb-1">
                  Category
                </CaptionMedium>
                <BodyMedium className="text-gray-800">
                  {holiday.category}
                </BodyMedium>
              </div>
            </div>
            <div className="mt-4">
              <CaptionMedium className="font-medium text-gray-600 mb-1">
                Description
              </CaptionMedium>
              <BodyMedium className="text-gray-700">
                {holiday.description}
              </BodyMedium>
            </div>
            <div className="mt-4">
              <CaptionMedium className="font-medium text-gray-600 mb-1">
                Marketing Opportunity
              </CaptionMedium>
              <BodyMedium className="text-gray-700">
                {holiday.garden_relevance}
              </BodyMedium>
            </div>
          </div>

          {/* Content Generation Section */}
          {!generatedContent ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-green-600" />
              </div>
              <HeadlineLarge className="text-gray-800 mb-2">
                Generate Marketing Content
              </HeadlineLarge>
              <BodyMedium className="text-gray-600 mb-6 max-w-md mx-auto">
                Create social media posts, newsletters, and marketing content specifically for {holiday.holiday_name}
              </BodyMedium>
              <PremiumButton
                variant="primary"
                size="lg"
                leadingIcon="sparkles"
                premium={true}
                disabled={isGenerating}
                onClick={handleGenerateContent}
                className="px-8 py-3"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating Content...
                  </>
                ) : (
                  'Generate Content'
                )}
              </PremiumButton>
            </div>
          ) : (
            <div className="space-y-4">
              <HeadlineLarge className="text-gray-800">
                Generated Content
              </HeadlineLarge>
              
              {/* Sample content display - would be dynamic based on generated content */}
              <div className="space-y-4">
                {['Social Media Post', 'Newsletter Content', 'Email Subject Line'].map((contentType, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <CaptionMedium className="font-medium text-gray-600">
                        {contentType}
                      </CaptionMedium>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyContent(`Sample ${contentType.toLowerCase()} content`)}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditContent(`Sample ${contentType.toLowerCase()} content`)}
                        >
                          <Edit3 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    {isEditing ? (
                      <div className="space-y-2">
                        <textarea
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          className="w-full p-3 border border-gray-300 rounded-lg resize-none"
                          rows={4}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleSaveEdit}>
                            Save Changes
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <BodyMedium className="text-gray-700 bg-gray-50 p-3 rounded">
                        Sample {contentType.toLowerCase()} content for {holiday.holiday_name}. This would be the actual generated content from the AI.
                      </BodyMedium>
                    )}
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <Button variant="outline" onClick={onClose}>
                  Close
                </Button>
                <Button onClick={handleApproveContent} className="bg-green-600 hover:bg-green-700">
                  <Check className="w-4 h-4 mr-2" />
                  Approve & Publish
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
