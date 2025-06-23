
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Copy, Trash2, Calendar, Archive, X, CheckCircle } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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

      onOperationComplete();
      onClearSelection();
    } catch (error) {
      console.error('Error duplicating campaigns:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedCampaigns.length} campaigns? This action cannot be undone.`)) {
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .in('id', selectedCampaigns.map(c => c.id.toString()));

      if (error) throw error;

      onOperationComplete();
      onClearSelection();
    } catch (error) {
      console.error('Error deleting campaigns:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleShift = async () => {
    const weeks = prompt('Shift campaigns by how many weeks? (use negative numbers to move backward)');
    if (!weeks) return;

    const shiftAmount = parseInt(weeks);
    if (isNaN(shiftAmount)) {
      alert('Please enter a valid number');
      return;
    }

    setIsLoading(true);
    try {
      const updates = selectedCampaigns.map(campaign => {
        const newDate = new Date(campaign.start_date);
        newDate.setDate(newDate.getDate() + (shiftAmount * 7));
        
        return {
          id: campaign.id.toString(),
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

      onOperationComplete();
      onClearSelection();
    } catch (error) {
      console.error('Error shifting campaigns:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (selectedCampaigns.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in">
      <Card className="bg-white shadow-2xl border-0 rounded-2xl overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-blue-600" />
              <Badge className="bg-blue-100 text-blue-800 border-blue-200 font-semibold px-3 py-1">
                {selectedCampaigns.length} selected
              </Badge>
            </div>
            
            <div className="h-6 w-px bg-gray-200" />
            
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleDuplicate}
                disabled={isLoading}
                className="hover:bg-blue-50 border-blue-200 text-blue-700"
              >
                <Copy className="w-4 h-4 mr-2" />
                Duplicate
              </Button>
              
              <Button
                size="sm"
                variant="outline"
                onClick={handleShift}
                disabled={isLoading}
                className="hover:bg-green-50 border-green-200 text-green-700"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Shift Dates
              </Button>
              
              <Button
                size="sm"
                variant="outline"
                onClick={handleDelete}
                disabled={isLoading}
                className="hover:bg-red-50 border-red-200 text-red-700"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
            
            <div className="h-6 w-px bg-gray-200" />
            
            <Button
              size="sm"
              variant="ghost"
              onClick={onClearSelection}
              className="text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            >
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
