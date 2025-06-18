
import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HeadlineLarge, BodyMedium, CaptionMedium } from "@/components/ui/typography";
import { Calendar } from "lucide-react";

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
}

export const HolidayContentModal = ({
  holiday,
  isOpen,
  onClose
}: HolidayContentModalProps) => {
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
      <DialogContent className="max-w-2xl">
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

          {/* Action Buttons */}
          <div className="flex justify-end pt-4 border-t border-gray-200">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
