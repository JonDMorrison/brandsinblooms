
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Trash2, Calendar, Archive } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Campaign {
  id: number;
  week_number: number;
  start_date: string;
  title: string;
  theme?: string;
  description?: string;
}

interface BulkOperationsBarProps {
  selectedCampaigns: Campaign[];
  onClearSelection: () => void;
  onOperationComplete: () => void;
}

export const BulkOperationsBar = ({ 
  selectedCampaigns, 
  onClearSelection, 
  onOperationComplete 
}: BulkOperationsBarProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleDuplicate = async () => {
    setIsLoading(true);
    try {
      const duplicates = selectedCampaigns.map(campaign => ({
        title: `${campaign.title} (Copy)`,
        theme: campaign.theme,
        description: campaign.description,
        week_number: campaign.week_number + 52, // Next year
        start_date: new Date(new Date(campaign.start_date).getTime() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      }));

      const { error } = await supabase
        .from('campaigns')
        .insert(duplicates);

      if (error) throw error;

      toast.success(`Duplicated ${selectedCampaigns.length} campaigns for next year`);
      onOperationComplete();
      onClearSelection();
    } catch (error) {
      console.error('Error duplicating campaigns:', error);
      toast.error('Failed to duplicate campaigns');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete ${selectedCampaigns.length} campaigns? This cannot be undone.`)) {
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .in('id', selectedCampaigns.map(c => c.id));

      if (error) throw error;

      toast.success(`Deleted ${selectedCampaigns.length} campaigns`);
      onOperationComplete();
      onClearSelection();
    } catch (error) {
      console.error('Error deleting campaigns:', error);
      toast.error('Failed to delete campaigns');
    } finally {
      setIsLoading(false);
    }
  };

  const handleShift = async () => {
    const weeks = prompt('Shift campaigns by how many weeks? (use negative numbers to move backward)');
    if (!weeks) return;

    const shiftAmount = parseInt(weeks);
    if (isNaN(shiftAmount)) {
      toast.error('Please enter a valid number');
      return;
    }

    setIsLoading(true);
    try {
      const updates = selectedCampaigns.map(campaign => {
        const newDate = new Date(campaign.start_date);
        newDate.setDate(newDate.getDate() + (shiftAmount * 7));
        
        return {
          id: campaign.id,
          week_number: campaign.week_number + shiftAmount,
          start_date: newDate.toISOString().split('T')[0]
        };
      });

      for (const update of updates) {
        const { error } = await supabase
          .from('campaigns')
          .update({ 
            week_number: update.week_number, 
            start_date: update.start_date 
          })
          .eq('id', update.id);

        if (error) throw error;
      }

      toast.success(`Shifted ${selectedCampaigns.length} campaigns by ${shiftAmount} weeks`);
      onOperationComplete();
      onClearSelection();
    } catch (error) {
      console.error('Error shifting campaigns:', error);
      toast.error('Failed to shift campaigns');
    } finally {
      setIsLoading(false);
    }
  };

  if (selectedCampaigns.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {selectedCampaigns.length} selected
          </Badge>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleDuplicate}
            disabled={isLoading}
          >
            <Copy className="w-4 h-4 mr-2" />
            Duplicate
          </Button>
          
          <Button
            size="sm"
            variant="outline"
            onClick={handleShift}
            disabled={isLoading}
          >
            <Calendar className="w-4 h-4 mr-2" />
            Shift Dates
          </Button>
          
          <Button
            size="sm"
            variant="outline"
            onClick={handleDelete}
            disabled={isLoading}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
        </div>
        
        <Button
          size="sm"
          variant="ghost"
          onClick={onClearSelection}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
};
