
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ContentApprovalProps {
  task: any;
  onTaskUpdate?: () => void;
  onClose: () => void;
}

export const ContentApproval = ({ task, onTaskUpdate, onClose }: ContentApprovalProps) => {
  const [isApproving, setIsApproving] = useState(false);

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      console.log('Approving task with status change to: scheduled');
      
      const { error } = await supabase
        .from('content_tasks')
        .update({ status: 'scheduled' })
        .eq('id', task.id);

      if (error) {
        console.error('Error approving task:', error);
        toast({
          title: "Error",
          description: `Failed to approve content: ${error.message}`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Content Approved! ✅",
          description: "Content has been moved to Scheduled status.",
        });
        if (onTaskUpdate) onTaskUpdate();
        onClose();
      }
    } catch (error) {
      console.error('Error approving task:', error);
      toast({
        title: "Error",
        description: "Failed to approve content. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsApproving(false);
    }
  };

  // Show approval button for content that's ready for review
  if (task?.status !== 'scheduled' && task?.ai_output) {
    return (
      <Card className="border-orange-200 bg-orange-50">
        <CardContent className="p-4">
          <div className="text-center">
            <h3 className="font-semibold text-orange-800 mb-2">Ready for Approval</h3>
            <p className="text-sm text-orange-700 mb-4">
              Review the content below and approve it to move to Scheduled status.
            </p>
            <Button 
              onClick={handleApprove}
              disabled={isApproving}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              {isApproving ? "Approving..." : "Approve & Move to Scheduled"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show status for already approved content
  if (task?.status === 'scheduled') {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="p-4">
          <div className="text-center">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-600" />
            <h3 className="font-semibold text-green-800 mb-1">Content Approved</h3>
            <p className="text-sm text-green-700">
              This content is scheduled and ready for posting.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
};
