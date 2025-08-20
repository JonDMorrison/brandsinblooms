import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Edit2, FileText, Users, TrendingUp, Clock } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { ThemeDisplay } from "./ThemeDisplay";
import { ThemeEditor } from "./ThemeEditor";
import { CampaignContentSection } from "./CampaignContentSection";
import { supabase } from "@/integrations/supabase/client";
import { dateToWeekNumber } from "@/utils/dateUtils";
// Removed sonner import - using global toast replacement

interface Campaign {
  id: number;
  week_number: number;
  start_date: string;
  title: string;
  theme?: string;
  description?: string;
}

interface CampaignDetailsModalProps {
  campaign: Campaign | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (campaign: Campaign) => void;
}

export const CampaignDetailsModal = ({ campaign, isOpen, onClose, onUpdate }: CampaignDetailsModalProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [contentUpdateKey, setContentUpdateKey] = useState(0);

  if (!campaign) return null;

  // Calculate the actual week number from the campaign's start_date
  const actualWeekNumber = dateToWeekNumber(new Date(campaign.start_date));

  // Utility function to sanitize theme text
  const sanitizeTheme = (theme: string) => {
    return theme.replace(/\s*-\s*Week\s+\d+/i, '').trim();
  };

  const handleThemeUpdate = async (newTheme: string, newDescription?: string) => {
    try {
      const sanitizedTheme = sanitizeTheme(newTheme);
      
      const { data, error } = await supabase
        .from('campaigns')
        .update({ 
          theme: newTheme, 
          description: newDescription,
          title: sanitizedTheme // Update title to match sanitized theme
        })
        .eq('id', campaign.id.toString())
        .select()
        .single();

      if (error) throw error;

      const updatedCampaign = {
        ...campaign,
        theme: newTheme,
        description: newDescription,
        title: sanitizedTheme
      };

      onUpdate(updatedCampaign);
      setIsEditing(false);
      toast.success('Campaign theme updated successfully!');
    } catch (error) {
      console.error('Error updating campaign theme:', error);
      toast.error('Failed to update campaign theme');
    }
  };

  const handleContentGenerated = () => {
    toast.success('Content pack generated! Use the review section below to approve your content.');
    setContentUpdateKey(prev => prev + 1);
  };

  const handleContentUpdate = () => {
    setContentUpdateKey(prev => prev + 1);
  };

  const getStatusBadge = () => {
    const today = new Date();
    const startDate = new Date(campaign.start_date);
    const weekEnd = new Date(startDate);
    weekEnd.setDate(startDate.getDate() + 6);

    if (today < startDate) {
      return <Badge className="bg-blue-100 text-blue-800">Upcoming</Badge>;
    } else if (today >= startDate && today <= weekEnd) {
      return <Badge className="bg-green-100 text-green-800">Active</Badge>;
    } else {
      return <Badge className="bg-gray-100 text-gray-800">Completed</Badge>;
    }
  };

  const hasTheme = campaign.theme && campaign.theme.trim() !== "";
  const hasDescription = campaign.description && campaign.description.trim() !== "";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader className="space-y-4 pb-6 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <DialogTitle className="text-2xl font-bold text-gray-900 leading-tight">
                {campaign.theme ? sanitizeTheme(campaign.theme) : campaign.title}
              </DialogTitle>
              <div className="flex items-center gap-4">
                {getStatusBadge()}
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar className="w-4 h-4" />
                  Week {actualWeekNumber}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="w-4 h-4" />
                  {format(new Date(campaign.start_date), 'MMM d, yyyy')}
                </div>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-6">
          {/* Campaign Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <Calendar className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-blue-900">Week Range</p>
                <p className="text-xs text-blue-700">
                  {format(new Date(campaign.start_date), 'MMM d')} - {format(new Date(new Date(campaign.start_date).getTime() + 6 * 24 * 60 * 60 * 1000), 'MMM d')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-900">Content Status</p>
                <p className="text-xs text-green-700">Ready for planning</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-lg border border-purple-200">
              <Users className="w-5 h-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-purple-900">Target Reach</p>
                <p className="text-xs text-purple-700">Multi-platform</p>
              </div>
            </div>
          </div>

          {/* Theme Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Campaign Theme & Content
              </h3>
              {!isEditing && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit Theme
                </Button>
              )}
            </div>

            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              {isEditing ? (
                <ThemeEditor
                  campaignId={campaign.id.toString()}
                  currentTheme={campaign.theme || ""}
                  currentDescription={campaign.description || ""}
                  weekNumber={actualWeekNumber}
                  onSave={handleThemeUpdate}
                  onCancel={() => setIsEditing(false)}
                />
              ) : (
                <ThemeDisplay
                  campaignId={campaign.id.toString()}
                  currentTheme={campaign.theme || ""}
                  currentDescription={campaign.description}
                  weekNumber={actualWeekNumber}
                  onEdit={() => setIsEditing(true)}
                  onContentGenerated={handleContentGenerated}
                />
              )}
            </div>
          </div>

          {/* Generated Content Section */}
          <div className="space-y-4">
            <CampaignContentSection
              key={contentUpdateKey}
              campaignId={campaign.id.toString()}
              campaignTitle={campaign.title}
              hasTheme={hasTheme}
              hasDescription={hasDescription}
              onContentUpdate={handleContentUpdate}
            />
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
};
